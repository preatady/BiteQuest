import express, { Request, Response } from 'express';
import path from 'path';
import crypto from 'crypto';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';
import { getDistance } from 'geolib';
import {
  INITIAL_USER,
  EMPTY_USER,
  INITIAL_PLACES,
  INITIAL_FEED_BITES,
  INITIAL_PASSPORT_CAU_GIAY,
  createDefaultPassport,
  EMPTY_PASSPORT_CAU_GIAY,
  INITIAL_ACHIEVEMENTS,
} from './src/data/seedData';
import {
  BiteCheckin,
  Place,
  User,
  DistrictPassport,
  AchievementBadge,
  FoodCategory,
  QuickRatingTaste,
  QuickRatingPrice,
} from './src/types';
import { mediaStorageProvider } from './src/services/storage/cloudinaryProvider';
import { normalizeCategory, doesCategoryMatch } from './src/services/maps/categoryNormalizer';
import { UnifiedPlace } from './src/services/maps/types';
import { placeService } from './src/services/maps/placeProvider';
import { venueRegistry } from './src/services/maps/venueRegistryService';
import { CanonicalVenue, DiscoveryAnchor } from './src/services/maps/venueRegistryTypes';
import { authenticateFirebaseUser, requireAuth, getFirebaseAdmin, getFirebaseFirestore } from './src/server/authMiddleware';
import { validateUsername, validateDisplayName, validateOnboardingChoices } from './src/services/authValidation';
import { verifyCommunitySpotAtomic } from './src/server/firstBiteEngine';
import { completeKnowledgeQuestAtomic } from './src/server/knowledgeEngine';
import {
  createVerificationSession,
  consumeVerificationSessionAtomic,
  commitVerifiedCheckinAtomic,
  getAuthoritativeVerifiedBiteCount,
  getAuthoritativeVerifiedCheckins,
} from './src/server/verificationSessions';
import { logger } from './src/server/logger';

// In-memory state store: Use honest empty state by default to prevent demo leakage
const isExplicitDemo = process.env.BITEQUEST_DEMO_MODE === 'true';
let currentUser: User = isExplicitDemo ? { ...INITIAL_USER } : { ...EMPTY_USER };
let places: Place[] = [...INITIAL_PLACES];
let feedBites: BiteCheckin[] = isExplicitDemo ? [...INITIAL_FEED_BITES] : [];
let passport: DistrictPassport = isExplicitDemo
  ? JSON.parse(JSON.stringify(INITIAL_PASSPORT_CAU_GIAY))
  : createDefaultPassport('cau_giay');
let achievements: AchievementBadge[] = isExplicitDemo
  ? [...INITIAL_ACHIEVEMENTS]
  : INITIAL_ACHIEVEMENTS.map((a) => ({ ...a, isUnlocked: false, unlockedAt: undefined }));

// Authoritative in-memory username index (normalized username -> uid)
const authoritativeUsernames = new Map<string, string>();
if (isExplicitDemo) {
  authoritativeUsernames.set('tuananh', 'user_tuan_anh');
}

// Hydrate all authentic places into Venue Registry
for (const p of places) {
  venueRegistry.registerPlace(p);
}
venueRegistry.syncVerifiedBiteCounts(feedBites);

// --- Rate Limiting Guards ---
const ipRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const userRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, limitMap: Map<string, { count: number; resetAt: number }>, maxPerMin = 20): boolean {
  const now = Date.now();
  const entry = limitMap.get(key);
  if (!entry || now > entry.resetAt) {
    limitMap.set(key, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (entry.count >= maxPerMin) {
    return false;
  }
  entry.count++;
  return true;
}

// --- Zod Validation Schemas ---

const VerifyBiteRequestSchema = z.object({
  imageBase64: z.string().max(12 * 1024 * 1024, 'Kích thước ảnh vượt quá 12MB').optional(),
  latitude: z.number().min(-90).max(90).default(21.0185),
  longitude: z.number().min(-180).max(180).default(105.7952),
  accuracy: z.number().min(0).max(5000).default(15),
  selectedPlaceId: z.string().max(100).optional(),
  isGalleryUpload: z.boolean().optional().default(false),
});

const GeminiPerceptionOutputSchema = z.object({
  isFoodOrDrink: z.boolean().default(true),
  dishName: z.string().default('Món ăn ngon'),
  foodCategory: z.enum(['noodles', 'rice', 'coffee', 'dessert', 'street_food', 'burger_western', 'bbq_hotpot', 'drinks']).default('street_food'),
  categoryLabel: z.string().default('Ẩm thực đường phố'),
  visibleVenueText: z.string().optional().default(''),
  visiblePriceMin: z.number().optional().default(30000),
  visiblePriceMax: z.number().optional().default(60000),
  ambianceType: z.string().optional().default('Quán ăn'),
  confidence: z.number().min(0).max(1).default(0.85),
  tags: z.array(z.string()).optional().default([]),
});

const CheckinRequestSchema = z.object({
  verificationSessionId: z.string().max(100).optional(),
  placeId: z.string().max(100).optional(),
  providerPlaceId: z.string().max(100).optional(),
  placeName: z.string().max(150).optional(),
  district: z.string().max(50).optional().default('Cầu Giấy'),
  imageUrl: z.string().max(12 * 1024 * 1024).optional(),
  displayImageUrl: z.string().max(12 * 1024 * 1024).optional(),
  filterId: z.string().max(50).optional().default('original'),
  stickerId: z.string().max(50).optional(),
  isGalleryUpload: z.boolean().optional().default(false),
  caption: z.string().max(500).optional(),
  tasteRating: z.enum(['tasty', 'normal', 'bad']).optional().default('tasty'),
  priceRating: z.enum(['good_value', 'fair', 'expensive']).optional().default('good_value'),
  wouldReturn: z.boolean().optional().default(true),
  foodCategory: z.string().max(50).optional().default('street_food'),
  isNewSpot: z.boolean().optional().default(false),
  newSpotData: z.object({
    name: z.string().min(2, 'Tên quán tối thiểu 2 ký tự').max(100),
    categoryLabel: z.string().max(50).optional(),
    address: z.string().max(200).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    priceBand: z.string().max(50).optional(),
    priceMin: z.number().min(0).optional(),
    priceMax: z.number().min(0).optional(),
  }).optional(),
});

const ReactionRequestSchema = z.object({
  biteId: z.string().max(100),
  emoji: z.string().max(10),
});

const VerifyCommunitySpotSchema = z.object({
  spotId: z.string().max(100),
});

const CompleteKnowledgeQuestSchema = z.object({
  trackId: z.enum(['smart_biter', 'bite_guardian']),
  score: z.number().min(0).max(5),
  total: z.number().min(1).max(10).default(5),
  passed: z.boolean(),
});

// Helper: Normalize string to prevent duplicate community spots
function normalizeVenueName(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Lazy Gemini AI client
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Helper: Run async task with strict timeout
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallbackValue), timeoutMs);
  });
  return Promise.race([
    promise.then((res) => {
      clearTimeout(timer);
      return res;
    }),
    timeoutPromise,
  ]);
}

async function startServer() {
  // Wire Firestore database to Venue Registry and hydrate persisted venues
  try {
    const firestore = getFirebaseFirestore();
    if (firestore) {
      venueRegistry.setFirestoreDb(firestore);
      const hydratedCount = await venueRegistry.hydrateFromFirestore();
      if (hydratedCount > 0) {
        logger.info({ event: 'VENUE_REGISTRY_HYDRATED_FROM_FIRESTORE', count: hydratedCount });
      }
    }
  } catch (err: any) {
    logger.warn({ event: 'VENUE_REGISTRY_FIRESTORE_INIT_WARNING', error: err?.message });
  }

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Trust proxy for container ingress / Cloud Run reverse proxy
  app.set('trust proxy', 1);

  // 1. Helmet HTTP Security Headers (Optimized for AI Studio iframe & mobile preview)
  app.use(
    helmet({
      xFrameOptions: false,
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false,
    })
  );

  // 2. Request ID & Structured Pino Logging Middleware (Redacts credentials, tokens, and base64 payloads)
  app.use((req, res, next) => {
    const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    res.setHeader('X-Request-Id', requestId);
    (req as any).requestId = requestId;

    // Only log API endpoints or HTTP error responses to keep logs clean
    const isApiRoute = req.path.startsWith('/api/');
    if (isApiRoute) {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info({
          requestId,
          method: req.method,
          route: req.path,
          status: res.statusCode,
          latencyMs: duration,
          uidHash: (req as any).user?.uid
            ? crypto.createHash('sha256').update((req as any).user.uid).digest('hex').slice(0, 8)
            : undefined,
        });
      });
    }
    next();
  });

  // 3. Rate Limiters (Best-effort per-instance application-level abuse mitigation)
  const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 150,
    standardHeaders: true,
    legacyHeaders: false,
    validate: {
      trustProxy: false,
      xForwardedForHeader: false,
      forwardedHeader: false,
    },
    message: { error: 'TOO_MANY_REQUESTS', message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.' },
  });
  app.use('/api/', generalLimiter);

  // Maximum payload size 12MB with JSON parser
  app.use(express.json({ limit: '12mb' }));

  // Attach Firebase Auth middleware to all incoming requests
  app.use(authenticateFirebaseUser);

  // --- API Routes ---

  // Health check endpoint (Available and ready for container health/liveness probes)
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // 1. Diagnostics & configuration status
  app.get('/api/health', (req, res) => {
    const isDemoMode = process.env.BITEQUEST_DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production';
    const hasGeoapifyServerKey = Boolean(process.env.GEOAPIFY_SERVER_KEY || process.env.GEOAPIFY_API_KEY);
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      mode: isDemoMode ? 'demo' : 'production',
      providers: {
        gemini: Boolean(process.env.GEMINI_API_KEY),
        geoapify: hasGeoapifyServerKey,
        cloudinary: Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
      },
      provenance: {
        mapTiles: 'OpenFreeMap Vector Tiles (Positron)',
        placesEngine: hasGeoapifyServerKey
          ? 'Geoapify Places API (Live)'
          : isDemoMode
          ? 'Cầu Giấy Curated Benchmark Dataset (Demo Mode)'
          : 'Community Spots Only (No External Places Provider)',
        storage: Boolean(process.env.CLOUDINARY_CLOUD_NAME) ? 'Cloudinary Media Storage' : 'Local Ephemeral (Demo)',
      },
    });
  });

  // Auth: Check username availability & validate format server-authoritatively
  app.get('/api/auth/check-username', async (req, res) => {
    const username = (req.query.username as string) || '';
    const validation = validateUsername(username);
    if (!validation.valid) {
      return res.status(200).json({ available: false, error: validation.error });
    }

    const normalized = username.trim().toLowerCase();

    // Check Firestore Admin if initialized
    try {
      const firestore = getFirebaseFirestore();
      if (firestore && typeof firestore.collection === 'function') {
        const snap = await firestore.collection('usernames').doc(normalized).get();
        if (snap.exists) {
          const docData = snap.data();
          if (req.user?.uid && docData?.uid === req.user.uid) {
            return res.json({ available: true });
          }
          return res.json({
            available: false,
            error: 'ID người dùng này đã được sử dụng. Vui lòng chọn ID khác.',
          });
        }
      }
    } catch (err: any) {
      logger.warn({ event: 'FIRESTORE_CHECK_USERNAME_WARNING', error: err?.message });
    }

    // Check in-memory store
    if (authoritativeUsernames.has(normalized) && authoritativeUsernames.get(normalized) !== req.user?.uid) {
      return res.json({
        available: false,
        error: 'ID người dùng này đã được sử dụng. Vui lòng chọn ID khác.',
      });
    }

    return res.json({ available: true });
  });

  // Auth: Update or register user profile and preferences
  app.post('/api/auth/profile', requireAuth, async (req, res) => {
    const { username, displayName, foodPreferences, explorationStyle, onboardingCompleted, isGuest, authProvider } = req.body;
    const uid = req.user!.uid;

    if (username) {
      const validation = validateUsername(username);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      const normalized = username.trim().toLowerCase();

      // Check uniqueness in Firestore Admin
      try {
        const firestore = getFirebaseFirestore();
        if (firestore && typeof firestore.collection === 'function') {
          const snap = await firestore.collection('usernames').doc(normalized).get();
          if (snap.exists && snap.data()?.uid !== uid) {
            return res.status(400).json({ error: 'ID người dùng này đã được sử dụng. Vui lòng chọn ID khác.' });
          }

          const now = new Date().toISOString();
          const batch = firestore.batch();
          const userRef = firestore.collection('users').doc(uid);
          const usernameRef = firestore.collection('usernames').doc(normalized);

          batch.set(usernameRef, { uid, username, updatedAt: now }, { merge: true });
          batch.set(
            userRef,
            {
              id: uid,
              uid,
              username,
              name: displayName || req.user!.name,
              displayName: displayName || req.user!.name,
              authProvider: authProvider || (req.user!.isAnonymous ? 'anonymous' : 'password'),
              isGuest: isGuest ?? req.user!.isAnonymous,
              foodPreferences: foodPreferences || [],
              explorationStyle,
              onboardingCompleted: onboardingCompleted ?? true,
              updatedAt: now,
            },
            { merge: true }
          );

          await batch.commit();
        }
      } catch (err: any) {
        logger.warn({ event: 'FIRESTORE_UPDATE_PROFILE_WARNING', error: err?.message });
      }

      authoritativeUsernames.set(normalized, uid);
    }

    res.json({ success: true });
  });

  // 2. Initial state bootstrap
  app.get('/api/bootstrap', (req, res) => {
    res.json({
      user: currentUser,
      places,
      feedBites,
      passport,
      achievements,
    });
  });

  // 3. Nearby Places & 10km Discovery with Canonical Venue Registry
  app.get('/api/nearby-places', async (req, res) => {
    const lat = parseFloat(req.query.lat as string) || 21.0285;
    const lng = parseFloat(req.query.lng as string) || 105.7958;
    const radius = parseInt(req.query.radius as string, 10) || 2000;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 400);

    try {
      const anchorLat = req.query.anchorLat ? parseFloat(req.query.anchorLat as string) : undefined;
      const anchorLng = req.query.anchorLng ? parseFloat(req.query.anchorLng as string) : undefined;
      const isRealLocation = req.query.isRealLocation === 'true';
      const forceRefresh = req.query.forceRefresh === 'true';
      const category = req.query.category as string | undefined;

      const discoveryAnchor: DiscoveryAnchor =
        anchorLat !== undefined && anchorLng !== undefined
          ? { latitude: anchorLat, longitude: anchorLng, isRealUserLocation: isRealLocation }
          : { latitude: lat, longitude: lng, isRealUserLocation: isRealLocation };

      // Ensure verified bite counts are authoritatively synced from database / server store
      const authoritativeCheckins = await getAuthoritativeVerifiedCheckins();
      venueRegistry.syncVerifiedBiteCounts(authoritativeCheckins.length > 0 ? authoritativeCheckins : feedBites);

      const discoveryResult = await venueRegistry.discoverVenues({
        latitude: lat,
        longitude: lng,
        radiusMeters: radius,
        limit,
        category,
        discoveryAnchor,
        forceRefresh,
      });

      const unifiedPlaces = discoveryResult.venues.map((v) => venueRegistry.toUnifiedPlace(v, lat, lng));

      res.json({
        success: true,
        places: unifiedPlaces,
        canonicalVenues: discoveryResult.venues,
        provenance: discoveryResult.provenance,
      });
    } catch (err: any) {
      console.warn('Nearby places error:', err?.message || err);
      const isDemoMode = process.env.BITEQUEST_DEMO_MODE === 'true';

      const fallbackPlaces = places
        .map((p) => {
          const dist = getDistance({ latitude: lat, longitude: lng }, { latitude: p.latitude, longitude: p.longitude });
          return {
            id: p.id,
            canonicalVenueId: `vn_comm_${p.id}`,
            name: p.name,
            category: p.category,
            categoryLabel: p.categoryLabel,
            address: p.address,
            district: p.district,
            city: 'Hà Nội',
            latitude: p.latitude,
            longitude: p.longitude,
            distanceMeters: dist,
            isCommunitySpot: p.isCommunitySpot,
            communityStatus: p.communityStatus,
            communityVerified: p.communityVerified,
            firstDiscovererName: p.firstDiscovererName,
          };
        })
        .filter((p) => p.distanceMeters <= radius)
        .sort((a, b) => a.distanceMeters - b.distanceMeters);

      return res.status(200).json({
        success: true,
        places: fallbackPlaces,
        provenance: {
          source: 'VENUE_FALLBACK',
          provider: 'BiteQuest Curated & Community Directory',
          isDemoMode,
          externalApi: false,
          warning: err?.message || 'External places discovery fallback',
          totalCount: fallbackPlaces.length,
          communityCount: fallbackPlaces.filter((p) => p.isCommunitySpot).length,
          registryCount: places.length,
          providerFetchedCount: 0,
          finalVenueCount: fallbackPlaces.length,
          cacheHits: 0,
          cacheMisses: 1,
          discoveryAnchor: {
            latitude: 21.0285,
            longitude: 105.7958,
            isRealUserLocation: false,
            maxDiscoveryRadiusMeters: 10000,
          },
        },
      });
    }
  });

  // Bite AI Foundation API: Query canonical venues with filters
  app.get('/api/venues', async (req, res) => {
    try {
      const lat = parseFloat(req.query.lat as string) || 21.0285;
      const lng = parseFloat(req.query.lng as string) || 105.7958;
      const radius = parseInt(req.query.radius as string, 10) || 2000;
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
      const category = req.query.category as string | undefined;
      const minVerifiedBites = req.query.minVerifiedBites ? parseInt(req.query.minVerifiedBites as string, 10) : 0;

      const authoritativeCheckins = await getAuthoritativeVerifiedCheckins();
      venueRegistry.syncVerifiedBiteCounts(authoritativeCheckins.length > 0 ? authoritativeCheckins : feedBites);
      const venues = await venueRegistry.getVenuesInRadius({
        latitude: lat,
        longitude: lng,
        radiusMeters: radius,
        limit,
        category,
        minVerifiedBites,
      });

      res.json({
        success: true,
        venues,
        count: venues.length,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to query venues' });
    }
  });

  // 4. Multi-modal Verification Engine (Gemini Evidence Perception + Geolib Deterministic Distance)
  app.post('/api/verify-bite', async (req, res) => {
    const clientIp = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
    const userId = req.user?.uid || 'guest';

    // Application-level per-instance rate limiting (best-effort abuse mitigation)
    if (!checkRateLimit(clientIp, ipRateLimitMap, 20) || !checkRateLimit(userId, userRateLimitMap, 15)) {
      return res.status(429).json({ error: 'Quá nhiều yêu cầu xác minh. Vui lòng chờ 1 phút trước khi thử lại.' });
    }

    try {
      const parsedBody = VerifyBiteRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json({ error: 'Invalid verification request parameters', details: parsedBody.error.format() });
      }

      const { imageBase64, latitude, longitude, accuracy, selectedPlaceId, isGalleryUpload } = parsedBody.data;

      // Dynamic search radius based on GPS accuracy (clamped between 40m and 300m)
      const dynamicRadius = Math.min(300, Math.max(40, accuracy * 2.5));

      // AI Multimodal Evidence Perception (Gemini does NOT hold final verification authority)
      // FAIL-CLOSED INVARIANT: Absence of visual evidence != positive visual evidence.
      let geminiExecuted = false;
      let geminiConfirmedFood = false;
      let geminiExplicitNonFood = false;
      let visibleSignageText = '';

      let aiPerception: {
        isFoodOrDrink: boolean;
        dishName: string;
        foodCategory: FoodCategory;
        categoryLabel: string;
        visibleVenueText: string;
        visiblePriceMin: number;
        visiblePriceMax: number;
        ambianceType: string;
        confidence: number;
        tags: string[];
      } = {
        isFoodOrDrink: false, // Default is strictly false (fail-closed)
        dishName: 'Món ăn đặc sản Hà Nội',
        foodCategory: 'noodles',
        categoryLabel: 'Bún / Phở',
        visibleVenueText: '',
        visiblePriceMin: 35000,
        visiblePriceMax: 55000,
        ambianceType: 'Quán ăn',
        confidence: 0.50,
        tags: ['Món ngon', 'Hà Nội', 'Đậm vị'],
      };

      const ai = getGeminiClient();
      if (ai && imageBase64) {
        try {
          const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

          // Execute Gemini AI with 10s strict timeout
          const geminiCall = ai.models.generateContent({
            model: 'gemini-3.7-flash',
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: base64Data,
                  },
                },
                {
                  text: `Bạn là trợ lý AI phân tích thị giác ẩm thực của BiteQuest.
Nhiệm vụ: Trích xuất thông tin cấu trúc chính xác từ ảnh:
1. isFoodOrDrink: boolean (CHỈ ĐẶT true nếu ảnh thực sự chứa đồ ăn, thức uống, món ăn, bánh kẹo hoặc menu quán ăn. Nếu là ảnh phong cảnh, người, đồ vật không liên quan đến ẩm thực -> false).
2. dishName: Tên món ăn tiếng Việt ngắn gọn, chuẩn mực (ví dụ: "Bún Cá Chiên Giòn", "Phở Bò Tái Nạm", "Cà Phê Muối", "Bánh Mì Chảo").
3. foodCategory: chọn 1 trong ['noodles', 'rice', 'coffee', 'dessert', 'street_food', 'burger_western', 'bbq_hotpot', 'drinks'].
4. categoryLabel: tên tiếng Việt thân thiện tương ứng.
5. visibleVenueText: chữ đọc được trên biển hiệu/menu/hóa đơn (nếu không có để "").
6. visiblePriceMin, visiblePriceMax: khoảng giá ước tính (VND).
7. ambianceType: loại không gian (ví dụ: "Quán vỉa hè", "Quán trong ngõ", "Nhà hàng", "Quán cà phê").
8. confidence: độ tin cậy từ 0.0 đến 1.0.
9. tags: mảng 3-5 từ khóa mô tả món ăn.`,
                },
              ],
            },
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  isFoodOrDrink: { type: Type.BOOLEAN },
                  dishName: { type: Type.STRING },
                  foodCategory: { type: Type.STRING },
                  categoryLabel: { type: Type.STRING },
                  visibleVenueText: { type: Type.STRING },
                  visiblePriceMin: { type: Type.NUMBER },
                  visiblePriceMax: { type: Type.NUMBER },
                  ambianceType: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                  tags: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: ['isFoodOrDrink', 'dishName', 'foodCategory', 'confidence'],
              },
            },
          });

          const response = await withTimeout(geminiCall, 10000, null);

          if (response && response.text) {
            const rawJson = JSON.parse(response.text.trim());
            const validatedAi = GeminiPerceptionOutputSchema.safeParse(rawJson);
            if (validatedAi.success) {
              aiPerception = { ...aiPerception, ...validatedAi.data } as typeof aiPerception;
              geminiExecuted = true;
              if (validatedAi.data.isFoodOrDrink === true && (validatedAi.data.confidence || 0) >= 0.5) {
                geminiConfirmedFood = true;
              } else if (validatedAi.data.isFoodOrDrink === false) {
                geminiExplicitNonFood = true;
              }
              if (validatedAi.data.visibleVenueText) {
                visibleSignageText = validatedAi.data.visibleVenueText.trim();
              }
            }
          }
        } catch (geminiError) {
          console.warn('Gemini perception call timed out or failed, using fail-closed visual fallback:', geminiError);
        }
      }

      // Compute distances using geolib & evaluate candidate matches
      const candidateList = places.map((place) => {
        const dist = getDistance(
          { latitude, longitude },
          { latitude: place.latitude, longitude: place.longitude }
        );

        let matchScore = 0;

        // Proximity scoring
        if (dist <= 30) matchScore += 65;
        else if (dist <= 75) matchScore += 50;
        else if (dist <= 150) matchScore += 35;
        else if (dist <= dynamicRadius) matchScore += 20;
        else matchScore += 5;

        // Food category match
        if (aiPerception.foodCategory === place.category) {
          matchScore += 20;
        }

        // Venue name text match (if OCR detected sign) - only applies if venue is within dynamic search radius
        let signageMatched = false;
        if (visibleSignageText && dist <= dynamicRadius) {
          const normVisible = normalizeVenueName(visibleSignageText);
          const normPlace = normalizeVenueName(place.name);
          if (normVisible.length >= 3 && (normPlace.includes(normVisible) || normVisible.includes(normPlace))) {
            matchScore += 40;
            signageMatched = true;
          }
        }

        // User explicit selection bonus
        if (selectedPlaceId && place.id === selectedPlaceId) {
          matchScore += 50;
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

      // Spatial Gate (Trust Gate D & E):
      // Must be within dynamic search radius AND GPS accuracy must be reasonable (<= 150m), non-zero coords
      const isConfidentMatch = Boolean(
        topMatch &&
        topMatch.distanceMeters <= Math.max(dynamicRadius, 150) &&
        accuracy <= 150 &&
        latitude !== 0 &&
        longitude !== 0
      );
      const matchedPlace = isConfidentMatch ? topMatch.place : places[0];
      const distanceMeters = isConfidentMatch ? topMatch.distanceMeters : 25;
      const hasSignageEvidence = Boolean(topMatch?.signageMatched);

      // Visual Evidence Gate (Trust Gate F - Fail-Closed Evaluation):
      // Visual evidence is valid IF:
      // 1. NOT explicit non-food (Gemini returned isFoodOrDrink === false)
      // 2. AND (Gemini confirmed food/drink OR verified signage/OCR venue match)
      const hasPositiveVisualEvidence =
        !geminiExplicitNonFood &&
        (geminiConfirmedFood || hasSignageEvidence);

      // Determine Server Authoritative Verification Decision
      let verificationDecision: 'VERIFIED_ELIGIBLE' | 'UNVERIFIED_GALLERY' | 'EVIDENCE_UNAVAILABLE' | 'EVIDENCE_INSUFFICIENT' | 'REJECTED';
      let statusMessage: string;
      let isLiveVerified = false;

      if (isGalleryUpload) {
        verificationDecision = 'UNVERIFIED_GALLERY';
        isLiveVerified = false;
        statusMessage = '📸 Ảnh từ thư viện (Gallery Bite - Chưa xác minh trực tiếp)';
      } else if (!isConfidentMatch) {
        verificationDecision = 'REJECTED';
        isLiveVerified = false;
        statusMessage = '👀 Quán mới à? (Vị trí chưa khớp quán sẵn có)';
      } else if (geminiExplicitNonFood) {
        verificationDecision = 'REJECTED';
        isLiveVerified = false;
        statusMessage = '🚫 Không phát hiện món ăn/đồ uống trong ảnh.';
      } else if (!hasPositiveVisualEvidence) {
        // FAIL-CLOSED: Absence of visual evidence (Gemini timeout / no food / no signage) MUST NOT verify
        verificationDecision = 'EVIDENCE_UNAVAILABLE';
        isLiveVerified = false;
        statusMessage = 'Chưa thể xác minh bằng chứng hình ảnh.';
      } else {
        // All Gates Pass: Live camera + spatial proximity + positive visual evidence
        verificationDecision = 'VERIFIED_ELIGIBLE';
        isLiveVerified = true;
        statusMessage = '✨ Đã xác minh trực tiếp tại quán!';
      }

      let verificationSessionId: string | undefined = undefined;

      if (isLiveVerified && verificationDecision === 'VERIFIED_ELIGIBLE') {
        const authenticatedUid = req.user?.uid || 'user_guest';
        verificationSessionId = await createVerificationSession({
          userId: authenticatedUid,
          placeId: matchedPlace.id,
          providerPlaceId: (matchedPlace as any).providerPlaceId,
          decision: 'VERIFIED_ELIGIBLE',
          isLiveVerified: true,
          isGalleryUpload: false,
        });
      }

      // Weak GPS confidence penalty: if GPS accuracy is poor (>80m), decrease confidence score
      const gpsPenalty = accuracy > 80 ? Math.min(0.35, ((accuracy - 80) / 200) * 0.35) : 0;
      const baseConfidence = isConfidentMatch ? (topMatch.matchScore / 100) * 0.9 + 0.1 : 0.60;
      const computedConfidence = Math.max(0.35, Math.min(0.98, baseConfidence - gpsPenalty));

      const responsePayload = {
        verified: isLiveVerified,
        verificationDecision,
        verificationSessionId,
        isFoodOrDrink: geminiConfirmedFood,
        confidence: isGalleryUpload
          ? Math.min(computedConfidence, 0.70)
          : !isLiveVerified
          ? Math.min(computedConfidence, 0.50)
          : computedConfidence,
        matchedPlace,
        distanceMeters,
        formattedDistance: distanceMeters < 1000 ? `Cách bạn khoảng ${distanceMeters}m` : `Cách bạn khoảng ${(distanceMeters / 1000).toFixed(1)}km`,
        statusMessage,
        aiAnalysis: {
          ...aiPerception,
          isFoodOrDrink: geminiConfirmedFood,
        },
        candidates: candidateList.slice(0, 3).map((r) => ({
          ...r.place,
          distanceMeters: r.distanceMeters,
        })),
        isNewCommunitySpot: !isConfidentMatch,
        isGalleryUpload: Boolean(isGalleryUpload),
      };

      res.json(responsePayload);
    } catch (err: any) {
      console.error('Verification error:', err);
      res.status(500).json({ error: err.message || 'Verification failed' });
    }
  });

  // 5. Create Verified Bite (Check-in) with Server-Authoritative Verification Session
  app.post('/api/checkin', async (req, res) => {
    const clientIp = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
    // Strictly derive authenticated user identity from req.user (NOT client body)
    const authenticatedUser = req.user || {
      uid: currentUser.id,
      name: currentUser.name,
      avatarUrl: currentUser.avatarUrl,
    };

    if (!checkRateLimit(clientIp, ipRateLimitMap, 15) || !checkRateLimit(authenticatedUser.uid, userRateLimitMap, 10)) {
      return res.status(429).json({ error: 'Quá nhiều yêu cầu check-in. Vui lòng thử lại sau.' });
    }

    try {
      const parsed = CheckinRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid checkin payload', details: parsed.error.format() });
      }

      const {
        verificationSessionId,
        placeId,
        providerPlaceId,
        placeName,
        district,
        imageUrl,
        displayImageUrl,
        filterId,
        stickerId,
        isGalleryUpload,
        caption,
        tasteRating,
        priceRating,
        wouldReturn,
        foodCategory,
        isNewSpot,
        newSpotData,
      } = parsed.data;

      // Handle media storage (Cloudinary in Production vs client preview in Demo)
      let finalImageUrl = displayImageUrl || imageUrl || 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800';
      let cloudinaryPublicId: string | undefined;

      const isCloudinaryConfigured = Boolean(
        process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
      );

      if (finalImageUrl && finalImageUrl.startsWith('data:image')) {
        if (isCloudinaryConfigured) {
          const uploadResult = await mediaStorageProvider.uploadImage({
            imageBase64: finalImageUrl,
            userId: authenticatedUser.uid,
            checkinId: `checkin_${Date.now()}`,
            folder: 'bitequest/bites',
          });
          finalImageUrl = uploadResult.secureUrl;
          cloudinaryPublicId = uploadResult.publicId;
        } else {
          const isDemoMode = process.env.BITEQUEST_DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production';
          if (isDemoMode) {
            // Keep preview URL for demo session without breaking flow
          } else {
            // In strict production mode without media storage, do not persist 5MB data URLs
            finalImageUrl = 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800';
          }
        }
      }

      let targetPlace = places.find((p) => p.id === placeId);

      // Handle Community Spot creation with conservative duplicate prevention
      if (isNewSpot && newSpotData && newSpotData.name) {
        const normNewName = normalizeVenueName(newSpotData.name);
        const newLat = newSpotData.latitude || 21.0185;
        const newLng = newSpotData.longitude || 105.7952;

        // Conservative duplicate check: exact normalized name match AND strict distance <= 25 meters
        const existingNearby = places.find((p) => {
          const nameMatch = normalizeVenueName(p.name) === normNewName;
          const dist = getDistance(
            { latitude: newLat, longitude: newLng },
            { latitude: p.latitude, longitude: p.longitude }
          );
          return nameMatch && dist <= 25;
        });

        if (existingNearby) {
          targetPlace = existingNearby;
        } else {
          targetPlace = {
            id: `community_${Date.now()}`,
            name: newSpotData.name,
            category: (foodCategory as FoodCategory) || 'street_food',
            categoryLabel: newSpotData.categoryLabel || 'Quán ngõ',
            address: newSpotData.address || `${district || 'Cầu Giấy'}, Hà Nội`,
            district: district || 'Cầu Giấy',
            latitude: newLat,
            longitude: newLng,
            priceBand: newSpotData.priceBand || '35k–60k',
            priceMin: newSpotData.priceMin || 35000,
            priceMax: newSpotData.priceMax || 60000,
            rating: 5.0,
            reviewCount: 1,
            imageUrl: finalImageUrl,
            isOpen: true,
            openingHoursText: '07:00 – 22:00',
            isCommunitySpot: true,
            communityStatus: 'pending',
            communityVerified: false,
            firstDiscovererId: authenticatedUser.uid,
            firstDiscovererName: authenticatedUser.name,
          };
          places.unshift(targetPlace);
          venueRegistry.registerCommunitySpot(targetPlace);
        }
      }

      // --- SERVER-AUTHORITATIVE PROOF-OF-BITE VERIFICATION ---
      // isVerified MUST ONLY be granted if an atomic server verification session exists,
      // is unconsumed, matches the venue and user, and is not expired or a gallery upload.
      // Both session consumption and checkin document creation are committed inside the SAME db.runTransaction().
      let isVerified = false;
      let verifiedAt: string | undefined = undefined;
      const checkinId = `bite_${Date.now()}`;

      const candidateBite: BiteCheckin = {
        id: checkinId,
        userId: authenticatedUser.uid,
        userName: authenticatedUser.name,
        userAvatar: authenticatedUser.avatarUrl || currentUser.avatarUrl,
        placeId: targetPlace ? targetPlace.id : placeId || 'place_bun_ca_co_lan',
        providerPlaceId: targetPlace?.providerPlaceId || providerPlaceId,
        placeName: targetPlace ? targetPlace.name : placeName || 'Bún Cá Cô Lan',
        placeAddress: targetPlace ? targetPlace.address : 'Hà Nội',
        district: targetPlace ? targetPlace.district : district || 'Cầu Giấy',
        foodCategory: (foodCategory as FoodCategory) || 'noodles',
        imageUrl: finalImageUrl,
        displayImageUrl: finalImageUrl,
        filterId: filterId || 'original',
        stickerId: stickerId || undefined,
        isGalleryUpload: Boolean(isGalleryUpload),
        cloudinaryPublicId,
        caption: caption ? caption.trim() : undefined,
        createdAt: 'Vừa xong',
        tasteRating: tasteRating ? (tasteRating as QuickRatingTaste) : undefined,
        priceRating: priceRating ? (priceRating as QuickRatingPrice) : undefined,
        wouldReturn: typeof wouldReturn === 'boolean' ? wouldReturn : undefined,
        isVerified: false,
        verifiedAt: undefined,
        isFirstBite: false, // First bite is awarded upon second user verification
        reactions: [
          { emoji: '🤤', count: 1, userReacted: false },
          { emoji: '🔥', count: 1, userReacted: true },
          { emoji: '💯', count: 0, userReacted: false },
        ],
        verificationMetadata: {
          distanceMeters: isGalleryUpload ? 0 : 18,
          confidence: isGalleryUpload ? 0.65 : 0.50,
          aiEvidence: isGalleryUpload
            ? 'Ảnh tải từ thư viện (Gallery Bite)'
            : 'Check-in chưa qua xác minh camera live hợp lệ',
        },
      };

      const effectivePlaceId = targetPlace ? targetPlace.id : (placeId || '');
      const effectiveProviderId = targetPlace?.providerPlaceId || providerPlaceId;

      // Check prior verified checkins for this venue on BiteQuest
      const priorVerifiedBitesCount = feedBites.filter(
        (b) =>
          b.isVerified &&
          (b.placeId === effectivePlaceId ||
            (effectiveProviderId && b.providerPlaceId === effectiveProviderId))
      ).length;

      if (verificationSessionId) {
        const atomicCommit = await commitVerifiedCheckinAtomic({
          sessionId: verificationSessionId,
          uid: authenticatedUser.uid,
          placeId: effectivePlaceId,
          providerPlaceId: effectiveProviderId,
          isGalleryUpload: Boolean(isGalleryUpload),
          checkinData: candidateBite,
        });

        if (atomicCommit.valid && atomicCommit.checkin) {
          isVerified = true;
          verifiedAt = atomicCommit.checkin.verifiedAt;
          candidateBite.isVerified = true;
          candidateBite.verifiedAt = verifiedAt;
          candidateBite.verificationMetadata = {
            distanceMeters: 18,
            confidence: 0.95,
            aiEvidence: 'Xác minh camera live bởi BiteQuest Verification Engine',
          };
        } else {
          logger.warn({
            event: 'CHECKIN_VERIFICATION_SESSION_REJECTED',
            reason: atomicCommit.reason,
            sessionId: verificationSessionId,
            uid: authenticatedUser.uid,
            placeId: effectivePlaceId,
          });
        }
      }

      // Authoritative First Bite: true if verified and this venue had 0 prior verified bites
      const isFirstBite = Boolean(isVerified && priorVerifiedBitesCount === 0);
      if (isFirstBite) {
        candidateBite.isFirstBite = true;
        currentUser.stats.firstBitesCount += 1;
      }

      // Authoritative Community Spot Verification: independent second user verifying a pending community spot
      let isCommunityVerification = false;
      let isFirstVerifier = false;
      if (
        isVerified &&
        targetPlace?.isCommunitySpot &&
        (!targetPlace.communityVerified || targetPlace.communityStatus === 'pending')
      ) {
        if (targetPlace.firstDiscovererId && targetPlace.firstDiscovererId !== authenticatedUser.uid) {
          const commResult = await verifyCommunitySpotAtomic(
            places,
            targetPlace.id,
            authenticatedUser.uid,
            authenticatedUser.name
          );
          if (commResult.success) {
            isCommunityVerification = true;
            isFirstVerifier = true;
          }
        }
      }

      feedBites.unshift(candidateBite);
      const newBite = candidateBite;

      // Sync venue registry counts with authoritative feed
      venueRegistry.syncVerifiedBiteCounts(feedBites);
      const updatedVenueVerifiedBites = isVerified ? priorVerifiedBitesCount + 1 : priorVerifiedBitesCount;

      // Authoritative progression rule:
      // Gallery, unverified, or failed verification yields TOTAL_AUTHORITATIVE_XP = 0
      // and cannot advance quests, stats, badges, or levels.
      let totalEarnedXp = 0;
      let unlockedChallenge: string | null = null;

      if (isVerified) {
        const baseCheckinXp = isNewSpot ? 80 : 60;
        totalEarnedXp = baseCheckinXp;
        currentUser.stats.placesDiscovered += 1;

        // Passport progression logic for verified bites only
        const checkinCanonicalCat = normalizeCategory(
          targetPlace || { name: placeName, category: foodCategory }
        );
        passport.challenges.forEach((ch) => {
          if (!ch.isCompleted) {
            if (ch.category && doesCategoryMatch(checkinCanonicalCat, ch.category)) {
              ch.isCompleted = true;
              ch.completedAt = 'Vừa hoàn thành';
              totalEarnedXp += ch.rewardXp;
              passport.xp = Math.min(passport.maxXp, passport.xp + ch.rewardXp);
              unlockedChallenge = ch.title;
            } else if (ch.type === 'alley' && (targetPlace?.address.toLowerCase().includes('ngõ') || targetPlace?.address.toLowerCase().includes('hẻm'))) {
              ch.isCompleted = true;
              ch.completedAt = 'Vừa hoàn thành';
              totalEarnedXp += ch.rewardXp;
              passport.xp = Math.min(passport.maxXp, passport.xp + ch.rewardXp);
              unlockedChallenge = ch.title;
            }
          }
        });

        currentUser.xp += totalEarnedXp;

        // Authoritative Level Up Calculation (Handles multi-level jumps gracefully)
        while (currentUser.xp >= currentUser.nextLevelXp) {
          currentUser.level += 1;
          currentUser.xp = currentUser.xp - currentUser.nextLevelXp;
          currentUser.nextLevelXp += 200;
        }

        // Sync updated user progression to Firestore Admin if authenticated
        if (req.user?.uid) {
          try {
            const firestore = getFirebaseFirestore();
            if (firestore && typeof firestore.collection === 'function') {
              await firestore.collection('users').doc(req.user.uid).set(
                {
                  xp: currentUser.xp,
                  level: currentUser.level,
                  nextLevelXp: currentUser.nextLevelXp,
                  stats: currentUser.stats,
                  updatedAt: new Date().toISOString(),
                },
                { merge: true }
              );
            }
          } catch (err: any) {
            logger.warn({ event: 'FIRESTORE_SYNC_USER_XP_WARNING', error: err?.message });
          }
        }
      }

      const completedCount = passport.challenges.filter((c) => c.isCompleted).length;
      const totalCount = passport.challenges.length;
      const isNewlyCompletedJourney = totalCount > 0 && completedCount === totalCount;

      res.json({
        success: true,
        bite: newBite,
        user: currentUser,
        passport,
        earnedXp: totalEarnedXp,
        unlockedChallenge,
        isFirstBite,
        isCommunityVerification,
        isFirstVerifier,
        verifiedBiteCount: updatedVenueVerifiedBites,
        journeyProgress: {
          districtName: passport.districtName || targetPlace?.district || 'Cầu Giấy',
          completedCount,
          totalCount,
          milestoneCompletedTitle: unlockedChallenge,
          journeyChanged: Boolean(unlockedChallenge),
          isNewlyCompletedJourney,
          challenges: passport.challenges,
        },
      });
    } catch (err: any) {
      console.error('Checkin error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 6. Toggle Emoji Reaction
  app.post('/api/reactions', (req, res) => {
    const parsed = ReactionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid reaction request' });
    }

    const { biteId, emoji } = parsed.data;
    const bite = feedBites.find((b) => b.id === biteId);
    if (!bite) {
      return res.status(404).json({ error: 'Bite not found' });
    }

    let existingReaction = bite.reactions.find((r) => r.emoji === emoji);
    if (existingReaction) {
      if (existingReaction.userReacted) {
        existingReaction.userReacted = false;
        existingReaction.count = Math.max(0, existingReaction.count - 1);
      } else {
        existingReaction.userReacted = true;
        existingReaction.count += 1;
      }
    } else {
      bite.reactions.push({
        emoji,
        count: 1,
        userReacted: true,
      });
    }

    res.json({ success: true, reactions: bite.reactions });
  });

  // 7. Distance & Travel info (Honest calculation without fake traffic claims)
  app.get('/api/best-time-to-go/:placeId', (req, res) => {
    const { placeId } = req.params;
    const place = places.find((p) => p.id === placeId);
    if (!place) {
      return res.status(404).json({ error: 'Place not found' });
    }

    // Honest physical distance calculation
    const distanceM = getDistance(
      { latitude: 21.0285, longitude: 105.7958 },
      { latitude: place.latitude, longitude: place.longitude }
    );
    const formattedDistance = distanceM < 1000 ? `Cách bạn khoảng ${distanceM}m` : `Cách bạn khoảng ${(distanceM / 1000).toFixed(1)}km`;

    res.json({
      placeId,
      hasLiveTraffic: false,
      distanceMeters: distanceM,
      formattedDistance,
      suggestionMessage: `${formattedDistance} (Đang mở cửa)`,
    });
  });

  // 8. Atomic Community Spot Verification (Rule: Creator cannot self-verify, 2nd user triggers First Bite)
  app.post('/api/verify-community-spot', async (req, res) => {
    const parsed = VerifyCommunitySpotSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid spotId' });
    }

    const { spotId } = parsed.data;
    const verifierUserId = req.user?.uid || 'user_verifier_2';
    const verifierUserName = req.user?.name || 'Food Explorer';

    const verificationResult = await verifyCommunitySpotAtomic(places, spotId, verifierUserId, verifierUserName);

    if (!verificationResult.success) {
      if (verificationResult.code === 'SELF_VERIFY_FORBIDDEN') {
        return res.status(403).json({
          error: verificationResult.message,
          code: verificationResult.code,
        });
      }
      if (verificationResult.code === 'ALREADY_VERIFIED') {
        return res.status(400).json({
          error: verificationResult.message,
          code: verificationResult.code,
        });
      }
      if (verificationResult.code === 'CONCURRENT_CONFLICT') {
        return res.status(409).json({
          error: verificationResult.message,
          code: verificationResult.code,
        });
      }
      return res.status(404).json({
        error: verificationResult.message,
        code: verificationResult.code,
      });
    }

    // Award First Bite to creator and verifier XP
    const awardedVerifierXp = verificationResult.awardedXpToVerifier || 60;
    currentUser.stats.firstBitesCount += 1;
    currentUser.xp += awardedVerifierXp;

    while (currentUser.xp >= currentUser.nextLevelXp) {
      currentUser.level += 1;
      currentUser.xp = currentUser.xp - currentUser.nextLevelXp;
      currentUser.nextLevelXp += 200;
    }

    // Sync updated user progression to Firestore Admin if authenticated
    if (req.user?.uid) {
      try {
        const firestore = getFirebaseFirestore();
        if (firestore && typeof firestore.collection === 'function') {
          await firestore.collection('users').doc(req.user.uid).set(
            {
              xp: currentUser.xp,
              level: currentUser.level,
              nextLevelXp: currentUser.nextLevelXp,
              stats: currentUser.stats,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        }
      } catch (err: any) {
        logger.warn({ event: 'FIRESTORE_SYNC_USER_XP_WARNING', error: err?.message });
      }
    }

    res.json({
      success: true,
      spot: verificationResult.spot,
      user: currentUser,
      message: verificationResult.message,
      firstDiscovererId: verificationResult.firstDiscovererId,
      awardedXp: awardedVerifierXp,
    });
  });

  // 8b. Create Community Spot (Draft / Pending status - No client XP choice)
  app.post('/api/community-spots', async (req, res) => {
    try {
      const { name, category, categoryLabel, address, district, latitude, longitude, priceBand, priceMin, priceMax, imageUrl } = req.body;
      const uid = req.user?.uid || currentUser.id;
      const userName = req.user?.name || currentUser.name;

      if (!name || name.trim().length < 2) {
        return res.status(400).json({ error: 'Tên quán tối thiểu 2 ký tự' });
      }

      const normNewName = normalizeVenueName(name);
      const newLat = latitude || 21.0185;
      const newLng = longitude || 105.7952;

      // Conservative duplicate check
      const existingNearby = places.find((p) => {
        const nameMatch = normalizeVenueName(p.name) === normNewName;
        const dist = getDistance(
          { latitude: newLat, longitude: newLng },
          { latitude: p.latitude, longitude: p.longitude }
        );
        return nameMatch && dist <= 25;
      });

      if (existingNearby) {
        return res.json({
          success: true,
          spot: existingNearby,
          user: currentUser,
          isDuplicate: true,
        });
      }

      const newSpot: Place = {
        id: `community_${Date.now()}`,
        name: name.trim(),
        category: (category as FoodCategory) || 'street_food',
        categoryLabel: categoryLabel || 'Quán ngõ',
        address: address || `${district || 'Cầu Giấy'}, Hà Nội`,
        district: district || 'Cầu Giấy',
        latitude: newLat,
        longitude: newLng,
        priceBand: priceBand || '35k–60k',
        priceMin: priceMin || 35000,
        priceMax: priceMax || 60000,
        rating: 5.0,
        reviewCount: 1,
        imageUrl: imageUrl || 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800',
        isOpen: true,
        openingHoursText: '07:00 – 22:00',
        isCommunitySpot: true,
        communityStatus: 'pending',
        communityVerified: false,
        firstDiscovererId: uid,
        firstDiscovererName: userName,
        createdAt: new Date().toISOString(),
      };

      places.unshift(newSpot);
      venueRegistry.registerCommunitySpot(newSpot);

      res.json({
        success: true,
        spot: newSpot,
        user: currentUser,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Lỗi tạo quán cộng đồng' });
    }
  });

  // 9. Update Active Title (Server-authoritative check against unlocked availableTitles)
  app.post('/api/user/title', (req, res) => {
    const { title } = req.body;
    if (!title || !currentUser.availableTitles.includes(title)) {
      return res.status(400).json({ error: 'TITLE_LOCKED_OR_UNAVAILABLE', message: 'Danh hiệu chưa được mở khóa hợp lệ.' });
    }
    currentUser.activeTitle = title;
    res.json({ success: true, user: currentUser });
  });

  // 10. Complete Knowledge Quest Track (Atomic Idempotent XP & Badge rewards)
  app.post('/api/knowledge-quests/complete', async (req, res) => {
    const parsed = CompleteKnowledgeQuestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.format() });
    }

    const { trackId, score, total, passed } = parsed.data;

    try {
      const result = await completeKnowledgeQuestAtomic({
        user: currentUser,
        trackId,
        score,
        total,
        passed,
        achievements,
        uid: req.user?.uid,
      });

      res.json({
        success: result.success,
        user: result.user,
        achievements,
        earnedXp: result.awardedXp,
        alreadyClaimed: result.alreadyClaimed,
        newlyUnlockedBadge: result.newlyUnlockedBadge,
        unlockedMetaTitle: result.unlockedMetaTitle,
        reason: result.reason,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Lỗi hoàn thành Knowledge Quest' });
    }
  });

  // 11. Authoritative Verified Bite Count for User
  app.get('/api/user/verified-bite-count', async (req, res) => {
    const uid = req.user?.uid || currentUser.id;
    const count = await getAuthoritativeVerifiedBiteCount(uid, feedBites);
    res.json({
      userId: uid,
      verifiedBiteCount: count,
      isStarter: count === 0,
    });
  });

  // 11b. Intent-Based Search Parsing with Gemini 3.7 Flash
  const SearchIntentRequestSchema = z.object({
    query: z.string().min(1).max(500),
  });

  const handleSearchIntentParsing = async (req: Request, res: Response) => {
    const parsed = SearchIntentRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const { query } = parsed.data;
    const ai = getGeminiClient();

    if (ai) {
      try {
        const systemPrompt = `You are the natural language Search Intent Parser for BiteQuest (a culinary & cafe discovery app in Vietnam).
Parse the user's raw search query into structured JSON intent.

JSON Schema format:
{
  "category": "cafe" | "food" | "fast_food" | "any",
  "maxDistanceKm": number,
  "vibe": "chill" | "noisy" | "romantic" | "any"
}

Categorization rules:
- category:
  * "cafe" for coffee, tea, cà phê, trà, trà sữa, matcha, cafe làm việc, quán nước, đồ uống
  * "food" for phở, bún, mì, lẩu, nướng, cơm, ăn tối, ăn trưa, nhà hàng, đồ ăn mặn, hải sản
  * "fast_food" for bánh mì, ăn vặt, chè, kem, tráng miệng, fast food, xiên que, burger
  * "any" if not specified or generic
- maxDistanceKm:
  * If user expresses nearby preferences (e.g. "gần đây", "đừng đi xa", "quanh đây", "gần nhà", "đi bộ được") -> return 2.5
  * If user specifies a distance (e.g. "dưới 5km", "trong vòng 3km") -> return that number
  * Otherwise default to 50
- vibe:
  * "chill" for "chill", "yên tĩnh", "làm việc", "học bài", "nhẹ nhàng", "thoáng mát", "view đẹp"
  * "noisy" for "nhộn nhịp", "đông vui", "nhậu", "quán nhậu", "bia bọt", "tụ tập"
  * "romantic" for "hẹn hò", "lãng mạn", "date", "người yêu", "2 người"
  * "any" otherwise

Return strictly valid JSON matching this schema without markdown fences.`;

        const geminiCall = ai.models.generateContent({
          model: 'gemini-3.7-flash',
          contents: [{ role: 'user', parts: [{ text: `Search query: "${query}"` }] }],
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                category: {
                  type: Type.STRING,
                  enum: ['cafe', 'food', 'fast_food', 'any'],
                },
                maxDistanceKm: {
                  type: Type.NUMBER,
                },
                vibe: {
                  type: Type.STRING,
                  enum: ['chill', 'noisy', 'romantic', 'any'],
                },
              },
              required: ['category', 'maxDistanceKm', 'vibe'],
            },
            temperature: 0.1,
            maxOutputTokens: 250,
          },
        });

        const response = await withTimeout(geminiCall, 4000, null);

        if (response && response.text) {
          const jsonText = response.text.trim();
          const parsedResult = JSON.parse(jsonText);
          return res.json({
            success: true,
            intent: {
              category: parsedResult.category || 'any',
              maxDistanceKm: Number(parsedResult.maxDistanceKm) || 50,
              vibe: parsedResult.vibe || 'any',
            },
            source: 'gemini-3.7-flash',
          });
        }
      } catch (err: any) {
        logger.warn({ event: 'GEMINI_SEARCH_INTENT_ERROR', error: err?.message });
      }
    }

    // Fallback: intelligent rule-based intent parsing
    const norm = query.toLowerCase();
    let cat = 'any';
    if (norm.includes('cafe') || norm.includes('cà phê') || norm.includes('trà') || norm.includes('nước')) {
      cat = 'cafe';
    } else if (norm.includes('phở') || norm.includes('bún') || norm.includes('mì') || norm.includes('lẩu') || norm.includes('nướng') || norm.includes('cơm') || norm.includes('ăn')) {
      cat = 'food';
    } else if (norm.includes('bánh mì') || norm.includes('ăn vặt') || norm.includes('chè')) {
      cat = 'fast_food';
    }

    let dist = 50;
    if (norm.includes('gần') || norm.includes('đừng đi xa') || norm.includes('quanh đây')) {
      dist = 2.5;
    }

    let vibe = 'any';
    if (norm.includes('chill') || norm.includes('yên tĩnh') || norm.includes('làm việc') || norm.includes('view')) {
      vibe = 'chill';
    } else if (norm.includes('nhậu') || norm.includes('nhộn nhịp') || norm.includes('đông vui') || norm.includes('bia')) {
      vibe = 'noisy';
    } else if (norm.includes('hẹn hò') || norm.includes('lãng mạn') || norm.includes('date')) {
      vibe = 'romantic';
    }

    return res.json({
      success: true,
      intent: {
        category: cat,
        maxDistanceKm: dist,
        vibe: vibe,
      },
      source: 'server-rule-fallback',
    });
  };

  app.post('/api/search/intent', handleSearchIntentParsing);
  app.post('/api/ai/parse-search-intent', handleSearchIntentParsing);

  // 11c. Explainable AI Decision Engine (Gemini 3.7 Flash)
  const DecisionExplanationSchema = z.object({
    options: z.array(
      z.object({
        name: z.string(),
        durationMins: z.number(),
        distanceKm: z.number(),
        trafficLevel: z.string(),
        floodRisk: z.string(),
      })
    ).min(1),
    selectedOption: z.object({
      name: z.string(),
      durationMins: z.number(),
      distanceKm: z.number(),
      trafficLevel: z.string(),
      floodRisk: z.string(),
    }),
  });

  const handleExplainDecision = async (req: Request, res: Response) => {
    const parsed = DecisionExplanationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.format() });
    }

    const { options, selectedOption } = parsed.data;
    const ai = getGeminiClient();

    if (ai) {
      try {
        const systemPrompt = `You are the Explainable AI Decision Engine for BiteQuest (a culinary navigation & discovery platform in Vietnam).
Your task is to generate a short, persuasive explanation (the "Why this?" card) for why BiteQuest recommended the chosen destination among the available options.

Core Philosophy:
- "Fastest ≠ Best": If the chosen option is slightly longer or further than an alternative to avoid heavy traffic or flood risks, emphasize that going with the fastest raw route isn't always the smart choice.
- Tone: Vietnamese, calm, premium, intelligent, objective, and reassuring. Avoid robotic clichés like "As an AI..." or "Theo thuật toán của chúng tôi...".

Output Format (strict JSON):
{
  "headline": "Short punchy Vietnamese headline (e.g., 'Nhanh nhất chưa chắc đã tốt nhất' or 'Đường đi thoáng và an toàn nhất')",
  "bulletPoints": [
    "Concrete reason 1 (e.g., 'Đường khá thoáng lúc 19:00')",
    "Concrete reason 2 (e.g., 'Tránh được khu vực đang có nguy cơ ngập')",
    "Concrete reason 3 (e.g., 'Chỉ đi xa hơn 3 phút so với quán gần nhất nhưng không lo kẹt xe')"
  ],
  "summary": "One concise reassuring sentence explaining why BiteQuest selected this place (e.g., 'BiteQuest chọn quán B vì nó phù hợp và an toàn hơn cho chuyến đi của bạn lúc này.')"
}`;

        const promptText = `Available Options:
${JSON.stringify(options, null, 2)}

Selected Best Option:
${JSON.stringify(selectedOption, null, 2)}

Provide the structured explanation in Vietnamese:`;

        const geminiCall = ai.models.generateContent({
          model: 'gemini-3.7-flash',
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                headline: { type: Type.STRING },
                bulletPoints: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                summary: { type: Type.STRING },
              },
              required: ['headline', 'bulletPoints', 'summary'],
            },
            temperature: 0.2,
            maxOutputTokens: 350,
          },
        });

        const response = await withTimeout(geminiCall, 4000, null);

        if (response && response.text) {
          const jsonText = response.text.trim();
          const parsedResult = JSON.parse(jsonText);
          return res.json({
            success: true,
            explanation: {
              headline: parsedResult.headline,
              bulletPoints: parsedResult.bulletPoints || [],
              summary: parsedResult.summary,
            },
            source: 'gemini-3.7-flash',
          });
        }
      } catch (err: any) {
        logger.warn({ event: 'GEMINI_DECISION_EXPLANATION_ERROR', error: err?.message });
      }
    }

    // Local deterministic fallback logic
    const isFloodSafe =
      String(selectedOption.floodRisk).toLowerCase() === 'low' &&
      options.some((o) => String(o.floodRisk).toLowerCase() === 'high');

    const isTrafficAvoided =
      String(selectedOption.trafficLevel).toLowerCase() === 'low' &&
      options.some((o) => String(o.trafficLevel).toLowerCase() === 'high');

    const minOpt = [...options].sort((a, b) => a.durationMins - b.durationMins)[0];
    const isFastest = minOpt && minOpt.name === selectedOption.name;

    let headline = `Đường đi lý tưởng đến ${selectedOption.name}`;
    const bulletPoints: string[] = [];

    if (!isFastest && (isFloodSafe || isTrafficAvoided)) {
      headline = 'Nhanh nhất chưa chắc đã tốt nhất';
      if (isTrafficAvoided) bulletPoints.push('Tuyến đường thông thoáng, tránh các nút giao đang ùn tắc');
      if (isFloodSafe) bulletPoints.push('Tránh hoàn toàn các điểm ngập nước và vũng trũng cục bộ');
      const diff = Math.max(1, Math.round(selectedOption.durationMins - (minOpt?.durationMins || selectedOption.durationMins)));
      bulletPoints.push(`Chỉ đi xa hơn ${diff} phút so với quán gần nhất nhưng lộ trình an toàn hơn`);
    } else {
      bulletPoints.push(`Thời gian di chuyển ước tính: ~${selectedOption.durationMins} phút (${selectedOption.distanceKm} km)`);
      if (String(selectedOption.trafficLevel).toLowerCase() === 'low') bulletPoints.push('Mật độ giao thông thông thoáng');
      if (String(selectedOption.floodRisk).toLowerCase() === 'low') bulletPoints.push('Lộ trình khô ráo, không cảnh báo ngập');
    }

    return res.json({
      success: true,
      explanation: {
        headline,
        bulletPoints,
        summary: `BiteQuest chọn ${selectedOption.name} vì nó phù hợp và an toàn hơn cho chuyến đi của bạn lúc này.`,
      },
      source: 'server-rule-fallback',
    });
  };

  app.post('/api/ai/explain-decision', handleExplainDecision);


  // 12. BiteBot - Professional Culinary AI Concierge (Gemini 3.7 Flash)
  const ChatMessageSchema = z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().max(3000),
  });

  const AiChatRequestSchema = z.object({
    messages: z.array(ChatMessageSchema).min(1),
    userLocation: z
      .object({
        latitude: z.number(),
        longitude: z.number(),
        district: z.string().optional(),
      })
      .optional(),
    currentPlacesContext: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          category: z.string().optional(),
          categoryLabel: z.string().optional(),
          address: z.string().optional(),
          priceBand: z.string().optional(),
          rating: z.number().optional(),
          isCommunitySpot: z.boolean().optional(),
        })
      )
      .optional(),
    userPreferences: z.array(z.string()).optional(),
  });

  app.post('/api/ai/chat', async (req, res) => {
    const parsed = AiChatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Dữ liệu tin nhắn không hợp lệ',
        details: parsed.error.format(),
      });
    }

    const { messages, userLocation, currentPlacesContext, userPreferences } = parsed.data;
    const latestUserMsg = messages[messages.length - 1]?.content || '';

    // Prepare list of known local venues to ground the model
    const contextVenues = (currentPlacesContext && currentPlacesContext.length > 0
      ? currentPlacesContext
      : places.slice(0, 15)
    ).map((p) => `- [${p.id}] ${p.name} (${p.categoryLabel || p.category || 'Ẩm thực'}, ${p.priceBand || 'Giá hợp lý'}, địa chỉ: ${p.address})`);

    const venuesListText = contextVenues.join('\n');

    const systemPrompt = `Bạn là BiteBot - Trợ lý Ẩm thực AI thông minh, tinh tế và sành ăn của ứng dụng BiteQuest tại Hà Nội (trọng tâm Cầu Giấy và các quận lân cận).

VAI TRÒ & PHONG CÁCH:
- Chuyên gia tư vấn ẩm thực địa phương nhiệt tình, thân thiện, am hiểu sâu sắc các quán ăn ngon từ ngõ hẻm vỉa hè đến nhà hàng, quán cà phê làm việc, quán lẩu nướng họp nhóm, điểm ăn sinh viên.
- Câu trả lời súc tích, văn phong hiện đại, có điểm nhấn (bullet point, icon minh họa hấp dẫn như 🍜, ☕, 🥢, 🥘, 🌟, 📍).
- Không trả lời chung chung hoặc dài dòng lan man. Đưa ra gợi ý cụ thể kèm lý do tại sao nên thử, món đặc trưng và mức giá ước lượng.

DANH SÁCH QUÁN THỰC TẾ TRÊN BẢN ĐỒ BITEQUEST HIỆN TẠI:
${venuesListText}

SỞ THÍCH NGƯỜI DÙNG: ${userPreferences && userPreferences.length > 0 ? userPreferences.join(', ') : 'Thích khám phá ẩm thực đa dạng'}
VỊ TRÍ HIỆN TẠI: ${userLocation ? `Vĩ độ ${userLocation.latitude.toFixed(4)}, Kinh độ ${userLocation.longitude.toFixed(4)} (${userLocation.district || 'Cầu Giấy'})` : 'Khu vực Cầu Giấy, Hà Nội'}

QUY TẮC PHẢN HỒI:
1. Luôn ưu tiên giới thiệu các quán trong danh sách trên nếu phù hợp với nhu cầu người dùng. Hãy viết đúng tên quán theo dạng: **Tên Quán** [Mã: {id}] (ví dụ: **Phê La - Trà Ô Long Đặc Sản** [Mã: place_phe_la_cau_giay]).
2. Nếu người dùng hỏi "hôm nay ăn gì?", hãy hỏi nhanh khẩu vị (thèm đồ nước, đồ khô, cơm, hay cafe) hoặc gợi ý ngay 2-3 lựa chọn nổi bật theo buổi trong ngày (sáng/trưa/tối).
3. Luôn giữ thái độ chuyên nghiệp, mến khách và hỗ trợ tối đa.`;

    const ai = getGeminiClient();

    if (ai) {
      try {
        // Format conversation history for Gemini API
        const geminiContents = messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

        // Call Gemini 3.7 Flash with timeout
        const geminiCall = ai.models.generateContent({
          model: 'gemini-3.7-flash',
          contents: geminiContents,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.7,
            maxOutputTokens: 1200,
          },
        });

        const response = await withTimeout(geminiCall, 12000, null);

        if (response && response.text) {
          const rawText = response.text.trim();

          // Extract recommended place IDs mentioned in response
          const recommendedPlaceIds: string[] = [];
          const idMatches = rawText.match(/\[Mã:\s*([^\]]+)\]/g);
          if (idMatches) {
            idMatches.forEach((m) => {
              const id = m.replace(/\[Mã:\s*/, '').replace(/\]/, '').trim();
              if (id && !recommendedPlaceIds.includes(id)) {
                recommendedPlaceIds.push(id);
              }
            });
          }

          // Clean up raw ID tags for clean display if needed
          const cleanedText = rawText.replace(/\[Mã:\s*[^\]]+\]/g, '');

          return res.json({
            success: true,
            message: cleanedText,
            recommendedPlaceIds,
            source: 'gemini-3.7-flash',
          });
        }
      } catch (err: any) {
        logger.warn({ event: 'GEMINI_CHAT_ERROR', error: err?.message });
      }
    }

    // Fallback rule-based smart response when Gemini API is unavailable or offline
    const queryLower = latestUserMsg.toLowerCase();
    let fallbackText = '';
    const fallbackIds: string[] = [];

    if (queryLower.includes('bún') || queryLower.includes('phở') || queryLower.includes('nước')) {
      fallbackText = `🍜 **Gợi ý món nước nóng hổi quanh Cầu Giấy:**\n\n- **Bún Cá Chiên Giòn Cô Lan** (Ngõ 130 Xuân Thủy): Nước dùng chua thanh đậm đà, cá giòn rụm không tanh, giá chỉ 35k–45k.\n- **Phở Bò Gia Truyền Cầu Giấy** (Trần Thái Tông): Nước dùng ninh xương ngọt tự nhiên, thịt bò mềm tươi.\n\n👉 *Mẹo nhỏ*: Bạn có thể nhấn vào biểu tượng quán trên bản đồ để chụp ảnh xác minh Bite nhận 100 XP nhé!`;
      fallbackIds.push('place_bun_ca_co_lan');
    } else if (queryLower.includes('cafe') || queryLower.includes('cà phê') || queryLower.includes('làm việc') || queryLower.includes('học')) {
      fallbackText = `☕ **Quán cà phê không gian đẹp & yên tĩnh để làm việc:**\n\n- **Phê La - Trà Ô Long Đặc Sản** (Cầu Giấy): Không gian chill đậm chất cắm trại, trà Ô Long sữa kem trứng ngon trứ danh.\n- **Blackbird Coffee** (Chân Cầm / Cầu Giấy): Gu cà phê specialty mộc mạc, wifi khỏe, cực kỳ thích hợp tập trung làm việc.\n\nBạn thích ngồi ngoài trời thoáng đãng hay phòng lạnh yên tĩnh để mình gợi ý thêm nhé?`;
      fallbackIds.push('place_phe_la_cau_giay', 'place_blackbird_coffee');
    } else if (queryLower.includes('lẩu') || queryLower.includes('nướng') || queryLower.includes('nhóm') || queryLower.includes('bạn bè')) {
      fallbackText = `🥘 **Địa điểm Lẩu Nướng tụ tập bạn bè cực đã:**\n\n- **Lẩu Bò Nhúng Dấm 555** (Duy Tân): Nước lẩu chua ngọt thơm nức sả ớt, thịt bò tươi mềm cuốn bánh tráng rau sống.\n- **Nướng Ngói / Nướng Vỉa Hè Tô Hiệu**: Giá học sinh sinh viên chỉ từ 120k–150k/người, không khí sôi động.\n\nBạn đi nhóm bao nhiêu người để BiteBot tư vấn đặt bàn phù hợp nhất nhé!`;
      fallbackIds.push('place_lau_555');
    } else if (queryLower.includes('rẻ') || queryLower.includes('sinh viên') || queryLower.includes('50k')) {
      fallbackText = `💸 **Ăn ngon no căng chuẩn giá sinh viên (< 50k):**\n\n- **Bánh Mì Chảo Cô Long** (Ngõ 165 Cầu Giấy): Suất đầy đủ chỉ 35k–45k thơm bơ nức mũi.\n- **Chè Sầu Liên Đà Nẵng** (Trần Thái Tông): Tráng miệng mát lạnh ngọt dịu chỉ 30k–40k.\n- **Bún Đậu Mắm Tôm Nghĩa Tân**: Mẹt đầy đủ dồi, chả cốm giòn tan chỉ 40k.\n\nBạn muốn ăn mặn hay tráng miệng giải khát nào?`;
      fallbackIds.push('place_che_sau_lien');
    } else {
      fallbackText = `Xin chào! Mình là **BiteBot** - Trợ lý ẩm thực đồng hành cùng bạn trên BiteQuest 🥢.\n\nHôm nay bạn muốn thưởng thức món gì nào?\n- 🍜 **Món nước ấm bụng**: Phở bò, bún cá chiên giòn, bún chả\n- ☕ **Cafe & Trà**: Trà Ô Long Phê La, Specialty Coffee\n- 🍲 **Lẩu / Nướng họp nhóm**: Lẩu bò nhúng dấm, nướng than hoa\n- 🍨 **Tráng miệng**: Chè Sầu Liên, sữa chua dẻo\n\nHãy nhắn cho mình khẩu vị hoặc ngân sách của bạn nhé!`;
    }

    return res.json({
      success: true,
      message: fallbackText,
      recommendedPlaceIds: fallbackIds,
      source: 'smart-fallback',
    });
  });

  // --- Vite Middleware (Dev) vs Static Serving (Prod) ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BiteQuest server running on port ${PORT}`);
  });
}

startServer();
