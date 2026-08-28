import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
  startAt,
  endAt,
  limit,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import {
  geohashForLocation,
  geohashQueryBounds,
  distanceBetween,
} from 'geofire-common';
import {
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { db, auth, googleProvider } from '../firebase';
import { Place, BiteCheckin, User, DistrictPassport, AuthProviderType } from '../types';
import {
  INITIAL_PLACES,
  INITIAL_FEED_BITES,
  INITIAL_USER,
  EMPTY_USER,
  createDefaultPassport,
  EMPTY_PASSPORT_CAU_GIAY,
} from '../data/seedData';
import { validateUsername } from './authValidation';

// Check if username is available in Firestore
export async function checkUsernameAvailability(
  username: string,
  currentUid?: string
): Promise<{ available: boolean; error?: string }> {
  const formatValidation = validateUsername(username);
  if (!formatValidation.valid) {
    return { available: false, error: formatValidation.error };
  }

  const normalized = username.trim().toLowerCase();

  try {
    const usernameDocRef = doc(db, 'usernames', normalized);
    const snap = await getDoc(usernameDocRef);

    if (snap.exists()) {
      const data = snap.data();
      if (currentUid && data.uid === currentUid) {
        return { available: true };
      }
      return { available: false, error: 'ID người dùng này đã được sử dụng. Vui lòng chọn ID khác.' };
    }

    return { available: true };
  } catch (err: any) {
    console.warn('Firestore username check fallback:', err);
    // Fallback to server API check if direct client check encounters permission/network issue
    try {
      const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(normalized)}`);
      if (res.ok) {
        const data = await res.json();
        return { available: data.available, error: data.error };
      }
    } catch (e) {
      console.warn('API username check fallback:', e);
    }
    return { available: true };
  }
}

// Sync or fetch current logged-in user profile
export async function syncUserProfile(
  fbUser: FirebaseUser,
  initialExtra?: {
    username?: string;
    displayName?: string;
    authProvider?: AuthProviderType;
    isGuest?: boolean;
    foodPreferences?: string[];
    explorationStyle?: string;
    onboardingCompleted?: boolean;
  }
): Promise<User> {
  const userRef = doc(db, 'users', fbUser.uid);
  const snap = await getDoc(userRef);

  const providerType: AuthProviderType = fbUser.isAnonymous
    ? 'anonymous'
    : (fbUser.providerData?.[0]?.providerId === 'google.com' || fbUser.providerId === 'google.com'
      ? 'google'
      : 'password');

  if (snap.exists()) {
    const existing = snap.data() as User;
    // If extra fields were passed (e.g. from registration or onboarding), merge them
    if (initialExtra && Object.keys(initialExtra).length > 0) {
      const merged: User = {
        ...existing,
        ...initialExtra,
        id: fbUser.uid,
        uid: fbUser.uid,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(userRef, merged, { merge: true });
      return merged;
    }
    return existing;
  }

  // Derive initial username fallback if not provided
  let initialUsername = initialExtra?.username;
  if (!initialUsername) {
    if (fbUser.email) {
      const cleanEmailPrefix = fbUser.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
      if (cleanEmailPrefix.length >= 3) {
        initialUsername = cleanEmailPrefix.slice(0, 20);
      }
    }
    if (!initialUsername) {
      initialUsername = `bite${fbUser.uid.slice(0, 6)}`;
    }
  }

  const now = new Date().toISOString();

  // Create new user profile in Firestore
  const newUser: User = {
    id: fbUser.uid,
    uid: fbUser.uid,
    username: initialUsername,
    name: initialExtra?.displayName || fbUser.displayName || 'Bite Explorer',
    displayName: initialExtra?.displayName || fbUser.displayName || 'Bite Explorer',
    email: fbUser.email || undefined,
    authProvider: initialExtra?.authProvider || providerType,
    isGuest: initialExtra?.isGuest ?? fbUser.isAnonymous,
    foodPreferences: initialExtra?.foodPreferences || [],
    explorationStyle: initialExtra?.explorationStyle,
    onboardingCompleted: initialExtra?.onboardingCompleted ?? false,
    createdAt: now,
    updatedAt: now,
    avatarUrl: fbUser.photoURL || EMPTY_USER.avatarUrl,
    level: 1,
    xp: 0,
    nextLevelXp: 500,
    activeTitle: 'Bite Scout Mới',
    availableTitles: ['Bite Scout Mới', 'Chiến Thần Phở Bò', 'Thợ Săn Quán Ngõ'],
    stats: {
      placesDiscovered: 0,
      passportsCompleted: 0,
      firstBitesCount: 0,
    },
    districtProgress: [
      {
        districtId: 'cau_giay',
        districtName: 'Cầu Giấy',
        completed: 0,
        total: 6,
      },
    ],
  };

  try {
    await setDoc(userRef, newUser);
    // Also reserve username index
    if (initialUsername) {
      const normalized = initialUsername.toLowerCase();
      await setDoc(doc(db, 'usernames', normalized), {
        uid: fbUser.uid,
        username: initialUsername,
        createdAt: now,
      }, { merge: true });
    }
  } catch (err) {
    console.warn('Could not write user profile directly to Firestore:', err);
  }

  return newUser;
}

// Persist complete user preferences and complete onboarding
export async function saveUserOnboardingPreferences(
  userId: string,
  foodPreferences: string[],
  explorationStyle?: string
): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const now = new Date().toISOString();

  const updateData: Partial<User> = {
    foodPreferences,
    explorationStyle,
    onboardingCompleted: true,
    updatedAt: now,
  };

  try {
    await updateDoc(userRef, updateData as any);
  } catch (err) {
    console.warn('Could not update onboarding preferences in Firestore:', err);
    // Fallback merge
    await setDoc(userRef, updateData, { merge: true });
  }
}

// Fetch all places from Firestore (or seed if empty)
export async function getPlacesFromDb(): Promise<Place[]> {
  try {
    const placesCol = collection(db, 'places');
    const snap = await getDocs(placesCol);

    if (snap.empty) {
      // Seed initial places to Firestore
      for (const p of INITIAL_PLACES) {
        await setDoc(doc(db, 'places', p.id), p);
      }
      return INITIAL_PLACES;
    }

    return snap.docs.map((d) => d.data() as Place);
  } catch (err) {
    console.warn('Firestore places read fallback:', err);
    return INITIAL_PLACES;
  }
}

// Fetch live Feed Bites (Do not inject synthetic checkins in production)
export async function getFeedBitesFromDb(allowSeedFallback = false): Promise<BiteCheckin[]> {
  try {
    const checkinsCol = collection(db, 'checkins');
    const q = query(checkinsCol, orderBy('createdAt', 'desc'), limit(25));
    const snap = await getDocs(q);

    if (snap.empty) {
      if (allowSeedFallback) {
        return INITIAL_FEED_BITES;
      }
      return [];
    }

    return snap.docs.map((d) => d.data() as BiteCheckin);
  } catch (err) {
    console.warn('Firestore feed read fallback:', err);
    return allowSeedFallback ? INITIAL_FEED_BITES : [];
  }
}

// Get user Passport from DB (Defaults to honest empty passport if uninitialized)
export async function getPassportFromDb(userId: string, districtId = 'cau_giay'): Promise<DistrictPassport> {
  try {
    const passportRef = doc(db, 'passports', `${userId}_${districtId}`);
    const snap = await getDoc(passportRef);

    if (snap.exists()) {
      return snap.data() as DistrictPassport;
    }

    const defaultPassport = createDefaultPassport(districtId);
    await setDoc(passportRef, defaultPassport);
    return defaultPassport;
  } catch (err) {
    console.warn('Firestore get passport fallback:', err);
    return createDefaultPassport(districtId);
  }
}

// Save a verified Bite Checkin to Firestore
export async function saveCheckinToDb(checkin: BiteCheckin): Promise<void> {
  try {
    const checkinRef = doc(db, 'checkins', checkin.id);
    await setDoc(checkinRef, checkin);
  } catch (err) {
    console.warn('Firestore save checkin fallback:', err);
  }
}

// Save or update a Place (including Community Spot) to Firestore with geohash
export async function savePlaceToDb(place: Place): Promise<void> {
  try {
    const hash = geohashForLocation([place.latitude, place.longitude]);
    const placeWithGeo: Place = {
      ...place,
      geohash: hash,
      location: {
        lat: place.latitude,
        lng: place.longitude,
      },
    };
    const placeRef = doc(db, 'places', place.id);
    await setDoc(placeRef, placeWithGeo);
  } catch (err) {
    console.warn('Firestore save place fallback:', err);
  }
}

/**
 * Geo-query Firestore places using geohashQueryBounds to avoid full collection scans
 */
export async function getNearbyPlacesByGeohash(
  centerLat: number,
  centerLng: number,
  radiusInMeters: number = 1500
): Promise<Place[]> {
  try {
    const center: [number, number] = [centerLat, centerLng];
    const bounds = geohashQueryBounds(center, radiusInMeters);
    const placesCol = collection(db, 'places');
    const promises = [];

    for (const b of bounds) {
      const q = query(
        placesCol,
        orderBy('geohash'),
        startAt(b[0]),
        endAt(b[1])
      );
      promises.push(getDocs(q));
    }

    const snapshots = await Promise.all(promises);
    const matchingDocs: Place[] = [];
    const seenIds = new Set<string>();

    for (const snap of snapshots) {
      for (const docSnap of snap.docs) {
        const place = docSnap.data() as Place;
        if (!seenIds.has(place.id)) {
          seenIds.add(place.id);
          // Filter false positives using accurate distance
          const distanceInKm = distanceBetween([place.latitude, place.longitude], center);
          const distanceInM = distanceInKm * 1000;
          if (distanceInM <= radiusInMeters) {
            matchingDocs.push(place);
          }
        }
      }
    }

    return matchingDocs.length > 0 ? matchingDocs : INITIAL_PLACES;
  } catch (err) {
    console.warn('Firestore geohash query fallback:', err);
    return INITIAL_PLACES;
  }
}

// Save Passport progress to Firestore
export async function savePassportToDb(userId: string, passport: DistrictPassport): Promise<void> {
  try {
    const passportRef = doc(db, 'passports', `${userId}_${passport.id}`);
    await setDoc(passportRef, passport);
  } catch (err) {
    console.warn('Firestore save passport fallback:', err);
  }
}

// Save Knowledge Quest progress to Firestore (progression fields like XP/level are server-authoritative)
export async function saveKnowledgeProgressToDb(userId: string, user: User): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      knowledgeProgress: user.knowledgeProgress,
      availableTitles: user.availableTitles,
      activeTitle: user.activeTitle,
    });
  } catch (err) {
    console.warn('Firestore save knowledge progress fallback:', err);
  }
}

// Atomic First Bite verification using Firestore Transaction
export async function verifyCommunitySpotTransaction(spotId: string, verifierId: string): Promise<boolean> {
  const spotRef = doc(db, 'places', spotId);

  return await runTransaction(db, async (transaction) => {
    const spotDoc = await transaction.get(spotRef);
    if (!spotDoc.exists()) {
      throw new Error('Quán ngõ không tồn tại!');
    }

    const spotData = spotDoc.data() as Place;
    if (spotData.communityStatus === 'verified') {
      return false; // Already verified
    }

    // Mark as verified
    transaction.update(spotRef, {
      communityStatus: 'verified',
      communityVerified: true,
    });

    // Award First Bite & XP to the original discoverer
    if (spotData.firstDiscovererId) {
      const discovererRef = doc(db, 'users', spotData.firstDiscovererId);
      const discovererDoc = await transaction.get(discovererRef);
      if (discovererDoc.exists()) {
        const u = discovererDoc.data() as User;
        transaction.update(discovererRef, {
          'stats.firstBitesCount': (u.stats.firstBitesCount || 0) + 1,
          xp: (u.xp || 0) + 150,
        });
      }
    }

    return true;
  });
}
