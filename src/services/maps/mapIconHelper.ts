import { CanonicalCategory, CANONICAL_CATEGORIES, normalizeCategory } from './categoryNormalizer';

/**
 * Parses an icon identifier into a canonical category and selection state.
 * E.g., 'icon-pho' -> { category: 'PHO', isSelected: false }
 *       'icon-cafe_drink-selected' -> { category: 'CAFE_DRINK', isSelected: true }
 */
export function resolveCanonicalCategoryFromIconId(
  iconId: string
): { category: CanonicalCategory; isSelected: boolean } | null {
  if (!iconId || typeof iconId !== 'string') {
    return null;
  }

  let raw = '';
  if (iconId.startsWith('icon-')) {
    raw = iconId.slice(5);
  } else if (iconId.startsWith('cat_')) {
    raw = iconId.slice(4);
  } else if (iconId.startsWith('cat-')) {
    raw = iconId.slice(4);
  } else {
    return null;
  }

  const isSelected = raw.endsWith('-selected') || raw.endsWith('_selected');
  const baseName = isSelected ? raw.replace(/[-_]selected$/, '') : raw;
  const upperKey = baseName.toUpperCase();

  if (upperKey in CANONICAL_CATEGORIES) {
    return {
      category: upperKey as CanonicalCategory,
      isSelected,
    };
  }

  // Fallback category for any unknown icon-* or cat_* request to prevent missing image drops
  return {
    category: 'OTHER_FOOD',
    isSelected,
  };
}

/**
 * Creates a MapLibre-compatible image buffer ({ width, height, data: Uint8Array | Uint8ClampedArray }) with the category badge rendered.
 * Renders at 2x resolution (48x48 for 24x24 logical, 64x64 for 32x32 selected).
 */
export function createCategoryIconCanvas(
  category: CanonicalCategory,
  isSelected: boolean = false
): { width: number; height: number; data: Uint8Array | Uint8ClampedArray } {
  const size = isSelected ? 64 : 48;

  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const meta = CANONICAL_CATEGORIES[category] || CANONICAL_CATEGORIES.OTHER_FOOD || CANONICAL_CATEGORIES.RESTAURANT;
        const center = size / 2;
        const radius = isSelected ? 26 : 19;

        // Clear
        ctx.clearRect(0, 0, size, size);

        // Outer shadow
        ctx.save();
        ctx.shadowColor = isSelected ? 'rgba(255, 107, 53, 0.45)' : 'rgba(45, 41, 38, 0.25)';
        ctx.shadowBlur = isSelected ? 8 : 4;
        ctx.shadowOffsetY = isSelected ? 3 : 2;

        // Background circle: Selected gets pure BiteQuest Orange; Ambient gets restrained, low-saturation cohesive stone tones
        const ambientColors: Record<CanonicalCategory, string> = {
          CAFE_DRINK: '#4A3C31',
          PHO: '#543D2B',
          NOODLE: '#583B2C',
          HOTPOT: '#5A342E',
          BBQ: '#563529',
          RICE: '#50412E',
          RESTAURANT: '#3B4247',
          FAST_FOOD: '#52363B',
          BAKERY_DESSERT: '#4F3743',
          BAR_BEER: '#433A4E',
          VEGETARIAN: '#374538',
          OTHER_FOOD: '#44403C',
        };

        const bgFill = isSelected
          ? '#FF6B35'
          : ambientColors[category] || '#44403C';

        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.fillStyle = bgFill;
        ctx.fill();
        ctx.restore();

        // Crisp White border
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = isSelected ? 3.5 : 2.5;
        ctx.stroke();

        // Inner icon / pictogram glyph in crisp high-contrast white
        ctx.save();
        ctx.font = isSelected ? '26px sans-serif' : '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FFFFFF';
        // Slight vertical optical center adjustment for emoji / glyphs
        ctx.fillText(meta.symbolGlyph || '🍴', center, center + (isSelected ? 2 : 1));
        ctx.restore();

        const imgData = ctx.getImageData(0, 0, size, size);
        return {
          width: size,
          height: size,
          data: imgData.data,
        };
      }
    } catch {
      // Fallback to RGBA buffer if canvas context is unavailable
    }
  }

  // Fallback RGBA image data for MapLibre
  const data = new Uint8Array(size * size * 4);
  return { width: size, height: size, data };
}

/**
 * Registers a single category icon on demand if missing from the map style image repository.
 */
export function registerCategoryIcon(map: any, iconId: string): boolean {
  if (!map || typeof map.addImage !== 'function') return false;

  try {
    if (typeof map.hasImage === 'function' && map.hasImage(iconId)) {
      return true;
    }

    const resolved = resolveCanonicalCategoryFromIconId(iconId);
    if (!resolved) return false;

    const img = createCategoryIconCanvas(resolved.category, resolved.isSelected);
    if (img) {
      map.addImage(iconId, img, { pixelRatio: 2 });
      return true;
    }
  } catch (err) {
    // Avoid crashing on duplicate or invalid image addition
  }

  return false;
}

/**
 * Registers all canonical category icons onto a MapLibre GL map instance.
 */
export function registerAllCategoryIcons(map: any): void {
  if (!map || typeof map.addImage !== 'function') return;

  const categories = Object.keys(CANONICAL_CATEGORIES) as CanonicalCategory[];

  categories.forEach((cat) => {
    const iconNormalId = `icon-${cat.toLowerCase()}`;
    const iconSelectedId = `icon-${cat.toLowerCase()}-selected`;
    const catNormalId = `cat_${cat.toLowerCase()}`;
    const catSelectedId = `cat_${cat.toLowerCase()}-selected`;

    try {
      // Normal Icon (icon-*)
      if (typeof map.hasImage !== 'function' || !map.hasImage(iconNormalId)) {
        const img = createCategoryIconCanvas(cat, false);
        if (img) {
          map.addImage(iconNormalId, img, { pixelRatio: 2 });
        }
      }

      // Selected Icon (icon-*-selected)
      if (typeof map.hasImage !== 'function' || !map.hasImage(iconSelectedId)) {
        const img = createCategoryIconCanvas(cat, true);
        if (img) {
          map.addImage(iconSelectedId, img, { pixelRatio: 2 });
        }
      }

      // Legacy/Metadata alias (cat_*)
      if (typeof map.hasImage === 'function' && !map.hasImage(catNormalId)) {
        const img = createCategoryIconCanvas(cat, false);
        if (img) {
          map.addImage(catNormalId, img, { pixelRatio: 2 });
        }
      }
      if (typeof map.hasImage === 'function' && !map.hasImage(catSelectedId)) {
        const img = createCategoryIconCanvas(cat, true);
        if (img) {
          map.addImage(catSelectedId, img, { pixelRatio: 2 });
        }
      }
    } catch {
      // Catch transient style change race conditions
    }
  });
}

/**
 * Attaches robust lifecycle listeners to a MapLibre GL map instance:
 * 1. Immediate registration
 * 2. 'style.load' listener for full reloads
 * 3. 'styledata' listener for dynamic style updates
 * 4. 'styleimagemissing' listener for just-in-time on-demand resolution and fallback
 *
 * Returns a teardown function.
 */
export function setupMapIconLifecycle(map: any): () => void {
  if (!map || typeof map.on !== 'function') {
    return () => {};
  }

  // 1. Immediate registration
  registerAllCategoryIcons(map);

  // 2. Handlers
  const onStyleLoad = () => {
    registerAllCategoryIcons(map);
  };

  const onStyleData = () => {
    registerAllCategoryIcons(map);
  };

  const onStyleImageMissing = (e: any) => {
    const id = e?.id;
    if (typeof id === 'string' && (id.startsWith('icon-') || id.startsWith('cat_') || id.startsWith('cat-'))) {
      registerCategoryIcon(map, id);
    }
  };

  map.on('style.load', onStyleLoad);
  map.on('styledata', onStyleData);
  map.on('styleimagemissing', onStyleImageMissing);

  return () => {
    if (typeof map.off === 'function') {
      map.off('style.load', onStyleLoad);
      map.off('styledata', onStyleData);
      map.off('styleimagemissing', onStyleImageMissing);
    }
  };
}

/**
 * Helper to get icon name for a place/venue based on metadata
 */
export function getCategoryIconName(
  venue: { name?: string; category?: string; categoryLabel?: string; categories?: string[] },
  isSelected: boolean = false
): string {
  const cat = normalizeCategory(venue);
  return isSelected ? `icon-${cat.toLowerCase()}-selected` : `icon-${cat.toLowerCase()}`;
}

