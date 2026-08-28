import { BiteOpportunity, Place, DistrictPassport, User, BiteCheckin } from '../types';
import {
  generateBiteOpportunities,
  ExploreEngineParams,
  computeFoodPreferenceMatch,
  formatTruthfulRecency,
} from './exploreEngine';
import {
  CanonicalCategory,
  CANONICAL_CATEGORIES,
  getLocalizedCategoryLabel,
} from './maps/categoryNormalizer';

export type TodayOpportunityType =
  | 'PROXIMITY'
  | 'PREFERENCE_MATCH'
  | 'NEW_TO_YOU'
  | 'JOURNEY_MATCH'
  | 'SCOUT'
  | 'FRESH_VERIFIED';

export type TruthSource =
  | 'REAL_USER_DISCOVERY_LOCATION'
  | 'ACTIVE_DISCOVERY_ANCHOR'
  | 'VENUE_COORDINATES'
  | 'USER_EXPLICIT_PREFERENCE'
  | 'VENUE_CATEGORY'
  | 'USER_VERIFIED_BITE_HISTORY'
  | 'VENUE_ID'
  | 'AUTHORITATIVE_JOURNEY_STATE'
  | 'AUTHORITATIVE_VERIFIED_BITE_COUNT'
  | 'AUTHORITATIVE_LAST_VERIFIED_BITE_AT';

export const STARTER_QUEST_ADAPTER_POLICY = 'DROP_NOT_CONSUMER_SURFACED';

export type TodayCTA = 'OPEN_VENUE' | 'OPEN_MAP' | 'OPEN_JOURNEY';

export interface TodayOpportunity {
  id: string;
  venueId: string;
  type: TodayOpportunityType;
  title: string;
  reasonPrimary: string;
  reasonSecondary?: string;
  distanceMeters?: number;
  truthSources: TruthSource[];
  cta: TodayCTA;
  sourceOpportunityId?: string;
}

export interface TodayAdapterOptions {
  userPreferences?: string[];
  isRealUserLocation?: boolean;
  maxLimit?: number;
  visitedPlaceIds?: Set<string>;
  feedBites?: BiteCheckin[];
}

export interface TodayAdapterResult {
  opportunities: TodayOpportunity[];
  metadata: {
    inputOpportunityCount: number;
    dedupedVenueCount: number;
    todayOpportunityCount: number;
    isRealUserLocation: boolean;
  };
}

/**
 * Forbidden marketing / speculative copy that MUST NEVER be emitted to consumers.
 */
export const FORBIDDEN_CONSUMER_TERMS = [
  'Đang hot',
  'Phổ biến',
  'Được yêu thích',
  'Đang mở',
  'Giá tốt',
  'Rẻ',
  'Đáng tiền',
  'Bạn bè vừa ăn',
  'Đang thịnh hành',
  'Sắp hết cơ hội',
  'Nhiều người đang xem',
  'SCOUT_WINDOW',
  'QUEST_MATCH',
  'NEW_TO_YOU',
  'STARTER_QUEST',
  'FRESH_VERIFIED',
  'behavioral score',
  'confidence score',
] as const;

/**
 * Format meters to human readable distance string
 */
export function formatDistanceString(distanceMeters?: number): string {
  if (typeof distanceMeters !== 'number' || isNaN(distanceMeters)) return '';
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)}m`;
  }
  return `${(distanceMeters / 1000).toFixed(1)}km`;
}

/**
 * Standardize preference string into consumer-friendly Vietnamese title
 */
export function formatPreferenceName(pref?: string): string {
  if (!pref) return 'Ẩm thực yêu thích';
  const pLower = pref.toLowerCase().trim();
  if (
    pLower.includes('café') ||
    pLower.includes('cafe') ||
    pLower.includes('cà phê') ||
    pLower === 'coffee' ||
    pLower === 'cafe_drink'
  ) {
    return 'Cà phê';
  }
  if (pLower.includes('phở') || pLower === 'pho') {
    return 'Phở';
  }
  if (
    pLower.includes('bún') ||
    pLower.includes('mì') ||
    pLower.includes('mỳ') ||
    pLower === 'noodle' ||
    pLower === 'noodles'
  ) {
    return 'Bún/Mì';
  }
  if (pLower.includes('lẩu') || pLower === 'hotpot') {
    return 'Lẩu';
  }
  if (
    pLower.includes('nướng') ||
    pLower.includes('bbq') ||
    pLower === 'nuong' ||
    pLower === 'bbq_hotpot'
  ) {
    return 'Nướng';
  }
  if (
    pLower.includes('cơm') ||
    pLower.includes('xôi') ||
    pLower === 'rice' ||
    pLower === 'com'
  ) {
    return 'Cơm';
  }
  if (pLower.includes('nhà hàng') || pLower === 'restaurant') {
    return 'Nhà hàng';
  }
  if (
    pLower.includes('nhanh') ||
    pLower.includes('fast') ||
    pLower === 'fast_food' ||
    pLower === 'burger_western'
  ) {
    return 'Fast food';
  }
  if (
    pLower.includes('ngọt') ||
    pLower.includes('bánh') ||
    pLower === 'dessert' ||
    pLower === 'bakery' ||
    pLower === 'bakery_dessert'
  ) {
    return 'Bánh & Đồ ngọt';
  }
  if (
    pLower.includes('bia') ||
    pLower.includes('bar') ||
    pLower === 'bar_beer' ||
    pLower === 'drinks'
  ) {
    return 'Bar/Bia';
  }
  if (
    pLower.includes('chay') ||
    pLower === 'vegetarian' ||
    pLower === 'vegan'
  ) {
    return 'Chay';
  }
  if (
    pLower.includes('street') ||
    pLower.includes('đường phố') ||
    pLower.includes('ăn vặt') ||
    pLower === 'street_food'
  ) {
    return 'Ăn vặt';
  }
  if (pLower.includes('món việt') || pLower.includes('việt')) {
    return 'Món Việt';
  }
  if (pLower.includes('cay')) {
    return 'Món cay';
  }
  if (pLower.includes('nhật')) {
    return 'Món Nhật';
  }
  if (pLower.includes('gì cũng thử')) {
    return 'Khám phá đa dạng';
  }

  // CanonicalCategory Enum lookup
  const upperKey = pref.toUpperCase() as CanonicalCategory;
  if (upperKey in CANONICAL_CATEGORIES) {
    return CANONICAL_CATEGORIES[upperKey].shortLabel || CANONICAL_CATEGORIES[upperKey].label;
  }

  return pref.replace(/^[^a-zA-Z0-9À-ỹ]+/g, '').trim() || 'Ẩm thực';
}

/**
 * Map an internal BiteOpportunity to a truthful TodayOpportunity
 * Returns null if opportunity cannot be verified by an authentic consumer signal.
 */
export function mapInternalOpportunityToToday(
  opp: BiteOpportunity,
  options?: {
    userPreferences?: string[];
    isRealUserLocation?: boolean;
    visitedPlaceIds?: Set<string>;
  }
): TodayOpportunity | null {
  // Location truth: ONLY true when explicitly verified as real device location
  const isRealLocation = options?.isRealUserLocation === true;
  const userPreferences = options?.userPreferences;
  const place = opp.place;
  const distStr = formatDistanceString(opp.distanceMeters);

  // Proximity truth: "Gần bạn" is ONLY emitted when genuine real user device location is verified.
  // Fallback / searched map anchor emits "Trong khu vực đang xem".
  const locationTruthSource: TruthSource = isRealLocation
    ? 'REAL_USER_DISCOVERY_LOCATION'
    : 'ACTIVE_DISCOVERY_ANCHOR';

  const proximityCopy = isRealLocation
    ? (distStr ? `Gần bạn · ${distStr}` : 'Gần bạn')
    : (distStr ? `Trong khu vực đang xem · ${distStr}` : 'Trong khu vực đang xem');

  // Check explicit food preference match for secondary / primary enrichment
  const prefMatch = computeFoodPreferenceMatch(place, userPreferences);

  switch (opp.type) {
    case 'QUEST_MATCH': {
      const challengeTitle = opp.challengeTitle || opp.questMatch?.challengeTitle;
      const reasonPrimary = challengeTitle
        ? `Giúp hoàn thành mốc ${challengeTitle}`
        : 'Giúp hoàn thành mốc Hành trình';

      return {
        id: `today_${opp.id || opp.placeId}`,
        venueId: opp.placeId,
        type: 'JOURNEY_MATCH',
        title: place.name,
        reasonPrimary,
        reasonSecondary: proximityCopy,
        distanceMeters: opp.distanceMeters,
        truthSources: [
          'AUTHORITATIVE_JOURNEY_STATE',
          'VENUE_CATEGORY',
          locationTruthSource,
          'VENUE_COORDINATES',
        ],
        cta: 'OPEN_JOURNEY',
        sourceOpportunityId: opp.id,
      };
    }

    case 'SCOUT_WINDOW': {
      return {
        id: `today_${opp.id || opp.placeId}`,
        venueId: opp.placeId,
        type: 'SCOUT',
        title: place.name,
        reasonPrimary: 'Chưa có Verified Bite',
        reasonSecondary: proximityCopy,
        distanceMeters: opp.distanceMeters,
        truthSources: [
          'AUTHORITATIVE_VERIFIED_BITE_COUNT',
          locationTruthSource,
          'VENUE_COORDINATES',
        ],
        cta: 'OPEN_VENUE',
        sourceOpportunityId: opp.id,
      };
    }

    case 'FRESH_VERIFIED': {
      const recency = opp.verifiedAt ? formatTruthfulRecency(opp.verifiedAt) : null;
      const reasonPrimary = recency ? `Vừa có Verified Bite (${recency})` : 'Vừa có Verified Bite';

      return {
        id: `today_${opp.id || opp.placeId}`,
        venueId: opp.placeId,
        type: 'FRESH_VERIFIED',
        title: place.name,
        reasonPrimary,
        reasonSecondary: proximityCopy,
        distanceMeters: opp.distanceMeters,
        truthSources: [
          'AUTHORITATIVE_LAST_VERIFIED_BITE_AT',
          locationTruthSource,
          'VENUE_COORDINATES',
        ],
        cta: 'OPEN_VENUE',
        sourceOpportunityId: opp.id,
      };
    }

    case 'STARTER_QUEST': {
      // CAUSAL TRUTH POLICY: STARTER_QUEST itself is NEVER proof of preference or novelty.
      // 1. Independent Preference Match Check
      if (prefMatch.matchedPreference) {
        const prefLabel = formatPreferenceName(prefMatch.matchedPreference);
        return {
          id: `today_${opp.id || opp.placeId}`,
          venueId: opp.placeId,
          type: 'PREFERENCE_MATCH',
          title: place.name,
          reasonPrimary: `Hợp sở thích ${prefLabel}`,
          reasonSecondary: proximityCopy,
          distanceMeters: opp.distanceMeters,
          truthSources: [
            'USER_EXPLICIT_PREFERENCE',
            'VENUE_CATEGORY',
            locationTruthSource,
            'VENUE_COORDINATES',
          ],
          cta: 'OPEN_VENUE',
          sourceOpportunityId: opp.id,
        };
      }

      // 2. Independent Novelty Check (Requires explicit proof from user bite history)
      const venueKey = place.id || opp.placeId;
      const isIndependentlyUnvisited = options?.visitedPlaceIds
        ? !options.visitedPlaceIds.has(venueKey)
        : false;

      if (isIndependentlyUnvisited) {
        return {
          id: `today_${opp.id || opp.placeId}`,
          venueId: opp.placeId,
          type: 'NEW_TO_YOU',
          title: place.name,
          reasonPrimary: 'Bạn chưa từng Bite tại đây',
          reasonSecondary: proximityCopy,
          distanceMeters: opp.distanceMeters,
          truthSources: [
            'USER_VERIFIED_BITE_HISTORY',
            'VENUE_ID',
            locationTruthSource,
            'VENUE_COORDINATES',
          ],
          cta: 'OPEN_VENUE',
          sourceOpportunityId: opp.id,
        };
      }

      // 3. Fallback: STARTER_QUEST without independent proof is DROPPED
      return null;
    }

    case 'NEW_TO_YOU':
    default: {
      if (opp.id?.startsWith('opp_ambient_')) {
        const secondaryLabel =
          place.categoryLabel && !place.categoryLabel.includes('_')
            ? place.categoryLabel
            : getLocalizedCategoryLabel(place.category || 'RESTAURANT');
        return {
          id: `today_${opp.id || opp.placeId}`,
          venueId: opp.placeId,
          type: 'PROXIMITY',
          title: place.name,
          reasonPrimary: proximityCopy,
          reasonSecondary: secondaryLabel || place.address || 'Khám phá ẩm thực',
          distanceMeters: opp.distanceMeters,
          truthSources: [locationTruthSource, 'VENUE_COORDINATES', 'VENUE_CATEGORY'],
          cta: 'OPEN_VENUE',
          sourceOpportunityId: opp.id,
        };
      }

      if (prefMatch.matchedPreference) {
        const prefLabel = formatPreferenceName(prefMatch.matchedPreference);
        return {
          id: `today_${opp.id || opp.placeId}`,
          venueId: opp.placeId,
          type: 'PREFERENCE_MATCH',
          title: place.name,
          reasonPrimary: `Hợp sở thích ${prefLabel}`,
          reasonSecondary: proximityCopy,
          distanceMeters: opp.distanceMeters,
          truthSources: [
            'USER_EXPLICIT_PREFERENCE',
            'VENUE_CATEGORY',
            locationTruthSource,
            'VENUE_COORDINATES',
          ],
          cta: 'OPEN_VENUE',
          sourceOpportunityId: opp.id,
        };
      }

      return {
        id: `today_${opp.id || opp.placeId}`,
        venueId: opp.placeId,
        type: 'NEW_TO_YOU',
        title: place.name,
        reasonPrimary: 'Bạn chưa từng Bite tại đây',
        reasonSecondary: proximityCopy,
        distanceMeters: opp.distanceMeters,
        truthSources: [
          'USER_VERIFIED_BITE_HISTORY',
          'VENUE_ID',
          locationTruthSource,
          'VENUE_COORDINATES',
        ],
        cta: 'OPEN_VENUE',
        sourceOpportunityId: opp.id,
      };
    }
  }
}

/**
 * Adapter: Convert internal BiteOpportunities into clean, deduplicated, capped TodayOpportunities (Max 3)
 */
export function adaptBiteOpportunities(
  opportunities: BiteOpportunity[],
  options?: TodayAdapterOptions
): TodayAdapterResult {
  const maxLimit = options?.maxLimit ?? 3;
  const userPreferences = options?.userPreferences;
  const isRealUserLocation = options?.isRealUserLocation === true;
  const inputOpportunityCount = opportunities.length;

  const dedupedMap = new Map<string, TodayOpportunity>();

  for (const opp of opportunities) {
    if (!opp || !opp.place) continue;
    const venueId = opp.place.id || opp.placeId;
    if (!venueId) continue;

    // Deduplication policy: If venue already mapped, retain existing higher-priority candidate
    if (dedupedMap.has(venueId)) {
      continue;
    }

    const todayOpp = mapInternalOpportunityToToday(opp, {
      userPreferences,
      isRealUserLocation,
      visitedPlaceIds: options?.visitedPlaceIds,
    });

    // Drop opportunities that lack independent causal truth verification
    if (!todayOpp) {
      continue;
    }

    dedupedMap.set(venueId, todayOpp);
  }

  const allDeduped = Array.from(dedupedMap.values());
  const dedupedVenueCount = allDeduped.length;
  const todayOpportunities = allDeduped.slice(0, maxLimit);

  return {
    opportunities: todayOpportunities,
    metadata: {
      inputOpportunityCount,
      dedupedVenueCount,
      todayOpportunityCount: todayOpportunities.length,
      isRealUserLocation,
    },
  };
}

/**
 * Convenience orchestrator: Computes opportunities using existing Radar engine and adapts to Today
 */
export function getTodayOpportunities(params: ExploreEngineParams): TodayAdapterResult {
  const internalOpps = generateBiteOpportunities(params);
  const visitedPlaceIds = new Set(
    (params.feedBites || [])
      .filter((b) => b.userId === params.user?.id && b.isVerified)
      .map((b) => b.placeId)
  );

  return adaptBiteOpportunities(internalOpps, {
    userPreferences: params.user?.foodPreferences,
    isRealUserLocation: params.userLocation?.isRealUserLocation,
    visitedPlaceIds,
    maxLimit: 3,
  });
}
