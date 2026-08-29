import { describe, it, expect } from 'vitest';
import {
  createCategoryIconCanvas,
  getCategoryIconName,
  registerAllCategoryIcons,
  registerCategoryIcon,
  resolveCanonicalCategoryFromIconId,
  setupMapIconLifecycle,
} from '../src/services/maps/mapIconHelper';
import { CANONICAL_CATEGORIES, CanonicalCategory } from '../src/services/maps/categoryNormalizer';

describe('MapIconHelper', () => {
  it('derives truthful category icon names matching canonical categories V2', () => {
    expect(getCategoryIconName({ name: 'Highlands Coffee', category: 'coffee' })).toBe('icon-cafe_drink');
    expect(getCategoryIconName({ name: 'Lẩu Phan', category: 'restaurant' })).toBe('icon-hotpot');
    expect(getCategoryIconName({ name: 'Gogi House Nướng BBQ' })).toBe('icon-bbq');
    expect(getCategoryIconName({ name: 'Phở Bò Gia Truyền 49 Bát Đàn' })).toBe('icon-pho');
    expect(getCategoryIconName({ name: 'Bún Chả Đắc Kim' })).toBe('icon-noodle');
    expect(getCategoryIconName({ name: 'Lotteria Cầu Giấy' })).toBe('icon-fast_food');
    expect(getCategoryIconName({ name: 'Tous Les Jours Bakery' })).toBe('icon-bakery_dessert');
    expect(getCategoryIconName({ name: 'Bia Hơi Hà Nội 1985' })).toBe('icon-bar_beer');
    expect(getCategoryIconName({ name: 'Cơm Tấm Sà Bì Chưởng' })).toBe('icon-rice');
    expect(getCategoryIconName({ name: 'Cơm Chay An Lạc' })).toBe('icon-vegetarian');
  });

  it('supports selected state icon name resolution', () => {
    expect(getCategoryIconName({ name: 'Highlands Coffee' }, true)).toBe('icon-cafe_drink-selected');
    expect(getCategoryIconName({ name: 'Lẩu Haidilao' }, true)).toBe('icon-hotpot-selected');
    expect(getCategoryIconName({ name: 'Phở Thìn Lò Đúc' }, true)).toBe('icon-pho-selected');
  });

  it('resolves canonical category and selection from icon identifier with safe fallbacks', () => {
    expect(resolveCanonicalCategoryFromIconId('icon-fast_food')).toEqual({
      category: 'FAST_FOOD',
      isSelected: false,
      variant: 'normal',
    });
    expect(resolveCanonicalCategoryFromIconId('cat_fast_food')).toEqual({
      category: 'FAST_FOOD',
      isSelected: false,
      variant: 'normal',
    });
    expect(resolveCanonicalCategoryFromIconId('icon-pho-selected')).toEqual({
      category: 'PHO',
      isSelected: true,
      variant: 'selected',
    });
    expect(resolveCanonicalCategoryFromIconId('cat_pho_selected')).toEqual({
      category: 'PHO',
      isSelected: true,
      variant: 'selected',
    });
    expect(resolveCanonicalCategoryFromIconId('icon-cafe_drink')).toEqual({
      category: 'CAFE_DRINK',
      isSelected: false,
      variant: 'normal',
    });
    expect(resolveCanonicalCategoryFromIconId('cat_cafe_drink')).toEqual({
      category: 'CAFE_DRINK',
      isSelected: false,
      variant: 'normal',
    });
    expect(resolveCanonicalCategoryFromIconId('icon-unknown_snack')).toEqual({
      category: 'OTHER_FOOD',
      isSelected: false,
      variant: 'normal',
    });
    expect(resolveCanonicalCategoryFromIconId('cat_unknown_snack')).toEqual({
      category: 'OTHER_FOOD',
      isSelected: false,
      variant: 'normal',
    });
    expect(resolveCanonicalCategoryFromIconId('not-an-icon')).toBeNull();
  });

  it('registers on-demand category icon if missing', () => {
    const registeredImages = new Map<string, any>();
    const mockMap = {
      hasImage: (id: string) => registeredImages.has(id),
      addImage: (id: string, image: any, options: any) => {
        registeredImages.set(id, { image, options });
      },
    };

    expect(registerCategoryIcon(mockMap, 'icon-bbq')).toBe(true);
    expect(registeredImages.has('icon-bbq')).toBe(true);
    expect(registeredImages.get('icon-bbq').options).toEqual({ pixelRatio: 2 });

    // Calling again does not re-add
    expect(registerCategoryIcon(mockMap, 'icon-bbq')).toBe(true);
  });

  it('registers all 12 canonical category normal and selected icons for both icon- and cat_ conventions', () => {
    const registeredImages = new Map<string, any>();
    const mockMap = {
      hasImage: (id: string) => registeredImages.has(id),
      addImage: (id: string, image: any, options: any) => {
        registeredImages.set(id, { image, options });
      },
    };

    registerAllCategoryIcons(mockMap);

    const categories = Object.keys(CANONICAL_CATEGORIES) as CanonicalCategory[];
    expect(categories.length).toBe(12);

    categories.forEach((cat) => {
      expect(registeredImages.has(`icon-${cat.toLowerCase()}`)).toBe(true);
      expect(registeredImages.has(`icon-${cat.toLowerCase()}-selected`)).toBe(true);
      expect(registeredImages.has(`cat_${cat.toLowerCase()}`)).toBe(true);
      expect(registeredImages.has(`cat_${cat.toLowerCase()}-selected`)).toBe(true);
    });
  });

  it('binds lifecycle events including styleimagemissing on MapLibre instance', () => {
    const registeredImages = new Map<string, any>();
    const eventHandlers: Record<string, (e?: any) => void> = {};

    const mockMap = {
      hasImage: (id: string) => registeredImages.has(id),
      addImage: (id: string, image: any, options: any) => {
        registeredImages.set(id, { image, options });
      },
      on: (event: string, handler: (e?: any) => void) => {
        eventHandlers[event] = handler;
      },
      off: (event: string, handler: (e?: any) => void) => {
        if (eventHandlers[event] === handler) {
          delete eventHandlers[event];
        }
      },
    };

    const teardown = setupMapIconLifecycle(mockMap);

    // Initial load registered
    expect(registeredImages.has('icon-pho')).toBe(true);

    // Simulate style reload (MapLibre flushes custom images)
    registeredImages.clear();
    expect(registeredImages.size).toBe(0);

    // Trigger style.load
    eventHandlers['style.load']?.();
    expect(registeredImages.has('icon-noodle')).toBe(true);

    // Trigger styleimagemissing for an on-demand icon
    registeredImages.delete('icon-fast_food');
    expect(registeredImages.has('icon-fast_food')).toBe(false);
    eventHandlers['styleimagemissing']?.({ id: 'icon-fast_food' });
    expect(registeredImages.has('icon-fast_food')).toBe(true);

    // Teardown unbinds handlers
    teardown();
    expect(eventHandlers['style.load']).toBeUndefined();
    expect(eventHandlers['styleimagemissing']).toBeUndefined();
  });
});

