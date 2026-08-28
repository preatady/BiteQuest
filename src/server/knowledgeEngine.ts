import { User, AchievementBadge, UserKnowledgeProgress } from '../types';
import { getFirebaseFirestore } from './authMiddleware';
import { logger } from './logger';

export interface CompleteKnowledgeQuestResult {
  success: boolean;
  awardedXp: number;
  alreadyClaimed: boolean;
  user: User;
  newlyUnlockedBadge: AchievementBadge | null;
  unlockedMetaTitle: boolean;
  reason?: string;
}

// In-memory mutex map for atomic isolation during concurrent requests
const userMutexMap = new Map<string, Promise<any>>();

export async function runWithUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const currentPromise = userMutexMap.get(userId) || Promise.resolve();
  let releaseLock: () => void;
  const nextPromise = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  userMutexMap.set(userId, currentPromise.then(() => nextPromise));

  try {
    await currentPromise;
    return await fn();
  } finally {
    releaseLock!();
    if (userMutexMap.get(userId) === nextPromise) {
      userMutexMap.delete(userId);
    }
  }
}

export async function completeKnowledgeQuestAtomic(params: {
  user: User;
  trackId: 'smart_biter' | 'bite_guardian';
  score: number;
  total: number;
  passed: boolean;
  achievements: AchievementBadge[];
  uid?: string;
}): Promise<CompleteKnowledgeQuestResult> {
  const { trackId, score, total, passed, achievements, uid } = params;
  const user = params.user;
  const userLockKey = uid || user.id || 'default_user';

  return runWithUserLock(userLockKey, async () => {
    const firestore = getFirebaseFirestore();
    const trackKey: keyof UserKnowledgeProgress = trackId === 'smart_biter' ? 'smartBiter' : 'biteGuardian';

    // 1. Transactional Firestore branch if Firestore is available and user is authenticated
    if (firestore && typeof firestore.runTransaction === 'function' && uid) {
      try {
        const userRef = firestore.collection('users').doc(uid);

        return await firestore.runTransaction(async (transaction) => {
          const userDoc = await transaction.get(userRef);
          const userData = userDoc.exists ? (userDoc.data() as User) : user;

          const currentProgress: UserKnowledgeProgress = userData.knowledgeProgress || {
            smartBiter: { completed: false, bestScore: 0, claimedReward: false },
            biteGuardian: { completed: false, bestScore: 0, claimedReward: false },
          };

          const currentTrack = currentProgress[trackKey] || { completed: false, bestScore: 0, claimedReward: false };
          currentTrack.bestScore = Math.max(currentTrack.bestScore || 0, score);

          // 2. Check track completion / reward idempotency state inside transaction
          if (currentTrack.claimedReward || currentTrack.completed) {
            // Already completed/claimed -> strictly return 0 XP
            currentProgress[trackKey] = currentTrack;
            userData.knowledgeProgress = currentProgress;
            return {
              success: true,
              awardedXp: 0,
              alreadyClaimed: true,
              user: userData,
              newlyUnlockedBadge: null,
              unlockedMetaTitle: false,
            };
          }

          // 3. Validate completion eligibility
          const isEligible = passed && (score / (total || 5) >= 0.8 || score >= 4);
          if (!isEligible) {
            currentProgress[trackKey] = currentTrack;
            userData.knowledgeProgress = currentProgress;
            transaction.set(userRef, { knowledgeProgress: currentProgress, updatedAt: new Date().toISOString() }, { merge: true });
            return {
              success: false,
              awardedXp: 0,
              alreadyClaimed: false,
              user: userData,
              newlyUnlockedBadge: null,
              unlockedMetaTitle: false,
              reason: 'SCORE_INSUFFICIENT',
            };
          }

          // 4. Calculate reward server-side & update state inside transaction
          const awardedXp = 100;
          currentTrack.completed = true;
          currentTrack.completedAt = new Date().toLocaleDateString('vi-VN');
          currentTrack.claimedReward = true;
          currentProgress[trackKey] = currentTrack;

          let updatedXp = (userData.xp || 0) + awardedXp;
          let updatedLevel = userData.level || 1;
          let updatedNextLevelXp = userData.nextLevelXp || 400;

          while (updatedXp >= updatedNextLevelXp) {
            updatedLevel += 1;
            updatedXp = updatedXp - updatedNextLevelXp;
            updatedNextLevelXp += 200;
          }

          const badgeId = trackId === 'smart_biter' ? 'badge_smart_biter' : 'badge_bite_guardian';
          let newlyUnlockedBadge: AchievementBadge | null = null;
          const badge = achievements.find((a) => a.id === badgeId);
          if (badge && !badge.isUnlocked) {
            badge.isUnlocked = true;
            badge.unlockedAt = new Date().toLocaleDateString('vi-VN');
            newlyUnlockedBadge = badge;
          }

          let unlockedMetaTitle = false;
          const availableTitles = [...(userData.availableTitles || ['Bite Scout'])];
          if (currentProgress.smartBiter?.completed && currentProgress.biteGuardian?.completed) {
            const metaTitle = '🏆 Nhà Khám Phá Sành Sỏi';
            if (!availableTitles.includes(metaTitle)) {
              availableTitles.push(metaTitle);
              unlockedMetaTitle = true;
            }
          }

          const updatedUser: User = {
            ...userData,
            xp: updatedXp,
            level: updatedLevel,
            nextLevelXp: updatedNextLevelXp,
            knowledgeProgress: currentProgress,
            availableTitles,
            updatedAt: new Date().toISOString(),
          };

          // 5. Commit atomically inside the transaction
          transaction.set(
            userRef,
            {
              xp: updatedUser.xp,
              level: updatedUser.level,
              nextLevelXp: updatedUser.nextLevelXp,
              knowledgeProgress: updatedUser.knowledgeProgress,
              availableTitles: updatedUser.availableTitles,
              updatedAt: updatedUser.updatedAt,
            },
            { merge: true }
          );

          // Update in-memory user reference
          Object.assign(user, updatedUser);

          return {
            success: true,
            awardedXp,
            alreadyClaimed: false,
            user: updatedUser,
            newlyUnlockedBadge,
            unlockedMetaTitle,
          };
        });
      } catch (err: any) {
        logger.warn({ event: 'FIRESTORE_KNOWLEDGE_TRANSACTION_ERROR', error: err?.message });
      }
    }

    // 2. In-memory Authoritative Transaction (Protected by UserLock mutex)
    if (!user.knowledgeProgress) {
      user.knowledgeProgress = {
        smartBiter: { completed: false, bestScore: 0, claimedReward: false },
        biteGuardian: { completed: false, bestScore: 0, claimedReward: false },
      };
    }

    const currentTrack = user.knowledgeProgress[trackKey] || { completed: false, bestScore: 0, claimedReward: false };
    currentTrack.bestScore = Math.max(currentTrack.bestScore || 0, score);

    // Idempotency check: Already completed or claimed
    if (currentTrack.claimedReward || currentTrack.completed) {
      user.knowledgeProgress[trackKey] = currentTrack;
      return {
        success: true,
        awardedXp: 0,
        alreadyClaimed: true,
        user,
        newlyUnlockedBadge: null,
        unlockedMetaTitle: false,
      };
    }

    // Validation
    const isEligible = passed && (score / (total || 5) >= 0.8 || score >= 4);
    if (!isEligible) {
      user.knowledgeProgress[trackKey] = currentTrack;
      return {
        success: false,
        awardedXp: 0,
        alreadyClaimed: false,
        user,
        newlyUnlockedBadge: null,
        unlockedMetaTitle: false,
        reason: 'SCORE_INSUFFICIENT',
      };
    }

    // Calculate reward server-side
    const awardedXp = 100;
    currentTrack.completed = true;
    currentTrack.completedAt = new Date().toLocaleDateString('vi-VN');
    currentTrack.claimedReward = true;
    user.knowledgeProgress[trackKey] = currentTrack;

    user.xp += awardedXp;
    while (user.xp >= user.nextLevelXp) {
      user.level += 1;
      user.xp = user.xp - user.nextLevelXp;
      user.nextLevelXp += 200;
    }

    const badgeId = trackId === 'smart_biter' ? 'badge_smart_biter' : 'badge_bite_guardian';
    let newlyUnlockedBadge: AchievementBadge | null = null;
    const badge = achievements.find((a) => a.id === badgeId);
    if (badge && !badge.isUnlocked) {
      badge.isUnlocked = true;
      badge.unlockedAt = new Date().toLocaleDateString('vi-VN');
      newlyUnlockedBadge = badge;
    }

    let unlockedMetaTitle = false;
    if (user.knowledgeProgress.smartBiter?.completed && user.knowledgeProgress.biteGuardian?.completed) {
      const metaTitle = '🏆 Nhà Khám Phá Sành Sỏi';
      if (!user.availableTitles.includes(metaTitle)) {
        user.availableTitles.push(metaTitle);
        unlockedMetaTitle = true;
      }
    }

    return {
      success: true,
      awardedXp,
      alreadyClaimed: false,
      user,
      newlyUnlockedBadge,
      unlockedMetaTitle,
    };
  });
}
