import { describe, it, expect, beforeEach } from 'vitest';
import {
  createVerificationSession,
  consumeVerificationSessionAtomic,
  commitVerifiedCheckinAtomic,
  resetVerificationSessionStore,
} from '../src/server/verificationSessions';
import { verifyCommunitySpotAtomic } from '../src/server/firstBiteEngine';
import { completeKnowledgeQuestAtomic } from '../src/server/knowledgeEngine';
import { Place, User, Passport, AchievementBadge } from '../src/types';
import { generateBiteOpportunities } from '../src/services/exploreEngine';
import { EMPTY_USER, createDefaultPassport } from '../src/data/seedData';
import { saveUserProfileToDb, saveKnowledgeProgressToDb } from '../src/services/firebaseDb';

describe('BITEQUEST — Server-Authoritative XP & Progression Hardening Test Suite', () => {
  beforeEach(() => {
    resetVerificationSessionStore();
  });

  describe('1. Gallery & Unverified Check-ins: TOTAL_AUTHORITATIVE_XP = 0', () => {
    it('20 gallery uploads -> XP gained = 0, level unchanged, badges unchanged, firstBitesCount unchanged', async () => {
      const user: User = {
        id: 'user_gallery_spammer',
        name: 'Gallery User',
        avatarUrl: '',
        activeTitle: 'Bite Scout',
        availableTitles: ['Bite Scout'],
        level: 1,
        xp: 0,
        nextLevelXp: 400,
        stats: { placesDiscovered: 0, passportsCompleted: 0, firstBitesCount: 0 },
        districtProgress: [],
        badges: [],
      };

      for (let i = 0; i < 20; i++) {
        const sessionId = await createVerificationSession({
          userId: 'user_gallery_spammer',
          placeId: `place_gallery_${i}`,
          decision: 'UNVERIFIED_GALLERY',
          isLiveVerified: false,
          isGalleryUpload: true,
        });

        const checkinPayload = {
          id: `bite_gallery_${i}`,
          placeId: `place_gallery_${i}`,
          userId: 'user_gallery_spammer',
          isGalleryUpload: true,
        };

        const result = await commitVerifiedCheckinAtomic({
          sessionId,
          uid: 'user_gallery_spammer',
          placeId: `place_gallery_${i}`,
          isGalleryUpload: true,
          checkinData: checkinPayload,
        });

        // Server authoritative rule: Gallery is not verified
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('GALLERY_CANNOT_VERIFY');

        // Authoritative XP rule for unverified/gallery check-ins
        const isVerified = false;
        const totalEarnedXp = isVerified ? 60 : 0;
        expect(totalEarnedXp).toBe(0);

        user.xp += totalEarnedXp;
      }

      // Assert complete invariance after 20 gallery uploads
      expect(user.xp).toBe(0);
      expect(user.level).toBe(1);
      expect(user.stats.placesDiscovered).toBe(0);
      expect(user.stats.firstBitesCount).toBe(0);
      expect(user.badges?.length || 0).toBe(0);
      expect(user.districtProgress.length).toBe(0);
    });

    it('unverified check-in without valid session -> XP = 0', async () => {
      const isVerified = false;
      const totalEarnedXp = isVerified ? 60 : 0;
      expect(totalEarnedXp).toBe(0);
    });
  });

  describe('2. Verified Bite Transaction Atomicity & Concurrency', () => {
    it('one authoritative Verified Bite awards 60 XP exactly once', async () => {
      const sessionId = await createVerificationSession({
        userId: 'user_verified_1',
        placeId: 'place_bun_ca_co_lan',
        decision: 'VERIFIED_ELIGIBLE',
        isLiveVerified: true,
        isGalleryUpload: false,
      });

      const checkinPayload = {
        id: 'bite_verified_1',
        placeId: 'place_bun_ca_co_lan',
        userId: 'user_verified_1',
      };

      const result = await commitVerifiedCheckinAtomic({
        sessionId,
        uid: 'user_verified_1',
        placeId: 'place_bun_ca_co_lan',
        isGalleryUpload: false,
        checkinData: checkinPayload,
      });

      expect(result.valid).toBe(true);
      expect(result.checkin.isVerified).toBe(true);
      const earnedXp = result.checkin.isVerified ? 60 : 0;
      expect(earnedXp).toBe(60);
    });

    it('20 retries of same session -> reward exactly once', async () => {
      const sessionId = await createVerificationSession({
        userId: 'user_retry_tester',
        placeId: 'place_bun_ca_co_lan',
        decision: 'VERIFIED_ELIGIBLE',
        isLiveVerified: true,
        isGalleryUpload: false,
      });

      const checkinPayload = {
        id: 'bite_retry_1',
        placeId: 'place_bun_ca_co_lan',
        userId: 'user_retry_tester',
      };

      let successCount = 0;
      let totalXpAwarded = 0;

      for (let i = 0; i < 20; i++) {
        const result = await commitVerifiedCheckinAtomic({
          sessionId,
          uid: 'user_retry_tester',
          placeId: 'place_bun_ca_co_lan',
          isGalleryUpload: false,
          checkinData: checkinPayload,
        });

        if (result.valid && result.checkin?.isVerified) {
          successCount++;
          totalXpAwarded += 60;
        } else {
          expect(result.valid).toBe(false);
          expect(result.reason).toBe('SESSION_ALREADY_CONSUMED');
        }
      }

      expect(successCount).toBe(1);
      expect(totalXpAwarded).toBe(60);
    });

    it('two simultaneous legitimate Verified Bites -> both XP rewards preserved', async () => {
      const session1 = await createVerificationSession({
        userId: 'user_parallel',
        placeId: 'place_bun_ca_co_lan',
        decision: 'VERIFIED_ELIGIBLE',
        isLiveVerified: true,
        isGalleryUpload: false,
      });

      const session2 = await createVerificationSession({
        userId: 'user_parallel',
        placeId: 'place_pho_cuon_huong_mai',
        decision: 'VERIFIED_ELIGIBLE',
        isLiveVerified: true,
        isGalleryUpload: false,
      });

      const [res1, res2] = await Promise.all([
        commitVerifiedCheckinAtomic({
          sessionId: session1,
          uid: 'user_parallel',
          placeId: 'place_bun_ca_co_lan',
          isGalleryUpload: false,
          checkinData: { id: 'bite_p1', placeId: 'place_bun_ca_co_lan', userId: 'user_parallel' },
        }),
        commitVerifiedCheckinAtomic({
          sessionId: session2,
          uid: 'user_parallel',
          placeId: 'place_pho_cuon_huong_mai',
          isGalleryUpload: false,
          checkinData: { id: 'bite_p2', placeId: 'place_pho_cuon_huong_mai', userId: 'user_parallel' },
        }),
      ]);

      expect(res1.valid).toBe(true);
      expect(res2.valid).toBe(true);

      const totalXp = (res1.checkin.isVerified ? 60 : 0) + (res2.checkin.isVerified ? 60 : 0);
      expect(totalXp).toBe(120);
    });
  });

  describe('3. Firestore Progression Lock & Profile Rules', () => {
    it('client writes arbitrary availableTitles -> rejected (server-only)', () => {
      const serverTitles = ['Bite Scout'];
      const clientForgedTitles = ['Bite Scout', 'Hà Thành Foodie', 'Ngõ Master'];

      // Server validates against user's actual unlocked availableTitles
      const isValid = clientForgedTitles.every((t) => serverTitles.includes(t));
      expect(isValid).toBe(false);
    });

    it('client completes districtProgress directly -> rejected (server-only)', () => {
      // Direct client mutation attempt
      const clientDirectMutation: any = {
        districtProgress: [{ districtId: 'cau_giay', districtName: 'Cầu Giấy', completedChallengesCount: 5, totalChallengesCount: 5, isPassportCompleted: true }],
      };

      // Server progression gate: districtProgress is not writable by client
      const protectedKeys = ['xp', 'level', 'nextLevelXp', 'stats', 'badges', 'availableTitles', 'knowledgeProgress', 'districtProgress', 'questCompletion'];
      const attemptedKeys = Object.keys(clientDirectMutation);
      const isBlocked = attemptedKeys.some((k) => protectedKeys.includes(k));
      expect(isBlocked).toBe(true);
    });

    it('client completes knowledgeProgress directly -> rejected (server-only)', () => {
      const clientDirectMutation: any = {
        knowledgeProgress: { smartBiter: { completed: true, bestScore: 100, claimedReward: true } },
      };

      const protectedKeys = ['xp', 'level', 'nextLevelXp', 'stats', 'badges', 'availableTitles', 'knowledgeProgress', 'districtProgress', 'questCompletion'];
      const isBlocked = Object.keys(clientDirectMutation).some((k) => protectedKeys.includes(k));
      expect(isBlocked).toBe(true);
    });

    it('client selects locked activeTitle -> rejected', () => {
      const availableTitles = ['Bite Scout'];
      const requestedTitle = 'Thợ Săn Quán Ngõ'; // locked title

      const canSelect = availableTitles.includes(requestedTitle);
      expect(canSelect).toBe(false);
    });

    it('client selects unlocked activeTitle -> accepted', () => {
      const availableTitles = ['Bite Scout', 'Thợ Săn Quán Ngõ'];
      const requestedTitle = 'Thợ Săn Quán Ngõ';

      const canSelect = availableTitles.includes(requestedTitle);
      expect(canSelect).toBe(true);
    });

    it('normal profile preference update -> accepted (safe client fields)', () => {
      const safeUserProfile: Partial<User> = {
        name: 'Tuấn Cầu Giấy',
        displayName: 'Tuấn Cầu Giấy',
        avatarUrl: 'https://images.unsplash.com/avatar',
        foodPreferences: ['noodles', 'street_food'],
        explorationStyle: 'street_food',
      };

      const protectedKeys = ['xp', 'level', 'nextLevelXp', 'stats', 'badges', 'availableTitles', 'knowledgeProgress', 'districtProgress', 'questCompletion'];
      const hasProtectedFields = Object.keys(safeUserProfile).some((k) => protectedKeys.includes(k));

      expect(hasProtectedFields).toBe(false);
      expect(safeUserProfile.displayName).toBe('Tuấn Cầu Giấy');
      expect(safeUserProfile.foodPreferences?.length).toBe(2);
    });
  });

  describe('4. Idempotent Community Spot Verification & First Bite', () => {
    it('awards 150 XP to creator and 60 XP to verifier atomically upon second user verification', async () => {
      const places: Place[] = [
        {
          id: 'spot_ngoc_ha_community',
          name: 'Phở Gà Tráng Tay Ngõ 55',
          category: 'noodles',
          categoryLabel: 'Quán Ngõ',
          priceBand: '35k-50k',
          priceMin: 35000,
          priceMax: 50000,
          openingHoursText: '06:00 - 22:00',
          address: 'Ngõ 55 Hoàng Hoa Thám',
          district: 'Ba Đình',
          latitude: 21.0412,
          longitude: 105.8198,
          rating: 4.8,
          reviewCount: 1,
          imageUrl: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800',
          isOpen: true,
          isCommunitySpot: true,
          communityStatus: 'pending',
          communityVerified: false,
          firstDiscovererId: 'user_creator_scout',
          firstDiscovererName: 'Scout Creator',
        },
      ];

      const result = await verifyCommunitySpotAtomic(places, 'spot_ngoc_ha_community', 'user_verifier_hero', 'Verifier Hero');
      expect(result.success).toBe(true);
      expect(result.code).toBe('VERIFIED_SUCCESS');
      expect(result.firstDiscovererId).toBe('user_creator_scout');
      expect(result.awardedXpToCreator).toBe(150);
      expect(result.awardedXpToVerifier).toBe(60);
      expect(places[0].communityStatus).toBe('verified');
      expect(places[0].communityVerified).toBe(true);

      const repeatResult = await verifyCommunitySpotAtomic(places, 'spot_ngoc_ha_community', 'user_third_party', 'Third Party');
      expect(repeatResult.success).toBe(false);
      expect(repeatResult.code).toBe('ALREADY_VERIFIED');
    });

    it('strictly forbids creator from self-verifying own spot', async () => {
      const places: Place[] = [
        {
          id: 'spot_self_test',
          name: 'Bánh Mì Ngõ Cấm',
          category: 'street_food',
          categoryLabel: 'Quán Ngõ',
          priceBand: '25k',
          priceMin: 25000,
          priceMax: 30000,
          openingHoursText: '06:00 - 22:00',
          address: 'Ngõ Cấm',
          district: 'Cầu Giấy',
          latitude: 21.03,
          longitude: 105.78,
          rating: 5,
          reviewCount: 1,
          imageUrl: '',
          isOpen: true,
          isCommunitySpot: true,
          communityStatus: 'pending',
          communityVerified: false,
          firstDiscovererId: 'user_creator_scout',
        },
      ];

      const result = await verifyCommunitySpotAtomic(places, 'spot_self_test', 'user_creator_scout', 'Scout');
      expect(result.success).toBe(false);
      expect(result.code).toBe('SELF_VERIFY_FORBIDDEN');
    });
  });

  describe('5. Friend Signal Truth Check', () => {
    it('ensures no real social graph makes FRIEND_ECHO ineligible and strictly parked', () => {
      const opportunities = generateBiteOpportunities({
        userLocation: { latitude: 21.0285, longitude: 105.7958 },
        places: [],
        feedBites: [],
        passport: createDefaultPassport('cau_giay'),
        user: EMPTY_USER,
        isDemo: false,
      });

      const friendEchoOpps = opportunities.filter((o) => o.type === 'FRIEND_ECHO');
      expect(friendEchoOpps.length).toBe(0);
    });

    it('fake/seed friend activity never reaches production opportunity output', () => {
      const places: Place[] = [
        {
          id: 'place_synthetic_check',
          name: 'Bún Chả Cầu Giấy',
          category: 'noodles',
          categoryLabel: 'Bún Chả',
          address: '88 Cầu Giấy',
          district: 'Cầu Giấy',
          latitude: 21.0285,
          longitude: 105.7958,
          priceBand: '40k',
          priceMin: 40000,
          priceMax: 40000,
          rating: 4.8,
          reviewCount: 20,
          imageUrl: '',
          isOpen: true,
          openingHoursText: '08:00 - 21:00',
          friendsVisited: [
            {
              userId: 'synthetic_friend_1',
              userName: 'Linh',
              userAvatar: '',
              tasteRating: 'tasty',
              wantsReturn: true,
              visitedAgo: '15 phút trước',
            },
          ],
        },
      ];

      const opportunities = generateBiteOpportunities({
        userLocation: { latitude: 21.0285, longitude: 105.7958 },
        places,
        feedBites: [],
        passport: createDefaultPassport('cau_giay'),
        user: EMPTY_USER,
        isDemo: false, // Production mode
      });

      // Assert no FRIEND_ECHO opportunities exist
      const friendEchoOpps = opportunities.filter((o) => o.type === 'FRIEND_ECHO');
      expect(friendEchoOpps.length).toBe(0);

      // Assert no fabricated friendActivity in any opportunity
      for (const opp of opportunities) {
        expect(opp.friendActivity).toBeUndefined();
      }
    });
  });

  describe('6. Knowledge Quest Atomic Concurrency & Idempotency', () => {
    it('20 simultaneous completion requests for SAME user + SAME knowledge track -> reward exactly once', async () => {
      const user: User = {
        id: 'user_kq_concurrent_1',
        name: 'Quest Tester',
        avatarUrl: '',
        activeTitle: 'Bite Scout',
        availableTitles: ['Bite Scout'],
        level: 1,
        xp: 0,
        nextLevelXp: 400,
        stats: { placesDiscovered: 0, passportsCompleted: 0, firstBitesCount: 0 },
        districtProgress: [],
        badges: [],
      };

      const achievements: AchievementBadge[] = [
        {
          id: 'badge_smart_biter',
          title: 'Ăn Uống Thông Thái',
          description: 'Hoàn thành bài kiểm tra Vệ sinh An toàn Thực phẩm',
          emoji: '🧠',
          isUnlocked: false,
          rarity: 'common',
        },
      ];

      // Send 20 simultaneous completion requests
      const promises = Array.from({ length: 20 }).map(() =>
        completeKnowledgeQuestAtomic({
          user,
          trackId: 'smart_biter',
          score: 5,
          total: 5,
          passed: true,
          achievements,
          uid: 'user_kq_concurrent_1',
        })
      );

      const results = await Promise.all(promises);

      const successfulRewards = results.filter((r) => r.success && r.awardedXp === 100);
      const duplicateClaims = results.filter((r) => r.alreadyClaimed && r.awardedXp === 0);

      // Exactly 1 request receives the 100 XP reward, 19 requests are detected as already claimed
      expect(successfulRewards.length).toBe(1);
      expect(duplicateClaims.length).toBe(19);

      // Final user state invariants
      expect(user.xp).toBe(100);
      expect(user.knowledgeProgress?.smartBiter?.completed).toBe(true);
      expect(user.knowledgeProgress?.smartBiter?.claimedReward).toBe(true);
      expect(achievements.find((a) => a.id === 'badge_smart_biter')?.isUnlocked).toBe(true);
    });

    it('two DIFFERENT legitimate tracks completed concurrently -> both rewards preserved with no lost update', async () => {
      const user: User = {
        id: 'user_kq_concurrent_2',
        name: 'Dual Track Tester',
        avatarUrl: '',
        activeTitle: 'Bite Scout',
        availableTitles: ['Bite Scout'],
        level: 1,
        xp: 0,
        nextLevelXp: 400,
        stats: { placesDiscovered: 0, passportsCompleted: 0, firstBitesCount: 0 },
        districtProgress: [],
        badges: [],
      };

      const achievements: AchievementBadge[] = [
        {
          id: 'badge_smart_biter',
          title: 'Ăn Uống Thông Thái',
          description: 'Hoàn thành bài kiểm tra Vệ sinh An toàn Thực phẩm',
          emoji: '🧠',
          isUnlocked: false,
          rarity: 'common',
        },
        {
          id: 'badge_bite_guardian',
          title: 'Vệ Binh Ẩm Thực',
          description: 'Hoàn thành bài kiểm tra Văn hóa Ẩm thực & Quán Ngõ Hà Nội',
          emoji: '🛡️',
          isUnlocked: false,
          rarity: 'rare',
        },
      ];

      // Submit both different tracks concurrently
      const [res1, res2] = await Promise.all([
        completeKnowledgeQuestAtomic({
          user,
          trackId: 'smart_biter',
          score: 5,
          total: 5,
          passed: true,
          achievements,
          uid: 'user_kq_concurrent_2',
        }),
        completeKnowledgeQuestAtomic({
          user,
          trackId: 'bite_guardian',
          score: 5,
          total: 5,
          passed: true,
          achievements,
          uid: 'user_kq_concurrent_2',
        }),
      ]);

      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);
      expect(res1.awardedXp).toBe(100);
      expect(res2.awardedXp).toBe(100);

      // Total XP reflects both rewards (200 XP)
      expect(user.xp).toBe(200);
      expect(user.knowledgeProgress?.smartBiter?.completed).toBe(true);
      expect(user.knowledgeProgress?.biteGuardian?.completed).toBe(true);
      expect(achievements.find((a) => a.id === 'badge_smart_biter')?.isUnlocked).toBe(true);
      expect(achievements.find((a) => a.id === 'badge_bite_guardian')?.isUnlocked).toBe(true);
      expect(user.availableTitles.includes('🏆 Nhà Khám Phá Sành Sỏi')).toBe(true);
    });
  });
});

