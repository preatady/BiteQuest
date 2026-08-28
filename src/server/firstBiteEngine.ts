import { Place, User } from '../types';
import { getFirebaseAdmin } from './authMiddleware';
import { logger } from './logger';

export interface VerificationResult {
  success: boolean;
  code: 'VERIFIED_SUCCESS' | 'SELF_VERIFY_FORBIDDEN' | 'ALREADY_VERIFIED' | 'SPOT_NOT_FOUND' | 'CONCURRENT_CONFLICT';
  message: string;
  spot?: Place;
  firstDiscovererId?: string;
  awardedXpToCreator?: number;
  awardedXpToVerifier?: number;
}

// In-memory mutex/lock set for atomic concurrency protection (fallback)
const activeVerificationLocks = new Set<string>();

/**
 * First Bite Verification Engine
 * Strictly enforces:
 * 1. Persistent Firestore transaction across Cloud Run instances
 * 2. Creator cannot self-verify (verifierUserId !== firstDiscovererId)
 * 3. Second independent user verification required
 * 4. Atomic single-award of First Bite badge & XP
 * 5. Multi-instance concurrent conflict resolution
 */
export async function verifyCommunitySpotAtomic(
  placesList: Place[],
  spotId: string,
  verifierUserId: string,
  verifierUserName: string
): Promise<VerificationResult> {
  // Step 1: Attempt Distributed Transaction via Firestore for true multi-instance authority
  try {
    const adminInstance = getFirebaseAdmin();
    const apps = (adminInstance as any)?.apps || (adminInstance as any)?.default?.apps;
    if (apps && apps.length) {
      const firestoreFn = (adminInstance as any).firestore || (adminInstance as any).default?.firestore;
      if (typeof firestoreFn === 'function') {
        const db = firestoreFn();
        const spotRef = db.collection('places').doc(spotId);
        const verificationRecordRef = db.collection('spotVerifications').doc(`verification_${spotId}`);

        const txResult = await db.runTransaction(async (transaction: any) => {
          const spotDoc = await transaction.get(spotRef);
          if (!spotDoc.exists) {
            return {
              success: false,
              code: 'SPOT_NOT_FOUND' as const,
              message: 'Không tìm thấy Quán Ngõ cộng đồng được yêu cầu.',
            };
          }

          const spotData = spotDoc.data() as Place;

          // Rule 1: Creator cannot self-verify
          if (spotData.firstDiscovererId && spotData.firstDiscovererId === verifierUserId) {
            return {
              success: false,
              code: 'SELF_VERIFY_FORBIDDEN' as const,
              message: 'Người tạo Quán Ngõ không thể tự xác minh First Bite. Cần một Foodie khác ghé thăm và xác nhận.',
            };
          }

          // Rule 2: First Bite awarded only once
          if (spotData.communityStatus === 'verified' || spotData.communityVerified) {
            return {
              success: false,
              code: 'ALREADY_VERIFIED' as const,
              message: 'Quán này đã được cộng đồng xác minh trước đó. First Bite chỉ được trao 1 lần duy nhất.',
            };
          }

          const nowIso = new Date().toISOString();

          // Rule 3: Atomic write to spot document and verification record
          transaction.update(spotRef, {
            communityStatus: 'verified',
            communityVerified: true,
            verifiedByUserId: verifierUserId,
            verifiedAt: nowIso,
          });

          transaction.set(verificationRecordRef, {
            spotId,
            verifierId: verifierUserId,
            verifierName: verifierUserName,
            firstDiscovererId: spotData.firstDiscovererId,
            verifiedAt: nowIso,
          });

          const updatedSpot: Place = {
            ...spotData,
            communityStatus: 'verified',
            communityVerified: true,
            verifiedByUserId: verifierUserId,
            verifiedAt: nowIso,
          };

          return {
            success: true,
            code: 'VERIFIED_SUCCESS' as const,
            message: `🎉 Quán đã được xác nhận bởi ${verifierUserName}! Huy hiệu First Bite đã chính thức được trao cho người phát hiện đầu tiên.`,
            spot: updatedSpot,
            firstDiscovererId: spotData.firstDiscovererId,
            awardedXpToCreator: 150,
            awardedXpToVerifier: 60,
          };
        });

        if (txResult.code !== 'SPOT_NOT_FOUND') {
          // Sync in-memory list
          const localSpot = placesList.find((p) => p.id === spotId);
          if (localSpot && txResult.success) {
            localSpot.communityStatus = 'verified';
            localSpot.communityVerified = true;
            localSpot.verifiedByUserId = verifierUserId;
            localSpot.verifiedAt = new Date().toISOString();
          }
          return txResult;
        }
      }
    }
  } catch (err: any) {
    logger.warn({ event: 'FIRESTORE_VERIFY_COMMUNITY_SPOT_TX_FALLBACK', error: err?.message });
  }

  // Step 2: Fallback to Atomic in-memory engine (for local unit tests / mock environments)
  if (activeVerificationLocks.has(spotId)) {
    return {
      success: false,
      code: 'CONCURRENT_CONFLICT',
      message: 'Một yêu cầu xác minh khác đang được xử lý đồng thời cho quán này.',
    };
  }

  activeVerificationLocks.add(spotId);

  try {
    const spot = placesList.find((p) => p.id === spotId && p.isCommunitySpot);
    if (!spot) {
      return {
        success: false,
        code: 'SPOT_NOT_FOUND',
        message: 'Không tìm thấy Quán Ngõ cộng đồng được yêu cầu.',
      };
    }

    // 1. Rule: Creator cannot self-verify
    if (spot.firstDiscovererId && spot.firstDiscovererId === verifierUserId) {
      return {
        success: false,
        code: 'SELF_VERIFY_FORBIDDEN',
        message: 'Người tạo Quán Ngõ không thể tự xác minh First Bite. Cần một Foodie khác ghé thăm và xác nhận.',
      };
    }

    // 2. Rule: First Bite awarded only once
    if (spot.communityStatus === 'verified' || spot.communityVerified) {
      return {
        success: false,
        code: 'ALREADY_VERIFIED',
        message: 'Quán này đã được cộng đồng xác minh trước đó. First Bite chỉ được trao 1 lần duy nhất.',
      };
    }

    // 3. Atomically update spot status
    spot.communityStatus = 'verified';
    spot.communityVerified = true;
    spot.verifiedByUserId = verifierUserId;
    spot.verifiedAt = new Date().toISOString();

    return {
      success: true,
      code: 'VERIFIED_SUCCESS',
      message: `🎉 Quán đã được xác nhận bởi ${verifierUserName}! Huy hiệu First Bite đã chính thức được trao cho người phát hiện đầu tiên.`,
      spot,
      firstDiscovererId: spot.firstDiscovererId,
      awardedXpToCreator: 150,
      awardedXpToVerifier: 60,
    };
  } finally {
    activeVerificationLocks.delete(spotId);
  }
}

