import { describe, it, expect } from 'vitest';
import {
  createVerificationSession,
  commitVerifiedCheckinAtomic,
  consumeVerificationSession,
  VerificationDecision,
} from '../src/server/verificationSessions';
import { Place, FoodCategory } from '../src/types';
import { getDistance } from 'geolib';

/**
 * Server Proof-of-Bite Verification Authority Logic (Simulated matching /api/verify-bite in server.ts)
 */
function evaluateServerVerificationDecision(params: {
  isGalleryUpload: boolean;
  latitude: number;
  longitude: number;
  accuracy: number;
  places: Place[];
  geminiResult: {
    executed: boolean;
    isFoodOrDrink: boolean | null;
    confidence: number;
    visibleVenueText?: string;
  } | null;
}): {
  verified: boolean;
  decision: VerificationDecision;
  statusMessage: string;
  matchedPlace: Place | null;
  distanceMeters: number;
} {
  const { isGalleryUpload, latitude, longitude, accuracy, places, geminiResult } = params;

  // 1. Dynamic search radius & candidate distance computation
  const dynamicRadius = Math.min(300, Math.max(40, accuracy * 2.5));

  const candidateList = places.map((place) => {
    const dist = getDistance(
      { latitude, longitude },
      { latitude: place.latitude, longitude: place.longitude }
    );

    let matchScore = 0;
    if (dist <= 30) matchScore += 65;
    else if (dist <= 75) matchScore += 50;
    else if (dist <= 150) matchScore += 35;
    else if (dist <= dynamicRadius) matchScore += 20;
    else matchScore += 5;

    let signageMatched = false;
    if (geminiResult?.visibleVenueText && dist <= dynamicRadius) {
      const normVisible = geminiResult.visibleVenueText.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normPlace = place.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normVisible.length >= 3 && (normPlace.includes(normVisible) || normVisible.includes(normPlace))) {
        matchScore += 40;
        signageMatched = true;
      }
    }

    return {
      place,
      distanceMeters: dist,
      matchScore,
      signageMatched,
    };
  });

  candidateList.sort((a, b) => b.matchScore - a.matchScore);
  const topMatch = candidateList[0];

  // Spatial Gate: Non-fallback GPS within dynamic radius
  const isConfidentMatch = Boolean(
    topMatch &&
    topMatch.distanceMeters <= Math.max(dynamicRadius, 150) &&
    accuracy <= 150 &&
    latitude !== 0 &&
    longitude !== 0
  );

  const matchedPlace = isConfidentMatch ? topMatch.place : places[0] || null;
  const distanceMeters = isConfidentMatch ? topMatch.distanceMeters : 9999;
  const hasSignageEvidence = Boolean(topMatch?.signageMatched);

  // Gemini evidence analysis
  const geminiConfirmedFood = Boolean(
    geminiResult?.executed &&
    geminiResult.isFoodOrDrink === true &&
    (geminiResult.confidence || 0) >= 0.5
  );
  const geminiExplicitNonFood = Boolean(
    geminiResult?.executed &&
    geminiResult.isFoodOrDrink === false
  );

  // Visual Evidence Gate (Fail-Closed)
  const hasPositiveVisualEvidence =
    !geminiExplicitNonFood &&
    (geminiConfirmedFood || hasSignageEvidence);

  // Decision Evaluation
  if (isGalleryUpload) {
    return {
      verified: false,
      decision: 'UNVERIFIED_GALLERY',
      statusMessage: '📸 Ảnh từ thư viện (Gallery Bite - Chưa xác minh trực tiếp)',
      matchedPlace,
      distanceMeters,
    };
  }

  if (!isConfidentMatch) {
    return {
      verified: false,
      decision: 'REJECTED',
      statusMessage: '👀 Quán mới à? (Vị trí chưa khớp quán sẵn có)',
      matchedPlace,
      distanceMeters,
    };
  }

  if (geminiExplicitNonFood) {
    return {
      verified: false,
      decision: 'REJECTED',
      statusMessage: '🚫 Không phát hiện món ăn/đồ uống trong ảnh.',
      matchedPlace,
      distanceMeters,
    };
  }

  if (!hasPositiveVisualEvidence) {
    // FAIL-CLOSED: Absence of visual evidence
    return {
      verified: false,
      decision: 'EVIDENCE_UNAVAILABLE',
      statusMessage: 'Chưa thể xác minh bằng chứng hình ảnh.',
      matchedPlace,
      distanceMeters,
    };
  }

  // All gates pass
  return {
    verified: true,
    decision: 'VERIFIED_ELIGIBLE',
    statusMessage: '✨ Đã xác minh trực tiếp tại quán!',
    matchedPlace,
    distanceMeters,
  };
}

describe('Proof-of-Bite Fail-Closed Evidence Hardening - Adversarial Test Suite', () => {
  const mockVenue: Place = {
    id: 'place_bun_ca_co_lan',
    name: 'Bún Cá Cô Lan',
    category: 'noodles',
    categoryLabel: 'Bún / Phở',
    address: 'Ngõ 165 Cầu Giấy, Hà Nội',
    district: 'Cầu Giấy',
    latitude: 21.0325,
    longitude: 105.7925,
    priceBand: '35k–50k',
    priceMin: 35000,
    priceMax: 50000,
    rating: 4.8,
    reviewCount: 12,
    imageUrl: 'https://images.unsplash.com/photo-1',
    isOpen: true,
    openingHoursText: '06:30 - 21:00',
  };

  const venueCoords = { latitude: 21.0325, longitude: 105.7925 };
  // 15 meters offset from venue
  const closeUserCoords = { latitude: 21.0326, longitude: 105.7926 };

  // TEST 1: Live camera + 15m distance + Gemini timeout + visual evidence none
  it('TEST 1: rejects verification when Gemini times out and visual evidence is absent (Distance alone is insufficient)', async () => {
    const evalResult = evaluateServerVerificationDecision({
      isGalleryUpload: false,
      latitude: closeUserCoords.latitude,
      longitude: closeUserCoords.longitude,
      accuracy: 10,
      places: [mockVenue],
      geminiResult: null, // Gemini timeout / unavailable
    });

    expect(evalResult.verified).toBe(false);
    expect(evalResult.decision).toBe('EVIDENCE_UNAVAILABLE');
    expect(evalResult.statusMessage).toBe('Chưa thể xác minh bằng chứng hình ảnh.');

    // If an invalid or unverified session is attempted for atomic check-in commit:
    const sessionId = await createVerificationSession({
      userId: 'user_test_1',
      placeId: mockVenue.id,
      decision: evalResult.decision,
      isLiveVerified: evalResult.verified,
      isGalleryUpload: false,
    });

    const commitResult = await commitVerifiedCheckinAtomic({
      sessionId,
      uid: 'user_test_1',
      placeId: mockVenue.id,
      checkinData: { id: 'checkin_fail_1' },
    });

    expect(commitResult.valid).toBe(false);
    expect(commitResult.reason).toBe('SESSION_NOT_ELIGIBLE');
  });

  // TEST 2: Live camera + 15m distance + Gemini returns explicit isFoodOrDrink = false
  it('TEST 2: strictly rejects verification when Gemini returns negative evidence (isFoodOrDrink = false)', async () => {
    const evalResult = evaluateServerVerificationDecision({
      isGalleryUpload: false,
      latitude: closeUserCoords.latitude,
      longitude: closeUserCoords.longitude,
      accuracy: 10,
      places: [mockVenue],
      geminiResult: {
        executed: true,
        isFoodOrDrink: false, // Shoes / keyboard / street
        confidence: 0.95,
      },
    });

    expect(evalResult.verified).toBe(false);
    expect(evalResult.decision).toBe('REJECTED');
    expect(evalResult.statusMessage).toBe('🚫 Không phát hiện món ăn/đồ uống trong ảnh.');
  });

  // TEST 3: Live camera + 15m distance + Gemini returns strong positive food evidence
  it('TEST 3: accepts verification when live camera, proximity, and positive food evidence all pass', async () => {
    const evalResult = evaluateServerVerificationDecision({
      isGalleryUpload: false,
      latitude: closeUserCoords.latitude,
      longitude: closeUserCoords.longitude,
      accuracy: 10,
      places: [mockVenue],
      geminiResult: {
        executed: true,
        isFoodOrDrink: true,
        confidence: 0.92,
      },
    });

    expect(evalResult.verified).toBe(true);
    expect(evalResult.decision).toBe('VERIFIED_ELIGIBLE');
    expect(evalResult.statusMessage).toBe('✨ Đã xác minh trực tiếp tại quán!');

    const sessionId = await createVerificationSession({
      userId: 'user_test_3',
      placeId: mockVenue.id,
      decision: evalResult.decision,
      isLiveVerified: evalResult.verified,
      isGalleryUpload: false,
    });

    const commitResult = await commitVerifiedCheckinAtomic({
      sessionId,
      uid: 'user_test_3',
      placeId: mockVenue.id,
      checkinData: { id: 'checkin_success_3' },
    });

    expect(commitResult.valid).toBe(true);
    expect(commitResult.session?.decision).toBe('VERIFIED_ELIGIBLE');
  });

  // TEST 4: Live camera + 15m distance + Gemini food unavailable, BUT venue signage matches
  it('TEST 4: accepts verification if alternative venue signage evidence matches venue name', async () => {
    const evalResult = evaluateServerVerificationDecision({
      isGalleryUpload: false,
      latitude: closeUserCoords.latitude,
      longitude: closeUserCoords.longitude,
      accuracy: 10,
      places: [mockVenue],
      geminiResult: {
        executed: true,
        isFoodOrDrink: null, // Food unconfirmed
        confidence: 0.6,
        visibleVenueText: 'Bún Cá Cô Lan - Cầu Giấy',
      },
    });

    expect(evalResult.verified).toBe(true);
    expect(evalResult.decision).toBe('VERIFIED_ELIGIBLE');
  });

  // TEST 5: Gallery upload + positive Gemini food evidence
  it('TEST 5: strictly rejects verification on gallery upload even with positive food evidence', async () => {
    const evalResult = evaluateServerVerificationDecision({
      isGalleryUpload: true, // Gallery upload
      latitude: closeUserCoords.latitude,
      longitude: closeUserCoords.longitude,
      accuracy: 10,
      places: [mockVenue],
      geminiResult: {
        executed: true,
        isFoodOrDrink: true,
        confidence: 0.99,
      },
    });

    expect(evalResult.verified).toBe(false);
    expect(evalResult.decision).toBe('UNVERIFIED_GALLERY');
    expect(evalResult.statusMessage).toBe('📸 Ảnh từ thư viện (Gallery Bite - Chưa xác minh trực tiếp)');
  });

  // TEST 6: Discovery fallback coordinates (0,0 or far away) + live camera
  it('TEST 6: strictly rejects verification on fallback/uncalibrated coordinates or excessive distance', async () => {
    const evalResult = evaluateServerVerificationDecision({
      isGalleryUpload: false,
      latitude: 0,
      longitude: 0, // Fallback/missing coordinates
      accuracy: 1000,
      places: [mockVenue],
      geminiResult: {
        executed: true,
        isFoodOrDrink: true,
        confidence: 0.90,
      },
    });

    expect(evalResult.verified).toBe(false);
    expect(evalResult.decision).toBe('REJECTED');
  });
});
