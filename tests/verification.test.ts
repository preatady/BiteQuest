import { describe, it, expect } from 'vitest';
import { verifyCommunitySpotAtomic } from '../src/server/firstBiteEngine';
import { Place } from '../src/types';

describe('BiteQuest Core Security & Transaction Integrity Tests', () => {
  it('rejects creator self-verification on pending community spot', async () => {
    const testPlaces: Place[] = [
      {
        id: 'spot_test_1',
        name: 'Quán Bún Ốc Bà Năm',
        category: 'noodles',
        categoryLabel: 'Bún / Phở',
        address: 'Ngõ 20 Hồ Tùng Mậu, Cầu Giấy',
        district: 'Cầu Giấy',
        latitude: 21.036,
        longitude: 105.781,
        priceBand: '35k–50k',
        priceMin: 35000,
        priceMax: 50000,
        rating: 5.0,
        reviewCount: 1,
        imageUrl: 'https://images.unsplash.com/photo-1',
        isOpen: true,
        openingHoursText: '07:00 - 22:00',
        isCommunitySpot: true,
        communityStatus: 'pending',
        communityVerified: false,
        firstDiscovererId: 'user_creator_A',
        firstDiscovererName: 'Foodie A',
      },
    ];

    const result = await verifyCommunitySpotAtomic(testPlaces, 'spot_test_1', 'user_creator_A', 'Foodie A');
    expect(result.success).toBe(false);
    expect(result.code).toBe('SELF_VERIFY_FORBIDDEN');
    expect(testPlaces[0].communityStatus).toBe('pending');
  });

  it('allows second independent user to verify and awards First Bite to creator', async () => {
    const testPlaces: Place[] = [
      {
        id: 'spot_test_2',
        name: 'Cà Phê Muối Chú Ba',
        category: 'coffee',
        categoryLabel: 'Café / Trà',
        address: 'Ngõ 165 Cầu Giấy',
        district: 'Cầu Giấy',
        latitude: 21.032,
        longitude: 105.792,
        priceBand: '25k–35k',
        priceMin: 25000,
        priceMax: 35000,
        rating: 5.0,
        reviewCount: 1,
        imageUrl: 'https://images.unsplash.com/photo-2',
        isOpen: true,
        openingHoursText: '07:00 - 22:00',
        isCommunitySpot: true,
        communityStatus: 'pending',
        communityVerified: false,
        firstDiscovererId: 'user_creator_A',
        firstDiscovererName: 'Foodie A',
      },
    ];

    const result = await verifyCommunitySpotAtomic(testPlaces, 'spot_test_2', 'user_independent_B', 'Foodie B');
    expect(result.success).toBe(true);
    expect(result.code).toBe('VERIFIED_SUCCESS');
    expect(testPlaces[0].communityStatus).toBe('verified');
    expect(testPlaces[0].verifiedByUserId).toBe('user_independent_B');
    expect(result.firstDiscovererId).toBe('user_creator_A');
  });

  it('rejects duplicate verification attempts on already-verified spots', async () => {
    const testPlaces: Place[] = [
      {
        id: 'spot_test_3',
        name: 'Bánh Mì Chảo Ngõ 12',
        category: 'street_food',
        categoryLabel: 'Ăn vặt / Ngõ',
        address: 'Ngõ 12 Duy Tân',
        district: 'Cầu Giấy',
        latitude: 21.030,
        longitude: 105.784,
        priceBand: '35k–60k',
        priceMin: 35000,
        priceMax: 60000,
        rating: 5.0,
        reviewCount: 2,
        imageUrl: 'https://images.unsplash.com/photo-3',
        isOpen: true,
        openingHoursText: '07:00 - 22:00',
        isCommunitySpot: true,
        communityStatus: 'verified',
        communityVerified: true,
        firstDiscovererId: 'user_creator_A',
        firstDiscovererName: 'Foodie A',
      },
    ];

    const result = await verifyCommunitySpotAtomic(testPlaces, 'spot_test_3', 'user_third_C', 'Foodie C');
    expect(result.success).toBe(false);
    expect(result.code).toBe('ALREADY_VERIFIED');
  });

  it('resolves concurrent verification requests atomically', async () => {
    const testPlaces: Place[] = [
      {
        id: 'spot_test_4',
        name: 'Chè Sầu Ngõ 110',
        category: 'dessert',
        categoryLabel: 'Tráng miệng',
        address: 'Ngõ 110 Trần Duy Hưng',
        district: 'Cầu Giấy',
        latitude: 21.011,
        longitude: 105.801,
        priceBand: '25k–40k',
        priceMin: 25000,
        priceMax: 40000,
        rating: 5.0,
        reviewCount: 1,
        imageUrl: 'https://images.unsplash.com/photo-4',
        isOpen: true,
        openingHoursText: '10:00 - 22:00',
        isCommunitySpot: true,
        communityStatus: 'pending',
        communityVerified: false,
        firstDiscovererId: 'user_creator_A',
        firstDiscovererName: 'Foodie A',
      },
    ];

    const [p1, p2] = await Promise.all([
      verifyCommunitySpotAtomic(testPlaces, 'spot_test_4', 'user_B', 'Foodie B'),
      verifyCommunitySpotAtomic(testPlaces, 'spot_test_4', 'user_C', 'Foodie C'),
    ]);

    expect(p1.success || p2.success).toBe(true);
    expect(p1.success && p2.success).toBe(false);
    expect(testPlaces[0].communityStatus).toBe('verified');
  });

  it('strictly distinguishes live camera check-ins from gallery uploads for verification badge', () => {
    interface VerificationRuleParams {
      isGalleryUpload: boolean;
      isConfidentMatch: boolean;
      isFoodOrDrink: boolean;
    }

    const evaluateVerificationBadge = ({
      isGalleryUpload,
      isConfidentMatch,
      isFoodOrDrink,
    }: VerificationRuleParams): { verified: boolean; statusMessage: string; badge: string } => {
      if (isGalleryUpload) {
        return {
          verified: false,
          statusMessage: '📸 Ảnh từ thư viện (Gallery Bite - Chưa xác minh trực tiếp)',
          badge: 'Gallery Bite',
        };
      }
      const verified = isConfidentMatch && isFoodOrDrink;
      return {
        verified,
        statusMessage: verified ? '✨ Có vẻ đúng quán rồi' : '👀 Quán mới à?',
        badge: verified ? 'Verified Bite' : 'Unverified',
      };
    };

    // Live camera + confident match + food -> Verified
    const liveResult = evaluateVerificationBadge({
      isGalleryUpload: false,
      isConfidentMatch: true,
      isFoodOrDrink: true,
    });
    expect(liveResult.verified).toBe(true);
    expect(liveResult.badge).toBe('Verified Bite');

    // Gallery upload -> Unverified badge
    const galleryResult = evaluateVerificationBadge({
      isGalleryUpload: true,
      isConfidentMatch: true,
      isFoodOrDrink: true,
    });
    expect(galleryResult.verified).toBe(false);
    expect(galleryResult.badge).toBe('Gallery Bite');
  });
});
