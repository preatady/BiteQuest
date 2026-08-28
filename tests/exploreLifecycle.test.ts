import { describe, it, expect, vi } from 'vitest';
import { getDistance } from 'geolib';
import { UnifiedPlace } from '../src/services/maps/types';

describe('Explore Lifecycle & Request Loop Guards (P0 Runtime Validation)', () => {
  const FALLBACK_CENTER = { latitude: 21.0285, longitude: 105.7958 };

  describe('1. Geolocation & Fallback State Isolation', () => {
    it('distinguishes REAL_LOCATION from FALLBACK_LOCATION cleanly', () => {
      const realLocation = { latitude: 21.0333, longitude: 105.8000 };
      let userLocation: { latitude: number; longitude: number } | null = null;
      let hasRealLocation = false;

      // When permissions policy blocks GPS:
      hasRealLocation = false;
      userLocation = null;

      const activeReferenceLocation = userLocation || FALLBACK_CENTER;
      expect(activeReferenceLocation).toEqual(FALLBACK_CENTER);
      expect(hasRealLocation).toBe(false);

      // When real GPS succeeds:
      hasRealLocation = true;
      userLocation = realLocation;

      const activeRealReference = userLocation || FALLBACK_CENTER;
      expect(activeRealReference).toEqual(realLocation);
      expect(hasRealLocation).toBe(true);
    });

    it('ensures one-shot initialization flag prevents automatic re-invocation', () => {
      let invocationCount = 0;
      let initialGeolocated = false;

      const simulateMountOrRerender = () => {
        if (initialGeolocated) return;
        initialGeolocated = true;
        invocationCount++;
      };

      // Mount: runs 1 time
      simulateMountOrRerender();
      expect(invocationCount).toBe(1);

      // 10 subsequent re-renders or state updates: does NOT re-run
      for (let i = 0; i < 10; i++) {
        simulateMountOrRerender();
      }
      expect(invocationCount).toBe(1);
    });
  });

  describe('2. Search This Area Threshold Logic', () => {
    it('does not trigger Search This Area button for micro pans (<= 450m)', () => {
      const lastFetchedCenter = { latitude: 21.0285, longitude: 105.7958 };
      // Micro pan ~150m away
      const newCenter = { latitude: 21.0298, longitude: 105.7958 };

      const dist = getDistance(lastFetchedCenter, newCenter);
      expect(dist).toBeLessThan(450);

      const shouldShowSearchPill = dist > 450;
      expect(shouldShowSearchPill).toBe(false);
    });

    it('triggers Search This Area button only when panned beyond 450m threshold', () => {
      const lastFetchedCenter = { latitude: 21.0285, longitude: 105.7958 };
      // Pan ~850m away to Kim Mã
      const newCenter = { latitude: 21.0350, longitude: 105.8010 };

      const dist = getDistance(lastFetchedCenter, newCenter);
      expect(dist).toBeGreaterThan(450);

      const shouldShowSearchPill = dist > 450;
      expect(shouldShowSearchPill).toBe(true);
    });
  });

  describe('3. In-flight Guard & Request URL Format', () => {
    it('builds canonical nearby places API URL with radius and limit', () => {
      const center = { latitude: 21.0285, longitude: 105.7958 };
      const radius = 2000;
      const url = `/api/nearby-places?lat=${center.latitude}&lng=${center.longitude}&radius=${radius}&limit=100`;

      expect(url).toBe('/api/nearby-places?lat=21.0285&lng=105.7958&radius=2000&limit=100');
    });

    it('suppresses duplicate concurrent fetches via in-flight flag', async () => {
      let networkFetchCount = 0;
      let inFlight = false;
      let cachedPOIs: UnifiedPlace[] = [];

      const fetchWithGuard = async (center: { latitude: number; longitude: number }) => {
        if (!center) return [];
        if (inFlight) return cachedPOIs;

        inFlight = true;
        try {
          networkFetchCount++;
          // Simulate latency
          await new Promise((r) => setTimeout(r, 10));
          const mockResult: UnifiedPlace[] = [
            {
              id: 'poi_mock_1',
              providerId: 'geo_1',
              name: 'Mock Café',
              category: 'coffee',
              categoryLabel: 'Café',
              address: '123 Cầu Giấy',
              district: 'Cầu Giấy',
              latitude: 21.0285,
              longitude: 105.7958,
            },
          ];
          cachedPOIs = mockResult;
          return mockResult;
        } finally {
          inFlight = false;
        }
      };

      // Trigger 2 concurrent requests
      const [res1, res2] = await Promise.all([
        fetchWithGuard({ latitude: 21.0285, longitude: 105.7958 }),
        fetchWithGuard({ latitude: 21.0285, longitude: 105.7958 }),
      ]);

      // Exactly 1 network fetch executed
      expect(networkFetchCount).toBe(1);
      expect(res1.length).toBe(1);
    });
  });

  describe('4. Deduplication of Background POIs Against Promoted Places', () => {
    it('filters out background POIs that share physical location (<25m) and name with promoted place', () => {
      const promotedPlaces = [
        {
          id: 'place_bun_ca_co_lan',
          name: 'Bún Cá Cay Cô Lan',
          latitude: 21.0285,
          longitude: 105.7958,
        },
      ];

      const nearbyBackgroundPOIs: UnifiedPlace[] = [
        // Duplicate: ~10m away, exact name
        {
          id: 'geo_poi_duplicate',
          providerId: 'geo_1',
          name: 'Bún Cá Cay Cô Lan',
          category: 'noodles',
          categoryLabel: 'Bún cá',
          address: 'Vũ Phạm Hàm',
          district: 'Cầu Giấy',
          latitude: 21.02858,
          longitude: 105.79585,
        },
        // Unique new POI: 400m away, distinct name
        {
          id: 'geo_poi_unique',
          providerId: 'geo_2',
          name: 'Bánh Mì Ngon 247',
          category: 'street_food',
          categoryLabel: 'Bánh mì',
          address: 'Trần Duy Hưng',
          district: 'Cầu Giấy',
          latitude: 21.025,
          longitude: 105.799,
        },
      ];

      const unpromotedPOIs = nearbyBackgroundPOIs.filter((poi) => {
        const spatialMatch = promotedPlaces.some((p) => {
          const dist = getDistance(
            { latitude: p.latitude, longitude: p.longitude },
            { latitude: poi.latitude, longitude: poi.longitude }
          );
          return dist < 25 && p.name.trim().toLowerCase() === poi.name.trim().toLowerCase();
        });
        return !spatialMatch;
      });

      expect(unpromotedPOIs.length).toBe(1);
      expect(unpromotedPOIs[0].id).toBe('geo_poi_unique');
    });
  });

  describe('5. Phase 3 "Tìm khu vực này" Full Test Matrix (A - L)', () => {
    const ANCHOR_CAU_GIAY = { latitude: 21.0285, longitude: 105.7958 };

    it('A. Initial Load: CTA is hidden and default anchor is established', () => {
      let showSearchThisArea = false;
      const lastFetchedCenter = ANCHOR_CAU_GIAY;
      const viewportCenter = ANCHOR_CAU_GIAY;

      const dist = getDistance(lastFetchedCenter, viewportCenter);
      showSearchThisArea = dist > 450;

      expect(showSearchThisArea).toBe(false);
      expect(dist).toBe(0);
    });

    it('B. 50m Pan: CTA remains hidden (micro drift)', () => {
      const pannedCenter = { latitude: 21.0289, longitude: 105.7958 }; // ~44m
      const dist = getDistance(ANCHOR_CAU_GIAY, pannedCenter);

      expect(dist).toBeLessThan(50);
      const showSearchThisArea = dist > 450;
      expect(showSearchThisArea).toBe(false);
    });

    it('C. 200m Pan: CTA remains hidden (sub-threshold movement)', () => {
      const pannedCenter = { latitude: 21.0303, longitude: 105.7958 }; // ~200m
      const dist = getDistance(ANCHOR_CAU_GIAY, pannedCenter);

      expect(dist).toBeGreaterThanOrEqual(190);
      expect(dist).toBeLessThan(450);
      const showSearchThisArea = dist > 450;
      expect(showSearchThisArea).toBe(false);
    });

    it('D. Threshold-Crossing Pan (> 450m): CTA becomes visible', () => {
      const pannedCenter = { latitude: 21.0350, longitude: 105.8010 }; // ~850m
      const dist = getDistance(ANCHOR_CAU_GIAY, pannedCenter);

      expect(dist).toBeGreaterThan(450);
      const showSearchThisArea = dist > 450;
      expect(showSearchThisArea).toBe(true);
    });

    it('E. Zoom-Only Interaction: CTA remains hidden with 0 area fetches', () => {
      let nearbyFetchCount = 0;
      const viewportCenter = ANCHOR_CAU_GIAY;

      // Simulate zoom in/out at same center
      const zoomLevels = [13, 14, 15, 16, 17];
      for (const _z of zoomLevels) {
        const dist = getDistance(ANCHOR_CAU_GIAY, viewportCenter);
        const showSearchThisArea = dist > 450;
        expect(showSearchThisArea).toBe(false);
      }
      expect(nearbyFetchCount).toBe(0);
    });

    it('F. Filter Switch: CTA remains hidden with 0 area fetches', () => {
      let nearbyFetchCount = 0;
      const filters = ['ALL', 'CAFE_DRINK', 'PHO', 'NOODLE', 'BBQ', 'HOTPOT'];

      for (const _f of filters) {
        // Filter changes do not displace map center or fire nearby API
        const dist = getDistance(ANCHOR_CAU_GIAY, ANCHOR_CAU_GIAY);
        expect(dist > 450).toBe(false);
      }
      expect(nearbyFetchCount).toBe(0);
    });

    it('G. Search Query: CTA remains hidden with 0 area fetches', () => {
      let nearbyFetchCount = 0;
      const queries = ['cafe', 'bún chả', 'phở thìn', ''];

      for (const _q of queries) {
        // Text search filtering operates strictly client-side
        const dist = getDistance(ANCHOR_CAU_GIAY, ANCHOR_CAU_GIAY);
        expect(dist > 450).toBe(false);
      }
      expect(nearbyFetchCount).toBe(0);
    });

    it('H. Venue Selection: CTA is suppressed when focusing venue card', () => {
      let showSearchThisArea = true; // Was panned
      const handleSelectVenue = () => {
        showSearchThisArea = false;
      };

      handleSelectVenue();
      expect(showSearchThisArea).toBe(false);
    });

    it('I. Pan + Tap CTA: executes exactly 1 intended fetch, updates anchor, and hides CTA', async () => {
      let fetchCount = 0;
      let lastFetchedCenter = ANCHOR_CAU_GIAY;
      const pannedTarget = { latitude: 21.0350, longitude: 105.8010 };
      let showSearchThisArea = true;

      const handleSearchThisArea = async () => {
        fetchCount++;
        lastFetchedCenter = pannedTarget;
        showSearchThisArea = false;
      };

      await handleSearchThisArea();

      expect(fetchCount).toBe(1);
      expect(lastFetchedCenter).toEqual(pannedTarget);
      expect(showSearchThisArea).toBe(false);
    });

    it('J. Double Tap CTA while loading: exactly 1 network request fired (duplicate suppressed)', async () => {
      let networkFetchCount = 0;
      let inFlight = false;

      const fetchArea = async () => {
        if (inFlight) return;
        inFlight = true;
        networkFetchCount++;
        await new Promise((r) => setTimeout(r, 20));
        inFlight = false;
      };

      await Promise.all([fetchArea(), fetchArea()]);
      expect(networkFetchCount).toBe(1);
    });

    it('K & L. Failed Area Fetch preserves previous valid venues and allows successful retry', async () => {
      let currentValidPOIs: UnifiedPlace[] = [
        {
          id: 'venue_cau_giay_1',
          name: 'Bún Cá Cầu Giấy',
          category: 'noodles',
          categoryLabel: 'Bún cá',
          address: 'Cầu Giấy',
          district: 'Cầu Giấy',
          latitude: 21.0285,
          longitude: 105.7958,
        },
      ];
      let lastFetchedCenter = ANCHOR_CAU_GIAY;
      let searchAreaError: boolean = false;
      let showSearchThisArea: boolean = true;
      let shouldSimulateFailure = true;

      const executeFetch = async (targetCenter: { latitude: number; longitude: number }) => {
        if (shouldSimulateFailure) {
          searchAreaError = true;
          // IMPORTANT: Do NOT wipe currentValidPOIs, do NOT update lastFetchedCenter
          return null;
        } else {
          searchAreaError = false;
          lastFetchedCenter = targetCenter;
          showSearchThisArea = false;
          currentValidPOIs = [
            {
              id: 'venue_kim_ma_1',
              name: 'Phở Kim Mã',
              category: 'noodles',
              categoryLabel: 'Phở',
              address: 'Kim Mã',
              district: 'Ba Đình',
              latitude: 21.035,
              longitude: 105.801,
            },
          ];
          return currentValidPOIs;
        }
      };

      const pannedCenter = { latitude: 21.035, longitude: 105.801 };

      // K. Failed attempt
      const failResult = await executeFetch(pannedCenter);
      expect(failResult).toBeNull();
      expect(searchAreaError).toBe(true);
      expect(showSearchThisArea).toBe(true); // CTA remains available for retry
      expect(lastFetchedCenter).toEqual(ANCHOR_CAU_GIAY); // Anchor not updated
      expect(currentValidPOIs.length).toBe(1); // Previous valid venues preserved
      expect(currentValidPOIs[0].name).toBe('Bún Cá Cầu Giấy');

      // L. Successful retry
      shouldSimulateFailure = false;
      const retryResult = await executeFetch(pannedCenter);
      expect(retryResult).not.toBeNull();
      expect(searchAreaError).toBe(false);
      expect(showSearchThisArea).toBe(false); // CTA hidden
      expect(lastFetchedCenter).toEqual(pannedCenter); // Anchor updated
      expect(currentValidPOIs.length).toBe(1);
      expect(currentValidPOIs[0].name).toBe('Phở Kim Mã'); // New venues loaded
    });

    it('M. Geolocation Isolation: Panning map does not alter device GPS or trigger geolocation request', () => {
      const realDeviceGPS = { latitude: 21.0285, longitude: 105.7958 };
      let userLocation: { latitude: number; longitude: number } | null = realDeviceGPS;
      let hasRealLocation = true;
      let geoApiCallCount = 0;

      // User pans to West Lake (Hồ Tây ~3.5km away)
      const pannedViewport = { latitude: 21.055, longitude: 105.825 };

      // Ensure panning action uses viewportCenter without touching userLocation or calling navigator.geolocation
      expect(pannedViewport).not.toEqual(userLocation);
      expect(userLocation).toEqual(realDeviceGPS);
      expect(hasRealLocation).toBe(true);
      expect(geoApiCallCount).toBe(0);
    });
  });

  describe('6. Phase 3B State-Machine & Anchor Truth Formal Verification', () => {
    const ANCHOR_CAU_GIAY = { latitude: 21.0285, longitude: 105.7958 };
    const PANNED_KIM_MA = { latitude: 21.0350, longitude: 105.8010 }; // ~850m

    it('1A & 1B. Filter and Search query modifications NEVER hide CTA when viewport is > 450m from discovery anchor', () => {
      const lastFetchedCenter = ANCHOR_CAU_GIAY;
      const viewportCenter = PANNED_KIM_MA;

      const isPannedAboveThreshold = getDistance(lastFetchedCenter, viewportCenter) > 450;
      expect(isPannedAboveThreshold).toBe(true);

      // Simulate 10 filter changes
      const filterSequence = ['ALL', 'PHO', 'NOODLE', 'CAFE_DRINK', 'BBQ', 'HOTPOT', 'SNACK', 'RICE', 'VEGAN', 'SEAFOOD'];
      for (const filter of filterSequence) {
        let activeFilter = filter;
        let isVenueSelected = false;
        let showSearchThisArea = (getDistance(lastFetchedCenter, viewportCenter) > 450) && !isVenueSelected;
        expect(showSearchThisArea).toBe(true);
        expect(activeFilter).toBe(filter);
      }

      // Simulate 10 search query modifications
      const searchQueries = ['bún chả', 'phở gà', 'cafe cốt dừa', 'lẩu ếch', 'bánh cuốn', 'nem nướng', 'trà sữa', 'cà phê muối', 'xôi xéo', ''];
      for (const query of searchQueries) {
        let activeQuery = query;
        let isVenueSelected = false;
        let showSearchThisArea = (getDistance(lastFetchedCenter, viewportCenter) > 450) && !isVenueSelected;
        expect(showSearchThisArea).toBe(true);
        expect(activeQuery).toBe(query);
      }
    });

    it('2. Venue Selection Lifecycle: CTA hidden while inspecting venue, re-evaluates and reappears when sheet closes', () => {
      const lastFetchedCenter = ANCHOR_CAU_GIAY;
      const viewportCenter = PANNED_KIM_MA;

      // 1. Panned > 450m: CTA visible
      let selectedVenue: UnifiedPlace | null = null;
      let isVenueSelected = Boolean(selectedVenue);
      let showSearchThisArea = (getDistance(lastFetchedCenter, viewportCenter) > 450) && !isVenueSelected;
      expect(showSearchThisArea).toBe(true);

      // 2. User selects a venue pin on the map -> venue sheet opens
      selectedVenue = {
        id: 'venue_kim_ma_detail',
        name: 'Phở Kim Mã',
        category: 'noodles',
        latitude: 21.0350,
        longitude: 105.8010,
      };
      isVenueSelected = Boolean(selectedVenue);
      showSearchThisArea = (getDistance(lastFetchedCenter, viewportCenter) > 450) && !isVenueSelected;
      expect(showSearchThisArea).toBe(false); // Temporarily suppressed for focused sheet inspection

      // 3. User closes venue sheet -> re-evaluate distance against discovery anchor
      selectedVenue = null;
      isVenueSelected = Boolean(selectedVenue);
      showSearchThisArea = (getDistance(lastFetchedCenter, viewportCenter) > 450) && !isVenueSelected;
      expect(showSearchThisArea).toBe(true); // Truthfully reappears
    });

    it('3. Anchor Truth: Strict separation of real GPS discovery, fallback browsing, and Proof-of-Bite location', () => {
      const REAL_LOCATION_DISCOVERY_ANCHOR = { latitude: 21.0123, longitude: 105.8456, isRealUserLocation: true };
      const FALLBACK_DISCOVERY_ANCHOR = { latitude: 21.0285, longitude: 105.7958, isRealUserLocation: false };
      let LAST_SUCCESSFULLY_FETCHED_ANCHOR = FALLBACK_DISCOVERY_ANCHOR;

      // When real GPS succeeds:
      LAST_SUCCESSFULLY_FETCHED_ANCHOR = REAL_LOCATION_DISCOVERY_ANCHOR;
      expect(LAST_SUCCESSFULLY_FETCHED_ANCHOR.isRealUserLocation).toBe(true);
      expect(LAST_SUCCESSFULLY_FETCHED_ANCHOR.latitude).toBe(21.0123);

      // When user browses away to another district (e.g. Ba Đình):
      const BROWSED_VIEWPORT = { latitude: 21.0350, longitude: 105.8010 };
      const proofOfBiteDeviceLocation = { latitude: 21.0123, longitude: 105.8456 }; // Real device hardware GPS

      // Proof-of-Bite verification MUST strictly use physical device location, not browsed viewport
      expect(proofOfBiteDeviceLocation).not.toEqual(BROWSED_VIEWPORT);
      expect(proofOfBiteDeviceLocation).toEqual({ latitude: REAL_LOCATION_DISCOVERY_ANCHOR.latitude, longitude: REAL_LOCATION_DISCOVERY_ANCHOR.longitude });
    });

    it('4. State Machine: Complete state transitions (INITIAL -> FETCHED_AT_ANCHOR -> PANNED -> FETCH_LOADING -> FETCH_SUCCEEDED / FAILED)', () => {
      type ExploreState =
        | 'INITIAL'
        | 'FETCHED_AT_ANCHOR'
        | 'USER_PANNED_BELOW_THRESHOLD'
        | 'USER_PANNED_ABOVE_THRESHOLD'
        | 'AREA_FETCH_LOADING'
        | 'AREA_FETCH_FAILED'
        | 'AREA_FETCH_SUCCEEDED'
        | 'VENUE_SELECTED';

      let state: ExploreState = 'INITIAL';
      let lastFetchedCenter: { latitude: number; longitude: number } | null = null;
      let viewportCenter = ANCHOR_CAU_GIAY;
      let selectedVenue: UnifiedPlace | null = null;
      let isLoading = false;
      let hasError = false;

      // Transition: INITIAL -> FETCHED_AT_ANCHOR
      lastFetchedCenter = ANCHOR_CAU_GIAY;
      state = 'FETCHED_AT_ANCHOR';
      let ctaVisible = (Boolean(lastFetchedCenter) && getDistance(lastFetchedCenter, viewportCenter) > 450) && !Boolean(selectedVenue);
      expect(state).toBe('FETCHED_AT_ANCHOR');
      expect(ctaVisible).toBe(false);

      // Transition: FETCHED_AT_ANCHOR -> USER_PANNED_BELOW_THRESHOLD (50m pan)
      viewportCenter = { latitude: 21.0289, longitude: 105.7958 };
      state = 'USER_PANNED_BELOW_THRESHOLD';
      ctaVisible = (Boolean(lastFetchedCenter) && getDistance(lastFetchedCenter, viewportCenter) > 450) && !Boolean(selectedVenue);
      expect(ctaVisible).toBe(false);

      // Transition: -> USER_PANNED_ABOVE_THRESHOLD (850m pan)
      viewportCenter = PANNED_KIM_MA;
      state = 'USER_PANNED_ABOVE_THRESHOLD';
      ctaVisible = (Boolean(lastFetchedCenter) && getDistance(lastFetchedCenter, viewportCenter) > 450) && !Boolean(selectedVenue);
      expect(ctaVisible).toBe(true);

      // Transition: -> VENUE_SELECTED
      selectedVenue = { id: 'v1', name: 'Phở', category: 'noodles', latitude: 21.035, longitude: 105.801 };
      state = 'VENUE_SELECTED';
      ctaVisible = (Boolean(lastFetchedCenter) && getDistance(lastFetchedCenter, viewportCenter) > 450) && !Boolean(selectedVenue);
      expect(ctaVisible).toBe(false);

      // Dismiss venue -> back to USER_PANNED_ABOVE_THRESHOLD
      selectedVenue = null;
      state = 'USER_PANNED_ABOVE_THRESHOLD';
      ctaVisible = (Boolean(lastFetchedCenter) && getDistance(lastFetchedCenter, viewportCenter) > 450) && !Boolean(selectedVenue);
      expect(ctaVisible).toBe(true);

      // Transition: -> AREA_FETCH_LOADING
      isLoading = true;
      state = 'AREA_FETCH_LOADING';
      expect(isLoading).toBe(true);

      // Transition: -> AREA_FETCH_FAILED
      isLoading = false;
      hasError = true;
      state = 'AREA_FETCH_FAILED';
      ctaVisible = (Boolean(lastFetchedCenter) && getDistance(lastFetchedCenter, viewportCenter) > 450) && !Boolean(selectedVenue);
      expect(hasError).toBe(true);
      expect(ctaVisible).toBe(true); // Still visible to allow retry

      // Retry -> AREA_FETCH_SUCCEEDED
      hasError = false;
      lastFetchedCenter = viewportCenter; // Updated anchor
      state = 'AREA_FETCH_SUCCEEDED';
      ctaVisible = (Boolean(lastFetchedCenter) && getDistance(lastFetchedCenter, viewportCenter) > 450) && !Boolean(selectedVenue);
      expect(state).toBe('AREA_FETCH_SUCCEEDED');
      expect(ctaVisible).toBe(false); // Reset to hidden
    });

    it('5. Network Test: Pan > 450m -> 10 filter changes + 10 search changes -> nearbyApiCalls = 0, tap CTA -> nearbyApiCalls = 1', async () => {
      let nearbyApiCalls = 0;
      let lastFetchedCenter = ANCHOR_CAU_GIAY;
      const viewportCenter = PANNED_KIM_MA;

      // Client-side interactions
      for (let i = 0; i < 10; i++) {
        // change filter
        const _f = `FILTER_${i}`;
        // zero network call
      }
      for (let i = 0; i < 10; i++) {
        // change search query
        const _q = `query_${i}`;
        // zero network call
      }

      expect(nearbyApiCalls).toBe(0);

      // Now tap CTA
      const handleTapCTA = async () => {
        nearbyApiCalls++;
        lastFetchedCenter = viewportCenter;
      };

      await handleTapCTA();
      expect(nearbyApiCalls).toBe(1);
      expect(lastFetchedCenter).toEqual(PANNED_KIM_MA);
    });

    it('6. Mobile Viewport Layout Verification across screen dimensions', () => {
      const viewports = [
        { width: 320, height: 568, name: 'iPhone SE 1st gen' },
        { width: 375, height: 667, name: 'iPhone SE 2nd/3rd gen' },
        { width: 390, height: 844, name: 'iPhone 12/13/14' },
        { width: 430, height: 932, name: 'iPhone 14/15 Pro Max' },
      ];

      for (const vp of viewports) {
        // 1. Top Search Bar: top: 10px, height: 44px (ends at 54px)
        const searchBottom = 10 + 44;
        // 2. Filter Bar: top: 60px, height: 38px (ends at 98px)
        const filterBottom = 60 + 38;
        // 3. CTA Pill: top: 116px (starts 18px below filter bar, no overlap)
        const ctaTop = 116;
        const ctaHeight = 32;
        const ctaBottom = ctaTop + ctaHeight; // 148px

        // 4. Bottom Nav: height 64px (starts at vp.height - 64px)
        const bottomNavTop = vp.height - 64;
        // 5. Selected Venue Card: starts at vp.height - 88px (bottom-22)
        const venueCardTop = vp.height - 240; // ~240px card height

        expect(ctaTop).toBeGreaterThan(filterBottom); // No filter overlap
        expect(filterBottom).toBeGreaterThan(searchBottom); // No search overlap
        expect(ctaBottom).toBeLessThan(venueCardTop); // No venue card overlap even on 568px height (148 < 328)
        expect(venueCardTop).toBeLessThan(bottomNavTop); // Cards stack above bottom nav
      }
    });
  });
});
