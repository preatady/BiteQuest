import { getDistance } from 'geolib';
import { Place } from '../types';
import { UnifiedPlace } from './maps/types';
import { normalizeCategory, normalizeVietnameseText } from './maps/categoryNormalizer';

export type IntentCategory = 'cafe' | 'food' | 'fast_food' | 'any';
export type IntentVibe = 'chill' | 'noisy' | 'romantic' | 'any';

export interface SearchIntent {
  category: IntentCategory;
  maxDistanceKm: number;
  vibe: IntentVibe;
  confidence?: number;
  source?: 'gemini' | 'rule-fallback';
}

/**
 * Fast client-side rule-based parser fallback for natural language culinary intent
 */
export function parseIntentRuleBasedFallback(rawQuery: string): SearchIntent {
  const norm = normalizeVietnameseText(rawQuery.toLowerCase());

  // 1. Detect Category
  let category: IntentCategory = 'any';
  if (
    norm.includes('cafe') ||
    norm.includes('ca phe') ||
    norm.includes('tra ') ||
    norm.includes('tra sua') ||
    norm.includes('uong') ||
    norm.includes('matcha') ||
    norm.includes('nuoc')
  ) {
    category = 'cafe';
  } else if (
    norm.includes('pho') ||
    norm.includes('bun') ||
    norm.includes('mi ') ||
    norm.includes('com') ||
    norm.includes('lau') ||
    norm.includes('nuong') ||
    norm.includes('an toi') ||
    norm.includes('an trua') ||
    norm.includes('an sang') ||
    norm.includes('do an') ||
    norm.includes('quan an') ||
    norm.includes('nha hang') ||
    norm.includes('hai san') ||
    norm.includes('thit')
  ) {
    category = 'food';
  } else if (
    norm.includes('banh mi') ||
    norm.includes('an vat') ||
    norm.includes('an nhanh') ||
    norm.includes('che ') ||
    norm.includes('kem') ||
    norm.includes('trang mieng') ||
    norm.includes('burger') ||
    norm.includes('xien') ||
    norm.includes('khoai tay')
  ) {
    category = 'fast_food';
  }

  // 2. Detect Distance Constraint
  let maxDistanceKm = 50;
  if (
    norm.includes('dung di xa') ||
    norm.includes('khong di xa') ||
    norm.includes('gan day') ||
    norm.includes('gan day thoi') ||
    norm.includes('quanh day') ||
    norm.includes('gan nha') ||
    norm.includes('di bo') ||
    norm.includes('gan thoi') ||
    norm.includes('ngay gan')
  ) {
    maxDistanceKm = 2.5;
  } else if (norm.includes('1km') || norm.includes('1 km')) {
    maxDistanceKm = 1.0;
  } else if (norm.includes('2km') || norm.includes('2 km')) {
    maxDistanceKm = 2.0;
  } else if (norm.includes('3km') || norm.includes('3 km')) {
    maxDistanceKm = 3.0;
  } else if (norm.includes('5km') || norm.includes('5 km')) {
    maxDistanceKm = 5.0;
  }

  // 3. Detect Vibe
  let vibe: IntentVibe = 'any';
  if (
    norm.includes('chill') ||
    norm.includes('yen tinh') ||
    norm.includes('lam viec') ||
    norm.includes('hoc bai') ||
    norm.includes('nhe nhang') ||
    norm.includes('thoang mat') ||
    norm.includes('view dep') ||
    norm.includes('ngoi ngam')
  ) {
    vibe = 'chill';
  } else if (
    norm.includes('nhon nhip') ||
    norm.includes('dong vui') ||
    norm.includes('nhau') ||
    norm.includes('uong bia') ||
    norm.includes('bia hoi') ||
    norm.includes('tu tap') ||
    norm.includes('quay') ||
    norm.includes('soi dong')
  ) {
    vibe = 'noisy';
  } else if (
    norm.includes('hen ho') ||
    norm.includes('lang man') ||
    norm.includes('date') ||
    norm.includes('nguoi yeu') ||
    norm.includes('2 nguoi') ||
    norm.includes('am cung')
  ) {
    vibe = 'romantic';
  }

  return {
    category,
    maxDistanceKm,
    vibe,
    confidence: 0.8,
    source: 'rule-fallback',
  };
}

/**
 * Checks if a query is a conversational / natural language sentence
 * that warrants AI intent parsing rather than a simple exact place name lookup.
 */
export function isNaturalLanguageQuery(query: string): boolean {
  if (!query) return false;
  const trimmed = query.trim();
  const words = trimmed.split(/\s+/);
  if (words.length >= 3) return true;

  const norm = normalizeVietnameseText(trimmed.toLowerCase());
  const intentTriggers = [
    'chill',
    'muon',
    'thich',
    'tim',
    'di dau',
    'an gi',
    'uong gi',
    'gan day',
    'dung di xa',
    'yen tinh',
    'hen ho',
    'tu tap',
    'gia re',
    'sinh vien',
    'view dep',
    'ngon',
  ];

  return intentTriggers.some((trigger) => norm.includes(trigger));
}

/**
 * Sends user raw text to Gemini server endpoint to parse search intent into strict JSON
 * with fast timeout and deterministic rule-based fallback.
 */
export async function parseSearchIntentWithGemini(query: string): Promise<SearchIntent> {
  if (!query || !query.trim()) {
    return {
      category: 'any',
      maxDistanceKm: 50,
      vibe: 'any',
      confidence: 1,
      source: 'rule-fallback',
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch('/api/search/intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: query.trim() }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();
    if (data && data.intent && typeof data.intent === 'object') {
      const { category, maxDistanceKm, vibe } = data.intent;
      const validCategories: IntentCategory[] = ['cafe', 'food', 'fast_food', 'any'];
      const validVibes: IntentVibe[] = ['chill', 'noisy', 'romantic', 'any'];

      return {
        category: validCategories.includes(category) ? category : 'any',
        maxDistanceKm: typeof maxDistanceKm === 'number' && maxDistanceKm > 0 ? maxDistanceKm : 50,
        vibe: validVibes.includes(vibe) ? vibe : 'any',
        confidence: data.confidence || 0.95,
        source: 'gemini',
      };
    }
  } catch (error) {
    // Graceful fallback to client-side rule engine
  }

  return parseIntentRuleBasedFallback(query);
}

/**
 * Checks if a venue matches the parsed intent category
 */
export function venueMatchesIntentCategory(venue: Place | UnifiedPlace, intentCategory: IntentCategory): boolean {
  if (intentCategory === 'any') return true;

  const canonical = normalizeCategory(venue);

  if (intentCategory === 'cafe') {
    return canonical === 'CAFE_DRINK';
  }

  if (intentCategory === 'food') {
    return [
      'PHO',
      'NOODLE',
      'HOTPOT',
      'BBQ',
      'RICE',
      'RESTAURANT',
      'VEGETARIAN',
      'OTHER_FOOD',
    ].includes(canonical);
  }

  if (intentCategory === 'fast_food') {
    const normName = normalizeVietnameseText(venue.name || '');
    const isQuickBite = /(?:^|[\s,./\-_(])(banh\s+mi|burger|pizza|ga\s+ran|fast\s+food|kfc|lotteria|jollibee|mcdonald|snack|an\s+vat)(?:$|[\s,./\-_)])/i.test(normName);
    return ['FAST_FOOD', 'BAKERY_DESSERT'].includes(canonical) || isQuickBite;
  }

  return true;
}

/**
 * Checks if a venue matches the requested vibe
 */
export function venueMatchesIntentVibe(venue: Place | UnifiedPlace, vibe: IntentVibe): boolean {
  if (vibe === 'any') return true;

  const nameNorm = normalizeVietnameseText(venue.name || '').toLowerCase();
  const canonical = normalizeCategory(venue);
  const addrNorm = normalizeVietnameseText(venue.address || '').toLowerCase();
  const categoryLabelNorm = normalizeVietnameseText(venue.categoryLabel || '').toLowerCase();
  const allText = `${nameNorm} ${addrNorm} ${categoryLabelNorm}`;

  if (vibe === 'chill') {
    // Cafes, tea shops, bakeries or places with tranquil keywords
    if (canonical === 'CAFE_DRINK' || canonical === 'BAKERY_DESSERT') return true;
    return (
      allText.includes('cafe') ||
      allText.includes('coffee') ||
      allText.includes('tra') ||
      allText.includes('chill') ||
      allText.includes('view') ||
      allText.includes('ho ') ||
      allText.includes('garden') ||
      allText.includes('san vuon') ||
      allText.includes('rooftop') ||
      allText.includes('sach')
    );
  }

  if (vibe === 'romantic') {
    // Date spots, bistros, steakhouses, rooftop, fine dining, specialty coffee
    return (
      allText.includes('bistro') ||
      allText.includes('steak') ||
      allText.includes('rooftop') ||
      allText.includes('view ho') ||
      allText.includes('lang man') ||
      allText.includes('specialty') ||
      allText.includes('wine') ||
      allText.includes('pizza') ||
      allText.includes('pasta') ||
      canonical === 'RESTAURANT' ||
      canonical === 'CAFE_DRINK'
    );
  }

  if (vibe === 'noisy') {
    // Lively, hotpot, bbq, beer, pub, street food
    return (
      canonical === 'HOTPOT' ||
      canonical === 'BBQ' ||
      canonical === 'BAR_BEER' ||
      allText.includes('bia') ||
      allText.includes('nhau') ||
      allText.includes('lau') ||
      allText.includes('nuong') ||
      allText.includes('via he') ||
      allText.includes('pub') ||
      allText.includes('bar')
    );
  }

  return true;
}

/**
 * Filters and ranks a list of places based on parsed Search Intent
 */
export function filterPlacesBySearchIntent(
  places: Array<Place | UnifiedPlace>,
  intent: SearchIntent,
  userLocation?: { latitude: number; longitude: number } | null
): Array<{ venue: Place | UnifiedPlace; distanceMeters?: number; score: number }> {
  if (!places || places.length === 0) return [];

  const candidates: Array<{ venue: Place | UnifiedPlace; distanceMeters?: number; score: number }> = [];

  for (const place of places) {
    if (!place || typeof place.latitude !== 'number' || typeof place.longitude !== 'number') continue;

    let distanceMeters: number | undefined;
    if (userLocation) {
      distanceMeters = getDistance(userLocation, {
        latitude: place.latitude,
        longitude: place.longitude,
      });
    }

    // 1. Distance filter (if user specified a distance boundary)
    if (intent.maxDistanceKm < 50 && distanceMeters !== undefined) {
      const maxDistanceMeters = intent.maxDistanceKm * 1000;
      // Allow slight 20% tolerance for close matches
      if (distanceMeters > maxDistanceMeters * 1.2) {
        continue;
      }
    }

    // 2. Category matching
    const catMatch = venueMatchesIntentCategory(place, intent.category);
    if (!catMatch && intent.category !== 'any') {
      continue;
    }

    // 3. Vibe matching & scoring
    const vibeMatch = venueMatchesIntentVibe(place, intent.vibe);
    if (!vibeMatch && intent.vibe !== 'any') {
      continue;
    }

    let score = 100;
    if (catMatch && intent.category !== 'any') score += 50;
    if (vibeMatch && intent.vibe !== 'any') score += 40;

    // Rating boost
    if (place.rating && place.rating >= 4.5) {
      score += (place.rating - 4.0) * 20;
    }

    // Distance proximity boost
    if (distanceMeters !== undefined) {
      if (distanceMeters < 1000) score += 30;
      else if (distanceMeters < 2500) score += 15;
    }

    candidates.push({
      venue: place,
      distanceMeters,
      score,
    });
  }

  // Sort candidates by score descending, then distance ascending
  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return (a.distanceMeters ?? 999999) - (b.distanceMeters ?? 999999);
  });

  return candidates;
}
