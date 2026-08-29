/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  FloodRiskZoneProperties,
  ForecastTimeStep,
  TerrainDataPoint,
  RainfallDataPoint,
} from './types';
import { defaultTerrainProvider } from './terrainProvider';
import { defaultRainfallProvider } from './rainfallProvider';
import { defaultFloodRiskEngine } from './floodRiskEngine';
import { defaultFloodPredictionService } from './floodPredictionService';
import { URBAN_FLOOD_BLACKSPOTS, UrbanFloodSpot } from '../maps/weatherFloodService';

// Pre-defined key urban zones across major districts for fast high-fidelity polygon generation
interface UrbanRiskZoneSpec {
  id: string;
  name: string;
  district: string;
  city: 'Hà Nội' | 'TP.HCM' | 'Đà Nẵng';
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  historicalFrequency: number;
  description: string;
}

const URBAN_KEY_ZONES: UrbanRiskZoneSpec[] = [
  // Cầu Giấy & Nam Từ Liêm
  { id: 'zone_hoa_bang', name: 'Lưu vực Hoa Bằng - Yên Hòa', district: 'Cầu Giấy', city: 'Hà Nội', centerLat: 21.0264, centerLng: 105.7942, radiusMeters: 650, historicalFrequency: 4.5, description: 'Vùng trũng thoát nước chậm ngập sâu ngõ phố khi mưa lớn.' },
  { id: 'zone_tran_thai_tong', name: 'Trục Trần Thái Tông - Duy Tân', district: 'Cầu Giấy', city: 'Hà Nội', centerLat: 21.0315, centerLng: 105.7875, radiusMeters: 550, historicalFrequency: 2.0, description: 'Khu văn phòng thoát nước tương đối nhanh, đọng nước mép đường.' },
  { id: 'zone_cau_giay_xuan_thuy', name: 'Trục Cầu Giấy - Xuân Thủy', district: 'Cầu Giấy', city: 'Hà Nội', centerLat: 21.0360, centerLng: 105.7960, radiusMeters: 600, historicalFrequency: 1.5, description: 'Gờ cao dọc tuyến đường sắt đô thị Nhổn - Ga Hà Nội.' },
  { id: 'zone_ham_thang_long', name: 'Hầm chui Đại lộ Thăng Long', district: 'Nam Từ Liêm', city: 'Hà Nội', centerLat: 21.0042, centerLng: 105.7485, radiusMeters: 750, historicalFrequency: 5.0, description: 'Điểm trũng gom nước lớn hầm chui Km9.' },

  // Đống Đa & Ba Đình
  { id: 'zone_thai_ha', name: 'Khu vực Thái Hà - Chùa Bộc', district: 'Đống Đa', city: 'Hà Nội', centerLat: 21.0145, centerLng: 105.8192, radiusMeters: 600, historicalFrequency: 3.5, description: 'Ngập úng đoạn rạp chiếu phim và nút giao Trung Liệt.' },
  { id: 'zone_nguyen_khuyen', name: 'Vùng trũng Văn Miếu - Nguyễn Khuyến', district: 'Đống Đa', city: 'Hà Nội', centerLat: 21.0289, centerLng: 105.8385, radiusMeters: 500, historicalFrequency: 4.0, description: 'Lòng chảo cổ khu Văn Miếu ngập thường niên.' },
  { id: 'zone_truc_bach', name: 'Bán đảo Ngũ Xã & Trúc Bạch', district: 'Ba Đình', city: 'Hà Nội', centerLat: 21.0440, centerLng: 105.8390, radiusMeters: 500, historicalFrequency: 1.8, description: 'Ven hồ Trúc Bạch, thoát nước trực tiếp ra hồ.' },
  { id: 'zone_hoang_hoa_tham', name: 'Gờ cao Hoàng Hoa Thám - Thụy Khuê', district: 'Ba Đình', city: 'Hà Nội', centerLat: 21.0415, centerLng: 105.8220, radiusMeters: 700, historicalFrequency: 1.0, description: 'Sườn đồi cao ráo, nước dốc dồn xuống chân dốc La Pho.' },

  // Hoàn Kiếm & Hai Bà Trưng
  { id: 'zone_pho_co_bat_dan', name: 'Khu Phố Cổ Bát Đàn - Hàng Mã', district: 'Hoàn Kiếm', city: 'Hà Nội', centerLat: 21.0345, centerLng: 105.8475, radiusMeters: 550, historicalFrequency: 2.2, description: 'Hệ thống cống vòm Pháp cổ, ngập nhẹ khi mưa trên 40mm.' },
  { id: 'zone_phan_boi_chau', name: 'Ngã tư Phan Bội Châu - Lý Thường Kiệt', district: 'Hoàn Kiếm', city: 'Hà Nội', centerLat: 21.0245, centerLng: 105.8456, radiusMeters: 450, historicalFrequency: 3.0, description: 'Nút giao đọng nước vỉa hè khi mưa to.' },

  // Tây Hồ
  { id: 'zone_quang_ba_to_ngoc_van', name: 'Bán đảo Quảng An - Tô Ngọc Vân', district: 'Tây Hồ', city: 'Hà Nội', centerLat: 21.0620, centerLng: 105.8260, radiusMeters: 750, historicalFrequency: 1.2, description: 'Địa hình ven hồ thoáng rộng, ít khi ngập sâu.' },
  { id: 'zone_thuy_khue_la_pho', name: 'Dốc La Pho - Thụy Khuê', district: 'Tây Hồ', city: 'Hà Nội', centerLat: 21.0425, centerLng: 105.8315, radiusMeters: 450, historicalFrequency: 3.8, description: 'Chân dốc gom nước từ Hoàng Hoa Thám đổ xuống.' },

  // Thanh Xuân & Hoàng Mai
  { id: 'zone_bui_xuong_trach', name: 'Lưu vực Bùi Xương Trạch - Khương Trung', district: 'Thanh Xuân', city: 'Hà Nội', centerLat: 20.9935, centerLng: 105.8198, radiusMeters: 650, historicalFrequency: 4.2, description: 'Ven sông Tô Lịch ngập úng ngõ trũng khi sông dâng cao.' },
  { id: 'zone_nguyen_trai_dai_hoc', name: 'Trục Nguyễn Trãi - ĐH KHXH&NV', district: 'Thanh Xuân', city: 'Hà Nội', centerLat: 20.9958, centerLng: 105.8052, radiusMeters: 600, historicalFrequency: 3.0, description: 'Đoạn trũng gom nước làn hỗn hợp sát mép vỉa hè.' },

  // TP. Hồ Chí Minh
  { id: 'zone_thao_dien', name: 'Bán đảo Thảo Điền - Quốc Hương', district: 'TP. Thủ Đức', city: 'TP.HCM', centerLat: 10.8058, centerLng: 106.7325, radiusMeters: 800, historicalFrequency: 4.8, description: 'Ngập kết hợp mưa lớn và triều cường dâng cao từ sông Sài Gòn.' },
  { id: 'zone_dinh_bo_linh', name: 'Ung Văn Khiêm - Đinh Bộ Lĩnh', district: 'Bình Thạnh', city: 'TP.HCM', centerLat: 10.8095, centerLng: 106.7145, radiusMeters: 650, historicalFrequency: 4.2, description: 'Chân cầu Đỏ và bến xe Miền Đông cũ thoát nước chậm.' },
  { id: 'zone_huynh_tan_phat', name: 'Huỳnh Tấn Phát - Trần Xuân Soạn', district: 'Quận 7', city: 'TP.HCM', centerLat: 10.7425, centerLng: 106.7265, radiusMeters: 700, historicalFrequency: 4.6, description: 'Vùng trũng thấp chịu ảnh hưởng triều cường thường xuyên.' },
];

// Helper to generate a regular polygon approximating a circle around center coordinate
function generatePolygonCoords(centerLat: number, centerLng: number, radiusMeters: number, sides: number = 14): [number, number][] {
  const coords: [number, number][] = [];
  const earthRadius = 6378137;
  const dLat = (radiusMeters / earthRadius) * (180 / Math.PI);
  const dLng = dLat / Math.cos((centerLat * Math.PI) / 180);

  for (let i = 0; i <= sides; i++) {
    const angle = (i * 2 * Math.PI) / sides;
    const lat = centerLat + dLat * Math.sin(angle) * (0.85 + 0.15 * Math.sin(angle * 3));
    const lng = centerLng + dLng * Math.cos(angle) * (0.85 + 0.15 * Math.cos(angle * 2));
    coords.push([Number(lng.toFixed(6)), Number(lat.toFixed(6))]);
  }
  return coords;
}

export interface FloodRiskGeoJSONBundle {
  floodRiskZonesGeoJSON: any;
  terrainContoursGeoJSON: any;
  rainfallRadarGeoJSON: any;
  floodBlackspotsGeoJSON: any;
}

// In-memory GeoJSON cache keyed by timeStep & rainfall hash
let cachedGeoJSONBundle: {
  timeStep: ForecastTimeStep;
  timestamp: number;
  bundle: FloodRiskGeoJSONBundle;
} | null = null;

/**
 * Builds comprehensive multi-layer GeoJSON datasets for map rendering.
 */
export async function generateFloodRiskGeoJSONBundle(
  timeStep: ForecastTimeStep = 'now',
  anchorLat: number = 21.0285,
  anchorLng: number = 105.7958
): Promise<FloodRiskGeoJSONBundle> {
  const now = Date.now();
  if (cachedGeoJSONBundle && cachedGeoJSONBundle.timeStep === timeStep && now - cachedGeoJSONBundle.timestamp < 30000) {
    return cachedGeoJSONBundle.bundle;
  }

  // 1. Fetch current precipitation & terrain for the area
  const rainfall = await defaultRainfallProvider.getCurrentRainfall(anchorLat, anchorLng);

  // Time-step rainfall multiplier
  let rainMultiplier = 1.0;
  if (timeStep === 'plus_30m') rainMultiplier = 1.35;
  if (timeStep === 'plus_60m') rainMultiplier = 0.90;
  if (timeStep === 'plus_120m') rainMultiplier = 0.40;

  const effectiveRainfall: RainfallDataPoint = {
    ...rainfall,
    currentRainfallMmH: Number((rainfall.currentRainfallMmH * rainMultiplier).toFixed(1)),
    rainfall15mMm: Number((rainfall.rainfall15mMm * rainMultiplier).toFixed(1)),
    rainfall30mMm: Number((rainfall.rainfall30mMm * rainMultiplier).toFixed(1)),
    rainfall1hMm: Number((rainfall.rainfall1hMm * (1 + (timeStep === 'plus_30m' ? 0.35 : timeStep === 'plus_60m' ? 0.6 : 0.8))).toFixed(1)),
  };

  // 2. Generate Flood Risk Polygons for all urban zones
  const floodZoneFeatures = [];
  for (const zone of URBAN_KEY_ZONES) {
    const terrain = await defaultTerrainProvider.getTerrainAtLocation(zone.centerLat, zone.centerLng);
    const riskResult = defaultFloodRiskEngine.calculateRisk({
      terrain,
      rainfall: effectiveRainfall,
      historicalFloodFrequency: zone.historicalFrequency,
    });
    const forecastTimeline = defaultFloodPredictionService.generateForecastTimeline(
      terrain,
      rainfall,
      zone.historicalFrequency
    );

    const polygonCoords = generatePolygonCoords(zone.centerLat, zone.centerLng, zone.radiusMeters);

    const props: FloodRiskZoneProperties = {
      id: zone.id,
      name: zone.name,
      district: zone.district,
      city: zone.city,
      latitude: zone.centerLat,
      longitude: zone.centerLng,
      riskLevel: riskResult.riskLevel,
      riskScore: riskResult.riskScore,
      elevationMeters: terrain.elevationMeters,
      relativeElevationMeters: terrain.relativeElevationMeters,
      slopeDegrees: terrain.slopeDegrees,
      flowAccumulation: terrain.flowAccumulation,
      rainfallCurrentMmH: effectiveRainfall.currentRainfallMmH,
      rainfall1hMm: effectiveRainfall.rainfall1hMm,
      waterDepthCmEstimated: riskResult.waterDepthCmEstimated,
      historicalFrequency: zone.historicalFrequency,
      primaryCause: riskResult.primaryCause,
      safetyAdvice: riskResult.safetyAdvice,
      forecast: forecastTimeline,
    };

    floodZoneFeatures.push({
      type: 'Feature',
      id: zone.id,
      geometry: {
        type: 'Polygon',
        coordinates: [polygonCoords],
      },
      properties: {
        ...props,
        // Serialized forecast string for MapLibre feature inspector
        forecastJson: JSON.stringify(forecastTimeline),
      },
    });
  }

  // 3. Generate Terrain DEM Contours & Elevation Gradient Grid
  const terrainFeatures = [];
  for (const zone of URBAN_KEY_ZONES) {
    const terrain = await defaultTerrainProvider.getTerrainAtLocation(zone.centerLat, zone.centerLng);
    // Outer DEM band
    const contourCoords = generatePolygonCoords(zone.centerLat, zone.centerLng, zone.radiusMeters * 1.35, 12);
    terrainFeatures.push({
      type: 'Feature',
      id: `dem_${zone.id}`,
      geometry: {
        type: 'Polygon',
        coordinates: [contourCoords],
      },
      properties: {
        elevationMeters: terrain.elevationMeters,
        relativeElevationMeters: terrain.relativeElevationMeters,
        slopeDegrees: terrain.slopeDegrees,
        depressionDepthMeters: terrain.depressionDepthMeters,
        name: zone.name,
        elevationLabel: `${terrain.elevationMeters.toFixed(1)}m`,
      },
    });
  }

  // 4. Generate Rainfall Radar Isohyet Clouds
  const rainfallRadarFeatures = [];
  if (effectiveRainfall.currentRainfallMmH > 0 || effectiveRainfall.precipitationProbability > 30) {
    for (const zone of URBAN_KEY_ZONES) {
      const radarCoords = generatePolygonCoords(zone.centerLat, zone.centerLng, zone.radiusMeters * 1.8, 16);
      rainfallRadarFeatures.push({
        type: 'Feature',
        id: `radar_${zone.id}`,
        geometry: {
          type: 'Polygon',
          coordinates: [radarCoords],
        },
        properties: {
          rainfallIntensity: effectiveRainfall.currentRainfallMmH,
          precipitationProbability: effectiveRainfall.precipitationProbability,
        },
      });
    }
  }

  // 5. Generate Urban Blackspot Points (Enhanced with real-time risk calculations)
  const blackspotFeatures = [];
  for (const spot of URBAN_FLOOD_BLACKSPOTS) {
    const terrain = await defaultTerrainProvider.getTerrainAtLocation(spot.latitude, spot.longitude);
    const riskResult = defaultFloodRiskEngine.calculateRisk({
      terrain,
      rainfall: effectiveRainfall,
      historicalFloodFrequency: 4.5,
    });

    blackspotFeatures.push({
      type: 'Feature',
      id: `spot_${spot.name.replace(/\s+/g, '_')}`,
      geometry: {
        type: 'Point',
        coordinates: [spot.longitude, spot.latitude],
      },
      properties: {
        name: spot.name,
        city: spot.city,
        latitude: spot.latitude,
        longitude: spot.longitude,
        typicalDepthCm: spot.waterDepthCmEstimated,
        currentDepthCm: riskResult.waterDepthCmEstimated,
        riskLevel: riskResult.riskLevel,
        riskScore: riskResult.riskScore,
        elevationMeters: terrain.elevationMeters,
        relativeElevationMeters: terrain.relativeElevationMeters,
        description: spot.description,
        safeDetourAdvice: spot.safeDetourAdvice,
        isBlackspot: true,
      },
    });
  }

  const bundle: FloodRiskGeoJSONBundle = {
    floodRiskZonesGeoJSON: {
      type: 'FeatureCollection',
      features: floodZoneFeatures,
    },
    terrainContoursGeoJSON: {
      type: 'FeatureCollection',
      features: terrainFeatures,
    },
    rainfallRadarGeoJSON: {
      type: 'FeatureCollection',
      features: rainfallRadarFeatures,
    },
    floodBlackspotsGeoJSON: {
      type: 'FeatureCollection',
      features: blackspotFeatures,
    },
  };

  cachedGeoJSONBundle = {
    timeStep,
    timestamp: now,
    bundle,
  };

  return bundle;
}
