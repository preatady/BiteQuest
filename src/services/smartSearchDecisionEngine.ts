/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Place } from '../types';
import { getDistance } from 'geolib';
import {
  analyzeTrafficRoutes,
  TrafficRouteResult,
  DayType,
} from './maps/trafficSmartRoutingService';
import {
  generateSmartExplanation,
  DestinationRoutingOption,
  SmartExplanationResult,
} from './decisionExplanationService';
import { normalizeCategory, normalizeVietnameseText } from './maps/categoryNormalizer';

export interface SmartDecisionState {
  bestRoute: TrafficRouteResult;
  closestRoute?: TrafficRouteResult;
  isDifferent: boolean;
  explanation: SmartExplanationResult;
  rawQuery: string;
  evaluatedPlacesCount: number;
}

export interface SmartSearchOptions {
  query: string;
  places: Place[];
  userLocation?: { latitude: number; longitude: number } | null;
  targetHour?: number;
  dayType?: DayType;
}

// Curated context-aware natural language prompts for Typeahead auto-complete
export const SMART_AUTOCOMPLETE_PROMPTS = [
  'Tôi muốn tìm quán cafe yên tĩnh để học trong bán kính 2km',
  'Tôi muốn tìm quán lẩu tránh ngập đường thoáng',
  'Tôi muốn tìm quán cafe view đẹp chill hẹn hò',
  'Tôi muốn tìm quán phở ngon nóng hổi gần đây',
  'Tôi muốn tìm quán ăn nhanh đường thông thoáng',
  'Tìm quán cà phê làm việc yên tĩnh có ổ cắm',
  'Tìm quán lẩu bò ngon nóng hổi né tắc đường',
];

/**
 * Filter autocomplete suggestions based on user input
 */
export function getSmartTypeaheadSuggestions(input: string): string[] {
  const norm = normalizeVietnameseText(input || '').toLowerCase().trim();
  if (!norm) return [];

  // Show rich suggestions if input matches prefix or keywords
  return SMART_AUTOCOMPLETE_PROMPTS.filter((prompt) => {
    const normPrompt = normalizeVietnameseText(prompt).toLowerCase();
    return normPrompt.includes(norm) || norm.split(' ').some((word) => word.length >= 2 && normPrompt.includes(word));
  }).slice(0, 3);
}

/**
 * Parse query for category and radius (km) constraint
 */
export function parseQueryConstraints(query: string): {
  category: string;
  radiusKm: number;
  vibe: string;
} {
  const norm = normalizeVietnameseText(query || '').toLowerCase();

  // Extract radius e.g., "2km", "3 km", "5km", "1.5km"
  let radiusKm = 10; // default 10km radius
  const radiusMatch = norm.match(/(\d+(?:\.\d+)?)\s*(?:km|kilo|cay)/);
  if (radiusMatch && radiusMatch[1]) {
    radiusKm = parseFloat(radiusMatch[1]);
  }

  // Category matching
  let category = 'none';
  if (norm.includes('cafe') || norm.includes('ca phe') || norm.includes('tra') || norm.includes('coffee')) {
    category = 'CAFE_DRINK';
  } else if (norm.includes('lau') || norm.includes('hotpot')) {
    category = 'HOTPOT';
  } else if (norm.includes('pho')) {
    category = 'PHO';
  } else if (norm.includes('bun') || norm.includes('mi') || norm.includes('noodle')) {
    category = 'NOODLE';
  } else if (norm.includes('banh mi') || norm.includes('an nhanh') || norm.includes('fast food') || norm.includes('burger')) {
    category = 'FAST_FOOD';
  } else if (norm.includes('nuong') || norm.includes('bbq')) {
    category = 'BBQ';
  }

  // Vibe extraction
  let vibe = 'any';
  if (norm.includes('yen tinh') || norm.includes('hoc') || norm.includes('lam viec')) {
    vibe = 'quiet';
  } else if (norm.includes('chill') || norm.includes('hen ho') || norm.includes('view dep')) {
    vibe = 'aesthetic';
  } else if (norm.includes('tranh ngap') || norm.includes('duong thoang') || norm.includes('ne tac')) {
    vibe = 'dry_route';
  }

  return { category, radiusKm, vibe };
}

/**
 * Sequential Pipeline: Intent -> Filter -> Route -> Explain
 * 1. Intent & Radius Filter on real places database (Top 3-5 closest)
 * 2. Traffic & Routing Analysis via trafficSmartRoutingService
 * 3. Decision Logic: Weighted scoring (duration + traffic penalty + flood penalty)
 * 4. Gemini Explainability: Grounded reasoning without hallucinations
 */
export async function executeSmartSearch(options: SmartSearchOptions): Promise<SmartDecisionState | null> {
  const { query, places, userLocation, targetHour = new Date().getHours(), dayType = new Date().getDay() === 0 || new Date().getDay() === 6 ? 'weekend' : 'weekday' } = options;

  if (!query || !query.trim() || !Array.isArray(places) || places.length === 0) {
    return null;
  }

  // 1. Intent & Radius Filter on genuine places
  const constraints = parseQueryConstraints(query);
  if (constraints.category === 'none' || constraints.category === 'all') {
    // If not a recognized smart scenario (e.g. cafe, lau, noodle, pho, bbq, fast_food), return null
    return null;
  }
  const userCoords = userLocation || { latitude: 21.0365, longitude: 105.7895 }; // Default to Hanoi centre if GPS loading

  // Filter real candidates
  const matchingPlaces = places.filter((p) => {
    if (!p || typeof p.latitude !== 'number' || typeof p.longitude !== 'number') return false;

    const pNormCat = normalizeCategory(p);
    const pNameNorm = normalizeVietnameseText(p.name || '').toLowerCase();
    const pCatLabel = normalizeVietnameseText(p.categoryLabel || '').toLowerCase();

    // Category filter
    const isMatch =
      pNormCat === constraints.category ||
      pCatLabel.includes(constraints.category.toLowerCase()) ||
      pNameNorm.includes(constraints.category.toLowerCase());
    if (!isMatch) return false;

    // Distance filter
    const distMeters = getDistance(userCoords, { latitude: p.latitude, longitude: p.longitude });
    if (distMeters > constraints.radiusKm * 1000 * 1.3) {
      return false; // outside radius
    }

    return true;
  });

  if (matchingPlaces.length === 0) {
    return null;
  }

  // Sort by raw distance and take top 3-5 real candidate places
  const candidatePlaces = matchingPlaces
    .map((p) => ({
      place: p,
      distanceMeters: getDistance(userCoords, { latitude: p.latitude, longitude: p.longitude }),
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 5)
    .map((item) => item.place);

  if (candidatePlaces.length === 0) {
    return null;
  }

  // 2. Traffic & Routing Analysis using real traffic engine
  const trafficRoutes: TrafficRouteResult[] = analyzeTrafficRoutes({
    userLocation: userCoords,
    targetHour,
    dayType,
    places: candidatePlaces,
  });

  if (!trafficRoutes || trafficRoutes.length === 0) {
    return null;
  }

  // 3. Decision Logic: Calculate weighted scores
  // (duration + traffic penalty + flood penalty)
  const scoredRoutes = trafficRoutes.map((route) => {
    let trafficPenalty = 0;
    if (route.trafficLevel === 'jammed') trafficPenalty = 18;
    else if (route.trafficLevel === 'heavy') trafficPenalty = 10;
    else if (route.trafficLevel === 'moderate') trafficPenalty = 3;

    let floodPenalty = 0;
    const isHighFlood =
      route.weatherFlood?.routeFloodRisk === 'high_flood' ||
      route.weatherFlood?.destFloodRisk === 'high_flood';
    const isModerateFlood =
      route.weatherFlood?.routeFloodRisk === 'moderate' ||
      route.weatherFlood?.destFloodRisk === 'moderate';

    if (isHighFlood) {
      floodPenalty = 25;
    } else if (isModerateFlood) {
      floodPenalty = 10;
    }

    // Weighted decision score (lower is better)
    const totalDecisionScore = route.estimatedDurationMinutes + trafficPenalty + floodPenalty;

    return {
      route,
      totalDecisionScore,
      trafficPenalty,
      floodPenalty,
    };
  });

  // Sort by decision score ascending (Best option first)
  scoredRoutes.sort((a, b) => a.totalDecisionScore - b.totalDecisionScore);

  const bestRoute = scoredRoutes[0].route;

  // Find the physically closest route (by distance)
  const closestRoute = [...trafficRoutes].sort((a, b) => a.distanceMeters - b.distanceMeters)[0];
  const isDifferent = bestRoute.place.id !== closestRoute.place.id;

  // 4. Gemini Explainability: Grounded reasoning without hallucinations
  const optionsPayload: DestinationRoutingOption[] = trafficRoutes.map((r) => ({
    name: r.place.name,
    durationMins: r.estimatedDurationMinutes,
    distanceKm: Number((r.distanceMeters / 1000).toFixed(1)),
    trafficLevel: r.trafficLevel === 'smooth' ? 'Low' : r.trafficLevel === 'moderate' ? 'Moderate' : 'High',
    floodRisk:
      r.weatherFlood?.routeFloodRisk === 'high_flood' || r.weatherFlood?.destFloodRisk === 'high_flood'
        ? 'High'
        : 'Low',
  }));

  const selectedPayload =
    optionsPayload.find((o) => o.name === bestRoute.place.name) || optionsPayload[0];

  let explanation: SmartExplanationResult;
  try {
    explanation = await generateSmartExplanation(optionsPayload, selectedPayload);
  } catch {
    // Fallback guaranteed explanation
    if (isDifferent) {
      const diffMins = Math.max(1, Math.round(bestRoute.estimatedDurationMinutes - closestRoute.estimatedDurationMinutes));
      explanation = {
        headline: 'Đề xuất tối ưu né tắc đường & ngập úng',
        bulletPoints: [
          `Tuyến đường đi ${bestRoute.place.name} thông thoáng hơn`,
          `Tránh được khu vực ùn tắc của ${closestRoute.place.name}`,
        ],
        summary: `BiteQuest khuyên bạn nên đi ${bestRoute.place.name}, ${diffMins > 0 ? `xa hơn ${diffMins} phút, ` : ''}nhưng đường thoáng và an toàn hơn.`,
      };
    } else {
      explanation = {
        headline: `Lộ trình lý tưởng đến ${bestRoute.place.name}`,
        bulletPoints: [
          `Thời gian di chuyển: ~${bestRoute.estimatedDurationMinutes} phút (${bestRoute.distanceKmFormatted})`,
          `Tình trạng giao thông: ${bestRoute.trafficLabel}`,
        ],
        summary: `BiteQuest chọn ${bestRoute.place.name} vì đây là lựa chọn gần nhất, đường đi thuận tiện và thông thoáng.`,
      };
    }
  }

  return {
    bestRoute,
    closestRoute: isDifferent ? closestRoute : undefined,
    isDifferent,
    explanation,
    rawQuery: query,
    evaluatedPlacesCount: candidatePlaces.length,
  };
}
