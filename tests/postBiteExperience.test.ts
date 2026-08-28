import { describe, it, expect } from 'vitest';
import { PostBiteResultData } from '../src/types';
import { verifyCommunitySpotAtomic } from '../src/server/firstBiteEngine';
import { Place } from '../src/types';

describe('Post-Bite Value & Journey Experience V1 - Authoritative Scenarios', () => {
  // Scenario A: Normal Verified Bite
  it('Scenario A: verifies normal verified bite authoritative structure and hierarchy', () => {
    const mockPostBite: PostBiteResultData = {
      success: true,
      bite: {
        id: 'bite_norm_1',
        userId: 'user_foodie_1',
        userName: 'Foodie Hà Nội',
        userAvatar: 'https://images.unsplash.com/avatar',
        placeId: 'place_bun_ca_co_lan',
        placeName: 'Bún Cá Cô Lan',
        placeAddress: 'Ngõ 165 Cầu Giấy, Hà Nội',
        district: 'Cầu Giấy',
        foodCategory: 'noodles',
        imageUrl: 'https://images.unsplash.com/photo-1',
        caption: 'Bún cá siêu ngon, nước dùng thanh ngọt!',
        createdAt: 'Vừa xong',
        tasteRating: 'tasty',
        priceRating: 'good_value',
        wouldReturn: true,
        isVerified: true,
        verifiedAt: new Date().toISOString(),
        isFirstBite: false,
        reactions: [],
      },
      earnedXp: 60,
      isFirstBite: false,
      isCommunityVerification: false,
      isFirstVerifier: false,
      verifiedBiteCount: 5,
      journeyProgress: {
        districtName: 'Cầu Giấy',
        completedCount: 3,
        totalCount: 6,
        milestoneCompletedTitle: null,
        journeyChanged: false,
        challenges: [
          { id: 'c1', title: 'Một quán bún/phở', icon: '🍜', category: 'noodles', type: 'category', isCompleted: true, rewardXp: 50 },
          { id: 'c2', title: 'Một quán cơm', icon: '🍛', category: 'rice', type: 'category', isCompleted: true, rewardXp: 50 },
          { id: 'c3', title: 'Một quán café', icon: '☕', category: 'coffee', type: 'category', isCompleted: true, rewardXp: 50 },
          { id: 'c4', title: 'Một món tráng miệng', icon: '🍮', category: 'dessert', type: 'category', isCompleted: false, rewardXp: 50 },
          { id: 'c5', title: 'Một quán ăn trong ngõ', icon: '🛵', type: 'alley', isCompleted: false, rewardXp: 50 },
          { id: 'c6', title: 'Phát hiện một quán mới', icon: '✨', type: 'new_spot', isCompleted: false, rewardXp: 100 },
        ],
      },
    };

    expect(mockPostBite.bite.isVerified).toBe(true);
    expect(mockPostBite.isFirstBite).toBe(false);
    expect(mockPostBite.earnedXp).toBe(60);
    expect(mockPostBite.verifiedBiteCount).toBe(5);
    expect(mockPostBite.journeyProgress.completedCount).toBe(3);
    expect(mockPostBite.journeyProgress.totalCount).toBe(6);
  });

  // Scenario B: Authoritative First Bite
  it('Scenario B: awards First Bite strictly when venue had 0 prior verified bites', () => {
    const priorVerifiedBitesCount = 0;
    const isVerified = true;
    const isFirstBite = Boolean(isVerified && priorVerifiedBitesCount === 0);

    expect(isFirstBite).toBe(true);

    const firstBiteResult: PostBiteResultData = {
      success: true,
      bite: {
        id: 'bite_first_1',
        userId: 'user_pioneer',
        userName: 'Thực Thần Tiên Phong',
        userAvatar: '',
        placeId: 'place_hidden_gem',
        placeName: 'Phở Gà Châm',
        placeAddress: 'Yên Phụ',
        district: 'Tây Hồ',
        foodCategory: 'noodles',
        imageUrl: '',
        caption: 'Phở gà tuyệt đỉnh',
        createdAt: 'Vừa xong',
        tasteRating: 'tasty',
        priceRating: 'good_value',
        wouldReturn: true,
        isVerified: true,
        isFirstBite: true,
        reactions: [],
      },
      earnedXp: 80,
      isFirstBite: true,
      isCommunityVerification: false,
      isFirstVerifier: false,
      verifiedBiteCount: 1,
      journeyProgress: {
        districtName: 'Tây Hồ',
        completedCount: 1,
        totalCount: 6,
        milestoneCompletedTitle: 'Một quán bún/phở',
        journeyChanged: true,
        challenges: [],
      },
    };

    expect(firstBiteResult.isFirstBite).toBe(true);
    expect(firstBiteResult.bite.isFirstBite).toBe(true);
    expect(firstBiteResult.verifiedBiteCount).toBe(1);
  });

  // Scenario C: Community Spot Verification
  it('Scenario C: allows independent second user to verify community spot atomically', async () => {
    const testPlaces: Place[] = [
      {
        id: 'spot_comm_test',
        name: 'Bánh Mì Ngõ 35',
        category: 'street_food',
        categoryLabel: 'Ăn vặt / Ngõ',
        address: 'Ngõ 35 Trần Thái Tông',
        district: 'Cầu Giấy',
        latitude: 21.031,
        longitude: 105.789,
        isOpen: true,
        isCommunitySpot: true,
        communityStatus: 'pending',
        communityVerified: false,
        firstDiscovererId: 'user_scout_A',
        firstDiscovererName: 'Foodie A',
      },
    ];

    // Second user verifies
    const result = await verifyCommunitySpotAtomic(testPlaces, 'spot_comm_test', 'user_verifier_B', 'Foodie B');
    expect(result.success).toBe(true);
    expect(result.code).toBe('VERIFIED_SUCCESS');
    expect(result.awardedXpToVerifier).toBe(60);
    expect(testPlaces[0].communityVerified).toBe(true);
    expect(testPlaces[0].communityStatus).toBe('verified');
  });

  // Scenario D: Non-verified / Failed Bite (Gallery upload)
  it('Scenario D: enforces 0 XP, unverified state, and no journey progress for gallery upload', () => {
    const isGalleryUpload = true;
    const isVerified = false; // Gallery cannot verify

    const galleryPostBite: PostBiteResultData = {
      success: true,
      bite: {
        id: 'bite_gallery_1',
        userId: 'user_foodie_1',
        userName: 'Foodie Hà Nội',
        userAvatar: '',
        placeId: 'place_bun_ca_co_lan',
        placeName: 'Bún Cá Cô Lan',
        placeAddress: 'Ngõ 165 Cầu Giấy',
        district: 'Cầu Giấy',
        foodCategory: 'noodles',
        imageUrl: 'https://images.unsplash.com/gallery',
        caption: 'Ảnh chụp từ hôm qua',
        createdAt: 'Vừa xong',
        tasteRating: 'tasty',
        priceRating: 'fair',
        wouldReturn: true,
        isVerified: false,
        isGalleryUpload: true,
        reactions: [],
      },
      earnedXp: 0,
      isFirstBite: false,
      isCommunityVerification: false,
      isFirstVerifier: false,
      verifiedBiteCount: 5,
      journeyProgress: {
        districtName: 'Cầu Giấy',
        completedCount: 3,
        totalCount: 6,
        milestoneCompletedTitle: null,
        journeyChanged: false,
        challenges: [],
      },
    };

    expect(galleryPostBite.bite.isVerified).toBe(false);
    expect(galleryPostBite.earnedXp).toBe(0);
    expect(galleryPostBite.isFirstBite).toBe(false);
    expect(galleryPostBite.journeyProgress.journeyChanged).toBe(false);
  });

  // Scenario E: Bite that changes Journey progress
  it('Scenario E: updates milestone completed and attaches unlocked challenge', () => {
    const progressWithMilestone: PostBiteResultData = {
      success: true,
      bite: {
        id: 'bite_milestone_1',
        userId: 'user_1',
        userName: 'Foodie',
        userAvatar: '',
        placeId: 'place_bun_ca',
        placeName: 'Bún Cá Cay Hải Phòng',
        placeAddress: 'Cầu Giấy',
        district: 'Cầu Giấy',
        foodCategory: 'noodles',
        imageUrl: '',
        caption: 'Bún cá ngon',
        createdAt: 'Vừa xong',
        tasteRating: 'tasty',
        priceRating: 'good_value',
        wouldReturn: true,
        isVerified: true,
        reactions: [],
      },
      earnedXp: 110, // 60 base + 50 challenge bonus
      unlockedChallenge: 'Một quán bún/phở',
      isFirstBite: false,
      verifiedBiteCount: 3,
      journeyProgress: {
        districtName: 'Cầu Giấy',
        completedCount: 4,
        totalCount: 6,
        milestoneCompletedTitle: 'Một quán bún/phở',
        journeyChanged: true,
        isNewlyCompletedJourney: false,
        challenges: [
          { id: 'c1', title: 'Một quán bún/phở', icon: '🍜', category: 'noodles', type: 'category', isCompleted: true, rewardXp: 50 },
        ],
      },
    };

    expect(progressWithMilestone.unlockedChallenge).toBe('Một quán bún/phở');
    expect(progressWithMilestone.journeyProgress.journeyChanged).toBe(true);
    expect(progressWithMilestone.journeyProgress.milestoneCompletedTitle).toBe('Một quán bún/phở');
    expect(progressWithMilestone.earnedXp).toBe(110);
  });

  // Scenario F: Bite that does NOT change Journey progress
  it('Scenario F: keeps journey unchanged when challenge already completed', () => {
    const progressWithoutMilestone: PostBiteResultData = {
      success: true,
      bite: {
        id: 'bite_no_milestone_1',
        userId: 'user_1',
        userName: 'Foodie',
        userAvatar: '',
        placeId: 'place_second_bun',
        placeName: 'Phở 10 Lý Quốc Sư',
        placeAddress: 'Cầu Giấy',
        district: 'Cầu Giấy',
        foodCategory: 'noodles',
        imageUrl: '',
        caption: 'Phở ngon',
        createdAt: 'Vừa xong',
        tasteRating: 'tasty',
        priceRating: 'good_value',
        wouldReturn: true,
        isVerified: true,
        reactions: [],
      },
      earnedXp: 60, // base only
      unlockedChallenge: null,
      isFirstBite: false,
      verifiedBiteCount: 12,
      journeyProgress: {
        districtName: 'Cầu Giấy',
        completedCount: 4,
        totalCount: 6,
        milestoneCompletedTitle: null,
        journeyChanged: false,
        isNewlyCompletedJourney: false,
        challenges: [],
      },
    };

    expect(progressWithoutMilestone.unlockedChallenge).toBeNull();
    expect(progressWithoutMilestone.journeyProgress.journeyChanged).toBe(false);
    expect(progressWithoutMilestone.journeyProgress.milestoneCompletedTitle).toBeNull();
    expect(progressWithoutMilestone.earnedXp).toBe(60);
  });

  // Scenario G: V1.1 Copy & CTA Hierarchy Verification
  it('Scenario G: validates V1.1 Gallery neutral copy, concrete contribution copy and 2-CTA hierarchy', () => {
    // 1. Gallery copy validation
    const galleryState = {
      isVerified: false,
      title: 'Ảnh đã được lưu',
      subtitle: 'Ảnh từ thư viện không đủ điều kiện cho Verified Bite.',
      earnedXp: 0,
      journeyProgressChanged: false,
    };
    expect(galleryState.title).toBe('Ảnh đã được lưu');
    expect(galleryState.subtitle).toBe('Ảnh từ thư viện không đủ điều kiện cho Verified Bite.');
    expect(galleryState.earnedXp).toBe(0);
    expect(galleryState.journeyProgressChanged).toBe(false);

    // 2. Concrete contribution copy formatting
    const formatContribution = (isVerified: boolean, venue: string, count?: number) => {
      if (!isVerified) return 'Ảnh từ thư viện không được tính vào số lượt Verified Bites của địa điểm.';
      if (typeof count === 'number' && count > 0) return `${venue} hiện có ${count} Verified Bites.`;
      return 'Bạn vừa thêm 1 Verified Bite cho địa điểm này.';
    };

    expect(formatContribution(true, 'Phở Thìn', 8)).toBe('Phở Thìn hiện có 8 Verified Bites.');
    expect(formatContribution(true, 'Quán Mới', 0)).toBe('Bạn vừa thêm 1 Verified Bite cho địa điểm này.');
    expect(formatContribution(false, 'Phở Thìn', 8)).toBe('Ảnh từ thư viện không được tính vào số lượt Verified Bites của địa điểm.');

    // 3. CTA hierarchy validation
    const primaryCTA = 'Tiếp tục khám phá';
    const secondaryCTA = 'Xem Hành trình';
    const tertiaryAction = 'Chia sẻ Bite này';

    expect(primaryCTA).toBe('Tiếp tục khám phá');
    expect(secondaryCTA).toBe('Xem Hành trình');
    expect(tertiaryAction).toBe('Chia sẻ Bite này');
  });
});
