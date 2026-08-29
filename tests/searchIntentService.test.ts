import { describe, it, expect } from 'vitest';
import {
  parseIntentRuleBasedFallback,
  isNaturalLanguageQuery,
  filterPlacesBySearchIntent,
  venueMatchesIntentCategory,
  venueMatchesIntentVibe,
  SearchIntent,
} from '../src/services/searchIntentService';
import { Place } from '../src/types';

describe('SearchIntentService', () => {
  const mockPlaces: Place[] = [
    {
      id: 'place_cafe_1',
      name: 'Phê La - Trà Ô Long Đặc Sản',
      category: 'coffee',
      categoryLabel: 'Cà phê & Trà',
      address: '24 Cầu Giấy, Hà Nội',
      district: 'Cầu Giấy',
      latitude: 21.0345,
      longitude: 105.7925,
      priceBand: '45k–65k',
      rating: 4.8,
      reviewCount: 120,
      imageUrl: 'https://example.com/phela.jpg',
      isOpen: true,
    },
    {
      id: 'place_pho_1',
      name: 'Phở Bò Gia Truyền Cầu Giấy',
      category: 'noodles',
      categoryLabel: 'Phở',
      address: '10 Trần Thái Tông, Cầu Giấy',
      district: 'Cầu Giấy',
      latitude: 21.0305,
      longitude: 105.7895,
      priceBand: '45k–60k',
      rating: 4.6,
      reviewCount: 90,
      imageUrl: 'https://example.com/pho.jpg',
      isOpen: true,
    },
    {
      id: 'place_hotpot_far',
      name: 'Lẩu Bò Nhúng Dấm 555',
      category: 'bbq_hotpot',
      categoryLabel: 'Lẩu',
      address: '56 Duy Tân, Cầu Giấy',
      district: 'Cầu Giấy',
      latitude: 21.0700, // ~5km away
      longitude: 105.8500,
      priceBand: '150k–250k',
      rating: 4.5,
      reviewCount: 150,
      imageUrl: 'https://example.com/lau.jpg',
      isOpen: true,
    },
    {
      id: 'place_bread_1',
      name: 'Bánh Mì Chảo Cô Long',
      category: 'street_food',
      categoryLabel: 'Bánh mì & Ăn nhanh',
      address: 'Ngõ 165 Cầu Giấy',
      district: 'Cầu Giấy',
      latitude: 21.0330,
      longitude: 105.7910,
      priceBand: '35k–45k',
      rating: 4.7,
      reviewCount: 80,
      imageUrl: 'https://example.com/banhmi.jpg',
      isOpen: true,
    },
  ];

  const userLocation = { latitude: 21.0340, longitude: 105.7920 };

  it('detects natural language queries accurately', () => {
    expect(isNaturalLanguageQuery('Tối nay muốn ăn gì đó chill, đừng đi xa')).toBe(true);
    expect(isNaturalLanguageQuery('quán cà phê yên tĩnh làm việc')).toBe(true);
    expect(isNaturalLanguageQuery('tìm quán lẩu ngon gần đây')).toBe(true);
    expect(isNaturalLanguageQuery('Phở Bò')).toBe(false);
  });

  it('parses natural language search intent in fallback engine', () => {
    const intent1 = parseIntentRuleBasedFallback('Tối nay muốn ăn gì đó chill, đừng đi xa');
    expect(intent1.vibe).toBe('chill');
    expect(intent1.maxDistanceKm).toBeLessThanOrEqual(3.0);

    const intent2 = parseIntentRuleBasedFallback('quán cà phê yên tĩnh gần đây');
    expect(intent2.category).toBe('cafe');
    expect(intent2.vibe).toBe('chill');
    expect(intent2.maxDistanceKm).toBeLessThanOrEqual(3.0);

    const intent3 = parseIntentRuleBasedFallback('tìm quán lẩu nhậu sôi động');
    expect(intent3.category).toBe('food');
    expect(intent3.vibe).toBe('noisy');
  });

  it('filters places strictly based on parsed intent (category, distance, vibe)', () => {
    const chillNearbyCafeIntent: SearchIntent = {
      category: 'cafe',
      maxDistanceKm: 2.0,
      vibe: 'chill',
    };

    const results = filterPlacesBySearchIntent(mockPlaces, chillNearbyCafeIntent, userLocation);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].venue.id).toBe('place_cafe_1');

    // Distant venues should be excluded when maxDistanceKm is small
    const farVenuePresent = results.some((r) => r.venue.id === 'place_hotpot_far');
    expect(farVenuePresent).toBe(false);
  });

  it('matches categories correctly against canonical normalizer', () => {
    expect(venueMatchesIntentCategory(mockPlaces[0], 'cafe')).toBe(true);
    expect(venueMatchesIntentCategory(mockPlaces[0], 'food')).toBe(false);
    expect(venueMatchesIntentCategory(mockPlaces[1], 'food')).toBe(true);
    expect(venueMatchesIntentCategory(mockPlaces[3], 'fast_food')).toBe(true);
  });

  it('matches vibes correctly based on venue attributes', () => {
    expect(venueMatchesIntentVibe(mockPlaces[0], 'chill')).toBe(true);
    expect(venueMatchesIntentVibe(mockPlaces[2], 'noisy')).toBe(true);
  });
});
