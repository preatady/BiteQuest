/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type FloodRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';

export interface FloodRiskThresholds {
  lowMax: number;       // e.g. 0.25
  moderateMax: number;  // e.g. 0.50
  highMax: number;      // e.g. 0.75
  veryHighMax: number;  // 1.00
}

export const DEFAULT_FLOOD_THRESHOLDS: FloodRiskThresholds = {
  lowMax: 0.25,
  moderateMax: 0.50,
  highMax: 0.75,
  veryHighMax: 1.00,
};

export interface TerrainDataPoint {
  latitude: number;
  longitude: number;
  elevationMeters: number;         // Absolute elevation above sea level (m)
  relativeElevationMeters: number; // Elevation difference relative to 500m radius baseline (m)
  slopeDegrees: number;            // Terrain slope in degrees (0 - 90°)
  aspectDegrees: number;           // Aspect orientation (0 - 360°)
  flowDirection: number;           // D8 flow direction (1 - 128)
  flowAccumulation: number;        // Upslope contributing drainage area (cells)
  depressionDepthMeters: number;   // Depth of local topographic depression / sink (m)
  distanceToRiverMeters: number;   // Distance to major river / lake (m)
  distanceToMainDrainMeters: number;// Distance to primary urban drainage culvert (m)
}

export interface RainfallDataPoint {
  currentRainfallMmH: number;      // Instantaneous rainfall intensity (mm/h)
  rainfall15mMm: number;           // Cumulative 15-minute precipitation (mm)
  rainfall30mMm: number;           // Cumulative 30-minute precipitation (mm)
  rainfall1hMm: number;            // Cumulative 1-hour precipitation (mm)
  rainfall3hMm: number;            // Cumulative 3-hour precipitation (mm)
  precipitationProbability: number;// 0 - 100%
  source: 'open_meteo_live' | 'station_sensor' | 'simulation_model';
}

export interface TideAndRiverData {
  tideLevelMeters: number;         // Current water level / tide above baseline (m)
  riverDischargeM3s?: number;      // River flow discharge rate (m³/s)
  isHighTideAlert: boolean;
}

export interface FloodRiskFactorInputs {
  terrain: TerrainDataPoint;
  rainfall: RainfallDataPoint;
  tide?: TideAndRiverData;
  historicalFloodFrequency: number;// Historical flood events per year in this cell (0 - 10+)
  soilPermeabilityFactor?: number; // 0 (100% concrete/impervious) to 1 (permeable soil/parks)
}

export interface FloodRiskResult {
  riskScore: number;               // 0.00 to 1.00
  riskLevel: FloodRiskLevel;
  waterDepthCmEstimated: number;   // Projected standing water depth in cm
  primaryCause: string;            // Explanation of dominant factor (depression, heavy rain, river backup)
  confidenceScore: number;         // Model confidence index (0.00 - 1.00)
  factorsBreakdown: {
    topographicFactor: number;     // 0..1
    rainfallAccumulationFactor: number; // 0..1
    drainageProximityFactor: number;// 0..1
    historicalFrequencyFactor: number; // 0..1
    tideFactor: number;            // 0..1
  };
  safetyAdvice: string;
  recommendedAction: string;
}

export type ForecastTimeStep = 'now' | 'plus_30m' | 'plus_60m' | 'plus_120m';

export interface FloodPredictionTimelinePoint {
  timeStep: ForecastTimeStep;
  label: string;
  relativeMinutes: number;
  expectedRainfallMmH: number;
  expectedRainfallAccumulatedMm: number;
  predictedRiskLevel: FloodRiskLevel;
  predictedRiskScore: number;
  predictedDepthCm: number;
  trend: 'rising' | 'stable' | 'receding';
}

export interface FloodRiskZoneProperties {
  id: string;
  name: string;
  district: string;
  city: string;
  latitude: number;
  longitude: number;
  riskLevel: FloodRiskLevel;
  riskScore: number;
  elevationMeters: number;
  relativeElevationMeters: number;
  slopeDegrees: number;
  flowAccumulation: number;
  rainfallCurrentMmH: number;
  rainfall1hMm: number;
  waterDepthCmEstimated: number;
  historicalFrequency: number;
  primaryCause: string;
  safetyAdvice: string;
  forecast: FloodPredictionTimelinePoint[];
}

export interface FloodLayerVisibilityState {
  showFloodRisk: boolean;          // High-contrast flood hazard polygons
  showTerrainContour: boolean;     // DEM elevation shading & relative depression contours
  showRainfallRadar: boolean;      // Live & simulated precipitation overlay
  showFloodPoints: boolean;        // Verified urban drainage blackspots & depth badges
}
