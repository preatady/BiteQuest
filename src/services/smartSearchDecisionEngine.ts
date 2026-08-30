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
import { localIntentParser } from './searchIntentService';

export interface SmartDecisionState {
  bestRoute: TrafficRouteResult;
  closestRoute?: TrafficRouteResult;
  isDifferent: boolean;
  explanation: SmartExplanationResult;
  rawQuery: string;
  evaluatedPlacesCount: number;
  allRoutes?: TrafficRouteResult[];
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
  targetTime: number | null;
  cleanKeyword: string;
} {
  const local = localIntentParser(query);
  const norm = normalizeVietnameseText(query || '').toLowerCase();

  // Extract radius e.g., "2km", "3 km", "5km", "1.5km"
  let radiusKm = 10; // default 10km radius
  const radiusMatch = norm.match(/(\d+(?:\.\d+)?)\s*(?:km|kilo|cay)/);
  if (radiusMatch && radiusMatch[1]) {
    radiusKm = parseFloat(radiusMatch[1]);
  }

  // Category matching
  let category = 'none';
  if (local.category === 'rice' || norm.includes('com') || norm.includes('rice')) {
    category = 'RICE';
  } else if (local.category === 'hotpot' || norm.includes('lau') || norm.includes('hotpot')) {
    category = 'HOTPOT';
  } else if (local.category === 'cafe_drink' || norm.includes('cafe') || norm.includes('ca phe') || norm.includes('tra') || norm.includes('coffee')) {
    category = 'CAFE_DRINK';
  } else if (local.category === 'noodle' || norm.includes('pho') || norm.includes('bun') || norm.includes('mi') || norm.includes('noodle')) {
    category = norm.includes('pho') ? 'PHO' : 'NOODLE';
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

  return {
    category,
    radiusKm,
    vibe,
    targetTime: local.targetTime,
    cleanKeyword: local.cleanKeyword,
  };
}

/**
 * Sequential Pipeline: Intent -> Filter -> Route -> Explain
 * 1. Intent & Radius Filter on real places database (Top 3-5 closest)
 * 2. Traffic & Routing Analysis via trafficSmartRoutingService
 * 3. Decision Logic: Weighted scoring (duration + traffic penalty + flood penalty)
 * 4. Gemini Explainability: Grounded reasoning without hallucinations
 */
export async function executeSmartSearch(options: SmartSearchOptions): Promise<SmartDecisionState | null> {
  const { query, places, userLocation } = options;

  if (!query || !query.trim() || !Array.isArray(places) || places.length === 0) {
    return null;
  }

  // 1. Intent & Radius Filter on genuine places
  const localIntent = localIntentParser(query);
  const constraints = parseQueryConstraints(query);
  if (constraints.category === 'none' || constraints.category === 'all') {
    // If not a recognized smart scenario (e.g. cafe, lau, noodle, pho, bbq, fast_food, rice), return null
    return null;
  }

  const computedTargetHour =
    options.targetHour ??
    (constraints.targetTime !== null ? constraints.targetTime : new Date().getHours());
  const dayType =
    options.dayType ?? (new Date().getDay() === 0 || new Date().getDay() === 6 ? 'weekend' : 'weekday');
  const userCoords = userLocation || { latitude: 21.0365, longitude: 105.7895 }; // Default to Hanoi centre if GPS loading

  // Hard boundary: If intent is 'HOTPOT', drop everything that isn't HOTPOT before routing/scoring
  const strictFilteredPlaces = places.filter((place) => {
    if (!place || typeof place.latitude !== 'number' || typeof place.longitude !== 'number') return false;
    if (constraints.category === 'all') return true;
    const canonical = normalizeCategory(place);
    return canonical === constraints.category;
  });

  // If strictFilteredPlaces is empty, fallback to string match on name, but DO NOT pass completely irrelevant categories to the Decision Engine
  const candidatePool =
    strictFilteredPlaces.length > 0
      ? strictFilteredPlaces
      : places.filter((place) => {
          if (!place || typeof place.latitude !== 'number' || typeof place.longitude !== 'number') return false;
          const pNormCat = normalizeCategory(place);
          // Never allow cross-category match (e.g. cafe matching hotpot)
          if (constraints.category === 'HOTPOT' && pNormCat === 'CAFE_DRINK') return false;
          if (constraints.category === 'CAFE_DRINK' && (pNormCat === 'HOTPOT' || pNormCat === 'BBQ')) return false;

          const pNameNorm = normalizeVietnameseText(place.name || '').toLowerCase();
          const pCatLabel = normalizeVietnameseText(place.categoryLabel || '').toLowerCase();
          const catKey = constraints.category.toLowerCase();
          return pNameNorm.includes(catKey) || pCatLabel.includes(catKey);
        });

  // Distance filter: If explicit radius given in query, try filtering; otherwise take closest
  const radiusMeters = constraints.radiusKm * 1000 * 1.5;
  let matchingPlaces = candidatePool.filter((p) => {
    const distMeters = getDistance(userCoords, { latitude: p.latitude, longitude: p.longitude });
    return distMeters <= radiusMeters;
  });

  // Fallback to closest candidates if none within strict radius
  if (matchingPlaces.length === 0) {
    matchingPlaces = candidatePool;
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
    targetHour: computedTargetHour,
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

  // 4. Grounded Explainability with Real Temporal & Traffic Dynamics
  const optionsPayload: DestinationRoutingOption[] = trafficRoutes.map((r) => ({
    name: r.place.name,
    durationMins: r.estimatedDurationMinutes,
    distanceKm: Number((r.distanceMeters / 1000).toFixed(1)),
    trafficLevel: r.trafficLevel === 'smooth' ? 'Low' : r.trafficLevel === 'moderate' ? 'Moderate' : 'High',
    floodRisk:
      r.weatherFlood?.routeFloodRisk === 'high_flood' || r.weatherFlood?.destFloodRisk === 'high_flood'
        ? 'High'
        : 'Low',
    address: r.place.address || r.place.district || '',
    category: r.place.category || '',
  }));

  const selectedPayload =
    optionsPayload.find((o) => o.name === bestRoute.place.name) || optionsPayload[0];

  const closestPayload =
    optionsPayload.find((o) => o.name === closestRoute.place.name) || optionsPayload[0];

  const explanationContext = {
    rawQuery: query,
    targetHour: computedTargetHour,
    timeLabel: localIntent.timeLabel,
    timeContext: localIntent.timeContext,
    dayType,
    dishCategory: localIntent.category,
    closestOption: closestPayload,
    isDifferent,
  };

  const explanation = await generateSmartExplanation(optionsPayload, selectedPayload, explanationContext);

  return {
    bestRoute,
    closestRoute: isDifferent ? closestRoute : undefined,
    isDifferent,
    explanation,
    rawQuery: query,
    evaluatedPlacesCount: candidatePlaces.length,
    allRoutes: trafficRoutes,
  };
}
