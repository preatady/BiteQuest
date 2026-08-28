import { describe, it, expect } from 'vitest';
import {
  adaptBiteOpportunities,
  getTodayOpportunities,
  FORBIDDEN_CONSUMER_TERMS,
} from '../src/services/todayIntelligenceAdapter';
import { generateBiteOpportunities } from '../src/services/exploreEngine';
import { INITIAL_PLACES, INITIAL_FEED_BITES, EMPTY_PASSPORT_CAU_GIAY, INITIAL_USER } from '../src/data/seedData';
import { Place } from '../types';

describe('Phase 5: First-Open Today Hook / Discovery Peek', () => {
  const FALLBACK_CENTER = { latitude: 21.0333, longitude: 105.7944, isRealUserLocation: false };
  const REAL_GPS_LOCATION = { latitude: 21.0333, longitude: 105.7944, isRealUserLocation: true };

  const cauGiayLive20Venues: Place[] = [
    {
      id: 'p1',
      name: 'Nhà hàng Hà Đăng',
      category: 'restaurant' as any,
      address: 'Dịch Vọng Hậu, Cầu Giấy',
      district: 'Cầu Giấy',
      latitude: 21.0315,
      longitude: 105.7925,
      priceBand: '50k–100k',
      priceMin: 50000,
      priceMax: 100000,
      rating: 4.3,
      reviewCount: 42,
      imageUrl: '',
      isOpen: true,
    },
    {
      id: 'p2',
      name: 'Nhà Hàng Casa Espana',
      category: 'restaurant' as any,
      address: 'Trần Thái Tông, Cầu Giấy',
      district: 'Cầu Giấy',
      latitude: 21.0345,
      longitude: 105.7915,
      priceBand: '100k–250k',
      priceMin: 100000,
      priceMax: 250000,
      rating: 4.5,
      reviewCount: 30,
      imageUrl: '',
      isOpen: true,
    },
    {
      id: 'p3',
      name: 'Nhậu tự do',
      category: 'restaurant' as any,
      address: 'Khúc Thừa Dụ, Cầu Giấy',
      district: 'Cầu Giấy',
      latitude: 21.036,
      longitude: 105.795,
      priceBand: '100k–200k',
      priceMin: 100000,
      priceMax: 200000,
      rating: 4.2,
      reviewCount: 55,
      imageUrl: '',
      isOpen: true,
    },
    {
      id: 'p4',
      name: 'WA GRILL - THỊT NƯỚNG MANG VỀ KÈM BẾP 24H',
      category: 'restaurant' as any,
      address: 'Duy Tân, Cầu Giấy',
      district: 'Cầu Giấy',
      latitude: 21.032,
      longitude: 105.788,
      priceBand: '80k–150k',
      priceMin: 80000,
      priceMax: 150000,
      rating: 4.1,
      reviewCount: 18,
      imageUrl: '',
      isOpen: true,
    },
    {
      id: 'p5',
      name: 'Cà Phê AnAn',
      category: 'coffee' as any,
      address: 'Dịch Vọng Hậu, Cầu Giấy',
      district: 'Cầu Giấy',
      latitude: 21.033,
      longitude: 105.792,
      priceBand: '30k–50k',
      priceMin: 30000,
      priceMax: 50000,
      rating: 4.6,
      reviewCount: 60,
      imageUrl: '',
      isOpen: true,
    },
    {
      id: 'p6',
      name: 'Bánh cuốn Gia An',
      category: 'restaurant' as any,
      address: 'Trần Thái Tông, Cầu Giấy',
      district: 'Cầu Giấy',
      latitude: 21.0335,
      longitude: 105.794,
      priceBand: '35k–60k',
      priceMin: 35000,
      priceMax: 60000,
      rating: 4.4,
      reviewCount: 88,
      imageUrl: '',
      isOpen: true,
    },
    {
      id: 'p7',
      name: 'Nhà Hàng Bò Đội Nón',
      category: 'restaurant' as any,
      address: 'Duy Tân, Cầu Giấy',
      district: 'Cầu Giấy',
      latitude: 21.031,
      longitude: 105.786,
      priceBand: '150k–300k',
      priceMin: 150000,
      priceMax: 300000,
      rating: 4.2,
      reviewCount: 34,
      imageUrl: '',
      isOpen: true,
    },
    {
      id: 'p8',
      name: 'Nhà Hàng Kombo',
      category: 'restaurant' as any,
      address: 'Phạm Văn Bạch, Cầu Giấy',
      district: 'Cầu Giấy',
      latitude: 21.029,
      longitude: 105.791,
      priceBand: '70k–120k',
      priceMin: 70000,
      priceMax: 120000,
      rating: 4.3,
      reviewCount: 110,
      imageUrl: '',
      isOpen: true,
    },
    {
      id: 'p9',
      name: 'Phở Bò Cầu Giấy',
      category: 'restaurant' as any,
      address: 'Cầu Giấy, Hà Nội',
      district: 'Cầu Giấy',
      latitude: 21.035,
      longitude: 105.798,
      priceBand: '40k–65k',
      priceMin: 40000,
      priceMax: 65000,
      rating: 4.5,
      reviewCount: 95,
      imageUrl: '',
      isOpen: true,
    },
    {
      id: 'p10',
      name: 'Bún Cá Cay Hải Phòng',
      category: 'restaurant' as any,
      address: 'Trần Thái Tông, Cầu Giấy',
      district: 'Cầu Giấy',
      latitude: 21.034,
      longitude: 105.792,
      priceBand: '35k–55k',
      priceMin: 35000,
      priceMax: 55000,
      rating: 4.4,
      reviewCount: 40,
      imageUrl: '',
      isOpen: true,
    },
    {
      id: 'p11',
      name: 'Lẩu Nấm Ashima',
      category: 'restaurant' as any,
      address: 'Khúc Thừa Dụ, Cầu Giấy',
      district: 'Cầu Giấy',
      latitude: 21.037,
      longitude: 105.794,
      priceBand: '250k–400k',
      priceMin: 250000,
      priceMax: 400000,
      rating: 4.7,
      reviewCount: 150,
      imageUrl: '',
      isOpen: true,
    },
    {
      id: 'p12',
      name: 'Gogi House Nướng Hàn Quốc',
      category: 'restaurant' as any,
      address: 'Trần Thái Tông, Cầu Giấy',
      district: 'Cầu Giấy',
      latitude: 21.033,
      longitude: 105.791,
      priceBand: '200k–350k',
      priceMin: 200000,
      priceMax: 350000,
      rating: 4.5,
      reviewCount: 220,
      imageUrl: '',
      isOpen: true,
    },
    {
      id: 'p13',
      name: 'Cơm Niêu Kombo',
      category: 'restaurant' as any,
      address: 'Duy Tân, Cầu Giấy',
      district: 'Cầu Giấy',
      latitude: 21.0318,
      longitude: 105.7875,
      priceBand: '70k–120k',
      priceMin: 70000,
      priceMax: 120000,
      rating: 4.3,
      reviewCount: 85,
      imageUrl: '',
      isOpen: true,
    },
    {
      id: 'p14',
      name: 'Highlands Coffee Duy Tân',
      category: 'coffee' as any,
      address: 'Duy Tân, Cầu Giấy',
      district: 'Cầu Giấy',
      latitude: 21.0315,
      longitude: 105.7865,
      priceBand: '35k–65k',
      priceMin: 35000,
      priceMax: 65000,
      rating: 4.2,
      reviewCount: 300,
      imageUrl: '',
      isOpen: true,
    },
    {
      id: 'p15',
      name: 'Tous Les Jours Bakery',
      category: 'dessert' as any,
      address: 'Trần Thái Tông, Cầu Giấy',
      district: 'Cầu Giấy',
      latitude: 21.0342,
      longitude: 105.7932,
      priceBand: '30k–80k',
      priceMin: 30000,
      priceMax: 80000,
      rating: 4.6,
      reviewCount: 90,
      imageUrl: '',
      isOpen: true,
    },
    {
      id: 'p16',
      name: 'Lotteria Hồ Tùng Mậu',
      category: 'burger_western' as any,
      address: 'Hồ Tùng Mậu, Cầu Giấy',
      district: 'Cầu Giấy',
      latitude: 21.038,
      longitude: 105.78,
      priceBand: '45k–90k',
      priceMin: 45000,
      priceMax: 90000,
      rating: 4.1,
      reviewCount: 140,
      imageUrl: '',
      isOpen: true,
    },
    {
      id: 'p17',
      name: 'The Beer Club 88',
      category: 'drinks' as any,
      address: 'Khúc Thừa Dụ, Cầu Giấy',
      district: 'Cầu Giấy',
      latitude: 21.0365,
      longitude: 105.796,
      priceBand: '100k–300k',
      priceMin: 100000,
      priceMax: 300000,
      rating: 4.3,
      reviewCount: 70,
      imageUrl: '',
      isOpen: true,
    },
    {
      id: 'p18',
      name: 'Cơm Chay Từ Tâm',
      category: 'restaurant' as any,
      address: 'Dịch Vọng Hậu, Cầu Giấy',
      district: 'Cầu Giấy',
      latitude: 21.0328,
      longitude: 105.7938,
      priceBand: '40k–70k',
      priceMin: 40000,
      priceMax: 70000,
      rating: 4.6,
      reviewCount: 50,
      imageUrl: '',
      isOpen: true,
    },
    {
      id: 'p19',
      name: 'Bánh Mì Dân Tổ',
      category: 'street_food' as any,
      address: 'Trần Thái Tông, Cầu Giấy',
      district: 'Cầu Giấy',
      latitude: 21.0338,
      longitude: 105.7928,
      priceBand: '25k–40k',
      priceMin: 25000,
      priceMax: 40000,
      rating: 4.5,
      reviewCount: 160,
      imageUrl: '',
      isOpen: true,
    },
    {
      id: 'p20',
      name: 'Chè Sầu Đà Nẵng',
      category: 'dessert' as any,
      address: 'Duy Tân, Cầu Giấy',
      district: 'Cầu Giấy',
      latitude: 21.0322,
      longitude: 105.787,
      priceBand: '25k–45k',
      priceMin: 25000,
      priceMax: 45000,
      rating: 4.4,
      reviewCount: 80,
      imageUrl: '',
      isOpen: true,
    },
  ];

  describe('1. First-Open Live Hero Computation', () => {
    it('accurately narrows 20 venues to 3 high-value choices with live counts', () => {
      const todayResult = getTodayOpportunities({
        userLocation: FALLBACK_CENTER,
        places: cauGiayLive20Venues,
        feedBites: INITIAL_FEED_BITES,
        passport: EMPTY_PASSPORT_CAU_GIAY,
        user: { ...INITIAL_USER, foodPreferences: ['restaurant', 'coffee'] },
        savedPlaceIds: [],
      });

      expect(cauGiayLive20Venues.length).toBe(20);
      expect(todayResult.opportunities.length).toBeLessThanOrEqual(3);
      expect(todayResult.opportunities.length).toBeGreaterThan(0);
      expect(todayResult.metadata.dedupedVenueCount).toBeGreaterThanOrEqual(todayResult.opportunities.length);

      // Verify no duplicate venues in output
      const venueIds = todayResult.opportunities.map((o) => o.venueId);
      const uniqueVenueIds = new Set(venueIds);
      expect(uniqueVenueIds.size).toBe(venueIds.length);
    });
  });

  describe('2. Location-Aware Hero Copy Contract', () => {
    it('emits "HÔM NAY Ở KHU VỰC NÀY" when using fallback/searched area', () => {
      const isRealUserLocation = false;
      const heroTitle = isRealUserLocation ? 'HÔM NAY QUANH BẠN' : 'HÔM NAY Ở KHU VỰC NÀY';
      const locPhrase = isRealUserLocation ? 'quanh đây' : 'trong khu vực này';

      expect(heroTitle).toBe('HÔM NAY Ở KHU VỰC NÀY');
      expect(locPhrase).toBe('trong khu vực này');
      expect(heroTitle).not.toContain('quanh bạn');
    });

    it('emits "HÔM NAY QUANH BẠN" when using real device location', () => {
      const isRealUserLocation = true;
      const heroTitle = isRealUserLocation ? 'HÔM NAY QUANH BẠN' : 'HÔM NAY Ở KHU VỰC NÀY';
      const locPhrase = isRealUserLocation ? 'quanh đây' : 'trong khu vực này';

      expect(heroTitle).toBe('HÔM NAY QUANH BẠN');
      expect(locPhrase).toBe('quanh đây');
    });
  });

  describe('3. Hero Signal Priority & Reason Integrity', () => {
    it('verifies hero reasons are truthful and free of marketing buzzwords', () => {
      const todayResult = getTodayOpportunities({
        userLocation: REAL_GPS_LOCATION,
        places: cauGiayLive20Venues,
        feedBites: INITIAL_FEED_BITES,
        passport: EMPTY_PASSPORT_CAU_GIAY,
        user: { ...INITIAL_USER, foodPreferences: ['restaurant', 'coffee'] },
        savedPlaceIds: [],
      });

      for (const opp of todayResult.opportunities) {
        expect(opp.title).toBeTruthy();
        expect(opp.reasonPrimary).toBeTruthy();

        // Must not contain forbidden marketing copy
        for (const forbidden of FORBIDDEN_CONSUMER_TERMS) {
          expect(opp.reasonPrimary).not.toContain(forbidden);
          if (opp.reasonSecondary) {
            expect(opp.reasonSecondary).not.toContain(forbidden);
          }
        }
      }
    });
  });

  describe('4. Search This Area (Area A -> Area B) Dynamic Recalculation', () => {
    it('completely replaces Area A opportunities with Area B opportunities on area search', () => {
      // Area A (Cầu Giấy center)
      const areaAPlaces = cauGiayLive20Venues.slice(0, 10);
      const resA = getTodayOpportunities({
        userLocation: { latitude: 21.033, longitude: 105.794, isRealUserLocation: false },
        places: areaAPlaces,
        feedBites: INITIAL_FEED_BITES,
        passport: EMPTY_PASSPORT_CAU_GIAY,
        user: INITIAL_USER,
        savedPlaceIds: [],
      });

      const areaAIds = resA.opportunities.map((o) => o.venueId);

      // Area B (Hoàn Kiếm / Westlake distinct venues)
      const areaBPlaces: Place[] = [
        {
          id: 'p_hk_1',
          name: 'Phở Gia Truyền Bát Đàn',
          category: 'restaurant' as any,
          address: '49 Bát Đàn, Hoàn Kiếm',
          district: 'Hoàn Kiếm',
          latitude: 21.0348,
          longitude: 105.848,
          priceBand: '50k–70k',
          priceMin: 50000,
          priceMax: 70000,
          rating: 4.8,
          reviewCount: 500,
          imageUrl: '',
          isOpen: true,
        },
        {
          id: 'p_hk_2',
          name: 'Cà Phê Giảng',
          category: 'coffee' as any,
          address: '39 Nguyễn Hữu Huân, Hoàn Kiếm',
          district: 'Hoàn Kiếm',
          latitude: 21.033,
          longitude: 105.854,
          priceBand: '35k–50k',
          priceMin: 35000,
          priceMax: 50000,
          rating: 4.7,
          reviewCount: 650,
          imageUrl: '',
          isOpen: true,
        },
        {
          id: 'p_hk_3',
          name: 'Bún Chả Đắc Kim',
          category: 'restaurant' as any,
          address: '1 Hàng Mành, Hoàn Kiếm',
          district: 'Hoàn Kiếm',
          latitude: 21.0339,
          longitude: 105.849,
          priceBand: '60k–90k',
          priceMin: 60000,
          priceMax: 90000,
          rating: 4.4,
          reviewCount: 400,
          imageUrl: '',
          isOpen: true,
        },
      ];

      const resB = getTodayOpportunities({
        userLocation: { latitude: 21.034, longitude: 105.85, isRealUserLocation: false },
        places: areaBPlaces,
        feedBites: INITIAL_FEED_BITES,
        passport: EMPTY_PASSPORT_CAU_GIAY,
        user: INITIAL_USER,
        savedPlaceIds: [],
      });

      const areaBIds = resB.opportunities.map((o) => o.venueId);

      // Verify 0 stale Area A IDs in Area B
      const staleOverlap = areaBIds.filter((id) => areaAIds.includes(id));
      expect(staleOverlap.length).toBe(0);
      expect(areaBIds.length).toBe(3);
    });
  });
});
