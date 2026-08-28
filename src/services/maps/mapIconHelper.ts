import { CanonicalCategory, CANONICAL_CATEGORIES, normalizeCategory } from './categoryNormalizer';

/**
 * Parses an icon identifier into a canonical category and selection state.
 * E.g., 'icon-pho' -> { category: 'PHO', isSelected: false }
 *       'icon-cafe_drink-selected' -> { category: 'CAFE_DRINK', isSelected: true }
 */
export type IconVariant = 'unvisited' | 'visited' | 'selected' | 'normal';

/**
 * Parses an icon identifier into a canonical category and variant.
 * E.g., 'icon-pho-unvisited' -> { category: 'PHO', variant: 'unvisited' }
 *       'icon-pho-visited' -> { category: 'PHO', variant: 'visited' }
 *       'icon-cafe_drink-selected' -> { category: 'CAFE_DRINK', variant: 'selected' }
 */
export function resolveCanonicalCategoryFromIconId(
  iconId: string
): { category: CanonicalCategory; variant: IconVariant } | null {
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

  let variant: IconVariant = 'normal';
  if (raw.endsWith('-selected') || raw.endsWith('_selected')) {
    variant = 'selected';
    raw = raw.replace(/[-_]selected$/, '');
  } else if (raw.endsWith('-unvisited') || raw.endsWith('_unvisited')) {
    variant = 'unvisited';
    raw = raw.replace(/[-_]unvisited$/, '');
  } else if (raw.endsWith('-visited') || raw.endsWith('_visited')) {
    variant = 'visited';
    raw = raw.replace(/[-_]visited$/, '');
  }

  const upperKey = raw.toUpperCase();

  if (upperKey in CANONICAL_CATEGORIES) {
    return {
      category: upperKey as CanonicalCategory,
      variant,
    };
  }

  // Fallback category for any unknown icon-* or cat_* request to prevent missing image drops
  return {
    category: 'OTHER_FOOD',
    variant,
  };
}

/**
 * Creates a MapLibre-compatible image buffer ({ width, height, data: Uint8Array | Uint8ClampedArray }) with the category badge rendered.
 * Renders at 2x resolution:
 * - unvisited: 48x48 muted gray stone badge (fog of food state)
 * - visited: 52x52 vibrant badge with checkmark indicator
 * - selected: 64x64 prominent orange badge
 * - normal: 48x48 standard category badge
 */
export function createCategoryIconCanvas(
  category: CanonicalCategory,
  variant: IconVariant = 'normal'
): { width: number; height: number; data: Uint8Array | Uint8ClampedArray } {
  const isSelected = variant === 'selected';
  const isVisited = variant === 'visited';
  const isUnvisited = variant === 'unvisited';
  const size = isSelected ? 64 : isVisited ? 52 : 48;

  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const meta = CANONICAL_CATEGORIES[category] || CANONICAL_CATEGORIES.OTHER_FOOD || CANONICAL_CATEGORIES.RESTAURANT;
        const center = size / 2;
        const radius = isSelected ? 26 : isVisited ? 21 : 19;

        // Clear
        ctx.clearRect(0, 0, size, size);

        // Outer shadow
        ctx.save();
        ctx.shadowColor = isSelected
          ? 'rgba(255, 107, 53, 0.45)'
          : isVisited
          ? 'rgba(16, 185, 129, 0.35)'
          : 'rgba(45, 41, 38, 0.20)';
        ctx.shadowBlur = isSelected ? 8 : isVisited ? 6 : 3;
        ctx.shadowOffsetY = isSelected ? 3 : 2;

        // Background circle fill:
        // - unvisited: muted neutral stone gray (#78716C)
        // - visited: vivid category color or BiteQuest emerald/orange (#10B981 / #FF6B35)
        // - selected: vibrant BiteQuest Orange (#FF6B35)
        const ambientColors: Record<CanonicalCategory, string> = {
          CAFE_DRINK: '#6B4E38',
          PHO: '#7C4A28',
          NOODLE: '#84472B',
          HOTPOT: '#893B2F',
          BBQ: '#823D26',
          RICE: '#73572D',
          RESTAURANT: '#475569',
          FAST_FOOD: '#783D48',
          BAKERY_DESSERT: '#72435B',
          BAR_BEER: '#55456A',
          VEGETARIAN: '#3E5E40',
          OTHER_FOOD: '#57534E',
        };

        let bgFill = '#57534E';
        if (isSelected) {
          bgFill = '#FF6B35';
        } else if (isVisited) {
          bgFill = ambientColors[category] || '#FF6B35';
        } else if (isUnvisited) {
          bgFill = '#78716C'; // Clean muted slate/stone gray for unvisited places
        } else {
          bgFill = ambientColors[category] || '#57534E';
        }

        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.fillStyle = bgFill;
        ctx.fill();
        ctx.restore();

        // Border:
        // - visited: bright white with double ring or emerald accent
        // - unvisited: subtle stone-300 border
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.strokeStyle = isUnvisited ? '#D6D3D1' : '#FFFFFF';
        ctx.lineWidth = isSelected ? 3.5 : isVisited ? 2.8 : 2.0;
        ctx.stroke();

        // Inner icon / pictogram glyph
        ctx.save();
        ctx.font = isSelected ? '26px sans-serif' : isVisited ? '22px sans-serif' : '19px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isUnvisited ? '#F5F5F4' : '#FFFFFF';
        if (isUnvisited) {
          ctx.globalAlpha = 0.88;
        }
        // Slight vertical optical center adjustment for emoji / glyphs
        ctx.fillText(meta.symbolGlyph || '🍴', center, center + (isSelected ? 2 : 1));
        ctx.restore();

        // If visited, add a mini shiny checkmark badge on the top right
        if (isVisited) {
          const badgeX = center + radius * 0.72;
          const badgeY = center - radius * 0.72;
          const badgeR = 6.5;

          ctx.save();
          ctx.beginPath();
          ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
          ctx.fillStyle = '#10B981'; // Emerald checkmark badge
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Checkmark symbol
          ctx.font = 'bold 8px sans-serif';
          ctx.fillStyle = '#FFFFFF';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('✓', badgeX, badgeY + 0.5);
          ctx.restore();
        }

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

    const img = createCategoryIconCanvas(resolved.category, resolved.variant);
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
 * Registers all canonical category icons with unvisited, visited, selected variants onto a MapLibre GL map instance.
 */
export function registerAllCategoryIcons(map: any): void {
  if (!map || typeof map.addImage !== 'function') return;

  const categories = Object.keys(CANONICAL_CATEGORIES) as CanonicalCategory[];

  categories.forEach((cat) => {
    const variants: IconVariant[] = ['unvisited', 'visited', 'selected', 'normal'];

    variants.forEach((v) => {
      const suffix = v === 'normal' ? '' : `-${v}`;
      const iconId = `icon-${cat.toLowerCase()}${suffix}`;
      const catId = `cat_${cat.toLowerCase()}${suffix}`;

      try {
        if (typeof map.hasImage !== 'function' || !map.hasImage(iconId)) {
          const img = createCategoryIconCanvas(cat, v);
          if (img) {
            map.addImage(iconId, img, { pixelRatio: 2 });
          }
        }

        if (typeof map.hasImage === 'function' && !map.hasImage(catId)) {
          const img = createCategoryIconCanvas(cat, v);
          if (img) {
            map.addImage(catId, img, { pixelRatio: 2 });
          }
        }
      } catch {
        // Catch transient style change race conditions
      }
    });
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

