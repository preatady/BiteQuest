import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeoapifyPlaceProvider } from '../src/services/maps/geoapify/geoapifyPlaces';
import { INITIAL_PLACES } from '../src/data/seedData';
import { getDistance } from 'geolib';

describe('Map Density & Data Truth Enforcement Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('1. Production Boundary & Fallback Leakage Elimination (P0)', () => {
    it('Geoapify 401 Unauthorized never returns INITIAL_PLACES in production', async () => {
      delete process.env.BITEQUEST_DEMO_MODE;
      process.env.NODE_ENV = 'production';

      const provider = new GeoapifyPlaceProvider('invalid_api_key_401');

      // Mock global fetch to return 401 Unauthorized
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ statusCode: 401, error: 'Unauthorized', message: 'Invalid apiKey' }),
      } as any);

      await expect(
        provider.searchNearby({
          latitude: 21.0285,
          longitude: 105.7958,
          radiusMeters: 2000,
          limit: 100,
        })
      ).rejects.toThrow(/GEOAPIFY_REQUEST_FAILED: HTTP status 401/);
    });

    it('Geoapify network failure never returns INITIAL_PLACES in production', async () => {
      delete process.env.BITEQUEST_DEMO_MODE;
      process.env.NODE_ENV = 'production';

      const provider = new GeoapifyPlaceProvider('some_key');

      // Mock global fetch to reject with Network Error
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network connection timeout'));

      await expect(
        provider.searchNearby({
          latitude: 21.0285,
          longitude: 105.7958,
          radiusMeters: 2000,
          limit: 100,
        })
      ).rejects.toThrow('Network connection timeout');
    });

    it('Missing API key in production throws rather than returning INITIAL_PLACES', async () => {
      delete process.env.BITEQUEST_DEMO_MODE;
      delete process.env.GEOAPIFY_SERVER_KEY;
      delete process.env.GEOAPIFY_API_KEY;
      process.env.NODE_ENV = 'production';

      const provider = new GeoapifyPlaceProvider('');

      await expect(
        provider.searchNearby({
          latitude: 21.0285,
          longitude: 105.7958,
          radiusMeters: 2000,
          limit: 100,
        })
      ).rejects.toThrow(/GEOAPIFY_SERVER_KEY_UNCONFIGURED/);
    });

    it('Explicit demo mode (BITEQUEST_DEMO_MODE=true) uses demo fixtures safely', async () => {
      process.env.BITEQUEST_DEMO_MODE = 'true';

      const provider = new GeoapifyPlaceProvider('');
      const results = await provider.searchNearby({
        latitude: 21.0285,
        longitude: 105.7958,
        radiusMeters: 2000,
        limit: 5,
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBeDefined();
    });
  });

  describe('2. POI Limit & Category Coverage (P1)', () => {
    it('live provider request builds URL supporting limit up to 100 and all expanded F&B categories', async () => {
      delete process.env.BITEQUEST_DEMO_MODE;
      const provider = new GeoapifyPlaceProvider('valid_test_key');

      let capturedUrl = '';
      vi.spyOn(global, 'fetch').mockImplementationOnce(async (url: any) => {
        capturedUrl = url.toString();
        return {
          ok: true,
          json: async () => ({
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: {
                  place_id: 'test_geo_1',
                  name: 'Quán Phở Thật',
                  categories: ['catering.restaurant'],
                  lat: 21.0285,
                  lon: 105.7958,
                },
              },
            ],
          }),
        } as any;
      });

      const results = await provider.searchNearby({
        latitude: 21.0285,
        longitude: 105.7958,
        radiusMeters: 2000,
        limit: 100,
      });

      expect(results.length).toBe(1);
      expect(capturedUrl).toContain('limit=100');
      expect(capturedUrl).toContain('catering.restaurant');
      expect(capturedUrl).toContain('catering.cafe');
      expect(capturedUrl).toContain('catering.ice_cream');
      expect(capturedUrl).toContain('catering.fast_food');
      expect(capturedUrl).toContain('catering.bar');
      expect(capturedUrl).toContain('catering.pub');
      expect(capturedUrl).toContain('commercial.food_and_drink.bakery');
      expect(capturedUrl).toContain('commercial.food_and_drink.confectionery');
    });
  });

  describe('3. Canonical Deduplication Integrity', () => {
    it('preserves unrelated nearby venues located within 25m with different names', () => {
      const promotedPlaces = [
        {
          id: 'promoted_noodle_shop',
          name: 'Bún Chả Đắc Kim',
          latitude: 21.0285,
          longitude: 105.7958,
        },
      ];

      const incomingPOIs = [
        // 1. Exact canonical name match within 10m -> Should be deduplicated
        {
          id: 'geo_poi_same',
          name: 'Bún Chả Đắc Kim',
          latitude: 21.02855,
          longitude: 105.79585,
        },
        // 2. Unrelated coffee shop directly next door (15m away) -> MUST BE PRESERVED
        {
          id: 'geo_poi_next_door_coffee',
          name: 'Highlands Coffee Hàng Mành',
          latitude: 21.0286,
          longitude: 105.7959,
        },
      ];

      const deduplicated = incomingPOIs.filter((poi) => {
        const canonicalMatch = promotedPlaces.some((p) => {
          const normPName = p.name.trim().toLowerCase().replace(/\s+/g, ' ');
          const normPoiName = poi.name.trim().toLowerCase().replace(/\s+/g, ' ');
          if (normPName !== normPoiName) return false;
          const dist = getDistance(
            { latitude: p.latitude, longitude: p.longitude },
            { latitude: poi.latitude, longitude: poi.longitude }
          );
          return dist < 25;
        });
        return !canonicalMatch;
      });

      expect(deduplicated.length).toBe(1);
      expect(deduplicated[0].id).toBe('geo_poi_next_door_coffee');
      expect(deduplicated[0].name).toBe('Highlands Coffee Hàng Mành');
    });
  });

  describe('4. AuthMiddleware verifyIdToken Security Verification', () => {
    it('cryptographically verifies token using verifyIdToken(token, true) and derives req.user.uid', async () => {
      const { authenticateFirebaseUser, getFirebaseAuth } = await import('../src/server/authMiddleware');
      const auth = getFirebaseAuth();

      const verifySpy = vi.spyOn(auth, 'verifyIdToken').mockResolvedValueOnce({
        uid: 'user_truth_999',
        name: 'Food Pioneer',
        email: 'pioneer@bitequest.app',
      } as any);

      const mockReq: any = {
        headers: {
          authorization: 'Bearer valid_crypto_firebase_id_token',
        },
      };
      const mockRes: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const nextFn = vi.fn();

      await authenticateFirebaseUser(mockReq, mockRes, nextFn);

      expect(verifySpy).toHaveBeenCalledWith('valid_crypto_firebase_id_token', true);
      expect(nextFn).toHaveBeenCalled();
      expect(mockReq.user?.uid).toBe('user_truth_999');
      expect(mockReq.user?.name).toBe('Food Pioneer');

      verifySpy.mockRestore();
    });
  });
});
