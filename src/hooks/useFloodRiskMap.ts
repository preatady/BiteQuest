/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import {
  FloodLayerVisibilityState,
  ForecastTimeStep,
  FloodRiskZoneProperties,
  RainfallDataPoint,
} from '../services/floodRisk/types';
import {
  generateFloodRiskGeoJSONBundle,
  FloodRiskGeoJSONBundle,
} from '../services/floodRisk/floodGridGenerator';
import { defaultRainfallProvider } from '../services/floodRisk/rainfallProvider';
import { defaultTerrainProvider } from '../services/floodRisk/terrainProvider';
import { defaultFloodRiskEngine } from '../services/floodRisk/floodRiskEngine';
import { defaultFloodPredictionService } from '../services/floodRisk/floodPredictionService';

export function useFloodRiskMap(anchorLat: number = 21.0285, anchorLng: number = 105.7958) {
  const [layers, setLayers] = useState<FloodLayerVisibilityState>({
    showFloodRisk: true,
    showTerrainContour: false,
    showRainfallRadar: true,
    showFloodPoints: true,
  });

  const [timeStep, setTimeStep] = useState<ForecastTimeStep>('now');
  const [geoJSONBundle, setGeoJSONBundle] = useState<FloodRiskGeoJSONBundle | null>(null);
  const [currentRainfall, setCurrentRainfall] = useState<RainfallDataPoint | null>(null);
  const [selectedZone, setSelectedZone] = useState<FloodRiskZoneProperties | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch GeoJSON and Rainfall
  const loadData = useCallback(async (step: ForecastTimeStep) => {
    try {
      setIsLoading(true);
      setError(null);

      const [bundle, rain] = await Promise.all([
        generateFloodRiskGeoJSONBundle(step, anchorLat, anchorLng),
        defaultRainfallProvider.getCurrentRainfall(anchorLat, anchorLng),
      ]);

      setGeoJSONBundle(bundle);
      setCurrentRainfall(rain);
    } catch (err: any) {
      console.warn('FloodRisk load error:', err);
      setError('Không thể tải dữ liệu mô hình ngập. Đang dùng cấu hình an toàn.');
    } finally {
      setIsLoading(false);
    }
  }, [anchorLat, anchorLng]);

  useEffect(() => {
    loadData(timeStep);
  }, [timeStep, loadData]);

  // Inspect arbitrary point clicked on the map
  const inspectPoint = useCallback(async (lat: number, lng: number, spotName?: string) => {
    try {
      const terrain = await defaultTerrainProvider.getTerrainAtLocation(lat, lng);
      const rain = currentRainfall || (await defaultRainfallProvider.getCurrentRainfall(lat, lng));
      const riskResult = defaultFloodRiskEngine.calculateRisk({
        terrain,
        rainfall: rain,
        historicalFloodFrequency: 2.0,
      });
      const forecast = defaultFloodPredictionService.generateForecastTimeline(terrain, rain, 2.0);

      const zoneProps: FloodRiskZoneProperties = {
        id: `inspect_${lat.toFixed(4)}_${lng.toFixed(4)}`,
        name: spotName || `Khu vực (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        district: 'Đang khảo sát',
        city: lat < 12 ? 'TP.HCM' : 'Hà Nội',
        latitude: lat,
        longitude: lng,
        riskLevel: riskResult.riskLevel,
        riskScore: riskResult.riskScore,
        elevationMeters: terrain.elevationMeters,
        relativeElevationMeters: terrain.relativeElevationMeters,
        slopeDegrees: terrain.slopeDegrees,
        flowAccumulation: terrain.flowAccumulation,
        rainfallCurrentMmH: rain.currentRainfallMmH,
        rainfall1hMm: rain.rainfall1hMm,
        waterDepthCmEstimated: riskResult.waterDepthCmEstimated,
        historicalFrequency: 2.0,
        primaryCause: riskResult.primaryCause,
        safetyAdvice: riskResult.safetyAdvice,
        forecast,
      };

      setSelectedZone(zoneProps);
    } catch (err) {
      console.warn('Inspect point error:', err);
    }
  }, [currentRainfall]);

  const toggleLayer = useCallback((layerKey: keyof FloodLayerVisibilityState) => {
    setLayers((prev) => ({
      ...prev,
      [layerKey]: !prev[layerKey],
    }));
  }, []);

  return {
    layers,
    timeStep,
    geoJSONBundle,
    currentRainfall,
    selectedZone,
    isLoading,
    error,
    setTimeStep,
    toggleLayer,
    setSelectedZone,
    inspectPoint,
    reload: () => loadData(timeStep),
  };
}
