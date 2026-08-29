/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  FloodRiskFactorInputs,
  FloodRiskResult,
  FloodRiskLevel,
  DEFAULT_FLOOD_THRESHOLDS,
  FloodRiskThresholds,
} from './types';

/**
 * Deterministic Baseline Multi-Criteria Hydro-Topographic Flood Risk Engine.
 * 
 * Formula principles:
 * Risk = w_topo * TopoFactor + w_rain * RainFactor + w_drain * DrainFactor + w_hist * HistFactor + w_tide * TideFactor
 * 
 * NOTE: This is a scientific baseline hydrologic heuristic model, clearly separated from black-box AI/ML.
 */
export class FloodRiskEngine {
  private thresholds: FloodRiskThresholds;

  constructor(customThresholds?: Partial<FloodRiskThresholds>) {
    this.thresholds = { ...DEFAULT_FLOOD_THRESHOLDS, ...customThresholds };
  }

  /**
   * Evaluates comprehensive flood hazard risk score for a spatial coordinate.
   */
  public calculateRisk(inputs: FloodRiskFactorInputs): FloodRiskResult {
    const { terrain, rainfall, tide, historicalFloodFrequency, soilPermeabilityFactor = 0.15 } = inputs;

    // 1. Topographic Wetness & Depression Factor (0.0 to 1.0)
    // Low relative elevation (valleys/basins), flat slope (< 1.5 deg), and high flow accumulation increase risk
    let topoScore = 0.1;
    if (terrain.relativeElevationMeters < -1.0) {
      topoScore += 0.45;
    } else if (terrain.relativeElevationMeters < -0.3) {
      topoScore += 0.30;
    } else if (terrain.relativeElevationMeters < 0.2) {
      topoScore += 0.15;
    }

    // Flat areas pool water
    if (terrain.slopeDegrees < 1.0) {
      topoScore += 0.25;
    } else if (terrain.slopeDegrees < 2.5) {
      topoScore += 0.12;
    }

    // High upslope contributing flow accumulation
    if (terrain.flowAccumulation > 300) {
      topoScore += 0.20;
    } else if (terrain.flowAccumulation > 100) {
      topoScore += 0.10;
    }

    const topographicFactor = Math.min(1.0, Math.max(0.0, Number(topoScore.toFixed(2))));

    // 2. Rainfall Intensity & Accumulation Factor (0.0 to 1.0)
    // Weighted formula: 40% current intensity + 30% 30m burst + 20% 1h + 10% 3h
    // Urban drainage systems typically handle ~30-50mm/h. Over 50mm/h causes flash pooling.
    const rCurrent = Math.min(1.0, rainfall.currentRainfallMmH / 60);
    const r30m = Math.min(1.0, (rainfall.rainfall30mMm * 2) / 70);
    const r1h = Math.min(1.0, rainfall.rainfall1hMm / 80);
    const r3h = Math.min(1.0, rainfall.rainfall3hMm / 120);

    const rainfallAccumulationFactor = Math.min(
      1.0,
      Math.max(0.0, Number((rCurrent * 0.4 + r30m * 0.3 + r1h * 0.2 + r3h * 0.1).toFixed(2)))
    );

    // 3. Drainage Network & River Proximity Factor (0.0 to 1.0)
    // If distance to main drain is large, or if near a bottleneck river during heavy rain
    let drainageScore = 0.2;
    if (terrain.distanceToMainDrainMeters > 300) {
      drainageScore += 0.35; // Far from underground collector network
    } else if (terrain.distanceToMainDrainMeters > 150) {
      drainageScore += 0.20;
    }

    // Impervious concrete surface accelerates runoff
    const imperviousness = 1.0 - soilPermeabilityFactor;
    drainageScore += imperviousness * 0.25;

    const drainageProximityFactor = Math.min(1.0, Math.max(0.0, Number(drainageScore.toFixed(2))));

    // 4. Historical Occurrence Blackspot Factor (0.0 to 1.0)
    // Frequent flood spots have known physical drainage bottlenecks
    const historicalFrequencyFactor = Math.min(1.0, Number((historicalFloodFrequency / 5.0).toFixed(2)));

    // 5. Tide & River Surge Factor (0.0 to 1.0)
    let tideFactor = 0.0;
    if (tide) {
      if (tide.isHighTideAlert) {
        tideFactor = Math.min(1.0, Math.max(0.3, tide.tideLevelMeters / 1.8));
      } else {
        tideFactor = Math.min(0.3, Math.max(0.0, tide.tideLevelMeters / 3.0));
      }
    }

    // 6. Weighted Synthesis of Flood Risk Score
    // If no rain at all and no high tide, risk score stays low even in depressions
    let compositeScore =
      topographicFactor * 0.30 +
      rainfallAccumulationFactor * 0.35 +
      drainageProximityFactor * 0.15 +
      historicalFrequencyFactor * 0.15 +
      tideFactor * 0.05;

    // Amplification rule: Heavy rain in a deep depression with high historical frequency creates severe flood
    if (topographicFactor > 0.6 && rainfallAccumulationFactor > 0.4) {
      compositeScore = Math.min(1.0, compositeScore * 1.35);
    }
    // Dampening rule: Zero rainfall drops risk significantly
    if (rainfall.currentRainfallMmH === 0 && rainfall.rainfall1hMm === 0 && (!tide || !tide.isHighTideAlert)) {
      compositeScore = compositeScore * 0.25;
    }

    const finalRiskScore = Number(Math.min(1.0, Math.max(0.0, compositeScore)).toFixed(2));

    // Determine Risk Level according to configurable thresholds
    let riskLevel: FloodRiskLevel = 'LOW';
    if (finalRiskScore > this.thresholds.highMax) {
      riskLevel = 'VERY_HIGH';
    } else if (finalRiskScore > this.thresholds.moderateMax) {
      riskLevel = 'HIGH';
    } else if (finalRiskScore > this.thresholds.lowMax) {
      riskLevel = 'MODERATE';
    } else {
      riskLevel = 'LOW';
    }

    // Estimated water depth (cm)
    let estimatedDepthCm = 0;
    if (riskLevel === 'VERY_HIGH') {
      estimatedDepthCm = Math.round(30 + finalRiskScore * 35);
    } else if (riskLevel === 'HIGH') {
      estimatedDepthCm = Math.round(15 + finalRiskScore * 20);
    } else if (riskLevel === 'MODERATE') {
      estimatedDepthCm = Math.round(5 + finalRiskScore * 12);
    } else {
      estimatedDepthCm = 0;
    }

    // Primary cause identification
    let primaryCause = 'Địa hình cao ráo, hệ thống thoát nước thông suốt.';
    if (riskLevel === 'VERY_HIGH' || riskLevel === 'HIGH') {
      if (topographicFactor > 0.6 && rainfallAccumulationFactor > 0.5) {
        primaryCause = 'Vùng trũng cục bộ + Lượng mưa tập trung dồn dập vượt công suất tiêu thoát.';
      } else if (tideFactor > 0.5) {
        primaryCause = 'Triều cường dâng cao ngăn dòng chảy thoát ra sông chính.';
      } else if (historicalFrequencyFactor > 0.6) {
        primaryCause = 'Điểm nghẽn thoát nước đô thị lịch sử có nguy cơ tái diễn ngập sâu.';
      } else {
        primaryCause = 'Mưa xối xả diện rộng gây đọng nước cục bộ mép đường.';
      }
    } else if (riskLevel === 'MODERATE') {
      primaryCause = 'Khả năng xuất hiện vũng nước đọng mép vỉa hè và ngõ hẻm trũng.';
    }

    // Safety and route advice
    let safetyAdvice = 'Tuyến đường an toàn, các phương tiện lưu thông bình thường.';
    let recommendedAction = 'Tiếp tục di chuyển';

    if (riskLevel === 'VERY_HIGH') {
      safetyAdvice = `⚠️ NGUY HIỂM: Ngập sâu dự kiến ${estimatedDepthCm}cm. Xe máy và ô tô gầm thấp có nguy cơ thủy kích/chết máy.`;
      recommendedAction = 'Tìm tuyến đường tránh trên cao';
    } else if (riskLevel === 'HIGH') {
      safetyAdvice = `🌧️ Chú ý: Nước ngập khoảng ${estimatedDepthCm}cm mép đường. Khuyến cáo giảm tốc độ, đi làn giữa.`;
      recommendedAction = 'Hạn chế vào ngõ sâu';
    } else if (riskLevel === 'MODERATE') {
      safetyAdvice = `🌦️ Mặt đường ướt trơn trượt, ngập nhẹ ${estimatedDepthCm}cm đoạn trũng.`;
      recommendedAction = 'Quan sát khi qua hẻm';
    }

    return {
      riskScore: finalRiskScore,
      riskLevel,
      waterDepthCmEstimated: estimatedDepthCm,
      primaryCause,
      confidenceScore: 0.88,
      factorsBreakdown: {
        topographicFactor,
        rainfallAccumulationFactor,
        drainageProximityFactor,
        historicalFrequencyFactor,
        tideFactor,
      },
      safetyAdvice,
      recommendedAction,
    };
  }
}

export const defaultFloodRiskEngine = new FloodRiskEngine();
