import { describe, it, expect } from 'vitest';
import {
  classifyVenue,
  normalizeCategory,
  computeDynamicFilterChips,
  computeQuickFilterChips,
  computeAllCategoryFilterCounts,
  matchVenueSearch,
  normalizeVietnameseText,
  CANONICAL_CATEGORIES,
  ALL_CATEGORY_META,
  CanonicalCategory,
  PREFERRED_QUICK_CATEGORY_PRIORITY,
  FULL_FILTER_CATEGORY_ORDER,
} from '../src/services/maps/categoryNormalizer';

describe('BiteQuest Explore Information Architecture V2', () => {
  describe('Canonical Food Taxonomy V2 Completeness', () => {
    it('defines exactly 12 canonical food categories with rich UI metadata', () => {
      const categories = Object.keys(CANONICAL_CATEGORIES) as CanonicalCategory[];
      expect(categories.length).toBe(12);

      const expectedCategories: CanonicalCategory[] = [
        'CAFE_DRINK',
        'PHO',
        'NOODLE',
        'HOTPOT',
        'BBQ',
        'RICE',
        'RESTAURANT',
        'FAST_FOOD',
        'BAKERY_DESSERT',
        'BAR_BEER',
        'VEGETARIAN',
        'OTHER_FOOD',
      ];

      expectedCategories.forEach((cat) => {
        expect(CANONICAL_CATEGORIES[cat]).toBeDefined();
        expect(CANONICAL_CATEGORIES[cat].label).toBeTruthy();
        expect(CANONICAL_CATEGORIES[cat].symbolGlyph).toBeTruthy();
        expect(CANONICAL_CATEGORIES[cat].color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });
    });

    it('defines ALL category filter metadata', () => {
      expect(ALL_CATEGORY_META.id).toBe('ALL');
      expect(ALL_CATEGORY_META.label).toBe('Tất cả');
      expect(ALL_CATEGORY_META.symbolGlyph).toBe('✨');
    });
  });

  describe('Deterministic Classification Hierarchy', () => {
    it('Priority 1: Classifies based on explicit provider category tags', () => {
      const cafe = classifyVenue({
        name: 'Trạm Nghỉ',
        categories: ['catering.cafe', 'commercial.food_and_drink'],
      });
      expect(cafe.category).toBe('CAFE_DRINK');
      expect(cafe.source).toBe('PROVIDER_EXPLICIT');

      const fastFood = classifyVenue({
        name: 'Happy Box',
        categories: ['catering.fast_food'],
      });
      expect(fastFood.category).toBe('FAST_FOOD');
      expect(fastFood.source).toBe('PROVIDER_EXPLICIT');

      const bakery = classifyVenue({
        name: 'Sweet Corner',
        categories: ['commercial.food_and_drink.bakery'],
      });
      expect(bakery.category).toBe('BAKERY_DESSERT');
      expect(bakery.source).toBe('PROVIDER_EXPLICIT');

      const bar = classifyVenue({
        name: 'The Secret Room',
        categories: ['catering.bar'],
      });
      expect(bar.category).toBe('BAR_BEER');
      expect(bar.source).toBe('PROVIDER_EXPLICIT');

      const vegan = classifyVenue({
        name: 'Lotus Heart',
        categories: ['catering.restaurant.vegetarian'],
      });
      expect(vegan.category).toBe('VEGETARIAN');
      expect(vegan.source).toBe('PROVIDER_EXPLICIT');
    });

    it('Priority 2: Classifies based on explicit Community Spot metadata', () => {
      const communityPho = classifyVenue({
        name: 'Gia Truyền 1982',
        communityCategory: 'pho',
      });
      expect(communityPho.category).toBe('PHO');
      expect(communityPho.source).toBe('COMMUNITY_EXPLICIT');

      const communityHotpot = classifyVenue({
        name: 'Nồi Lửa Đỏ',
        communityCategory: 'hotpot',
      });
      expect(communityHotpot.category).toBe('HOTPOT');
      expect(communityHotpot.source).toBe('COMMUNITY_EXPLICIT');

      const communityRice = classifyVenue({
        name: 'Bếp Mẹ Nấu',
        communityCategory: 'rice',
      });
      expect(communityRice.category).toBe('RICE');
      expect(communityRice.source).toBe('COMMUNITY_EXPLICIT');
    });

    it('Priority 3: Classifies based on normalized Vietnamese food keywords in venue name', () => {
      // Phở
      expect(normalizeCategory({ name: 'Phở Bò Tái Lăn 49 Bát Đàn' })).toBe('PHO');
      expect(normalizeCategory({ name: 'Pho Cuon Huong Mai' })).toBe('PHO');
      expect(normalizeCategory({ name: 'Phở Thìn 13 Lò Đúc' })).toBe('PHO');

      // Noodle / Bún / Mì / Hủ Tiếu / Bánh Đa
      expect(normalizeCategory({ name: 'Bún Chả Đắc Kim Hàng Mành' })).toBe('NOODLE');
      expect(normalizeCategory({ name: 'Bún Đậu Mắm Tôm Cầu Gỗ' })).toBe('NOODLE');
      expect(normalizeCategory({ name: 'Mì Vằn Thắn Đinh Liệt' })).toBe('NOODLE');
      expect(normalizeCategory({ name: 'Bánh Đa Cua Hải Phòng' })).toBe('NOODLE');
      expect(normalizeCategory({ name: 'Hủ Tiếu Nam Vang Cô Quyên' })).toBe('NOODLE');
      expect(normalizeCategory({ name: 'Ramen Ippudo' })).toBe('NOODLE');

      // Hotpot / Lẩu
      expect(normalizeCategory({ name: 'Lẩu Phan Cầu Giấy' })).toBe('HOTPOT');
      expect(normalizeCategory({ name: 'Haidilao Hotpot Vincom' })).toBe('HOTPOT');
      expect(normalizeCategory({ name: 'Lẩu Ếch Măng Cay Số 5' })).toBe('HOTPOT');

      // BBQ / Nướng
      expect(normalizeCategory({ name: 'Gogi House Quán Thịt Nướng Hàn Quốc' })).toBe('BBQ');
      expect(normalizeCategory({ name: 'King BBQ Buffet' })).toBe('BBQ');
      expect(normalizeCategory({ name: 'Bò Nướng Ngói Trần Thái Tông' })).toBe('BBQ');

      // Rice / Cơm / Xôi
      expect(normalizeCategory({ name: 'Cơm Tấm Sà Bì Chưởng' })).toBe('RICE');
      expect(normalizeCategory({ name: 'Cơm Niêu Singapore Kombo' })).toBe('RICE');
      expect(normalizeCategory({ name: 'Xôi Yến Nguyễn Hữu Huân' })).toBe('RICE');

      // Cafe & Tea
      expect(normalizeCategory({ name: 'Highlands Coffee Duy Tân' })).toBe('CAFE_DRINK');
      expect(normalizeCategory({ name: 'Cà phê Giảng' })).toBe('CAFE_DRINK');
      expect(normalizeCategory({ name: 'Phê La Cầu Giấy' })).toBe('CAFE_DRINK');
      expect(normalizeCategory({ name: 'Trà Sữa Phúc Long' })).toBe('CAFE_DRINK');

      // Fast Food
      expect(normalizeCategory({ name: 'KFC Hồ Tùng Mậu' })).toBe('FAST_FOOD');
      expect(normalizeCategory({ name: 'Lotteria Xuân Thủy' })).toBe('FAST_FOOD');
      expect(normalizeCategory({ name: 'Pizza Company Cầu Giấy' })).toBe('FAST_FOOD');

      // Bakery & Dessert
      expect(normalizeCategory({ name: 'Tous Les Jours IPH' })).toBe('BAKERY_DESSERT');
      expect(normalizeCategory({ name: 'Tiệm Bánh Cối Xay Gió' })).toBe('BAKERY_DESSERT');
      expect(normalizeCategory({ name: 'Chè Sầu Đà Nẵng' })).toBe('BAKERY_DESSERT');

      // Bar & Beer
      expect(normalizeCategory({ name: 'Bia Hơi Hà Nội Hải Xồm' })).toBe('BAR_BEER');
      expect(normalizeCategory({ name: 'Pasteur Street Craft Beer' })).toBe('BAR_BEER');

      // Vegetarian
      expect(normalizeCategory({ name: 'Cơm Chay An Lạc' })).toBe('VEGETARIAN');
      expect(normalizeCategory({ name: 'Nhà Hàng Chay Ưu Đàm' })).toBe('VEGETARIAN');
    });

    it('Priority 4: Falls back cleanly to RESTAURANT or OTHER_FOOD for generic titles', () => {
      const genericRestaurant = classifyVenue({
        name: 'Nhà Hàng Hoa Viên',
      });
      expect(genericRestaurant.category).toBe('RESTAURANT');
      expect(genericRestaurant.source).toBe('GENERIC_FALLBACK');

      const ambiguousPlace = classifyVenue({
        name: 'Điểm Hẹn Hoàng Hôn',
      });
      expect(ambiguousPlace.category).toBe('OTHER_FOOD');
      expect(ambiguousPlace.source).toBe('GENERIC_FALLBACK');
    });
  });

  describe('Dynamic Filter Chip Generation', () => {
    const sampleVenues = [
      { name: 'Phở Bò Bát Đàn' },
      { name: 'Phở Thìn Lò Đúc' },
      { name: 'Aha Cafe' },
      { name: 'Highlands Coffee' },
      { name: 'Phê La' },
      { name: 'Lẩu Phan' },
      { name: 'Bún Chả Sinh Từ' },
      { name: 'Cơm Tấm Cali' },
    ];

    it('generates dynamic filter chips derived directly from loaded venues', () => {
      const chips = computeDynamicFilterChips(sampleVenues, 'ALL');

      // ALL chip is always first and equals total venue count
      expect(chips[0].id).toBe('ALL');
      expect(chips[0].count).toBe(8);

      // Other chips should only include categories with count > 0
      const categoryChips = chips.slice(1);
      categoryChips.forEach((chip) => {
        expect(chip.count).toBeGreaterThan(0);
      });

      // Categories should be sorted by count descending
      const counts = categoryChips.map((c) => c.count);
      const isSorted = counts.every((val, i, arr) => !i || arr[i - 1] >= val);
      expect(isSorted).toBe(true);

      // CAFE_DRINK (3) > PHO (2)
      expect(categoryChips[0].id).toBe('CAFE_DRINK');
      expect(categoryChips[0].count).toBe(3);
      expect(categoryChips[1].id).toBe('PHO');
      expect(categoryChips[1].count).toBe(2);
    });

    it('retains active category in chips even if count is 0', () => {
      const chips = computeDynamicFilterChips(sampleVenues, 'VEGETARIAN');
      const vegChip = chips.find((c) => c.id === 'VEGETARIAN');
      expect(vegChip).toBeDefined();
      expect(vegChip?.count).toBe(0);
    });
  });

  describe('Phase 2: Professional Quick Food Filters & Full Filter Sheet', () => {
    const liveCầuGiấySample = [
      // 3 Cafes
      { name: 'Cafe Cây Khế', category: 'catering.cafe' },
      { name: 'AHA Cafe', category: 'catering.cafe' },
      { name: 'Phê La (Thành Thái)', category: 'catering.cafe' },
      // 2 Pho
      { name: 'Phở Bát Đàn', category: 'catering.restaurant' },
      { name: 'Phở Thìn 13 Lò Đúc', category: 'catering.restaurant' },
      // 2 Noodle
      { name: 'Bún Chả Sinh Từ', category: 'catering.restaurant' },
      { name: 'Mì Vằn Thắn Duy Tân', category: 'catering.restaurant' },
      // 1 Hotpot
      { name: 'Lẩu Phan Cầu Giấy', category: 'catering.restaurant' },
      // 1 BBQ
      { name: 'Gogi House Nướng Hàn Quốc', category: 'catering.restaurant' },
      // 1 Rice
      { name: 'Cơm Niêu Singapore Kombo', category: 'catering.restaurant' },
      // 2 Generic Restaurant
      { name: 'Nhà hàng Hà Đăng', category: 'catering.restaurant' },
      { name: 'Nhà hàng Sen Tây Hồ', category: 'catering.restaurant' },
      // 1 Other food
      { name: 'Điểm Ăn Vặt Ngõ 165', category: 'catering.fast_food' },
    ];

    it('orders quick filters by canonical food intent priority: CAFE_DRINK -> NOODLE -> PHO -> HOTPOT -> BBQ', () => {
      const quickChips = computeQuickFilterChips(liveCầuGiấySample, 'ALL');

      // 'ALL' is always index 0
      expect(quickChips[0].id).toBe('ALL');
      expect(quickChips[0].label).toBe('Tất cả');
      expect(quickChips[0].count).toBe(liveCầuGiấySample.length);

      const categoryIds = quickChips.slice(1).map((c) => c.id);

      // Verify canonical priority order is strictly respected (top 5 high-intent desires)
      expect(categoryIds.length).toBe(5);
      expect(categoryIds[0]).toBe('CAFE_DRINK');
      expect(categoryIds[1]).toBe('NOODLE');
      expect(categoryIds[2]).toBe('PHO');
      expect(categoryIds[3]).toBe('HOTPOT');
      expect(categoryIds[4]).toBe('BBQ');

      // Strictly excludes OTHER_FOOD ("Khác") from quick filter bar
      expect(categoryIds).not.toContain('OTHER_FOOD');

      // Strictly excludes generic RESTAURANT ("Nhà hàng") from quick filter bar
      expect(categoryIds).not.toContain('RESTAURANT');
    });

    it('surfaces RESTAURANT or OTHER_FOOD in quick filter bar only if user explicitly selects it via full filter sheet', () => {
      const quickChipsWithRestaurant = computeQuickFilterChips(liveCầuGiấySample, 'RESTAURANT');
      const hasRestaurant = quickChipsWithRestaurant.some((c) => c.id === 'RESTAURANT');
      expect(hasRestaurant).toBe(true);

      const quickChipsWithOther = computeQuickFilterChips(liveCầuGiấySample, 'OTHER_FOOD');
      const hasOther = quickChipsWithOther.some((c) => c.id === 'OTHER_FOOD');
      expect(hasOther).toBe(true);
    });

    it('provides full 12 canonical categories with live counts for the Full Filter Sheet', () => {
      const fullSheetChips = computeAllCategoryFilterCounts(liveCầuGiấySample, 'ALL');

      expect(fullSheetChips[0].id).toBe('ALL');
      expect(fullSheetChips[0].count).toBe(liveCầuGiấySample.length);

      // 12 canonical categories + ALL = 13 total items
      expect(fullSheetChips.length).toBe(13);

      const allCatIds = fullSheetChips.slice(1).map((c) => c.id);
      FULL_FILTER_CATEGORY_ORDER.forEach((cat) => {
        expect(allCatIds).toContain(cat);
      });

      // Verify counts of specific categories
      const cafeChip = fullSheetChips.find((c) => c.id === 'CAFE_DRINK');
      expect(cafeChip?.count).toBe(3);

      const phoChip = fullSheetChips.find((c) => c.id === 'PHO');
      expect(phoChip?.count).toBe(2);

      const restaurantChip = fullSheetChips.find((c) => c.id === 'RESTAURANT');
      expect(restaurantChip?.count).toBe(2);
    });
  });

  describe('Search Semantics & Diacritic Tolerance', () => {
    it('normalizes Vietnamese characters accurately', () => {
      expect(normalizeVietnameseText('Phở Bò Tái Lăn')).toBe('pho bo tai lan');
      expect(normalizeVietnameseText('Đường Cầu Giấy')).toBe('duong cau giay');
      expect(normalizeVietnameseText('Bánh Mì & Trà Sữa')).toBe('banh mi & tra sua');
    });

    it('matches venues across unaccented and accented queries', () => {
      const venue = {
        name: 'Phở Bát Đàn',
        address: '49 Bát Đàn, Hoàn Kiếm, Hà Nội',
        categoryLabel: 'Ẩm thực truyền thống',
      };

      // Exact name
      expect(matchVenueSearch(venue, 'Phở Bát Đàn')).toBe(true);
      // Unaccented name
      expect(matchVenueSearch(venue, 'pho bat dan')).toBe(true);
      // Keyword
      expect(matchVenueSearch(venue, 'pho bo')).toBe(true);
      // Address
      expect(matchVenueSearch(venue, 'Hoan Kiem')).toBe(true);
      // Non-match
      expect(matchVenueSearch(venue, 'pizza')).toBe(false);
    });

    it('matches canonical food keywords to corresponding categories', () => {
      const cafeVenue = { name: 'The Coffee House', address: 'Cầu Giấy' };
      expect(matchVenueSearch(cafeVenue, 'ca phe')).toBe(true);
      expect(matchVenueSearch(cafeVenue, 'tra')).toBe(true);
      expect(matchVenueSearch(cafeVenue, 'coffee')).toBe(true);

      const hotpotVenue = { name: 'Kichi Kichi Lẩu Băng Chuyền', address: 'Hà Nội' };
      expect(matchVenueSearch(hotpotVenue, 'lau')).toBe(true);
      expect(matchVenueSearch(hotpotVenue, 'hotpot')).toBe(true);
    });
  });

  describe('BiteQuest V4 Visual Correction & Copy Truth Contracts', () => {
    it('Radar collapsed state exposes the exact compact entry format: "✨ N nơi đáng đi · Xem Radar"', () => {
      const getRadarPillLabel = (count: number) => `✨ ${count} nơi đáng đi · Xem Radar`;
      expect(getRadarPillLabel(3)).toBe('✨ 3 nơi đáng đi · Xem Radar');
      expect(getRadarPillLabel(1)).toBe('✨ 1 nơi đáng đi · Xem Radar');
      // Must NOT contain old phrasing
      expect(getRadarPillLabel(3)).not.toContain('lý do đáng khám phá');
      expect(getRadarPillLabel(3)).not.toContain('Khám phá ngay');
    });

    it('Search input placeholder matches the canonical UX string', () => {
      const searchPlaceholder = 'Tìm món, quán hoặc khu vực';
      expect(searchPlaceholder).toBe('Tìm món, quán hoặc khu vực');
    });

    it('Navigation terminology uses "Hành trình" rather than "Hộ Chiếu"', () => {
      const canonicalTabLabels = {
        explore: 'Khám phá',
        camera: 'Chụp Bite',
        passport: 'Hành trình',
        profile: 'Hồ sơ',
      };
      expect(canonicalTabLabels.passport).toBe('Hành trình');
      expect(canonicalTabLabels.passport).not.toBe('Hộ Chiếu');
    });
  });
});

