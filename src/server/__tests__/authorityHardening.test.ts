import { describe, it, expect, beforeEach } from 'vitest';
import {
  createVerificationSession,
  consumeVerificationSessionAtomic,
  commitVerifiedCheckinAtomic,
  getAuthoritativeVerifiedBiteCount,
  resetVerificationSessionStore,
  getMemoryCheckinStore,
  getMemorySessionStore,
} from '../verificationSessions';
import { verifyCommunitySpotAtomic } from '../firstBiteEngine';
import { authenticateFirebaseUser } from '../authMiddleware';
import { Place } from '../../types';

describe('P0 Proof-of-Bite Authority Hardening Test Suite', () => {
  beforeEach(() => {
    resetVerificationSessionStore();
  });

  // 0. AUTH TOKEN VERIFICATION TESTS
  describe('Firebase Token Cryptographic Authority Gate', () => {
    it('rejects malformed token format with 401', async () => {
      let status = 200;
      let body: any = null;
      const req: any = { headers: { authorization: 'Bearer   ' } };
      const res: any = {
        status: (s: number) => { status = s; return res; },
        json: (b: any) => { body = b; return res; },
      };
      await authenticateFirebaseUser(req, res, () => {});
      expect(status).toBe(401);
      expect(body?.code).toBe('AUTH_TOKEN_MALFORMED');
    });

    it('rejects forged JWT with arbitrary payload with 401 AUTH_TOKEN_INVALID', async () => {
      let status = 200;
      let body: any = null;
      // Forged JWT signed by attacker
      const forgedJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiJhdHRhY2tlciIsImFkbWluIjp0cnVlfQ.invalidsignature';
      const req: any = { headers: { authorization: `Bearer ${forgedJwt}` } };
      const res: any = {
        status: (s: number) => { status = s; return res; },
        json: (b: any) => { body = b; return res; },
      };
      await authenticateFirebaseUser(req, res, () => {});
      expect(status).toBe(401);
      expect(body?.code).toBe('AUTH_TOKEN_INVALID');
    });

    it('derives req.user strictly from verified token (test/production path)', async () => {
      let nextCalled = false;
      const req: any = { headers: { authorization: 'Bearer test_token_user_valid_alice' } };
      const res: any = {
        status: (s: number) => res,
        json: (b: any) => res,
      };
      const next = () => {
        nextCalled = true;
      };
      await authenticateFirebaseUser(req, res, next);
      expect(nextCalled).toBe(true);
      expect(req.user?.uid).toBe('user_valid_alice');
    });
  });

  // 1. HAPPY PATH: Live camera capture -> verification session -> check-in
  it('HAPPY PATH: grants isVerified: true when valid unconsumed session matches user and place', async () => {
    const sessionId = await createVerificationSession({
      userId: 'user_alice',
      placeId: 'place_bun_ca_co_lan',
      decision: 'VERIFIED_ELIGIBLE',
      isLiveVerified: true,
      isGalleryUpload: false,
    });

    expect(sessionId).toMatch(/^vsession_/);

    const result = await consumeVerificationSessionAtomic({
      sessionId,
      uid: 'user_alice',
      placeId: 'place_bun_ca_co_lan',
      isGalleryUpload: false,
      checkinId: 'bite_123',
    });

    expect(result.valid).toBe(true);
    expect(result.session?.used).toBe(true);
    expect(result.session?.userId).toBe('user_alice');
  });

  // 2. BYPASS ATTEMPT: Calling check-in without a verification session
  it('DIRECT BYPASS: rejects verification when no verification session ID is provided', async () => {
    const result = await consumeVerificationSessionAtomic({
      sessionId: '',
      uid: 'user_attacker',
      placeId: 'place_bun_ca_co_lan',
      isGalleryUpload: false,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('SESSION_ID_MISSING');
  });

  it('DIRECT BYPASS: rejects non-existent fabricated session ID', async () => {
    const result = await consumeVerificationSessionAtomic({
      sessionId: 'vsession_fabricated_fake_id',
      uid: 'user_attacker',
      placeId: 'place_bun_ca_co_lan',
      isGalleryUpload: false,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('SESSION_NOT_FOUND');
  });

  // 3. REPLAY ATTACK: Re-using an already consumed session
  it('REPLAY ATTACK: prevents double-spending the same verification session', async () => {
    const sessionId = await createVerificationSession({
      userId: 'user_alice',
      placeId: 'place_bun_ca_co_lan',
      decision: 'VERIFIED_ELIGIBLE',
      isLiveVerified: true,
      isGalleryUpload: false,
    });

    // First consumption succeeds
    const firstAttempt = await consumeVerificationSessionAtomic({
      sessionId,
      uid: 'user_alice',
      placeId: 'place_bun_ca_co_lan',
      isGalleryUpload: false,
      checkinId: 'bite_101',
    });
    expect(firstAttempt.valid).toBe(true);

    // Second consumption (replay attack) MUST fail
    const replayAttempt = await consumeVerificationSessionAtomic({
      sessionId,
      uid: 'user_alice',
      placeId: 'place_bun_ca_co_lan',
      isGalleryUpload: false,
      checkinId: 'bite_102',
    });
    expect(replayAttempt.valid).toBe(false);
    expect(replayAttempt.reason).toBe('SESSION_ALREADY_CONSUMED');
  });

  // 4. CROSS-USER ATTACK: User B tries to use User A's session
  it('CROSS-USER ATTACK: prevents User B from consuming User A session', async () => {
    const sessionId = await createVerificationSession({
      userId: 'user_alice',
      placeId: 'place_bun_ca_co_lan',
      decision: 'VERIFIED_ELIGIBLE',
      isLiveVerified: true,
      isGalleryUpload: false,
    });

    const crossUserAttempt = await consumeVerificationSessionAtomic({
      sessionId,
      uid: 'user_bob',
      placeId: 'place_bun_ca_co_lan',
      isGalleryUpload: false,
      checkinId: 'bite_bob_attack',
    });

    expect(crossUserAttempt.valid).toBe(false);
    expect(crossUserAttempt.reason).toBe('CROSS_USER_FORBIDDEN');
  });

  // 5. CROSS-PLACE ATTACK: User verifies at Place A, attempts checkin to Place B
  it('CROSS-PLACE ATTACK: prevents using Place A session to verify Place B', async () => {
    const sessionId = await createVerificationSession({
      userId: 'user_alice',
      placeId: 'place_bun_ca_co_lan',
      decision: 'VERIFIED_ELIGIBLE',
      isLiveVerified: true,
      isGalleryUpload: false,
    });

    const crossPlaceAttempt = await consumeVerificationSessionAtomic({
      sessionId,
      uid: 'user_alice',
      placeId: 'place_pho_cuon_huong_mai',
      isGalleryUpload: false,
      checkinId: 'bite_place_switch',
    });

    expect(crossPlaceAttempt.valid).toBe(false);
    expect(crossPlaceAttempt.reason).toBe('CROSS_PLACE_FORBIDDEN');
  });

  // 6. EXPIRED SESSION ATTACK
  it('EXPIRED SESSION: rejects verification sessions past their TTL window', async () => {
    const sessionId = await createVerificationSession({
      userId: 'user_alice',
      placeId: 'place_bun_ca_co_lan',
      decision: 'VERIFIED_ELIGIBLE',
      isLiveVerified: true,
      isGalleryUpload: false,
      ttlMinutes: -1, // Expired 1 minute ago
    });

    const expiredAttempt = await consumeVerificationSessionAtomic({
      sessionId,
      uid: 'user_alice',
      placeId: 'place_bun_ca_co_lan',
      isGalleryUpload: false,
      checkinId: 'bite_expired',
    });

    expect(expiredAttempt.valid).toBe(false);
    expect(expiredAttempt.reason).toBe('SESSION_EXPIRED');
  });

  // 7. GALLERY UPLOAD BYPASS ATTACK
  it('GALLERY BYPASS: rejects verification if marked as gallery upload', async () => {
    const sessionId = await createVerificationSession({
      userId: 'user_alice',
      placeId: 'place_bun_ca_co_lan',
      decision: 'UNVERIFIED_GALLERY',
      isLiveVerified: false,
      isGalleryUpload: true,
    });

    const galleryAttempt = await consumeVerificationSessionAtomic({
      sessionId,
      uid: 'user_alice',
      placeId: 'place_bun_ca_co_lan',
      isGalleryUpload: true,
      checkinId: 'bite_gallery',
    });

    expect(galleryAttempt.valid).toBe(false);
    expect(galleryAttempt.reason).toBe('GALLERY_CANNOT_VERIFY');
  });

  // 8. CONCURRENCY: Multiple simultaneous requests consuming the same session
  it('CONCURRENCY: guarantees exactly one winner during race conditions', async () => {
    const sessionId = await createVerificationSession({
      userId: 'user_alice',
      placeId: 'place_bun_ca_co_lan',
      decision: 'VERIFIED_ELIGIBLE',
      isLiveVerified: true,
      isGalleryUpload: false,
    });

    const results = await Promise.all([
      consumeVerificationSessionAtomic({
        sessionId,
        uid: 'user_alice',
        placeId: 'place_bun_ca_co_lan',
        isGalleryUpload: false,
        checkinId: 'bite_race_1',
      }),
      consumeVerificationSessionAtomic({
        sessionId,
        uid: 'user_alice',
        placeId: 'place_bun_ca_co_lan',
        isGalleryUpload: false,
        checkinId: 'bite_race_2',
      }),
      consumeVerificationSessionAtomic({
        sessionId,
        uid: 'user_alice',
        placeId: 'place_bun_ca_co_lan',
        isGalleryUpload: false,
        checkinId: 'bite_race_3',
      }),
    ]);

    const successes = results.filter((r) => r.valid);
    const failures = results.filter((r) => !r.valid);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(2);
  });

  // 9. AUTHORITATIVE VERIFIED BITE COUNT
  it('AUTHORITATIVE COUNT: accurately calculates verified bite count', async () => {
    const sampleBites = [
      { userId: 'user_alice', isVerified: true },
      { userId: 'user_alice', isVerified: false },
      { userId: 'user_alice', isVerified: true },
      { userId: 'user_bob', isVerified: true },
    ];

    const aliceCount = await getAuthoritativeVerifiedBiteCount('user_alice', sampleBites);
    const bobCount = await getAuthoritativeVerifiedBiteCount('user_bob', sampleBites);
    const charlieCount = await getAuthoritativeVerifiedBiteCount('user_charlie', sampleBites);

    expect(aliceCount).toBe(2);
    expect(bobCount).toBe(1);
    expect(charlieCount).toBe(0);
  });

  // 10. COMMUNITY SPOT ATOMIC VERIFICATION
  it('COMMUNITY SPOT: Creator cannot self-verify own discovered spot', async () => {
    const places: Place[] = [
      {
        id: 'spot_ngoc_ha_1',
        name: 'Bánh Mì Ngõ 12',
        category: 'street_food',
        categoryLabel: 'Quán Ngõ',
        priceBand: '25k-40k',
        priceMin: 25000,
        priceMax: 40000,
        openingHoursText: '06:00 - 22:00',
        address: 'Ngõ 12 Ngọc Hà',
        district: 'Ba Đình',
        latitude: 21.0345,
        longitude: 105.8234,
        rating: 4.5,
        reviewCount: 1,
        imageUrl: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800',
        isOpen: true,
        isCommunitySpot: true,
        communityStatus: 'pending',
        communityVerified: false,
        firstDiscovererId: 'user_creator',
      },
    ];

    const selfVerifyResult = await verifyCommunitySpotAtomic(places, 'spot_ngoc_ha_1', 'user_creator', 'Creator');
    expect(selfVerifyResult.success).toBe(false);
    expect(selfVerifyResult.code).toBe('SELF_VERIFY_FORBIDDEN');

    const secondUserResult = await verifyCommunitySpotAtomic(places, 'spot_ngoc_ha_1', 'user_second_explorer', 'Second Explorer');
    expect(secondUserResult.success).toBe(true);
    expect(secondUserResult.spot?.communityStatus).toBe('verified');
    expect(secondUserResult.spot?.communityVerified).toBe(true);

    const thirdUserResult = await verifyCommunitySpotAtomic(places, 'spot_ngoc_ha_1', 'user_third', 'Third Explorer');
    expect(thirdUserResult.success).toBe(false);
    expect(thirdUserResult.code).toBe('ALREADY_VERIFIED');
  });

  // 11. CONCURRENT FIRST VERIFIER RACE CONDITION
  it('CONCURRENCY: guarantees exactly one First Verifier winner during race condition', async () => {
    const places: Place[] = [
      {
        id: 'spot_race_101',
        name: 'Phở Gà Ngõ 55',
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
        firstDiscovererId: 'user_creator_race',
      },
    ];

    const results = await Promise.all([
      verifyCommunitySpotAtomic(places, 'spot_race_101', 'user_runner_1', 'Runner 1'),
      verifyCommunitySpotAtomic(places, 'spot_race_101', 'user_runner_2', 'Runner 2'),
      verifyCommunitySpotAtomic(places, 'spot_race_101', 'user_runner_3', 'Runner 3'),
    ]);

    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(2);
    expect(successes[0].spot?.communityVerified).toBe(true);
  });

  // 12. VERIFIED BITE ATOMICITY (SINGLE TRANSACTION GUARANTEE)
  describe('Single db.runTransaction() Atomic Verified Checkin Commit', () => {
    it('verified checkin commits atomically with session consumption', async () => {
      const sessionId = await createVerificationSession({
        userId: 'user_alice',
        placeId: 'place_bun_ca_co_lan',
        decision: 'VERIFIED_ELIGIBLE',
        isLiveVerified: true,
        isGalleryUpload: false,
      });

      const checkinPayload = {
        id: 'bite_atomic_success_1',
        placeId: 'place_bun_ca_co_lan',
        userId: 'user_alice',
        caption: 'Bún cá siêu chuẩn ngon!',
      };

      const result = await commitVerifiedCheckinAtomic({
        sessionId,
        uid: 'user_alice',
        placeId: 'place_bun_ca_co_lan',
        isGalleryUpload: false,
        checkinData: checkinPayload,
      });

      expect(result.valid).toBe(true);
      expect(result.checkin).toBeDefined();
      expect(result.checkin.isVerified).toBe(true);
      expect(result.checkin.verifiedAt).toBeDefined();
      expect(typeof result.checkin.verifiedAt).toBe('string');
      expect(result.session?.used).toBe(true);
      expect(result.session?.checkinId).toBe('bite_atomic_success_1');

      // Assert persistent store record
      const storedCheckin = getMemoryCheckinStore().get('bite_atomic_success_1');
      expect(storedCheckin).toBeDefined();
      expect(storedCheckin.isVerified).toBe(true);
      expect(storedCheckin.verifiedAt).toBe(result.checkin.verifiedAt);

      const storedSession = getMemorySessionStore().get(sessionId);
      expect(storedSession?.used).toBe(true);
      expect(storedSession?.checkinId).toBe('bite_atomic_success_1');
    });

    it('failed checkin creation rolls back session consumption', async () => {
      const sessionId = await createVerificationSession({
        userId: 'user_alice',
        placeId: 'place_bun_ca_co_lan',
        decision: 'VERIFIED_ELIGIBLE',
        isLiveVerified: true,
        isGalleryUpload: false,
      });

      const checkinPayload = {
        id: 'bite_atomic_fail_1',
        placeId: 'place_bun_ca_co_lan',
        userId: 'user_alice',
        caption: 'Should roll back!',
      };

      // Force failure during write operation inside transaction
      await expect(
        commitVerifiedCheckinAtomic({
          sessionId,
          uid: 'user_alice',
          placeId: 'place_bun_ca_co_lan',
          isGalleryUpload: false,
          checkinData: checkinPayload,
          forceFailureInCheckinWrite: true,
        })
      ).rejects.toThrow('FORCED_CHECKIN_WRITE_FAILURE');

      // Expected: Transaction rolled back completely
      // 1. Session used remains FALSE
      const sessionInStore = getMemorySessionStore().get(sessionId);
      expect(sessionInStore?.used).toBe(false);
      expect(sessionInStore?.consumedByCheckinId).toBeNull();
      expect(sessionInStore?.checkinId).toBeNull();

      // 2. No verified checkin exists
      const checkinInStore = getMemoryCheckinStore().get('bite_atomic_fail_1');
      expect(checkinInStore).toBeUndefined();
    });

    it('concurrent redemption creates exactly one verified checkin', async () => {
      const sessionId = await createVerificationSession({
        userId: 'user_alice',
        placeId: 'place_bun_ca_co_lan',
        decision: 'VERIFIED_ELIGIBLE',
        isLiveVerified: true,
        isGalleryUpload: false,
      });

      const results = await Promise.all([
        commitVerifiedCheckinAtomic({
          sessionId,
          uid: 'user_alice',
          placeId: 'place_bun_ca_co_lan',
          isGalleryUpload: false,
          checkinData: { id: 'bite_race_checkin_A', caption: 'Race A' },
        }),
        commitVerifiedCheckinAtomic({
          sessionId,
          uid: 'user_alice',
          placeId: 'place_bun_ca_co_lan',
          isGalleryUpload: false,
          checkinData: { id: 'bite_race_checkin_B', caption: 'Race B' },
        }),
      ]);

      const successes = results.filter((r) => r.valid);
      const failures = results.filter((r) => !r.valid);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);
      expect(failures[0].reason).toMatch(/SESSION_ALREADY_CONSUMED|CONCURRENT_CONSUMPTION_LOCKED/);

      // Exactly ONE verified checkin exists in the store
      const winnerCheckinId = successes[0].checkin.id;
      expect(getMemoryCheckinStore().has(winnerCheckinId)).toBe(true);
      expect(getMemoryCheckinStore().size).toBe(1);

      // Session points to the winning checkin
      const session = getMemorySessionStore().get(sessionId);
      expect(session?.used).toBe(true);
      expect(session?.checkinId).toBe(winnerCheckinId);
    });

    it('consumed session cannot create another verified checkin', async () => {
      const sessionId = await createVerificationSession({
        userId: 'user_alice',
        placeId: 'place_bun_ca_co_lan',
        decision: 'VERIFIED_ELIGIBLE',
        isLiveVerified: true,
        isGalleryUpload: false,
      });

      // 1. First redemption succeeds
      const firstResult = await commitVerifiedCheckinAtomic({
        sessionId,
        uid: 'user_alice',
        placeId: 'place_bun_ca_co_lan',
        isGalleryUpload: false,
        checkinData: { id: 'bite_first_legit', caption: 'First successful redemption' },
      });
      expect(firstResult.valid).toBe(true);
      expect(firstResult.checkin.isVerified).toBe(true);

      // 2. Replay with the same session fails with SESSION_ALREADY_CONSUMED
      const replayResult = await commitVerifiedCheckinAtomic({
        sessionId,
        uid: 'user_alice',
        placeId: 'place_bun_ca_co_lan',
        isGalleryUpload: false,
        checkinData: { id: 'bite_replay_attempt', caption: 'Replay attempt' },
      });
      expect(replayResult.valid).toBe(false);
      expect(replayResult.reason).toBe('SESSION_ALREADY_CONSUMED');

      // No second checkin exists
      expect(getMemoryCheckinStore().has('bite_first_legit')).toBe(true);
      expect(getMemoryCheckinStore().has('bite_replay_attempt')).toBe(false);
      expect(getMemoryCheckinStore().size).toBe(1);
    });
  });
});
