export type TabType = 'explore' | 'radar' | 'friends' | 'camera' | 'passport' | 'profile';

export type AuthProviderType = 'google' | 'password' | 'anonymous';

export const ONBOARDING_FOOD_PREFERENCES = [
  '🍜 Món Việt',
  '☕ Café',
  '🍰 Đồ ngọt',
  '🌶 Ăn cay',
  '🥬 Ăn chay',
  '🍣 Nhật',
  '🍗 Đồ ăn nhanh',
  '🎲 Gì cũng thử',
] as const;

export type FoodPreferenceOption = typeof ONBOARDING_FOOD_PREFERENCES[number];

export const ONBOARDING_EXPLORATION_STYLES = [
  '🆕 Khám phá món mới',
  '📍 Tìm chỗ ngon gần đây',
  '🕵️ Săn quán lạ',
  '🏆 Chinh phục thử thách',
] as const;

export type ExplorationStyleOption = typeof ONBOARDING_EXPLORATION_STYLES[number];

export type FoodCategory =
  | 'noodles' // Bún / Phở / Mì
  | 'rice' // Cơm
  | 'coffee' // Café / Trà
  | 'dessert' // Tráng miệng / Chè / Bánh
  | 'street_food' // Ăn vặt / Quán ngõ
  | 'burger_western' // Burger / Món Âu
  | 'bbq_hotpot' // Nướng / Lẩu
  | 'drinks' // Đồ uống
  | 'restaurant'
  | 'CAFE_DRINK'
  | 'PHO'
  | 'NOODLE'
  | 'HOTPOT'
  | 'BBQ'
  | 'RICE'
  | 'RESTAURANT'
  | 'FAST_FOOD'
  | 'BAKERY_DESSERT'
  | 'BAR_BEER'
  | 'VEGETARIAN'
  | 'OTHER_FOOD';

export type QuickRatingTaste = 'tasty' | 'normal' | 'bad'; // 😍 | 😐 | 💀
export type QuickRatingPrice = 'good_value' | 'fair' | 'expensive'; // 💚 Đáng tiền | 🟡 Ổn | 🔴 Hơi chát

export interface KnowledgeTrackProgress {
  completed: boolean;
  bestScore: number;
  completedAt?: string;
  claimedReward?: boolean;
}

export interface UserKnowledgeProgress {
  smartBiter: KnowledgeTrackProgress;
  biteGuardian: KnowledgeTrackProgress;
}

export interface User {
  id: string;
  uid?: string;
  username?: string;
  name: string;
  displayName?: string;
  email?: string;
  authProvider?: AuthProviderType;
  isGuest?: boolean;
  foodPreferences?: string[];
  explorationStyle?: string;
  onboardingCompleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
  avatarUrl: string;
  activeTitle: string;
  availableTitles: string[];
  level: number;
  xp: number;
  nextLevelXp: number;
  knowledgeProgress?: UserKnowledgeProgress;
  stats: {
    placesDiscovered: number;
    passportsCompleted: number;
    firstBitesCount: number;
  };
  districtProgress: {
    districtId: string;
    districtName: string;
    completed: number;
    total: number;
  }[];
}

export interface Place {
  id: string;
  canonicalVenueId?: string;
  googlePlaceId?: string;
  providerPlaceId?: string;
  name: string;
  category: FoodCategory;
  categoryLabel: string;
  address: string;
  district: string;
  latitude: number;
  longitude: number;
  geohash?: string;
  location?: {
    lat: number;
    lng: number;
  };
  priceBand: string;
  priceMin: number;
  priceMax: number;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  isOpen: boolean;
  openingHoursText: string;
  isCommunitySpot?: boolean;
  communityStatus?: 'pending' | 'verified';
  communityVerified?: boolean;
  firstDiscovererId?: string;
  firstDiscovererName?: string;
  createdAt?: string;
  verifiedByUserId?: string;
  verifiedAt?: string;
  lastVerifiedBiteAt?: string;
  verifiedBiteCount?: number;
  friendsVisited?: {
    userId: string;
    userName: string;
    userAvatar: string;
    tasteRating: QuickRatingTaste;
    wantsReturn: boolean;
    visitedAgo: string;
  }[];
  bestTimeToVisit?: {
    bestTime: string;
    currentEtaMin: number;
    bestEtaMin: number;
    savedMin: number;
  };
}

export interface BiteCheckin {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  placeId: string;
  providerPlaceId?: string;
  placeName: string;
  placeAddress: string;
  district: string;
  foodCategory: FoodCategory;
  imageUrl: string;
  displayImageUrl?: string;
  filterId?: 'original' | 'warm_bite' | 'fresh' | 'night_bite' | string;
  stickerId?: string;
  isGalleryUpload?: boolean;
  cloudinaryPublicId?: string;
  caption?: string;
  createdAt: string;
  tasteRating?: QuickRatingTaste | null;
  priceRating?: QuickRatingPrice | null;
  wouldReturn?: boolean | null;
  isVerified: boolean;
  verifiedAt?: string;
  isFirstBite?: boolean;
  reactions: {
    emoji: string;
    count: number;
    userReacted: boolean;
  }[];
  verificationMetadata?: {
    distanceMeters: number;
    confidence: number;
    aiEvidence: string;
  };
}

export interface PassportChallenge {
  id: string;
  title: string;
  icon: string;
  category?: FoodCategory;
  type: 'category' | 'alley' | 'new_spot' | 'dessert';
  isCompleted: boolean;
  completedAt?: string;
  rewardXp: number;
}

export interface DistrictPassport {
  id: string;
  districtName: string;
  subtitle: string;
  coverImage: string;
  levelTitle: string;
  currentLevel: number;
  xp: number;
  maxXp: number;
  challenges: PassportChallenge[];
}

export interface PostBiteJourneyProgress {
  districtName: string;
  completedCount: number;
  totalCount: number;
  milestoneCompletedTitle?: string | null;
  journeyChanged: boolean;
  isNewlyCompletedJourney?: boolean;
  challenges: PassportChallenge[];
}

export interface PostBiteResultData {
  success: boolean;
  bite: BiteCheckin;
  user?: User;
  passport?: DistrictPassport;
  earnedXp: number;
  unlockedChallenge?: string | null;
  isFirstBite: boolean;
  isCommunityVerification?: boolean;
  isFirstVerifier?: boolean;
  verifiedBiteCount: number;
  journeyProgress: PostBiteJourneyProgress;
}

export interface AchievementBadge {
  id: string;
  title: string;
  description: string;
  emoji: string;
  isUnlocked: boolean;
  unlockedAt?: string;
  rarity: 'common' | 'rare' | 'legendary';
}

export interface GeminiAnalysisResult {
  isFoodOrDrink: boolean;
  dishName: string;
  foodCategory: FoodCategory;
  categoryLabel: string;
  visibleVenueText?: string;
  visiblePriceMin?: number;
  visiblePriceMax?: number;
  confidence: number;
  ambianceType?: string;
  tags: string[];
  suggestedPlaceMatch?: {
    placeId: string;
    confidence: number;
    reason: string;
  };
}

export type OpportunityType =
  | 'QUEST_MATCH'
  | 'NEW_TO_YOU'
  | 'SCOUT_WINDOW'
  | 'STARTER_QUEST'
  | 'FRESH_VERIFIED'
  | 'FRIEND_ECHO'; // Parked in V1 production

export type OpportunityActionType = 'scout' | 'quest' | 'explore' | 'starter';

export interface OpportunityReasonData {
  title: string;
  subtitle?: string;
  badgeText: string;
  icon: string;
  highlight?: string;
  ctaText: string;
  ctaIcon: string;
}

export interface OpportunityReason {
  icon: string;
  text: string;
  highlight?: string;
  badgeType: 'social' | 'scout' | 'quest' | 'freshness' | 'novelty';
}

export interface BiteOpportunity {
  id: string;
  placeId: string;
  providerPlaceId?: string;
  type: OpportunityType;
  score: number;
  distanceMeters: number;
  reasonData?: OpportunityReasonData;
  actionType?: OpportunityActionType;
  reasons: OpportunityReason[];
  expiresAt?: string;
  freshnessMinutes?: number;
  place: Place;
  passportId?: string;
  challengeId?: string;
  challengeTitle?: string;
  createdAt?: string;
  verifiedAt?: string;
  firstDiscovererId?: string;
  remainingChallengesCount?: number;
  friendActivity?: {
    userId: string;
    userName: string;
    userAvatar: string;
    action: string;
    timeAgo: string;
    caption?: string;
    imageUrl?: string;
    chainCount?: number;
  };
  scoutData?: {
    discoveredBy: string;
    discoveredAgo: string;
    isFirstVerifierAvailable: boolean;
    independentVerificationCount: number;
  };
  questMatch?: {
    passportId?: string;
    challengeId: string;
    challengeTitle: string;
    challengeIcon: string;
    rewardXp: number;
  };
}

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

export interface TodayOpportunity {
  id: string;
  venueId: string;
  type: TodayOpportunityType;
  title: string;
  reasonPrimary: string;
  reasonSecondary?: string;
  distanceMeters?: number;
  truthSources: TruthSource[];
  cta: 'OPEN_VENUE' | 'OPEN_MAP' | 'OPEN_JOURNEY';
  sourceOpportunityId?: string;
}
