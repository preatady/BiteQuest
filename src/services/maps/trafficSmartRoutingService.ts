/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Place } from '../../types';
import { getDistance } from 'geolib';
import {
  HourlyWeatherForecast,
  RouteWeatherFloodAnalysis,
  analyzeRouteWeatherAndFlood,
  getSyntheticHourlyWeather,
} from './weatherFloodService';

export type DayType = 'weekday' | 'weekend' | 'holiday';

export interface TrafficAnalysisOptions {
  userLocation: { latitude: number; longitude: number };
  targetHour: number; // 0 - 23 (e.g. 20 for 8:00 PM)
  targetMinute?: number;
  dayType: DayType;
  places: (Place | any)[];
  weatherForecasts?: HourlyWeatherForecast[];
}

export interface TrafficRouteResult {
  place: Place | any;
  distanceMeters: number;
  distanceKmFormatted: string;
  freeFlowDurationMinutes: number;
  estimatedDurationMinutes: number;
  delayMinutes: number;
  trafficLevel: 'smooth' | 'moderate' | 'heavy' | 'jammed'; // 🟢 🟡 🔴 ⛔
  trafficScore: number; // 100 = completely clear, < 40 = heavy jam
  trafficLabel: string;
  smartAdvice: string;
  bestDepartureTimeAdvice: string;
  avoidedBottlenecks: string[];
  routeCoordinates: [number, number][]; // [lng, lat] for MapLibre GeoJSON LineString
  weatherFlood?: RouteWeatherFloodAnalysis;
}

// Known historic bottleneck corridors in major urban centers (e.g. Hanoi / HCMC)
const URBAN_BOTTLENECKS = [
  { name: 'Trục Cầu Giấy - Xuân Thủy', lat: 21.0365, lng: 105.7895, peakMultiplier: 2.2 },
  { name: 'Nút giao Ngã Tư Sở - Trường Chinh', lat: 21.0016, lng: 105.8202, peakMultiplier: 2.5 },
  { name: 'Trục Nguyễn Trãi - Hà Đông', lat: 20.9925, lng: 105.8045, peakMultiplier: 2.1 },
  { name: 'Trục Đê La Thành - Kim Mã', lat: 21.0315, lng: 105.8155, peakMultiplier: 2.0 },
  { name: 'Trục Xã Đàn - Ô Chợ Dừa', lat: 21.0175, lng: 105.8345, peakMultiplier: 1.9 },
  { name: 'Khu vực Phố Cổ & Hồ Hoàn Kiếm', lat: 21.031, lng: 105.852, peakMultiplier: 2.3, weekendHigh: true },
  { name: 'Trục Cộng Hòa - Trường Chinh (TP.HCM)', lat: 10.803, lng: 106.654, peakMultiplier: 2.4 },
  { name: 'Vòng xoay Hàng Xanh - Xô Viết Nghệ Tĩnh', lat: 10.801, lng: 106.711, peakMultiplier: 2.3 },
];

/**
 * Calculates hourly congestion multiplier based on urban traffic dynamics
 */
export function getHourCongestionFactor(hour: number, dayType: DayType): { factor: number; description: string } {
  if (dayType === 'holiday') {
    // Holidays: High evening & night movement around dining & entertainment clusters
    if (hour >= 18 && hour <= 21) {
      return { factor: 1.9, description: 'Giờ cao điểm tối ngày Lễ (Khu ẩm thực & vui chơi đông nghẽn)' };
    }
    if (hour >= 11 && hour <= 14) {
      return { factor: 1.5, description: 'Giờ trưa ngày Lễ (Tụ tập gia đình & hàng quán đông)' };
    }
    if (hour >= 21 && hour <= 23) {
      return { factor: 1.4, description: 'Đêm dạo phố ngày Lễ' };
    }
    return { factor: 1.1, description: 'Đường phố ngày Lễ tương đối thoáng' };
  }

  if (dayType === 'weekend') {
    // Weekends: Relaxed morning, heavy evening dining rush
    if (hour >= 18 && hour <= 21) {
      return { factor: 1.75, description: 'Cuối tuần: Giờ ăn tối & cà phê cao điểm' };
    }
    if (hour >= 9 && hour <= 12) {
      return { factor: 1.35, description: 'Cuối tuần: Cà phê sáng & ăn trưa' };
    }
    if (hour >= 21 && hour <= 23) {
      return { factor: 1.3, description: 'Dạo phố đêm cuối tuần' };
    }
    return { factor: 1.0, description: 'Đường phố cuối tuần thông thoáng' };
  }

  // Regular Weekdays
  if ((hour >= 7 && hour < 9) || hour === 8) {
    return { factor: 2.2, description: 'Cao điểm sáng: Dòng người đi làm & đi học tắc nghẽn' };
  }
  if (hour >= 17 && hour <= 19) {
    return { factor: 2.4, description: 'Cao điểm tan tầm tối: Tắc đường diện rộng các trục chính' };
  }
  if (hour >= 11 && hour <= 13) {
    return { factor: 1.4, description: 'Cao điểm ăn trưa: Đông đúc quanh khu văn phòng' };
  }
  if (hour >= 19 && hour <= 21) {
    return { factor: 1.3, description: 'Khung giờ ăn tối: Lưu lượng giảm dần, đường thông thoáng hơn' };
  }
  if (hour >= 21 || hour < 6) {
    return { factor: 0.9, description: 'Đêm muộn: Đường hoàn toàn thông thoáng, đi rất nhanh' };
  }

  return { factor: 1.1, description: 'Khung giờ bình thường, di chuyển thuận lợi' };
}

/**
 * Generate a realistic multi-segment path between two coordinates
 */
export function generateCurvedRoutePath(
  start: { latitude: number; longitude: number },
  end: { latitude: number; longitude: number }
): [number, number][] {
  const points: [number, number][] = [];
  const steps = 12;

  const latDiff = end.latitude - start.latitude;
  const lngDiff = end.longitude - start.longitude;

  // Add intermediate road-like bends
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Slight sine wave deviation to emulate city street grid
    const wiggle = Math.sin(t * Math.PI) * 0.0008;
    const lat = start.latitude + latDiff * t + (i % 2 === 0 ? wiggle : -wiggle * 0.5);
    const lng = start.longitude + lngDiff * t + (i % 2 !== 0 ? wiggle : 0);
    points.push([lng, lat]);
  }

  return points;
}

/**
 * Analyze and rank places by traffic flow, weather obstacles, flood risks, and estimated transit delay.
 * Includes deterministic try...catch fail-safe fallback to straight-line distance sorting.
 */
export function analyzeTrafficRoutes(options: TrafficAnalysisOptions): TrafficRouteResult[] {
  try {
    const { userLocation, targetHour, dayType, places, weatherForecasts } = options;
    if (!userLocation || !Array.isArray(places) || places.length === 0) {
      return [];
    }
    const { factor: baseCongestion, description: timeDesc } = getHourCongestionFactor(targetHour, dayType);

    const activeWeather =
      weatherForecasts && weatherForecasts.length > targetHour
        ? weatherForecasts[targetHour]
        : getSyntheticHourlyWeather()[targetHour] || getSyntheticHourlyWeather()[20];

    const results: TrafficRouteResult[] = [];

    places.forEach((place) => {
      if (!place || typeof place.latitude !== 'number' || typeof place.longitude !== 'number') {
        return;
      }

      // Distance in meters
      const distMeters = getDistance(
        { latitude: userLocation.latitude, longitude: userLocation.longitude },
        { latitude: place.latitude, longitude: place.longitude }
      );

      // Free flow speed: ~30 km/h in urban streets = 500 m/min
      const freeFlowMinutes = Math.max(2, Math.round(distMeters / 450));

      // Check if route passes near any major bottleneck
      let routeMultiplier = baseCongestion;
      const avoidedBottlenecks: string[] = [];

      URBAN_BOTTLENECKS.forEach((bn) => {
        const distToBottleneck = getDistance(
          { latitude: (userLocation.latitude + place.latitude) / 2, longitude: (userLocation.longitude + place.longitude) / 2 },
          { latitude: bn.lat, longitude: bn.lng }
        );

        if (distToBottleneck < 1500) {
          if (dayType === 'weekend' && bn.weekendHigh) {
            routeMultiplier += 0.4;
          } else if (targetHour >= 17 && targetHour <= 19) {
            routeMultiplier += 0.5;
          }
        } else if (distToBottleneck > 2500) {
          avoidedBottlenecks.push(`Né ${bn.name}`);
        }
      });

      // Weather & Rain impact factor (Rain causes slower speed, water logging)
      let weatherPenalty = 0;
      if (activeWeather.rainSeverity === 'heavy_storm') {
        weatherPenalty = 0.6;
        routeMultiplier += weatherPenalty;
      } else if (activeWeather.rainSeverity === 'rain') {
        weatherPenalty = 0.35;
        routeMultiplier += weatherPenalty;
      } else if (activeWeather.rainSeverity === 'drizzle') {
        weatherPenalty = 0.15;
        routeMultiplier += weatherPenalty;
      }

      // Evaluate Flood Risk along the route
      let weatherFlood: RouteWeatherFloodAnalysis | undefined;
      try {
        weatherFlood = analyzeRouteWeatherAndFlood(
          userLocation,
          { latitude: place.latitude, longitude: place.longitude },
          activeWeather
        );
      } catch {
        weatherFlood = {
          targetHour,
          weather: activeWeather,
          originFloodRisk: 'none',
          destFloodRisk: 'none',
          routeFloodRisk: 'none',
          detectedFloodSpots: [],
          smartDiningAdvice: 'Đường khô ráo, di chuyển an toàn.',
          parkingAdvice: 'Bãi đỗ xe thông thoáng.',
          transportAdvice: 'Di chuyển thuận tiện.',
        };
      }

      if (weatherFlood.routeFloodRisk === 'high_flood') {
        routeMultiplier += 0.5;
      } else if (weatherFlood.routeFloodRisk === 'moderate') {
        routeMultiplier += 0.25;
      }

      // Random micro-variation based on place coordinate seed for realistic diversity
      const coordSeed = Math.abs(Math.sin(place.latitude * 1000 + place.longitude * 1000));
      routeMultiplier = Math.max(0.9, routeMultiplier + (coordSeed * 0.4 - 0.2));

      const estimatedMinutes = Math.max(freeFlowMinutes, Math.round(freeFlowMinutes * routeMultiplier));
      const delayMinutes = Math.max(0, estimatedMinutes - freeFlowMinutes);

      // Compute Traffic Score (0 - 100)
      let trafficScore = 100 - Math.round((routeMultiplier - 1) * 60) - Math.min(25, delayMinutes * 2);
      if (weatherFlood.routeFloodRisk === 'high_flood') {
        trafficScore = Math.max(10, trafficScore - 30);
      } else if (weatherFlood.routeFloodRisk === 'moderate') {
        trafficScore = Math.max(15, trafficScore - 15);
      }
      trafficScore = Math.max(15, Math.min(99, trafficScore));

      let trafficLevel: 'smooth' | 'moderate' | 'heavy' | 'jammed' = 'smooth';
      let trafficLabel = '🟢 Tuyến đường thông thoáng';

      if (trafficScore >= 75) {
        trafficLevel = 'smooth';
        trafficLabel = '🟢 Tuyến đường thông thoáng';
      } else if (trafficScore >= 55) {
        trafficLevel = 'moderate';
        trafficLabel = '🟡 Lưu lượng vừa phải';
      } else if (trafficScore >= 35) {
        trafficLevel = 'heavy';
        trafficLabel = '🔴 Nguy cơ đông/chậm';
      } else {
        trafficLevel = 'jammed';
        trafficLabel = '⛔ Điểm nóng kẹt xe';
      }

      // Generate intelligent advice including weather & flooding
      let smartAdvice = '';
      let bestDepartureTimeAdvice = '';

      if (weatherFlood.routeFloodRisk === 'high_flood') {
        const spotNames = weatherFlood.detectedFloodSpots.map((s) => s.name).join(', ');
        smartAdvice = `🚨 CẢNH BÁO NGẬP ÚNG: Tuyến này qua điểm ngập (${spotNames || 'vùng trũng'}). Điểm đến có thể ngập sâu khi mưa to.`;
        bestDepartureTimeAdvice = weatherFlood.detectedFloodSpots[0]?.safeDetourAdvice || 'Nên chọn quán khác ở vùng gò cao hoặc đi ô tô gầm cao.';
      } else if (activeWeather.isRainy) {
        if (trafficLevel === 'smooth') {
          smartAdvice = `🌧️ ${activeWeather.conditionLabel}. Đường êm ít kẹt, nhưng mặt đường trơn trượt.`;
          bestDepartureTimeAdvice = 'Nên mặc áo mưa gọn gàng, giảm tốc độ khi vào cua.';
        } else {
          smartAdvice = `🌧️ Trời mưa (${activeWeather.conditionLabel}) kết hợp tan tầm khiến các trục chính di chuyển chậm hơn ~${delayMinutes} phút.`;
          bestDepartureTimeAdvice = `Nên đợi qua ${targetHour === 17 ? '17:30' : '19:30'} để mưa ngớt và bớt kẹt xe.`;
        }
      } else if (targetHour >= 17 && targetHour <= 19) {
        if (trafficLevel === 'smooth') {
          smartAdvice = 'Tuyến đường đi qua các ngõ/đường vành đai thoáng, né được các ngã tư lớn đang kẹt giờ tan tầm.';
          bestDepartureTimeAdvice = 'Có thể xuất phát ngay, đường di chuyển êm.';
        } else {
          smartAdvice = `Trục đường này đang trong khung giờ cao điểm tan tầm (${timeDesc}). Có thể mất thêm ${delayMinutes} phút.`;
          bestDepartureTimeAdvice = `Nên xuất phát lúc ${targetHour === 17 ? '17:15' : '19:15'} (trước hoặc sau đỉnh điểm kẹt xe).`;
        }
      } else if (targetHour >= 11 && targetHour <= 13) {
        smartAdvice = 'Đường thông thoáng, chỉ cần lưu ý khu vực đỗ xe quanh hàng quán.';
        bestDepartureTimeAdvice = 'Khung giờ rất thích hợp để dùng bữa.';
      } else if (targetHour >= 20) {
        smartAdvice = 'Khung giờ tối muộn cực kỳ êm ái, xe cộ thưa thớt, tốc độ di chuyển tối đa.';
        bestDepartureTimeAdvice = 'Di chuyển tự do, không lo tắc đường.';
      } else {
        smartAdvice = 'Giao thông ổn định, không có cảnh báo ùn tắc lớn.';
        bestDepartureTimeAdvice = 'Xuất phát bất kỳ lúc nào.';
      }

      const routePath = generateCurvedRoutePath(userLocation, {
        latitude: place.latitude,
        longitude: place.longitude,
      });

      results.push({
        place,
        distanceMeters: distMeters,
        distanceKmFormatted: (distMeters / 1000).toFixed(1) + ' km',
        freeFlowDurationMinutes: freeFlowMinutes,
        estimatedDurationMinutes: estimatedMinutes,
        delayMinutes,
        trafficLevel,
        trafficScore,
        trafficLabel,
        smartAdvice,
        bestDepartureTimeAdvice,
        avoidedBottlenecks: avoidedBottlenecks.slice(0, 2),
        routeCoordinates: routePath,
        weatherFlood,
      });
    });

    // Sort primarily by: Best Traffic Score (Highest first) & Shortest ETA
    return results.sort((a, b) => {
      if (b.trafficScore !== a.trafficScore) {
        return b.trafficScore - a.trafficScore;
      }
      return a.estimatedDurationMinutes - b.estimatedDurationMinutes;
    });
  } catch {
    // Fail-safe deterministic fallback: sort purely by straight-line Euclidean distance
    const userLoc = options.userLocation || { latitude: 21.0285, longitude: 105.7958 };
    const validPlaces = (options.places || []).filter(
      (p) => p && typeof p.latitude === 'number' && typeof p.longitude === 'number'
    );
    return validPlaces
      .map((place) => {
        const distMeters = getDistance(
          { latitude: userLoc.latitude, longitude: userLoc.longitude },
          { latitude: place.latitude, longitude: place.longitude }
        );
        const durationMins = Math.max(2, Math.round(distMeters / 450));
        return {
          place,
          distanceMeters: distMeters,
          distanceKmFormatted: (distMeters / 1000).toFixed(1) + ' km',
          freeFlowDurationMinutes: durationMins,
          estimatedDurationMinutes: durationMins,
          delayMinutes: 0,
          trafficLevel: 'smooth' as const,
          trafficScore: 85,
          trafficLabel: '🟢 Tuyến đường thông thoáng',
          smartAdvice: 'Đường đi tiêu chuẩn theo khoảng cách gần nhất.',
          bestDepartureTimeAdvice: 'Có thể xuất phát ngay.',
          avoidedBottlenecks: [],
          routeCoordinates: generateCurvedRoutePath(userLoc, {
            latitude: place.latitude,
            longitude: place.longitude,
          }),
        };
      })
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
  }
}
