export type CanonicalCategory =
  | 'CAFE_DRINK'
  | 'PHO'
  | 'NOODLE'
  | 'HOTPOT'
  | 'BBQ'
  | 'RICE'
  | 'RESTAURANT'
  | 'FAST_FOOD'
  | 'BAKERY_DESSERT'
  | 'BAR_BEER'
  | 'VEGETARIAN'
  | 'OTHER_FOOD';

export type ExploreFilterCategory = 'ALL' | CanonicalCategory;

export type ClassificationSource =
  | 'PROVIDER_EXPLICIT'
  | 'COMMUNITY_EXPLICIT'
  | 'NAME_KEYWORD'
  | 'GENERIC_FALLBACK';

export interface ClassificationResult {
  category: CanonicalCategory;
  source: ClassificationSource;
  confidence: number;
}

export interface CategoryMetadata {
  id: CanonicalCategory;
  label: string;
  shortLabel: string;
  iconName: string;
  symbolGlyph: string; // unicode / emoji for fallback
  color: string;       // Primary brand/badge color
  bgColor: string;     // Pill background
  textColor: string;   // Text color
  borderColor: string; // Border color
}

export const ALL_CATEGORY_META = {
  id: 'ALL' as const,
  label: 'Tất cả',
  shortLabel: 'Tất cả',
  iconName: 'icon-all',
  symbolGlyph: '✨',
  color: '#FF6B35',
  bgColor: '#FFF5EB',
  textColor: '#2D2926',
  borderColor: '#FF6B35',
};

export const CANONICAL_CATEGORIES: Record<CanonicalCategory, CategoryMetadata> = {
  CAFE_DRINK: {
    id: 'CAFE_DRINK',
    label: 'Cà phê & Trà',
    shortLabel: 'Cà phê',
    iconName: 'icon-cafe_drink',
    symbolGlyph: '☕',
    color: '#78350F', // warm amber-900 / coffee brown
    bgColor: '#F5EBE6',
    textColor: '#593219',
    borderColor: '#8D5B4C',
  },
  PHO: {
    id: 'PHO',
    label: 'Phở',
    shortLabel: 'Phở',
    iconName: 'icon-pho',
    symbolGlyph: '🍜',
    color: '#B45309', // amber-700
    bgColor: '#FEF3C7',
    textColor: '#92400E',
    borderColor: '#F59E0B',
  },
  NOODLE: {
    id: 'NOODLE',
    label: 'Bún / Mì',
    shortLabel: 'Bún/Mì',
    iconName: 'icon-noodle',
    symbolGlyph: '🥢',
    color: '#EA580C', // orange-600
    bgColor: '#FFEDD5',
    textColor: '#9A3412',
    borderColor: '#F97316',
  },
  HOTPOT: {
    id: 'HOTPOT',
    label: 'Lẩu',
    shortLabel: 'Lẩu',
    iconName: 'icon-hotpot',
    symbolGlyph: '🍲',
    color: '#DC2626', // red-600
    bgColor: '#FEE2E2',
    textColor: '#991B1B',
    borderColor: '#EF4444',
  },
  BBQ: {
    id: 'BBQ',
    label: 'Nướng',
    shortLabel: 'Nướng',
    iconName: 'icon-bbq',
    symbolGlyph: '🔥',
    color: '#C2410C', // orange-700
    bgColor: '#FFEDD5',
    textColor: '#9A3412',
    borderColor: '#FB923C',
  },
  RICE: {
    id: 'RICE',
    label: 'Cơm',
    shortLabel: 'Cơm',
    iconName: 'icon-rice',
    symbolGlyph: '🍚',
    color: '#D97706', // amber-600
    bgColor: '#FEF9C3',
    textColor: '#854D0E',
    borderColor: '#FACC15',
  },
  RESTAURANT: {
    id: 'RESTAURANT',
    label: 'Nhà hàng',
    shortLabel: 'Nhà hàng',
    iconName: 'icon-restaurant',
    symbolGlyph: '🍴',
    color: '#0284C7', // sky-600
    bgColor: '#E0F2FE',
    textColor: '#0369A1',
    borderColor: '#38BDF8',
  },
  FAST_FOOD: {
    id: 'FAST_FOOD',
    label: 'Fast food',
    shortLabel: 'Fast food',
    iconName: 'icon-fast_food',
    symbolGlyph: '🍔',
    color: '#E11D48', // rose-600
    bgColor: '#FFE4E6',
    textColor: '#9F1239',
    borderColor: '#FB7185',
  },
  BAKERY_DESSERT: {
    id: 'BAKERY_DESSERT',
    label: 'Bánh & Đồ ngọt',
    shortLabel: 'Bánh',
    iconName: 'icon-bakery_dessert',
    symbolGlyph: '🍰',
    color: '#DB2777', // pink-600
    bgColor: '#FCE7F3',
    textColor: '#9D174D',
    borderColor: '#EC4899',
  },
  BAR_BEER: {
    id: 'BAR_BEER',
    label: 'Bar / Bia',
    shortLabel: 'Bar/Bia',
    iconName: 'icon-bar_beer',
    symbolGlyph: '🍺',
    color: '#7C3AED', // violet-600
    bgColor: '#EDE9FE',
    textColor: '#5B21B6',
    borderColor: '#8B5CF6',
  },
  VEGETARIAN: {
    id: 'VEGETARIAN',
    label: 'Chay',
    shortLabel: 'Chay',
    iconName: 'icon-vegetarian',
    symbolGlyph: '🌱',
    color: '#16A34A', // green-600
    bgColor: '#DCFCE7',
    textColor: '#166534',
    borderColor: '#4ADE80',
  },
  OTHER_FOOD: {
    id: 'OTHER_FOOD',
    label: 'Khác',
    shortLabel: 'Khác',
    iconName: 'icon-other_food',
    symbolGlyph: '🍽️',
    color: '#52525B', // zinc-600
    bgColor: '#F4F4F5',
    textColor: '#27272A',
    borderColor: '#71717A',
  },
};

/**
 * Normalizes Vietnamese text by stripping accents and standardizing whitespace.
 */
export function normalizeVietnameseText(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deterministic venue classifier for Canonical Food Taxonomy V2.
 *
 * Evaluation Hierarchy:
 * 1. Explicit Provider Categories (Priority 1) -> PROVIDER_EXPLICIT
 * 2. Explicit Community Category (Priority 2) -> COMMUNITY_EXPLICIT
 * 3. Normalized Name Keywords (Priority 3) -> NAME_KEYWORD
 * 4. Generic Parent Fallback (Priority 4) -> GENERIC_FALLBACK
 */
export function classifyVenue(venue: {
  name?: string;
  category?: string;
  categoryLabel?: string;
  categories?: string[];
  communityCategory?: string;
}): ClassificationResult {
  const name = (venue.name || '').trim();
  const normName = normalizeVietnameseText(name);
  const rawCat = (venue.category || '').toLowerCase().trim();
  const rawLabel = (venue.categoryLabel || '').toLowerCase().trim();
  const rawList = Array.isArray(venue.categories) ? venue.categories.map((c) => String(c).toLowerCase().trim()) : [];
  const commCat = (venue.communityCategory || '').toLowerCase().trim();

  // 1. Explicit Provider Categories (Priority 1)
  if (rawList.some((c) => c.includes('catering.cafe') || c.includes('coffee') || c.includes('tea'))) {
    return { category: 'CAFE_DRINK', source: 'PROVIDER_EXPLICIT', confidence: 0.95 };
  }
  if (rawList.some((c) => c.includes('catering.fast_food') || c.includes('burger'))) {
    return { category: 'FAST_FOOD', source: 'PROVIDER_EXPLICIT', confidence: 0.95 };
  }
  if (rawList.some((c) => c.includes('bakery') || c.includes('confectionery') || c.includes('ice_cream') || c.includes('dessert'))) {
    return { category: 'BAKERY_DESSERT', source: 'PROVIDER_EXPLICIT', confidence: 0.95 };
  }
  if (rawList.some((c) => c.includes('catering.bar') || c.includes('catering.pub') || c.includes('nightclub'))) {
    return { category: 'BAR_BEER', source: 'PROVIDER_EXPLICIT', confidence: 0.95 };
  }
  if (rawList.some((c) => c.includes('vegetarian') || c.includes('vegan'))) {
    return { category: 'VEGETARIAN', source: 'PROVIDER_EXPLICIT', confidence: 0.95 };
  }

  // 2. Explicit Community Category (Priority 2)
  if (commCat) {
    if (commCat === 'cafe' || commCat === 'coffee' || commCat === 'tea') return { category: 'CAFE_DRINK', source: 'COMMUNITY_EXPLICIT', confidence: 0.90 };
    if (commCat === 'pho') return { category: 'PHO', source: 'COMMUNITY_EXPLICIT', confidence: 0.90 };
    if (commCat === 'noodles' || commCat === 'noodle') return { category: 'NOODLE', source: 'COMMUNITY_EXPLICIT', confidence: 0.90 };
    if (commCat === 'hotpot' || commCat === 'lau') return { category: 'HOTPOT', source: 'COMMUNITY_EXPLICIT', confidence: 0.90 };
    if (commCat === 'bbq' || commCat === 'nuong') return { category: 'BBQ', source: 'COMMUNITY_EXPLICIT', confidence: 0.90 };
    if (commCat === 'rice' || commCat === 'com') return { category: 'RICE', source: 'COMMUNITY_EXPLICIT', confidence: 0.90 };
    if (commCat === 'fast_food' || commCat === 'burger_western') return { category: 'FAST_FOOD', source: 'COMMUNITY_EXPLICIT', confidence: 0.90 };
    if (commCat === 'dessert' || commCat === 'bakery') return { category: 'BAKERY_DESSERT', source: 'COMMUNITY_EXPLICIT', confidence: 0.90 };
    if (commCat === 'bar' || commCat === 'beer') return { category: 'BAR_BEER', source: 'COMMUNITY_EXPLICIT', confidence: 0.90 };
    if (commCat === 'vegetarian' || commCat === 'vegan') return { category: 'VEGETARIAN', source: 'COMMUNITY_EXPLICIT', confidence: 0.90 };
    if (commCat === 'restaurant') return { category: 'RESTAURANT', source: 'COMMUNITY_EXPLICIT', confidence: 0.90 };
  }

  // 3. Normalized Name Keywords (Priority 3)
  // Specific dietary and food specialties take priority over generic words

  // VEGETARIAN (Chay / Vegan) - Evaluated first so "Cơm Chay", "Lẩu Chay", "Phở Chay" correctly classify as VEGETARIAN
  if (
    /(?:^|[\s,./\-_(])(chay|vegan|vegetarian|thuc\s+duong|an\s+chay|quan\s+chay|com\s+chay|lau\s+chay|pho\s+chay)(?:$|[\s,./\-_)])/i.test(normName) ||
    /(?:^|[\s,./\-_(])(chay)(?:$|[\s,./\-_)])/i.test(name)
  ) {
    return { category: 'VEGETARIAN', source: 'NAME_KEYWORD', confidence: 0.85 };
  }

  // PHO (Distinct from general noodle)
  if (
    /(?:^|[\s,./\-_(])(pho|pho\s+bo|pho\s+ga|pho\s+cuon|pho\s+tron|pho\s+thin|pho\s+10|pho\s+ly\s+quoc\s+su|pho\s+bat\s+dan|pho\s+gia\s+truyen)(?:$|[\s,./\-_)])/i.test(normName) ||
    /(?:^|[\s,./\-_(])(phở)(?:$|[\s,./\-_)])/i.test(name)
  ) {
    return { category: 'PHO', source: 'NAME_KEYWORD', confidence: 0.85 };
  }

  // NOODLE (Bún / Mì / Hủ tiếu / Miến / Bánh đa / Bánh canh / Ramen / Udon)
  if (
    /(?:^|[\s,./\-_(])(bun|mi|my|ramen|udon|soba|hu\s+tieu|banh\s+da|mien|banh\s+canh|bun\s+cha|bun\s+dau|bun\s+ca|bun\s+bo|bun\s+rieu|bun\s+thang|bun\s+moc|mi\s+van\s+than|mi\s+cay|mi\s+quang|mi\s+xao|banh\s+da\s+cua)(?:$|[\s,./\-_)])/i.test(normName) ||
    /(?:^|[\s,./\-_(])(bún|mì|mỳ|hủ tiếu|bánh đa|miến|bánh canh)(?:$|[\s,./\-_)])/i.test(name)
  ) {
    return { category: 'NOODLE', source: 'NAME_KEYWORD', confidence: 0.85 };
  }

  // HOTPOT (Lẩu)
  if (
    /(?:^|[\s,./\-_(])(lau|hotpot|kichi|manwah|haidilao|hutong|lau\s+ech|lau\s+nam|lau\s+thai|lau\s+rieu)(?:$|[\s,./\-_)])/i.test(normName) ||
    /(?:^|[\s,./\-_(])(lẩu)(?:$|[\s,./\-_)])/i.test(name)
  ) {
    return { category: 'HOTPOT', source: 'NAME_KEYWORD', confidence: 0.85 };
  }

  // BBQ (Nướng)
  if (
    /(?:^|[\s,./\-_(])(nuong|bbq|barbecue|grill|yakiniku|gogi|king\s+bbq|sumo\s+bbq|bo\s+nuong|thit\s+nuong|chan\s+ga\s+nuong)(?:$|[\s,./\-_)])/i.test(normName) ||
    /(?:^|[\s,./\-_(])(nướng)(?:$|[\s,./\-_)])/i.test(name)
  ) {
    return { category: 'BBQ', source: 'NAME_KEYWORD', confidence: 0.85 };
  }

  // RICE (Cơm / Xôi)
  if (
    /(?:^|[\s,./\-_(])(com|com\s+tam|com\s+rang|com\s+ga|com\s+nieu|com\s+van\s+phong|com\s+suon|com\s+binh\s+dan|xoi)(?:$|[\s,./\-_)])/i.test(normName) ||
    /(?:^|[\s,./\-_(])(cơm|xôi)(?:$|[\s,./\-_)])/i.test(name)
  ) {
    return { category: 'RICE', source: 'NAME_KEYWORD', confidence: 0.85 };
  }

  // CAFE_DRINK (Cà phê & Trà)
  if (
    /(?:^|[\s,./\-_(])(cafe|cafe|coffee|ca\s+phe|caphe|tra|tea|tra\s+sua|milktea|milk\s+tea|matcha|espresso|highlands|starbucks|phuc\s+long|the\s+coffee\s+house|aha\s+cafe|katinat|cong\s+caphe|gemini|all\s+day\s+coffee|coffe|phe\s+la|zamia|tam\s+hoa\s+tra)(?:$|[\s,./\-_)])/i.test(normName) ||
    /(?:^|[\s,./\-_(])(cà phê|trà sữa|trà)(?:$|[\s,./\-_)])/i.test(name)
  ) {
    return { category: 'CAFE_DRINK', source: 'NAME_KEYWORD', confidence: 0.85 };
  }

  // BAKERY_DESSERT (Bánh & Đồ ngọt / Chè / Kem)
  if (
    /(?:^|[\s,./\-_(])(bakery|tiem\s+banh|banh\s+ngot|banh\s+kem|banh\s+sinh\s+nhat|che|kem|ice\s+cream|gelato|patisserie|cake|pastry|tous\s+les\s+jours|paris\s+baguette)(?:$|[\s,./\-_)])/i.test(normName) ||
    /(?:^|[\s,./\-_(])(tiệm bánh|bánh ngọt|chè|kem)(?:$|[\s,./\-_)])/i.test(name)
  ) {
    return { category: 'BAKERY_DESSERT', source: 'NAME_KEYWORD', confidence: 0.85 };
  }

  // BAR_BEER (Bar / Bia)
  if (
    /(?:^|[\s,./\-_(])(bar|pub|beer|bia|bia\s+hoi|lounge|club|craft\s+beer|taproom|vuvuzela|quan\s+bia)(?:$|[\s,./\-_)])/i.test(normName) ||
    /(?:^|[\s,./\-_(])(bia|quán bia)(?:$|[\s,./\-_)])/i.test(name)
  ) {
    return { category: 'BAR_BEER', source: 'NAME_KEYWORD', confidence: 0.85 };
  }

  // FAST_FOOD (Fast food / Burger / Pizza / Gà rán)
  if (
    /(?:^|[\s,./\-_(])(kfc|lotteria|mcdonald|jollibee|burger\s+king|pizza\s+hut|domino|fast\s+food|ga\s+ran|pizza|burger|subway|taco)(?:$|[\s,./\-_)])/i.test(normName) ||
    /(?:^|[\s,./\-_(])(gà rán|fast food)(?:$|[\s,./\-_)])/i.test(name)
  ) {
    return { category: 'FAST_FOOD', source: 'NAME_KEYWORD', confidence: 0.85 };
  }

  // Raw category keywords as additional signals
  const upperCat = (venue.category || '').toUpperCase().trim();
  if (upperCat in CANONICAL_CATEGORIES) {
    return { category: upperCat as CanonicalCategory, source: 'PROVIDER_EXPLICIT', confidence: 0.95 };
  }
  if (rawCat === 'cafe_drink' || rawCat.includes('coffee') || rawCat.includes('cafe')) return { category: 'CAFE_DRINK', source: 'PROVIDER_EXPLICIT', confidence: 0.90 };
  if (rawCat === 'pho') return { category: 'PHO', source: 'PROVIDER_EXPLICIT', confidence: 0.90 };
  if (rawCat === 'noodles' || rawCat === 'noodle') return { category: 'NOODLE', source: 'PROVIDER_EXPLICIT', confidence: 0.90 };
  if (rawCat === 'hotpot' || rawCat === 'lau') return { category: 'HOTPOT', source: 'PROVIDER_EXPLICIT', confidence: 0.90 };
  if (rawCat === 'bbq' || rawCat === 'nuong' || rawCat === 'bbq_hotpot') return { category: 'BBQ', source: 'PROVIDER_EXPLICIT', confidence: 0.90 };
  if (rawCat === 'rice' || rawCat === 'com') return { category: 'RICE', source: 'PROVIDER_EXPLICIT', confidence: 0.90 };
  if (rawCat === 'dessert' || rawCat === 'bakery' || rawCat === 'bakery_dessert') return { category: 'BAKERY_DESSERT', source: 'PROVIDER_EXPLICIT', confidence: 0.90 };
  if (rawCat === 'burger_western' || rawCat === 'fast_food') return { category: 'FAST_FOOD', source: 'PROVIDER_EXPLICIT', confidence: 0.90 };
  if (rawCat === 'bar' || rawCat === 'drinks' || rawCat === 'bar_beer' || rawCat === 'beer') return { category: 'BAR_BEER', source: 'PROVIDER_EXPLICIT', confidence: 0.90 };
  if (rawCat === 'vegetarian' || rawCat === 'vegan' || rawCat === 'chay') return { category: 'VEGETARIAN', source: 'PROVIDER_EXPLICIT', confidence: 0.90 };
  if (rawCat === 'restaurant') return { category: 'RESTAURANT', source: 'PROVIDER_EXPLICIT', confidence: 0.90 };
  if (rawCat === 'street_food' || rawCat === 'other_food') return { category: 'OTHER_FOOD', source: 'PROVIDER_EXPLICIT', confidence: 0.90 };

  // 4. Generic Fallback (Priority 4)
  if (
    /(?:^|[\s,./\-_(])(nha\s+hang|quan\s+an|restaurant|bep|kitchen|diner|quan)(?:$|[\s,./\-_)])/i.test(normName) ||
    rawCat === 'restaurant' ||
    rawList.some((c) => c.includes('restaurant') || c.includes('food_court'))
  ) {
    return { category: 'RESTAURANT', source: 'GENERIC_FALLBACK', confidence: 0.50 };
  }

  return { category: 'OTHER_FOOD', source: 'GENERIC_FALLBACK', confidence: 0.40 };
}

/**
 * Deterministic category normalization helper (returns canonical category id).
 */
export function normalizeCategory(venue: {
  name?: string;
  category?: string;
  categoryLabel?: string;
  categories?: string[];
  communityCategory?: string;
}): CanonicalCategory {
  return classifyVenue(venue).category;
}

/**
 * Returns complete UI metadata for a canonical category.
 */
export function getCategoryMetadata(category: CanonicalCategory): CategoryMetadata {
  return CANONICAL_CATEGORIES[category] || CANONICAL_CATEGORIES.OTHER_FOOD;
}

/**
 * Generates an SVG string / Data URL for a category map icon.
 */
export function generateCategoryIconSvg(category: CanonicalCategory, isSelected: boolean = false): string {
  const meta = getCategoryMetadata(category);
  const size = isSelected ? 32 : 24;
  const radius = isSelected ? 14 : 10;
  const strokeColor = '#FFFFFF';
  const strokeWidth = isSelected ? 2.5 : 1.5;
  const bg = isSelected ? '#FF6B35' : meta.color;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.25"/>
      </filter>
    </defs>
    <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="${bg}" stroke="${strokeColor}" stroke-width="${strokeWidth}" filter="url(#shadow)" />
    <text x="${size / 2}" y="${size / 2 + (size === 32 ? 4.5 : 3.5)}" font-size="${size === 32 ? 14 : 10}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif">${meta.symbolGlyph}</text>
  </svg>`;
}

export interface DynamicFilterChip {
  id: ExploreFilterCategory;
  label: string;
  count: number;
  metadata: CategoryMetadata | typeof ALL_CATEGORY_META;
}

/** Canonical quick filter priority list representing high-intent food desires */
export const PREFERRED_QUICK_CATEGORY_PRIORITY: CanonicalCategory[] = [
  'CAFE_DRINK',
  'NOODLE',
  'PHO',
  'HOTPOT',
  'BBQ',
  'RICE',
  'FAST_FOOD',
  'BAKERY_DESSERT',
  'BAR_BEER',
  'VEGETARIAN',
];

/** Full canonical order for complete filter sheet */
export const FULL_FILTER_CATEGORY_ORDER: CanonicalCategory[] = [
  'CAFE_DRINK',
  'PHO',
  'NOODLE',
  'HOTPOT',
  'BBQ',
  'RICE',
  'FAST_FOOD',
  'BAKERY_DESSERT',
  'BAR_BEER',
  'VEGETARIAN',
  'RESTAURANT',
  'OTHER_FOOD',
];

/**
 * Computes dynamic category filter chips derived strictly from the currently loaded venues in the active area.
 * - 'ALL' is always index 0 with total venue count.
 * - Categories with count > 0 (or currently selected) are included.
 * - Sorted by count descending.
 */
export function computeDynamicFilterChips(
  venues: Array<{
    name?: string;
    category?: string;
    categoryLabel?: string;
    categories?: string[];
    communityCategory?: string;
  }>,
  activeFilter: ExploreFilterCategory = 'ALL'
): DynamicFilterChip[] {
  const counts: Record<CanonicalCategory, number> = {
    CAFE_DRINK: 0,
    PHO: 0,
    NOODLE: 0,
    HOTPOT: 0,
    BBQ: 0,
    RICE: 0,
    RESTAURANT: 0,
    FAST_FOOD: 0,
    BAKERY_DESSERT: 0,
    BAR_BEER: 0,
    VEGETARIAN: 0,
    OTHER_FOOD: 0,
  };

  for (const v of venues) {
    const cat = normalizeCategory(v);
    if (counts[cat] !== undefined) {
      counts[cat]++;
    } else {
      counts.OTHER_FOOD++;
    }
  }

  const allChip: DynamicFilterChip = {
    id: 'ALL',
    label: 'Tất cả',
    count: venues.length,
    metadata: ALL_CATEGORY_META,
  };

  const categoryKeys = Object.keys(CANONICAL_CATEGORIES) as CanonicalCategory[];
  const activeChips: DynamicFilterChip[] = categoryKeys
    .filter((cat) => counts[cat] > 0 || activeFilter === cat)
    .map((cat) => ({
      id: cat,
      label: CANONICAL_CATEGORIES[cat].label,
      count: counts[cat],
      metadata: CANONICAL_CATEGORIES[cat],
    }))
    .sort((a, b) => b.count - a.count);

  return [allChip, ...activeChips];
}

/**
 * Computes consumer-facing Quick Food Filters for the primary top navigation bar.
 * Invariants:
 * - 'ALL' ("Tất cả") is always index 0.
 * - Canonical priority order: CAFE_DRINK, NOODLE, PHO, HOTPOT, BBQ, then other specialized food types.
 * - Strictly excludes 'OTHER_FOOD' ("Khác") from the primary quick row.
 * - Strictly excludes generic 'RESTAURANT' ("Nhà hàng") unless it is currently selected.
 * - Only includes categories that have count > 0 in current live dataset (or if currently selected).
 */
export function computeQuickFilterChips(
  venues: Array<{
    name?: string;
    category?: string;
    categoryLabel?: string;
    categories?: string[];
    communityCategory?: string;
  }>,
  activeFilter: ExploreFilterCategory = 'ALL'
): DynamicFilterChip[] {
  const counts: Record<CanonicalCategory, number> = {
    CAFE_DRINK: 0,
    PHO: 0,
    NOODLE: 0,
    HOTPOT: 0,
    BBQ: 0,
    RICE: 0,
    RESTAURANT: 0,
    FAST_FOOD: 0,
    BAKERY_DESSERT: 0,
    BAR_BEER: 0,
    VEGETARIAN: 0,
    OTHER_FOOD: 0,
  };

  for (const v of venues) {
    const cat = normalizeCategory(v);
    if (counts[cat] !== undefined) {
      counts[cat]++;
    } else {
      counts.OTHER_FOOD++;
    }
  }

  const allChip: DynamicFilterChip = {
    id: 'ALL',
    label: 'Tất cả',
    count: venues.length,
    metadata: ALL_CATEGORY_META,
  };

  // Build concise quick list following canonical food intent order (top 5 primary food desires)
  const quickList: DynamicFilterChip[] = [];
  const maxPrimaryQuickIntents = 5;

  for (const cat of PREFERRED_QUICK_CATEGORY_PRIORITY) {
    if (counts[cat] > 0) {
      quickList.push({
        id: cat,
        label: CANONICAL_CATEGORIES[cat].shortLabel || CANONICAL_CATEGORIES[cat].label,
        count: counts[cat],
        metadata: CANONICAL_CATEGORIES[cat],
      });
      if (quickList.length >= maxPrimaryQuickIntents) {
        break;
      }
    }
  }

  // If the active filter is set to a non-ALL category that is not in the top 5, surface it so its active state is visible
  if (activeFilter !== 'ALL' && !quickList.some((c) => c.id === activeFilter)) {
    const cat = activeFilter as CanonicalCategory;
    if (CANONICAL_CATEGORIES[cat]) {
      quickList.push({
        id: cat,
        label: CANONICAL_CATEGORIES[cat].shortLabel || CANONICAL_CATEGORIES[cat].label,
        count: counts[cat] || 0,
        metadata: CANONICAL_CATEGORIES[cat],
      });
    }
  }

  return [allChip, ...quickList];
}

/**
 * Computes category counts for all 12 canonical categories for the Full Filter Sheet.
 */
export function computeAllCategoryFilterCounts(
  venues: Array<{
    name?: string;
    category?: string;
    categoryLabel?: string;
    categories?: string[];
    communityCategory?: string;
  }>,
  activeFilter: ExploreFilterCategory = 'ALL'
): DynamicFilterChip[] {
  const counts: Record<CanonicalCategory, number> = {
    CAFE_DRINK: 0,
    PHO: 0,
    NOODLE: 0,
    HOTPOT: 0,
    BBQ: 0,
    RICE: 0,
    RESTAURANT: 0,
    FAST_FOOD: 0,
    BAKERY_DESSERT: 0,
    BAR_BEER: 0,
    VEGETARIAN: 0,
    OTHER_FOOD: 0,
  };

  for (const v of venues) {
    const cat = normalizeCategory(v);
    if (counts[cat] !== undefined) {
      counts[cat]++;
    } else {
      counts.OTHER_FOOD++;
    }
  }

  const allChip: DynamicFilterChip = {
    id: 'ALL',
    label: 'Tất cả',
    count: venues.length,
    metadata: ALL_CATEGORY_META,
  };

  const list: DynamicFilterChip[] = FULL_FILTER_CATEGORY_ORDER.map((cat) => ({
    id: cat,
    label: CANONICAL_CATEGORIES[cat].label,
    count: counts[cat],
    metadata: CANONICAL_CATEGORIES[cat],
  }));

  return [allChip, ...list];
}

/**
 * Determines whether a venue matches a user search query across name, diacritic-tolerant keywords, address, and category.
 */
export function matchVenueSearch(
  venue: {
    name?: string;
    category?: string;
    categoryLabel?: string;
    address?: string;
    categories?: string[];
    communityCategory?: string;
  },
  query: string
): boolean {
  if (!query || !query.trim()) return true;
  const qRaw = query.trim().toLowerCase();
  const qNorm = normalizeVietnameseText(qRaw);

  const venueName = (venue.name || '').trim();
  const normName = normalizeVietnameseText(venueName);
  const venueCatLabel = (venue.categoryLabel || '').trim();
  const normCatLabel = normalizeVietnameseText(venueCatLabel);
  const venueAddress = (venue.address || '').trim();
  const normAddress = normalizeVietnameseText(venueAddress);

  // 1. Direct or normalized name match
  if (venueName.toLowerCase().includes(qRaw) || normName.includes(qNorm)) {
    return true;
  }

  // 2. Direct or normalized address match
  if (venueAddress.toLowerCase().includes(qRaw) || normAddress.includes(qNorm)) {
    return true;
  }

  // 3. Category label match
  if (venueCatLabel.toLowerCase().includes(qRaw) || normCatLabel.includes(qNorm)) {
    return true;
  }

  // 4. Canonical category metadata match
  const classification = classifyVenue(venue);
  const meta = CANONICAL_CATEGORIES[classification.category];
  if (meta) {
    if (
      meta.label.toLowerCase().includes(qRaw) ||
      normalizeVietnameseText(meta.label).includes(qNorm) ||
      meta.shortLabel.toLowerCase().includes(qRaw) ||
      normalizeVietnameseText(meta.shortLabel).includes(qNorm)
    ) {
      return true;
    }
  }

  // 5. Common Vietnamese food keyword equivalents
  if (['cafe', 'coffee', 'ca phe', 'caphe', 'tra', 'tea'].includes(qNorm)) {
    if (classification.category === 'CAFE_DRINK') return true;
  }
  if (['pho', 'pho bo', 'pho ga', 'pho cuon'].includes(qNorm)) {
    if (classification.category === 'PHO') return true;
  }
  if (['bun', 'mi', 'my', 'noodle', 'ramen', 'hu tieu', 'banh da', 'mien'].includes(qNorm)) {
    if (classification.category === 'NOODLE') return true;
  }
  if (['lau', 'hotpot'].includes(qNorm)) {
    if (classification.category === 'HOTPOT') return true;
  }
  if (['nuong', 'bbq', 'grill', 'barbecue'].includes(qNorm)) {
    if (classification.category === 'BBQ') return true;
  }
  if (['com', 'xoi', 'rice'].includes(qNorm)) {
    if (classification.category === 'RICE') return true;
  }
  if (['fast food', 'burger', 'pizza', 'ga ran'].includes(qNorm)) {
    if (classification.category === 'FAST_FOOD') return true;
  }
  if (['banh', 'che', 'kem', 'dessert', 'bakery', 'cake'].includes(qNorm)) {
    if (classification.category === 'BAKERY_DESSERT') return true;
  }
  if (['bar', 'beer', 'bia', 'pub'].includes(qNorm)) {
    if (classification.category === 'BAR_BEER') return true;
  }
  if (['chay', 'vegan', 'vegetarian'].includes(qNorm)) {
    if (classification.category === 'VEGETARIAN') return true;
  }

  return false;
}

/**
 * Canonical Vietnamese label for a category (resolves enums, raw slugs, and labels).
 */
export function getLocalizedCategoryLabel(cat?: string): string {
  if (!cat) return 'Nhà hàng';
  const norm = normalizeCategory({ category: cat });
  return CANONICAL_CATEGORIES[norm]?.label || 'Nhà hàng';
}

/**
 * Short consumer label for a category.
 */
export function getLocalizedCategoryShortLabel(cat?: string): string {
  if (!cat) return 'Nhà hàng';
  const norm = normalizeCategory({ category: cat });
  return CANONICAL_CATEGORIES[norm]?.shortLabel || CANONICAL_CATEGORIES[norm]?.label || 'Nhà hàng';
}

/**
 * Deterministic category semantic matching for Journey challenges and filtering.
 * Directional: Canonical specific challenges (PHO, NOODLE, BBQ, HOTPOT) remain specific.
 * Legacy broad categories ('noodles', 'bbq_hotpot') map downward to compatible sub-categories.
 */
export function doesCategoryMatch(
  venueCat: CanonicalCategory | string,
  targetCat: CanonicalCategory | string
): boolean {
  if (!venueCat || !targetCat) return false;
  const vNorm = normalizeCategory({ category: String(venueCat) });

  // 1. Direct Canonical check: If targetCat is a recognized CanonicalCategory enum (uppercase)
  if (targetCat in CANONICAL_CATEGORIES) {
    return vNorm === targetCat;
  }

  const tStr = String(targetCat).toLowerCase().trim();

  // 2. Legacy broad category expansion (directional downward compatibility)
  if (tStr === 'noodles' || tStr === 'noodle') {
    return vNorm === 'PHO' || vNorm === 'NOODLE';
  }
  if (tStr === 'bbq_hotpot' || tStr === 'hotpot_bbq') {
    return vNorm === 'BBQ' || vNorm === 'HOTPOT';
  }
  if (tStr === 'coffee' || tStr === 'cafe') {
    return vNorm === 'CAFE_DRINK';
  }
  if (tStr === 'dessert' || tStr === 'bakery') {
    return vNorm === 'BAKERY_DESSERT';
  }
  if (tStr === 'rice' || tStr === 'com') {
    return vNorm === 'RICE';
  }
  if (tStr === 'drinks' || tStr === 'bar' || tStr === 'beer') {
    return vNorm === 'BAR_BEER';
  }
  if (tStr === 'burger_western' || tStr === 'fast_food') {
    return vNorm === 'FAST_FOOD';
  }
  if (tStr === 'vegetarian' || tStr === 'vegan' || tStr === 'chay') {
    return vNorm === 'VEGETARIAN';
  }
  if (tStr === 'restaurant') {
    return vNorm === 'RESTAURANT';
  }
  if (tStr === 'street_food' || tStr === 'other_food') {
    return vNorm === 'OTHER_FOOD';
  }

  // 3. Fallback normalization check
  const tNorm = normalizeCategory({ category: String(targetCat) });
  return vNorm === tNorm;
}

