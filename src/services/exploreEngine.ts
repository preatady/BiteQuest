import {
  Place,
  BiteCheckin,
  DistrictPassport,
  User,
  BiteOpportunity,
  OpportunityReason,
  OpportunityType,
  OpportunityActionType,
  OpportunityReasonData,
  FoodCategory,
} from '../types';
import { UnifiedPlace } from './maps/types';
import { normalizeCategory, getCategoryMetadata, doesCategoryMatch } from './maps/categoryNormalizer';
import { getDistance } from 'geolib';

export interface ExploreEngineParams {
  userLocation: { latitude: number; longitude: number; isRealUserLocation?: boolean };
  places: (Place | UnifiedPlace)[];
  feedBites: BiteCheckin[];
  passport?: DistrictPassport | null;
  user: User;
  savedPlaceIds?: string[];
  mode?: 'radar' | 'friends' | 'quest';
  /**
   * Flag indicating whether we are in an explicit demo/test fixture environment.
   * In production (isDemo !== true), all synthetic social signals, seed scout spots,
   * and unverified recency timestamps are strictly excluded.
   */
  isDemo?: boolean;
}

/**
 * Normalizes a CanonicalCategory string to FoodCategory
 */
function canonicalCategoryToFoodCategory(cat: string): FoodCategory {
  switch (cat) {
    case 'CAFE_DRINK':
      return 'coffee';
    case 'PHO':
    case 'NOODLE':
      return 'noodles';
    case 'RICE':
      return 'rice';
    case 'BAKERY_DESSERT':
      return 'dessert';
    case 'FAST_FOOD':
      return 'burger_western';
    case 'HOTPOT':
    case 'BBQ':
      return 'bbq_hotpot';
    case 'BAR_BEER':
      return 'drinks';
    case 'VEGETARIAN':
    case 'RESTAURANT':
    case 'OTHER_FOOD':
    default:
      return 'street_food';
  }
}

/**
 * Normalize any UnifiedPlace or Place to the standard Place structure for engine evaluation
 */
export function normalizePlaceForEngine(raw: Place | UnifiedPlace): Place {
  if ('priceBand' in raw && typeof (raw as Place).priceBand === 'string' && 'imageUrl' in raw && 'rating' in raw) {
    return raw as Place;
  }
  const unified = raw as UnifiedPlace;
  const canonicalCat = normalizeCategory({
    name: unified.name,
    category: unified.category,
    categoryLabel: unified.categoryLabel,
    categories: (unified as any).categories,
  });
  const foodCat: FoodCategory = canonicalCategoryToFoodCategory(canonicalCat);

  return {
    id: unified.id,
    canonicalVenueId: unified.canonicalVenueId || unified.id,
    googlePlaceId: unified.providerId,
    providerPlaceId: unified.providerId,
    name: unified.name,
    category: foodCat,
    categoryLabel: unified.categoryLabel || getCategoryMetadata(canonicalCat)?.label || 'Quán ăn',
    address: unified.address || '',
    district: unified.district || 'Cầu Giấy',
    latitude: unified.latitude,
    longitude: unified.longitude,
    priceBand: unified.priceBand || '₫₫',
    priceMin: unified.priceMin || 30000,
    priceMax: unified.priceMax || 70000,
    rating: unified.rating || 4.5,
    reviewCount: unified.reviewCount || 0,
    imageUrl: unified.imageUrl || '',
    isOpen: unified.isOpen ?? true,
    openingHoursText: unified.openingHoursText || '07:00 - 22:00',
    isCommunitySpot: unified.isCommunitySpot,
    communityStatus: unified.communityStatus,
    communityVerified: unified.communityVerified,
    firstDiscovererId: unified.firstDiscovererId,
    firstDiscovererName: unified.firstDiscovererName,
    createdAt: (unified as any).createdAt,
    verifiedByUserId: (unified as any).verifiedByUserId,
    verifiedAt: (unified as any).verifiedAt,
    lastVerifiedBiteAt: unified.lastVerifiedBiteAt,
    verifiedBiteCount: unified.verifiedBiteCount,
  };
}

/**
 * Known static seed community/demo spot IDs that lack runtime verification authority
 */
export const SEED_COMMUNITY_SPOT_IDS = new Set([
  'place_banh_cuon_co_hanh',
  'place_nem_nuong_co_diep',
  'vn_comm_place_banh_cuon_co_hanh',
  'vn_comm_place_nem_nuong_co_diep',
]);

/**
 * Centralized Scoring Configuration for Behavioral Engine V1
 */
export const OPPORTUNITY_CONFIG = {
  typeWeights: {
    SCOUT_WINDOW: 45,
    FRESH_VERIFIED: 40,
    QUEST_MATCH: 35,
    STARTER_QUEST: 25,
    NEW_TO_YOU: 15,
  },
  proximityBuckets: [
    { maxMeters: 500, score: 20 },
    { maxMeters: 1000, score: 15 },
    { maxMeters: 2000, score: 8 },
    { maxMeters: 4000, score: 3 },
  ],
  freshnessBuckets: [
    { maxMinutes: 30, score: 20 },
    { maxMinutes: 120, score: 15 },
    { maxMinutes: 360, score: 8 },
    { maxMinutes: 1440, score: 3 },
  ],
  questGoalGradient: {
    oneRemaining: 25,
    twoRemaining: 15,
    moreRemaining: 5,
  },
  savedPlaceBonus: 10,
  questModeBoost: {
    questMatch: 15,
    scoutWindow: 10,
  },
  attentionBudget: {
    carouselMax: 3,
    promotedMapMax: 7,
  },
  diversityTolerance: 10,
};

// ============================================================================
// 1. INDEPENDENT ELIGIBILITY FUNCTIONS
// ============================================================================

export interface QuestMatchEligibility {
  challengeId: string;
  challengeTitle: string;
  challengeIcon: string;
  rewardXp: number;
  passportId?: string;
  passportName?: string;
  remainingChallengesCount: number;
}

/**
 * Check if a place matches an incomplete challenge in an active passport
 */
export function matchPassportChallenge(
  place: Place,
  passport?: DistrictPassport | null
): QuestMatchEligibility | null {
  if (!passport || !Array.isArray(passport.challenges) || passport.challenges.length === 0) {
    return null;
  }

  // Verify district constraint: genuine passport challenge only applies to places in that district
  if (place.district && passport.districtName) {
    const pDist = place.district.trim().toLowerCase();
    const passDist = passport.districtName.trim().toLowerCase();
    if (!pDist.includes(passDist) && !passDist.includes(pDist)) {
      return null;
    }
  }

  const incompleteChallenges = passport.challenges.filter((c) => !c.isCompleted);
  const remainingChallengesCount = incompleteChallenges.length;

  for (const challenge of incompleteChallenges) {
    // 1. Alley / Street Food Challenge
    if (challenge.type === 'alley') {
      const addressLower = (place.address || '').toLowerCase();
      const nameLower = (place.name || '').toLowerCase();
      const isAlley =
        addressLower.includes('ngõ') ||
        addressLower.includes('hẻm') ||
        addressLower.includes('ngách') ||
        nameLower.includes('ngõ') ||
        place.category === 'street_food';
      if (isAlley) {
        return {
          challengeId: challenge.id,
          challengeTitle: challenge.title,
          challengeIcon: challenge.icon || '🛵',
          rewardXp: challenge.rewardXp || 50,
          passportId: passport.id,
          passportName: passport.districtName,
          remainingChallengesCount,
        };
      }
    }

    // 2. New Spot / Community Discovery Challenge
    if (challenge.type === 'new_spot') {
      if (place.isCommunitySpot && (!place.communityVerified || place.communityStatus === 'pending')) {
        return {
          challengeId: challenge.id,
          challengeTitle: challenge.title,
          challengeIcon: challenge.icon || '✨',
          rewardXp: challenge.rewardXp || 100,
          passportId: passport.id,
          passportName: passport.districtName,
          remainingChallengesCount,
        };
      }
    }

    // 3. Category Match (noodles, rice, coffee, dessert, etc.)
    if (challenge.type === 'category' && challenge.category) {
      const placeCat = place.category || normalizeCategory(place);
      if (
        place.category === challenge.category ||
        doesCategoryMatch(placeCat, challenge.category)
      ) {
        return {
          challengeId: challenge.id,
          challengeTitle: challenge.title,
          challengeIcon: challenge.icon || '🍜',
          rewardXp: challenge.rewardXp || 50,
          passportId: passport.id,
          passportName: passport.districtName,
          remainingChallengesCount,
        };
      }
    }
  }

  return null;
}

/**
 * Check if a place is novel to the current user's verified bite history (NEW_TO_YOU)
 */
export function checkNewToYouEligibility(
  place: Place,
  userVerifiedBites: BiteCheckin[]
): boolean {
  const hasUserBittenHere = userVerifiedBites.some((b) => {
    if (b.placeId === place.id) return true;
    if (place.providerPlaceId && (b.placeId === place.providerPlaceId || b.providerPlaceId === place.providerPlaceId)) return true;
    if (b.providerPlaceId && (b.providerPlaceId === place.id || b.providerPlaceId === place.providerPlaceId)) return true;
    if (place.googlePlaceId && (b.placeId === place.googlePlaceId || (b as any).googlePlaceId === place.googlePlaceId)) return true;
    return false;
  });

  return !hasUserBittenHere;
}

export interface ScoutWindowEligibility {
  firstDiscovererId: string;
  firstDiscovererName: string;
  createdAt: string;
  recency: string | null;
}

/**
 * Check if a place qualifies for SCOUT_WINDOW (Unverified community spot created by another user)
 */
export function checkScoutWindowEligibility(
  place: Place,
  currentUserId: string,
  isDemo = false
): ScoutWindowEligibility | null {
  if (!place.isCommunitySpot) return null;
  if (place.communityVerified || place.communityStatus === 'verified') return null;
  if (!place.firstDiscovererId) return null;
  if (place.firstDiscovererId === currentUserId) return null; // Creator cannot verify own spot

  const isSeedSpot = SEED_COMMUNITY_SPOT_IDS.has(place.id);
  if (isSeedSpot && !isDemo) return null;

  if (!place.createdAt) return null;
  const createdTime = new Date(place.createdAt).getTime();
  if (isNaN(createdTime)) return null;

  const recency = formatTruthfulRecency(place.createdAt);

  return {
    firstDiscovererId: place.firstDiscovererId,
    firstDiscovererName: place.firstDiscovererName || 'Bite Explorer',
    createdAt: place.createdAt,
    recency,
  };
}

export interface FreshVerifiedEligibility {
  verifiedAt: string;
  verifiedByUserId?: string;
  recency: string | null;
  ageMinutes: number;
}

/**
 * Check if a place qualifies for FRESH_VERIFIED (Authoritative verified bite within maxAgeHours)
 */
export function checkFreshVerifiedEligibility(
  place: Place,
  isDemo = false,
  maxAgeHours = 72
): FreshVerifiedEligibility | null {
  // Authoritative timestamp of the most recent verified bite at this venue
  const verifiedTimestamp = place.lastVerifiedBiteAt || place.verifiedAt;
  if (!verifiedTimestamp) return null;

  const isSeedSpot = SEED_COMMUNITY_SPOT_IDS.has(place.id);
  if (isSeedSpot && !isDemo) return null;

  const verifiedTime = new Date(verifiedTimestamp).getTime();
  if (isNaN(verifiedTime)) return null;

  const diffMs = Date.now() - verifiedTime;
  if (diffMs < 0) return null;

  const diffHours = diffMs / 3600000;
  if (diffHours > maxAgeHours) return null;

  const ageMinutes = Math.floor(diffMs / 60000);
  const recency = formatTruthfulRecency(verifiedTimestamp);

  return {
    verifiedAt: verifiedTimestamp,
    verifiedByUserId: place.verifiedByUserId,
    recency,
    ageMinutes,
  };
}

/**
 * Check if user is an authentic starter explorer (0 verified bites)
 */
export function checkStarterQuestEligibility(
  verifiedBiteCount: number,
  distanceMeters: number,
  maxDistance = 4000
): boolean {
  return verifiedBiteCount === 0 && distanceMeters <= maxDistance;
}

/**
 * Backwards-compatible helper for user starter status
 */
export function isStarterExplorer(user?: User | null, feedBites: BiteCheckin[] = []): boolean {
  if (!user) return false;
  const verifiedUserBites = feedBites.filter((b) => b.userId === user.id && b.isVerified);
  const userPlacesDiscovered = user.stats?.placesDiscovered || 0;
  const userFirstBites = user.stats?.firstBitesCount || 0;

  return (
    verifiedUserBites.length === 0 &&
    userPlacesDiscovered === 0 &&
    userFirstBites === 0 &&
    (user.level || 1) <= 1
  );
}

/**
 * Parses elapsed time into human-readable Vietnamese recency only if a real date timestamp exists.
 */
export function formatTruthfulRecency(timestampStr?: string): string | null {
  if (!timestampStr) return null;
  const time = new Date(timestampStr).getTime();
  if (isNaN(time)) return null;

  const diffMs = Date.now() - time;
  if (diffMs < 0) return null;

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 5) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours}h trước`;
  if (diffDays === 1) return 'Hôm qua';
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return null;
}

// ============================================================================
// 2. DETERMINISTIC SCORING HELPERS
// ============================================================================

export function computeProximityScore(distanceMeters: number): number {
  if (distanceMeters <= 500) return 20;
  if (distanceMeters <= 1000) return 15;
  if (distanceMeters <= 2000) return 8;
  if (distanceMeters <= 4000) return 3;
  return 0;
}

export function computeFreshnessScore(timestampStr?: string): number {
  if (!timestampStr) return 0;
  const time = new Date(timestampStr).getTime();
  if (isNaN(time)) return 0;

  const diffMinutes = Math.floor((Date.now() - time) / 60000);
  if (diffMinutes < 0) return 0;

  if (diffMinutes <= 30) return 20;
  if (diffMinutes <= 120) return 15;
  if (diffMinutes <= 360) return 8;
  if (diffMinutes <= 1440) return 3;
  return 0;
}

export function computeQuestCompletionScore(remainingChallengesCount: number): number {
  if (remainingChallengesCount === 1) return 25;
  if (remainingChallengesCount === 2) return 15;
  if (remainingChallengesCount > 2) return 5;
  return 0;
}

/**
 * Computes deterministic preference boost when a venue aligns with user's selected food preferences
 */
export function computeFoodPreferenceMatch(
  place: Place,
  userPreferences?: string[]
): { score: number; matchedPreference?: string } {
  if (!userPreferences || userPreferences.length === 0) return { score: 0 };
  const canonicalCat = normalizeCategory(place);
  const pName = (place.name || '').toLowerCase();
  const pCatLabel = (place.categoryLabel || '').toLowerCase();
  const addressLower = (place.address || '').toLowerCase();

  for (const pref of userPreferences) {
    const pLower = pref.toLowerCase().trim();
    let isMatched = false;

    if (pLower.includes('café') || pLower.includes('cafe') || pLower.includes('cà phê') || pLower === 'coffee' || pLower === 'cafe_drink') {
      if (canonicalCat === 'CAFE_DRINK' || pName.includes('cafe') || pName.includes('cà phê')) {
        isMatched = true;
      }
    } else if (pLower.includes('món việt') || pLower.includes('viet')) {
      if (['PHO', 'NOODLE', 'RICE'].includes(canonicalCat)) {
        isMatched = true;
      }
    } else if (pLower.includes('phở') || pLower === 'pho') {
      if (canonicalCat === 'PHO' || pName.includes('phở')) {
        isMatched = true;
      }
    } else if (pLower.includes('bún') || pLower.includes('bun') || pLower.includes('mì') || pLower.includes('noodle') || pLower === 'noodles') {
      if (canonicalCat === 'NOODLE' || canonicalCat === 'PHO' || pName.includes('bún') || pName.includes('mì')) {
        isMatched = true;
      }
    } else if (pLower.includes('cơm') || pLower.includes('com') || pLower.includes('rice') || pLower === 'rice') {
      if (canonicalCat === 'RICE' || pName.includes('cơm')) {
        isMatched = true;
      }
    } else if (pLower.includes('chay') || pLower === 'vegetarian' || pLower === 'vegan') {
      if (canonicalCat === 'VEGETARIAN' || pName.includes('chay')) {
        isMatched = true;
      }
    } else if (pLower.includes('ngọt') || pLower.includes('bánh') || pLower === 'dessert' || pLower === 'bakery' || pLower === 'bakery_dessert') {
      if (canonicalCat === 'BAKERY_DESSERT' || pCatLabel.includes('bánh') || pCatLabel.includes('đồ ngọt')) {
        isMatched = true;
      }
    } else if (pLower.includes('lẩu') || pLower === 'hotpot') {
      if (canonicalCat === 'HOTPOT' || pName.includes('lẩu')) {
        isMatched = true;
      }
    } else if (pLower.includes('nướng') || pLower === 'bbq' || pLower === 'nuong' || pLower.includes('grill')) {
      if (canonicalCat === 'BBQ' || pName.includes('nướng')) {
        isMatched = true;
      }
    } else if (pLower.includes('nhanh') || pLower.includes('fast') || pLower === 'burger_western' || pLower === 'fast_food') {
      if (canonicalCat === 'FAST_FOOD') {
        isMatched = true;
      }
    } else if (pLower.includes('bia') || pLower.includes('bar') || pLower === 'drinks' || pLower === 'bar_beer') {
      if (canonicalCat === 'BAR_BEER') {
        isMatched = true;
      }
    } else if (pLower.includes('nhà hàng') || pLower === 'restaurant') {
      if (canonicalCat === 'RESTAURANT') {
        isMatched = true;
      }
    } else if (
      pLower.includes('street') ||
      pLower.includes('đường phố') ||
      pLower.includes('ăn vặt') ||
      pLower === 'street_food'
    ) {
      if (
        addressLower.includes('ngõ') ||
        addressLower.includes('hẻm') ||
        pName.includes('ăn vặt') ||
        pCatLabel.includes('đường phố') ||
        pCatLabel.includes('ăn vặt')
      ) {
        isMatched = true;
      }
    }

    if (isMatched) {
      return { score: 12, matchedPreference: pref };
    }
  }

  return { score: 0 };
}

// ============================================================================
// 3. CONSUMER PRESENTATION BUILDER
// ============================================================================

export interface PresentationData {
  reasonData: OpportunityReasonData;
  reasons: OpportunityReason[];
  actionType: OpportunityActionType;
}

export function buildOpportunityPresentation(
  type: OpportunityType,
  place: Place,
  distanceMeters: number,
  options?: {
    questMatch?: QuestMatchEligibility;
    scoutData?: ScoutWindowEligibility;
    freshVerified?: FreshVerifiedEligibility;
  }
): PresentationData {
  const distanceText =
    distanceMeters < 1000 ? `${distanceMeters}m` : `${(distanceMeters / 1000).toFixed(1)}km`;

  switch (type) {
    case 'SCOUT_WINDOW': {
      const recencyStr = options?.scoutData?.recency ? ` · ${options.scoutData.recency}` : '';
      return {
        actionType: 'scout',
        reasonData: {
          badgeText: '🥇 First Verifier',
          title: 'Chưa ai xác minh địa điểm này',
          subtitle: `Cơ hội nhận danh hiệu First Verifier${recencyStr}`,
          icon: '🥇',
          highlight: 'Scout Window Active',
          ctaText: 'Đi xác minh',
          ctaIcon: 'verified',
        },
        reasons: [
          {
            icon: '🥇',
            text: 'Chưa ai xác minh · Cơ hội nhận First Verifier',
            highlight: 'Scout Window Active',
            badgeType: 'scout',
          },
        ],
      };
    }

    case 'QUEST_MATCH': {
      const remaining = options?.questMatch?.remainingChallengesCount || 3;
      const passportName = options?.questMatch?.passportName || place.district || 'khu vực';
      const isLastOne = remaining === 1;

      const title = isLastOne
        ? `Còn 1 Bite để hoàn thành Hành trình ${passportName}`
        : `Hoàn thành "${options?.questMatch?.challengeTitle || 'Thử thách'}"`;

      const badgeText = isLastOne ? '🗺️ Sắp hoàn thành' : '🗺️ Hành trình';

      return {
        actionType: 'quest',
        reasonData: {
          badgeText,
          title,
          subtitle: `+${options?.questMatch?.rewardXp || 50} XP Hành trình`,
          icon: options?.questMatch?.challengeIcon || '🎯',
          highlight: isLastOne ? 'Sắp hoàn thành' : `+${options?.questMatch?.rewardXp || 50} XP`,
          ctaText: 'Hoàn thành thử thách',
          ctaIcon: 'flag',
        },
        reasons: [
          {
            icon: options?.questMatch?.challengeIcon || '🎯',
            text: title,
            highlight: `+${options?.questMatch?.rewardXp || 50} XP Hành trình`,
            badgeType: 'quest',
          },
        ],
      };
    }

    case 'FRESH_VERIFIED': {
      const recency = options?.freshVerified?.recency || 'gần đây';
      return {
        actionType: 'explore',
        reasonData: {
          badgeText: '✨ Vừa xác minh',
          title: 'Được xác minh độc lập bởi cộng đồng',
          subtitle: `Xác minh ${recency}`,
          icon: '🛡️',
          highlight: 'Xác minh gần đây',
          ctaText: 'Khám phá',
          ctaIcon: 'explore',
        },
        reasons: [
          {
            icon: '🛡️',
            text: `Được xác minh độc lập bởi cộng đồng · ${recency}`,
            highlight: 'Xác minh gần đây',
            badgeType: 'freshness',
          },
        ],
      };
    }

    case 'STARTER_QUEST': {
      return {
        actionType: 'starter',
        reasonData: {
          badgeText: '🎯 Bite đầu tiên',
          title: 'Bắt đầu hành trình BiteQuest tại điểm ẩm thực gần bạn',
          subtitle: `${distanceText} · Địa điểm thực tế đã sẵn sàng`,
          icon: '🌱',
          highlight: 'Bite đầu tiên',
          ctaText: 'Bắt đầu Bite',
          ctaIcon: 'explore',
        },
        reasons: [
          {
            icon: '🌱',
            text: 'Bắt đầu hành trình BiteQuest tại điểm ẩm thực gần bạn',
            highlight: 'Bite đầu tiên',
            badgeType: 'novelty',
          },
        ],
      };
    }

    case 'NEW_TO_YOU':
    default: {
      return {
        actionType: 'explore',
        reasonData: {
          badgeText: '👀 Mới với bạn',
          title: 'Bạn chưa từng Bite tại đây',
          subtitle: place.categoryLabel || place.address || 'Địa điểm khám phá',
          icon: '✨',
          highlight: 'Điểm khám phá mới',
          ctaText: 'Khám phá',
          ctaIcon: 'explore',
        },
        reasons: [
          {
            icon: '✨',
            text: 'Bạn chưa từng Bite tại đây',
            highlight: 'Điểm khám phá mới',
            badgeType: 'novelty',
          },
        ],
      };
    }
  }
}

// ============================================================================
// 4. MAIN BEHAVIORAL ENGINE PIPELINE
// ============================================================================

/**
 * BiteQuest Behavioral Engine V1: Top 3 Truthful Reasons To Go
 * 
 * Pipeline Stages:
 * 1. Raw trustworthy state normalization
 * 2. Independent eligibility evaluation per place
 * 3. Candidate scoring (type weight + proximity + freshness + quest gradient)
 * 4. Venue deduplication (strongest opportunity per venue)
 * 5. Diversity promotion & Top 3 selection
 */
export function generateBiteOpportunities({
  userLocation,
  places,
  feedBites,
  passport,
  user,
  savedPlaceIds = [],
  mode = 'radar',
  isDemo = false,
}: ExploreEngineParams): BiteOpportunity[] {
  // Authoritative verified bite history for current user
  const userVerifiedBites = feedBites.filter((b) => b.userId === user.id && b.isVerified);
  const userVerifiedBiteCount = userVerifiedBites.length;
  const isStarter = checkStarterQuestEligibility(userVerifiedBiteCount, 0, Infinity) && isStarterExplorer(user, feedBites);

  const venueCandidates: BiteOpportunity[] = [];
  const seenPlaceKeys = new Set<string>();

  const hasLiveVenues = places.some(
    (p) => Boolean((p as any).providerPlaceId || (p as any).googlePlaceId || p.id?.startsWith('vn_geoapify_'))
  );

  for (const rawPlace of places) {
    const place = normalizePlaceForEngine(rawPlace);
    // Canonical place deduplication key
    const placeKey = place.providerPlaceId || place.id;
    if (seenPlaceKeys.has(placeKey)) continue;
    seenPlaceKeys.add(placeKey);

    // Strict Seed Policy: When live provider venues exist and isDemo === false,
    // do not source recommendations from embedded static seed fixtures
    if (!isDemo && hasLiveVenues) {
      const isSeedId =
        SEED_COMMUNITY_SPOT_IDS.has(place.id) ||
        SEED_COMMUNITY_SPOT_IDS.has(place.providerPlaceId || '') ||
        place.id?.startsWith('place_') ||
        (place.providerPlaceId?.startsWith('place_') && place.isCommunitySpot);

      if (isSeedId) {
        continue;
      }
    }

    const distanceMeters = getDistance(
      { latitude: userLocation.latitude, longitude: userLocation.longitude },
      { latitude: place.latitude, longitude: place.longitude }
    );

    const proximityScore = computeProximityScore(distanceMeters);
    const isSaved = savedPlaceIds.includes(place.id);
    const bookmarkScore = isSaved ? OPPORTUNITY_CONFIG.savedPlaceBonus : 0;

    // Check all eligible signals for this venue
    const eligibleOpportunitiesForPlace: BiteOpportunity[] = [];

    // 1. SCOUT_WINDOW ELIGIBILITY
    const scoutEligible = checkScoutWindowEligibility(place, user.id, isDemo);
    if (scoutEligible) {
      const freshnessScore = computeFreshnessScore(scoutEligible.createdAt);
      let score = OPPORTUNITY_CONFIG.typeWeights.SCOUT_WINDOW + proximityScore + freshnessScore + bookmarkScore;
      if (mode === 'quest') score += OPPORTUNITY_CONFIG.questModeBoost.scoutWindow;

      const presentation = buildOpportunityPresentation('SCOUT_WINDOW', place, distanceMeters, {
        scoutData: scoutEligible,
      });

      eligibleOpportunitiesForPlace.push({
        id: `opp_scout_${place.id}`,
        placeId: place.id,
        providerPlaceId: place.providerPlaceId,
        type: 'SCOUT_WINDOW',
        score,
        distanceMeters,
        reasonData: presentation.reasonData,
        actionType: presentation.actionType,
        reasons: presentation.reasons,
        place,
        createdAt: scoutEligible.createdAt,
        firstDiscovererId: scoutEligible.firstDiscovererId,
        scoutData: {
          discoveredBy: scoutEligible.firstDiscovererName,
          discoveredAgo: scoutEligible.recency || '',
          isFirstVerifierAvailable: true,
          independentVerificationCount: 0,
        },
      });
    }

    // 2. QUEST_MATCH ELIGIBILITY
    const questEligible = matchPassportChallenge(place, passport);
    if (questEligible) {
      const questCompletionScore = computeQuestCompletionScore(questEligible.remainingChallengesCount);
      let score =
        OPPORTUNITY_CONFIG.typeWeights.QUEST_MATCH +
        proximityScore +
        questCompletionScore +
        bookmarkScore;
      if (mode === 'quest') score += OPPORTUNITY_CONFIG.questModeBoost.questMatch;

      const presentation = buildOpportunityPresentation('QUEST_MATCH', place, distanceMeters, {
        questMatch: questEligible,
      });

      eligibleOpportunitiesForPlace.push({
        id: `opp_quest_${place.id}`,
        placeId: place.id,
        providerPlaceId: place.providerPlaceId,
        type: 'QUEST_MATCH',
        score,
        distanceMeters,
        reasonData: presentation.reasonData,
        actionType: presentation.actionType,
        reasons: presentation.reasons,
        place,
        passportId: questEligible.passportId,
        challengeId: questEligible.challengeId,
        challengeTitle: questEligible.challengeTitle,
        remainingChallengesCount: questEligible.remainingChallengesCount,
        questMatch: {
          passportId: questEligible.passportId,
          challengeId: questEligible.challengeId,
          challengeTitle: questEligible.challengeTitle,
          challengeIcon: questEligible.challengeIcon,
          rewardXp: questEligible.rewardXp,
        },
      });
    }

    // 3. FRESH_VERIFIED ELIGIBILITY
    const freshEligible = checkFreshVerifiedEligibility(place, isDemo, 72);
    if (freshEligible) {
      const freshnessScore = computeFreshnessScore(freshEligible.verifiedAt);
      const score = OPPORTUNITY_CONFIG.typeWeights.FRESH_VERIFIED + proximityScore + freshnessScore + bookmarkScore;

      const presentation = buildOpportunityPresentation('FRESH_VERIFIED', place, distanceMeters, {
        freshVerified: freshEligible,
      });

      eligibleOpportunitiesForPlace.push({
        id: `opp_fresh_${place.id}`,
        placeId: place.id,
        providerPlaceId: place.providerPlaceId,
        type: 'FRESH_VERIFIED',
        score,
        distanceMeters,
        reasonData: presentation.reasonData,
        actionType: presentation.actionType,
        reasons: presentation.reasons,
        place,
        verifiedAt: freshEligible.verifiedAt,
      });
    }

    // 4. STARTER_QUEST ELIGIBILITY (Only for 0-bite explorer within practical distance)
    const prefMatch = computeFoodPreferenceMatch(place, user.foodPreferences);
    if (isStarter && distanceMeters <= 4000) {
      const score = OPPORTUNITY_CONFIG.typeWeights.STARTER_QUEST + proximityScore + bookmarkScore + prefMatch.score;

      const presentation = buildOpportunityPresentation('STARTER_QUEST', place, distanceMeters);

      eligibleOpportunitiesForPlace.push({
        id: `opp_starter_${place.id}`,
        placeId: place.id,
        providerPlaceId: place.providerPlaceId,
        type: 'STARTER_QUEST',
        score,
        distanceMeters,
        reasonData: presentation.reasonData,
        actionType: presentation.actionType,
        reasons: presentation.reasons,
        place,
      });
    }

    // 5. NEW_TO_YOU ELIGIBILITY
    const isNewToUser = checkNewToYouEligibility(place, userVerifiedBites);
    if (isNewToUser) {
      const score = OPPORTUNITY_CONFIG.typeWeights.NEW_TO_YOU + proximityScore + bookmarkScore + prefMatch.score;

      const presentation = buildOpportunityPresentation('NEW_TO_YOU', place, distanceMeters);
      if (prefMatch.matchedPreference) {
        presentation.reasonData.subtitle = `Hợp sở thích (${prefMatch.matchedPreference}) · ${place.categoryLabel || place.address || 'Quán mới'}`;
        presentation.reasons.unshift({
          icon: '✨',
          text: `Phù hợp sở thích ${prefMatch.matchedPreference}`,
          highlight: 'Hợp sở thích',
          badgeType: 'novelty',
        });
      }

      eligibleOpportunitiesForPlace.push({
        id: `opp_new_${place.id}`,
        placeId: place.id,
        providerPlaceId: place.providerPlaceId,
        type: 'NEW_TO_YOU',
        score,
        distanceMeters,
        reasonData: presentation.reasonData,
        actionType: presentation.actionType,
        reasons: presentation.reasons,
        place,
      });
    } else {
      // General ambient fallback opportunity if visited before
      const score = proximityScore + bookmarkScore + prefMatch.score;
      eligibleOpportunitiesForPlace.push({
        id: `opp_ambient_${place.id}`,
        placeId: place.id,
        providerPlaceId: place.providerPlaceId,
        type: 'NEW_TO_YOU',
        score,
        distanceMeters,
        reasons: [
          {
            icon: '📍',
            text: place.address || 'Địa điểm ẩm thực gần bạn',
            badgeType: 'novelty',
          },
        ],
        place,
      });
    }

    // Deduplication per venue: Select the STRONGEST opportunity reason for this venue
    if (eligibleOpportunitiesForPlace.length > 0) {
      eligibleOpportunitiesForPlace.sort((a, b) => b.score - a.score);
      const strongestOpp = eligibleOpportunitiesForPlace[0];

      // If there was also a quest match but primary was different, retain quest info for secondary view
      if (questEligible && strongestOpp.type !== 'QUEST_MATCH' && !strongestOpp.questMatch) {
        strongestOpp.questMatch = {
          passportId: questEligible.passportId,
          challengeId: questEligible.challengeId,
          challengeTitle: questEligible.challengeTitle,
          challengeIcon: questEligible.challengeIcon,
          rewardXp: questEligible.rewardXp,
        };
      }

      venueCandidates.push(strongestOpp);
    }
  }

  // Sort all venue candidates descending by deterministic score
  venueCandidates.sort((a, b) => b.score - a.score);

  // Apply signal diversity to the Top 3 when scores are close
  const topOpportunities = selectDiverseTopOpportunities(venueCandidates, OPPORTUNITY_CONFIG.attentionBudget.carouselMax);

  // Return ranked opportunities (Top 3 for carousel, top 7 for promoted map highlights)
  return topOpportunities.slice(0, OPPORTUNITY_CONFIG.attentionBudget.promotedMapMax);
}

/**
 * Select top opportunities while applying deterministic signal diversity when scores are close
 */
function selectDiverseTopOpportunities(
  candidates: BiteOpportunity[],
  limit = 3
): BiteOpportunity[] {
  if (candidates.length <= limit) return candidates;

  const result: BiteOpportunity[] = [];
  const selectedTypes = new Set<OpportunityType>();
  const remaining = [...candidates];

  // 1. Pick the absolute highest scoring opportunity first
  const first = remaining.shift()!;
  result.push(first);
  selectedTypes.add(first.type);

  // 2. Pick subsequent slots with diversity promotion if scores are within tolerance
  while (result.length < limit && remaining.length > 0) {
    const topCandidate = remaining[0];
    const topScore = topCandidate.score;

    // Check if there is an eligible candidate with a distinct signal within diversity tolerance
    const diverseIndex = remaining.findIndex(
      (c) =>
        !selectedTypes.has(c.type) &&
        topScore - c.score <= OPPORTUNITY_CONFIG.diversityTolerance
    );

    if (diverseIndex !== -1) {
      const [chosen] = remaining.splice(diverseIndex, 1);
      result.push(chosen);
      selectedTypes.add(chosen.type);
    } else {
      const chosen = remaining.shift()!;
      result.push(chosen);
      selectedTypes.add(chosen.type);
    }
  }

  // Append remaining candidates back so callers can access items up to promotedMapMax
  return [...result, ...remaining];
}
