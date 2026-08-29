/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  TerrainDataPoint,
  RainfallDataPoint,
  FloodPredictionTimelinePoint,
  ForecastTimeStep,
} from './types';
import { FloodRiskEngine, defaultFloodRiskEngine } from './floodRiskEngine';

/**
 * Flood Prediction Service.
 * Produces deterministic timeline simulations for Now, +30m, +60m, +120m.
 * (Clearly noted as baseline hydrodynamic forecasting simulation).
 */
export class FloodPredictionService {
  private engine: FloodRiskEngine;

  constructor(engine: FloodRiskEngine = defaultFloodRiskEngine) {
    this.engine = engine;
  }

  /**
   * Generates a 4-step future flood risk timeline for a given location and terrain.
   */
  public generateForecastTimeline(
    terrain: TerrainDataPoint,
    currentRainfall: RainfallDataPoint,
    historicalFrequency: number = 1
  ): FloodPredictionTimelinePoint[] {
    const steps: { timeStep: ForecastTimeStep; label: string; min: number; rainMultiplier: number; drainRate: number }[] = [
      { timeStep: 'now', label: 'Hiện tại (0m)', min: 0, rainMultiplier: 1.0, drainRate: 0.0 },
      { timeStep: 'plus_30m', label: '+30 Phút', min: 30, rainMultiplier: 1.25, drainRate: 0.15 },
      { timeStep: 'plus_60m', label: '+60 Phút', min: 60, rainMultiplier: 0.85, drainRate: 0.35 },
      { timeStep: 'plus_120m', label: '+120 Phút (2h)', min: 120, rainMultiplier: 0.35, drainRate: 0.70 },
    ];

    const timeline: FloodPredictionTimelinePoint[] = [];
    let prevScore = 0;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const futureRainIntensity = Number((currentRainfall.currentRainfallMmH * step.rainMultiplier).toFixed(1));
      const futureAccumulated1h = Number((currentRainfall.rainfall1hMm * (1 + (step.min / 60) * step.rainMultiplier)).toFixed(1));

      const simulatedRainfall: RainfallDataPoint = {
        currentRainfallMmH: futureRainIntensity,
        rainfall15mMm: Number((futureRainIntensity * 0.35).toFixed(1)),
        rainfall30mMm: Number((futureRainIntensity * 0.65).toFixed(1)),
        rainfall1hMm: futureAccumulated1h,
        rainfall3hMm: Number((currentRainfall.rainfall3hMm + futureAccumulated1h * 0.5).toFixed(1)),
        precipitationProbability: Math.min(100, Math.max(10, currentRainfall.precipitationProbability + (step.min > 0 ? 5 : 0))),
        source: 'simulation_model',
      };

      const result = this.engine.calculateRisk({
        terrain,
        rainfall: simulatedRainfall,
        historicalFloodFrequency: historicalFrequency,
      });

      // Adjusted for drainage runoff decay over 60-120 mins if rain slows down
      let adjustedScore = result.riskScore;
      if (step.min >= 60 && futureRainIntensity < currentRainfall.currentRainfallMmH) {
        adjustedScore = Math.max(0.1, adjustedScore * (1 - step.drainRate * 0.4));
      }

      let trend: 'rising' | 'stable' | 'receding' = 'stable';
      if (i > 0) {
        if (adjustedScore > prevScore + 0.05) trend = 'rising';
        else if (adjustedScore < prevScore - 0.05) trend = 'receding';
        else trend = 'stable';
      }
      prevScore = adjustedScore;

      timeline.push({
        timeStep: step.timeStep,
        label: step.label,
        relativeMinutes: step.min,
        expectedRainfallMmH: futureRainIntensity,
        expectedRainfallAccumulatedMm: futureAccumulated1h,
        predictedRiskLevel: result.riskLevel,
        predictedRiskScore: Number(adjustedScore.toFixed(2)),
        predictedDepthCm: result.waterDepthCmEstimated,
        trend,
      });
    }

    return timeline;
  }
}

export const defaultFloodPredictionService = new FloodPredictionService();
