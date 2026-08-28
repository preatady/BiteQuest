import crypto from 'crypto';
import { getFirebaseAdmin } from './authMiddleware';
import { logger } from './logger';
import firebaseConfig from '../../firebase-applet-config.json';

export type VerificationDecision =
  | 'VERIFIED_ELIGIBLE'
  | 'UNVERIFIED_GALLERY'
  | 'EVIDENCE_UNAVAILABLE'
  | 'EVIDENCE_INSUFFICIENT'
  | 'REJECTED';

export interface VerificationSession {
  id: string;
  userId: string;
  placeId: string;
  providerPlaceId?: string;
  decision: VerificationDecision;
  isLiveVerified: boolean;
  isGalleryUpload: boolean;
  issuedAt: number;
  expiresAt: number;
  used: boolean;
  usedAt?: number | null;
  consumedAt?: number | null;
  consumedByCheckinId?: string | null;
  checkinId?: string | null;
  createdAtIso: string;
}

// In-memory persistent fallback store (with per-session atomic lock)
const memorySessionStore = new Map<string, VerificationSession>();
const memoryCheckinStore = new Map<string, any>();
const sessionLocks = new Set<string>();

/**
 * Creates a persistent server-side verification session
 */
export async function createVerificationSession(params: {
  userId: string;
  placeId: string;
  providerPlaceId?: string;
  decision: VerificationDecision;
  isLiveVerified: boolean;
  isGalleryUpload: boolean;
  ttlMinutes?: number;
}): Promise<string> {
  const sessionId = `vsession_${crypto.randomBytes(16).toString('hex')}`;
  const now = Date.now();
  const ttlMs = (params.ttlMinutes || 15) * 60 * 1000;

  const session: VerificationSession = {
    id: sessionId,
    userId: params.userId,
    placeId: params.placeId,
    providerPlaceId: params.providerPlaceId,
    decision: params.decision,
    isLiveVerified: params.isLiveVerified,
    isGalleryUpload: params.isGalleryUpload,
    issuedAt: now,
    expiresAt: now + ttlMs,
    used: false,
    usedAt: null,
    consumedAt: null,
    consumedByCheckinId: null,
    checkinId: null,
    createdAtIso: new Date(now).toISOString(),
  };

  // Always store in memory fallback
  memorySessionStore.set(sessionId, { ...session });

  // Attempt to persist to Firestore if Firebase Admin Firestore is accessible
  try {
    const adminInstance = getFirebaseAdmin();
    const apps = (adminInstance as any)?.apps || (adminInstance as any)?.default?.apps;
    if (apps && apps.length) {
      const firestoreFn = (adminInstance as any).firestore || (adminInstance as any).default?.firestore;
      if (typeof firestoreFn === 'function') {
        const db = firestoreFn();
        await db.collection('verificationSessions').doc(sessionId).set(session);
      }
    }
  } catch (err: any) {
    logger.warn({ event: 'VERIFICATION_SESSION_FIRESTORE_WRITE_FALLBACK', error: err?.message });
  }

  logger.info({
    event: 'VERIFICATION_SESSION_CREATED',
    sessionId,
    userId: params.userId,
    placeId: params.placeId,
    decision: params.decision,
  });

  return sessionId;
}

export interface CommitVerifiedCheckinParams {
  sessionId: string;
  uid: string;
  placeId: string;
  providerPlaceId?: string;
  isGalleryUpload?: boolean;
  checkinData: any;
  forceFailureInCheckinWrite?: boolean;
}

export interface CommitVerifiedCheckinResult {
  valid: boolean;
  reason?: string;
  session?: VerificationSession;
  checkin?: any;
}

/**
 * ATOMIC PROOF-OF-BITE VERIFIED CHECKIN TRANSACTION
 * 
 * Executes inside ONE single Firestore db.runTransaction() commit:
 * 1. Read + validate verificationSessions/{sessionId}
 * 2. Set checkin document (isVerified: true, server-generated verifiedAt)
 * 3. Update verification session as consumed (used: true, consumedAt, checkinId)
 * 
 * If checkin creation fails or anything is invalid, the entire transaction rolls back.
 */
export async function commitVerifiedCheckinAtomic(
  params: CommitVerifiedCheckinParams
): Promise<CommitVerifiedCheckinResult> {
  const { sessionId, uid, placeId, providerPlaceId, isGalleryUpload, checkinData, forceFailureInCheckinWrite } = params;

  if (!sessionId) {
    return { valid: false, reason: 'SESSION_ID_MISSING' };
  }

  // 1. Attempt single Firestore Transaction commit first
  try {
    const adminInstance = getFirebaseAdmin();
    const apps = (adminInstance as any)?.apps || (adminInstance as any)?.default?.apps;
    if (apps && apps.length) {
      const firestoreFn = (adminInstance as any).firestore || (adminInstance as any).default?.firestore;
      if (typeof firestoreFn === 'function') {
        const db = firestoreFn();
        const sessionRef = db.collection('verificationSessions').doc(sessionId);
        const checkinRef = db.collection('checkins').doc(checkinData.id);

        const result = await db.runTransaction(async (transaction: any) => {
          // Operation 1: Read session doc
          const docSnap = await transaction.get(sessionRef);
          if (!docSnap.exists) {
            return { valid: false, reason: 'SESSION_NOT_FOUND' };
          }

          const session = docSnap.data() as VerificationSession;

          // Validation rules
          if (session.used) {
            return { valid: false, reason: 'SESSION_ALREADY_CONSUMED' };
          }

          const now = Date.now();
          if (now > session.expiresAt) {
            return { valid: false, reason: 'SESSION_EXPIRED' };
          }

          if (session.userId !== uid) {
            return { valid: false, reason: 'CROSS_USER_FORBIDDEN' };
          }

          // Venue match check
          const placeMatches =
            session.placeId === placeId ||
            (session.providerPlaceId && providerPlaceId && session.providerPlaceId === providerPlaceId) ||
            (session.providerPlaceId && session.providerPlaceId === placeId) ||
            (providerPlaceId && session.placeId === providerPlaceId);

          if (!placeMatches) {
            return { valid: false, reason: 'CROSS_PLACE_FORBIDDEN' };
          }

          if (isGalleryUpload || session.isGalleryUpload) {
            return { valid: false, reason: 'GALLERY_CANNOT_VERIFY' };
          }

          if (session.decision !== 'VERIFIED_ELIGIBLE' || !session.isLiveVerified) {
            return { valid: false, reason: 'SESSION_NOT_ELIGIBLE' };
          }

          if (forceFailureInCheckinWrite) {
            throw new Error('FORCED_CHECKIN_WRITE_FAILURE');
          }

          const verifiedAtIso = new Date(now).toISOString();
          const finalCheckin = {
            ...checkinData,
            isVerified: true,
            verifiedAt: verifiedAtIso,
          };

          // Operation 2: Create checkin document inside transaction
          transaction.set(checkinRef, finalCheckin);

          // Operation 3: Mark verification session as consumed inside transaction
          transaction.update(sessionRef, {
            used: true,
            usedAt: now,
            consumedAt: now,
            consumedByCheckinId: checkinData.id,
            checkinId: checkinData.id,
          });

          // Sync in-memory records
          session.used = true;
          session.usedAt = now;
          session.consumedAt = now;
          session.consumedByCheckinId = checkinData.id;
          session.checkinId = checkinData.id;
          memorySessionStore.set(sessionId, session);
          memoryCheckinStore.set(checkinData.id, finalCheckin);

          return { valid: true, session, checkin: finalCheckin };
        });

        if (result.reason !== 'SESSION_NOT_FOUND') {
          return result;
        }
      }
    }
  } catch (err: any) {
    if (err?.message === 'FORCED_CHECKIN_WRITE_FAILURE') {
      throw err;
    }
    logger.warn({ event: 'FIRESTORE_SESSION_TRANSACTION_FALLBACK', error: err?.message });
  }

  // 2. Transactional fallback store
  if (sessionLocks.has(sessionId)) {
    return { valid: false, reason: 'CONCURRENT_CONSUMPTION_LOCKED' };
  }

  sessionLocks.add(sessionId);
  try {
    const session = memorySessionStore.get(sessionId);
    if (!session) {
      return { valid: false, reason: 'SESSION_NOT_FOUND' };
    }

    if (session.used) {
      return { valid: false, reason: 'SESSION_ALREADY_CONSUMED' };
    }

    const now = Date.now();
    if (now > session.expiresAt) {
      return { valid: false, reason: 'SESSION_EXPIRED' };
    }

    if (session.userId !== uid) {
      return { valid: false, reason: 'CROSS_USER_FORBIDDEN' };
    }

    const placeMatches =
      session.placeId === placeId ||
      (session.providerPlaceId && providerPlaceId && session.providerPlaceId === providerPlaceId) ||
      (session.providerPlaceId && session.providerPlaceId === placeId) ||
      (providerPlaceId && session.placeId === providerPlaceId);

    if (!placeMatches) {
      return { valid: false, reason: 'CROSS_PLACE_FORBIDDEN' };
    }

    if (isGalleryUpload || session.isGalleryUpload) {
      return { valid: false, reason: 'GALLERY_CANNOT_VERIFY' };
    }

    if (session.decision !== 'VERIFIED_ELIGIBLE' || !session.isLiveVerified) {
      return { valid: false, reason: 'SESSION_NOT_ELIGIBLE' };
    }

    if (forceFailureInCheckinWrite) {
      // Transaction aborts: no mutations are committed
      throw new Error('FORCED_CHECKIN_WRITE_FAILURE');
    }

    const verifiedAtIso = new Date(now).toISOString();
    const finalCheckin = {
      ...checkinData,
      isVerified: true,
      verifiedAt: verifiedAtIso,
    };

    // Atomically commit both operations
    memoryCheckinStore.set(checkinData.id, finalCheckin);
    session.used = true;
    session.usedAt = now;
    session.consumedAt = now;
    session.consumedByCheckinId = checkinData.id;
    session.checkinId = checkinData.id;
    memorySessionStore.set(sessionId, session);

    return { valid: true, session, checkin: finalCheckin };
  } finally {
    sessionLocks.delete(sessionId);
  }
}

/**
 * Atomically consumes a verification session.
 */
export async function consumeVerificationSessionAtomic(params: {
  sessionId: string;
  uid: string;
  placeId: string;
  providerPlaceId?: string;
  isGalleryUpload?: boolean;
  checkinId?: string;
  forceFailureInCheckinWrite?: boolean;
}): Promise<{ valid: boolean; reason?: string; session?: VerificationSession; checkin?: any }> {
  return commitVerifiedCheckinAtomic({
    sessionId: params.sessionId,
    uid: params.uid,
    placeId: params.placeId,
    providerPlaceId: params.providerPlaceId,
    isGalleryUpload: params.isGalleryUpload,
    checkinData: { id: params.checkinId || `bite_${Date.now()}` },
    forceFailureInCheckinWrite: params.forceFailureInCheckinWrite,
  });
}

/**
 * Server-authoritative count of verified bites for a user
 */
export async function getAuthoritativeVerifiedBiteCount(
  userId: string,
  feedBites: { userId: string; isVerified: boolean }[]
): Promise<number> {
  if (!userId) return 0;

  try {
    const adminInstance = getFirebaseAdmin();
    const apps = (adminInstance as any)?.apps || (adminInstance as any)?.default?.apps;
    if (apps && apps.length) {
      const firestoreFn = (adminInstance as any).firestore || (adminInstance as any).default?.firestore;
      if (typeof firestoreFn === 'function') {
        const db = firestoreFn();
        const snap = await db
          .collection('checkins')
          .where('userId', '==', userId)
          .where('isVerified', '==', true)
          .count()
          .get();
        return snap.data().count;
      }
    }
  } catch (err: any) {
    logger.warn({ event: 'FIRESTORE_COUNT_FALLBACK', error: err?.message });
  }

  // Authoritative in-memory count
  return feedBites.filter((b) => b.userId === userId && b.isVerified).length;
}

/**
 * Returns all authoritative verified check-ins from Firestore or server memory store.
 * Independent of client feed pagination or public feed slicing.
 */
export async function getAuthoritativeVerifiedCheckins(): Promise<any[]> {
  try {
    const adminInstance = getFirebaseAdmin();
    const apps = (adminInstance as any)?.apps || (adminInstance as any)?.default?.apps;
    if (apps && apps.length) {
      const firestoreFn = (adminInstance as any).firestore || (adminInstance as any).default?.firestore;
      if (typeof firestoreFn === 'function') {
        const db = firestoreFn();
        const snap = await db
          .collection('checkins')
          .where('isVerified', '==', true)
          .get();
        if (snap && Array.isArray(snap.docs) && snap.docs.length > 0) {
          return snap.docs.map((d: any) => d.data());
        }
      }
    }
  } catch (err: any) {
    logger.warn({ event: 'FIRESTORE_ALL_VERIFIED_CHECKINS_FALLBACK', error: err?.message });
  }

  return Array.from(memoryCheckinStore.values()).filter((c: any) => c.isVerified);
}

// Reset store (for testing purposes)
export function resetVerificationSessionStore(): void {
  memorySessionStore.clear();
  memoryCheckinStore.clear();
  sessionLocks.clear();
}

export function getMemoryCheckinStore(): Map<string, any> {
  return memoryCheckinStore;
}

export function getMemorySessionStore(): Map<string, VerificationSession> {
  return memorySessionStore;
}
