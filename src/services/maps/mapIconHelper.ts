import { CanonicalCategory, CANONICAL_CATEGORIES, normalizeCategory } from './categoryNormalizer';

/**
 * Parses an icon identifier into a canonical category and selection state.
 * E.g., 'icon-pho' -> { category: 'PHO', isSelected: false }
 *       'icon-cafe_drink-selected' -> { category: 'CAFE_DRINK', isSelected: true }
 */
export type IconVariant = 'unvisited' | 'visited' | 'selected' | 'normal' | 'hot' | 'visited-hot';

/**
 * Parses an icon identifier into a canonical category, pin style, and variant.
 * Supports:
 * - 'pin-grey-normal', 'pin-grey-hot', 'pin-orange-normal', 'pin-orange-hot', 'pin-grey-unvisited', 'pin-orange-visited'
 * - 'icon-pho-unvisited', 'icon-pho-hot', 'icon-pho-visited', 'icon-cafe_drink-selected', etc.
 */
export function resolveCanonicalCategoryFromIconId(
  iconId: string
): { category: CanonicalCategory; isSelected: boolean; variant: IconVariant; forceColor?: 'grey' | 'orange' } | null {
  if (!iconId || typeof iconId !== 'string') {
    return null;
  }

  // 1. Direct Pin-* Format (pin-grey-normal, pin-orange-hot, etc.)
  if (iconId.startsWith('pin-')) {
    const parts = iconId.split('-');
    const isOrange = parts.includes('orange') || parts.includes('visited');
    const isHot = parts.includes('hot');
    const isSelected = parts.includes('selected');

    let variant: IconVariant = 'unvisited';
    if (isSelected) {
      variant = 'selected';
    } else if (isOrange && isHot) {
      variant = 'visited-hot';
    } else if (isOrange) {
      variant = 'visited';
    } else if (isHot) {
      variant = 'hot';
    }

    return {
      category: 'OTHER_FOOD',
      isSelected,
      variant,
      forceColor: isOrange ? 'orange' : 'grey',
    };
  }

  // 2. Icon-* or Cat_* Format
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
  } else if (raw.endsWith('-visited-hot') || raw.endsWith('_visited_hot')) {
    variant = 'visited-hot';
    raw = raw.replace(/[-_]visited[-_]hot$/, '');
  } else if (raw.endsWith('-hot') || raw.endsWith('_hot')) {
    variant = 'hot';
    raw = raw.replace(/[-_]hot$/, '');
  } else if (raw.endsWith('-unvisited') || raw.endsWith('_unvisited')) {
    variant = 'unvisited';
    raw = raw.replace(/[-_]unvisited$/, '');
  } else if (raw.endsWith('-visited') || raw.endsWith('_visited')) {
    variant = 'visited';
    raw = raw.replace(/[-_]visited$/, '');
  }

  const upperKey = raw.toUpperCase();
  const isSelected = variant === 'selected';

  if (upperKey in CANONICAL_CATEGORIES) {
    return {
      category: upperKey as CanonicalCategory,
      isSelected,
      variant,
    };
  }

  // Fallback category
  return {
    category: 'OTHER_FOOD',
    isSelected,
    variant,
  };
}

/**
 * Creates a MapLibre-compatible image buffer ({ width, height, data: Uint8Array | Uint8ClampedArray })
 * Rendering an Inverted Teardrop (Giọt nước ngược / Standard Map Pin) with:
 * - Color: GREY for unvisited, ORANGE (#EA580C) for visited / BiteQuest brand
 * - Modifier: 🔥 Fire badge on top-right corner if isHot is true
 * - Modifier: ✓ Checkmark badge on visited
 * - Selected: Prominent scale with vibrant Orange and glow
 */
export function createCategoryIconCanvas(
  category: CanonicalCategory,
  variant: IconVariant = 'normal',
  forceColor?: 'grey' | 'orange'
): { width: number; height: number; data: Uint8Array | Uint8ClampedArray } {
  const isSelected = variant === 'selected';
  const isVisited = variant === 'visited' || variant === 'visited-hot' || forceColor === 'orange';
  const isHot = variant === 'hot' || variant === 'visited-hot';
  const isUnvisited = !isVisited && !isSelected;

  const width = isSelected ? 56 : isHot ? 50 : isVisited ? 46 : 42;
  const height = isSelected ? 66 : isHot ? 58 : isVisited ? 54 : 50;

  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const meta = CANONICAL_CATEGORIES[category] || CANONICAL_CATEGORIES.OTHER_FOOD || CANONICAL_CATEGORIES.RESTAURANT;
        const cx = width / 2;
        const topRadius = isSelected ? 19 : isHot ? 16 : isVisited ? 15 : 13.5;
        const cy = topRadius + (isSelected ? 5 : 4);
        const tipY = height - (isSelected ? 4 : 3);

        ctx.clearRect(0, 0, width, height);

        // 1. Outer Pin Shadow
        ctx.save();
        ctx.shadowColor = isSelected
          ? 'rgba(255, 107, 53, 0.55)'
          : isVisited
          ? 'rgba(234, 88, 12, 0.45)'
          : 'rgba(0, 0, 0, 0.30)';
        ctx.shadowBlur = isSelected ? 8 : isVisited ? 5 : 3;
        ctx.shadowOffsetY = 2.5;

        // 2. Draw Inverted Teardrop / Map Pin Shape
        const startAngle = Math.PI * 0.22;
        const endAngle = Math.PI * 0.78;

        ctx.beginPath();
        ctx.arc(cx, cy, topRadius, startAngle, endAngle, true);
        ctx.lineTo(cx, tipY);
        ctx.closePath();

        // Fill Color:
        // - Unvisited: GREY (#6B7280)
        // - Visited: ORANGE (#EA580C / BiteQuest Brand)
        // - Selected: #FF6B35
        let pinFill = '#6B7280';
        if (isSelected) {
          pinFill = '#FF6B35';
        } else if (isVisited) {
          pinFill = '#EA580C'; // BiteQuest Brand Orange
        } else {
          pinFill = '#6B7280'; // Clean Grey for unvisited
        }

        ctx.fillStyle = pinFill;
        ctx.fill();
        ctx.restore();

        // 3. Pin Border
        ctx.beginPath();
        ctx.arc(cx, cy, topRadius, startAngle, endAngle, true);
        ctx.lineTo(cx, tipY);
        ctx.closePath();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = isSelected ? 2.5 : 2;
        ctx.stroke();

        // 4. Inner Circle & Glyph
        const innerR = topRadius - (isSelected ? 4.5 : 3.5);
        ctx.beginPath();
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
        ctx.fillStyle = isSelected
          ? '#C2410C'
          : isVisited
          ? '#9A3412'
          : '#4B5563';
        ctx.fill();

        // Category Emoji / Pictogram glyph
        ctx.save();
        ctx.font = isSelected ? '15px sans-serif' : isHot ? '13px sans-serif' : isVisited ? '12px sans-serif' : '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FFFFFF';
        if (isUnvisited) {
          ctx.globalAlpha = 0.9;
        }
        ctx.fillText(meta.symbolGlyph || '🍴', cx, cy + 0.5);
        ctx.restore();

        // 5. Modifier: 🔥 Fire badge on top-right corner if isHot is true
        if (isHot) {
          const badgeX = cx + topRadius * 0.72;
          const badgeY = cy - topRadius * 0.72;
          const badgeR = isSelected ? 8.5 : 7.5;

          ctx.save();
          ctx.beginPath();
          ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
          ctx.fillStyle = '#DC2626'; // Fire Red
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Fire glyph
          ctx.font = isSelected ? '11px sans-serif' : '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🔥', badgeX, badgeY + 0.5);
          ctx.restore();
        }

        // 6. Modifier: ✓ Visited Badge (if not hot)
        if (isVisited && !isHot) {
          const badgeX = cx + topRadius * 0.72;
          const badgeY = cy - topRadius * 0.72;
          const badgeR = isSelected ? 7.5 : 6.5;

          ctx.save();
          ctx.beginPath();
          ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();

          ctx.font = 'bold 8px sans-serif';
          ctx.fillStyle = '#EA580C';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('✓', badgeX, badgeY + 0.5);
          ctx.restore();
        }

        const imgData = ctx.getImageData(0, 0, width, height);
        return {
          width,
          height,
          data: imgData.data,
        };
      }
    } catch {
      // Fallback
    }
  }

  const data = new Uint8Array(width * height * 4);
  return { width, height, data };
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
    if (resolved) {
      const img = createCategoryIconCanvas(resolved.category, resolved.variant, resolved.forceColor);
      if (img) {
        map.addImage(iconId, img, { pixelRatio: 2 });
        return true;
      }
    } else {
      // Graceful fallback for non-category style sprite images (e.g., osm poi icons like atm, gate, office)
      map.addImage(iconId, { width: 1, height: 1, data: new Uint8Array(4) }, { pixelRatio: 1 });
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

  // 1. Pre-register core Pin markers (pin-grey-normal, pin-grey-hot, pin-orange-normal, pin-orange-hot, etc.)
  const pinTypes = [
    { id: 'pin-grey-normal', variant: 'unvisited' as IconVariant, forceColor: 'grey' as const },
    { id: 'pin-grey-unvisited', variant: 'unvisited' as IconVariant, forceColor: 'grey' as const },
    { id: 'pin-grey-hot', variant: 'hot' as IconVariant, forceColor: 'grey' as const },
    { id: 'pin-orange-normal', variant: 'visited' as IconVariant, forceColor: 'orange' as const },
    { id: 'pin-orange-visited', variant: 'visited' as IconVariant, forceColor: 'orange' as const },
    { id: 'pin-orange-hot', variant: 'visited-hot' as IconVariant, forceColor: 'orange' as const },
    { id: 'pin-selected', variant: 'selected' as IconVariant, forceColor: 'orange' as const },
  ];

  pinTypes.forEach(({ id, variant, forceColor }) => {
    try {
      if (typeof map.hasImage !== 'function' || !map.hasImage(id)) {
        const img = createCategoryIconCanvas('OTHER_FOOD', variant, forceColor);
        if (img) {
          map.addImage(id, img, { pixelRatio: 2 });
        }
      }
    } catch {
      // ignore
    }
  });

  // 2. Register Category-specific Inverted Teardrop pins
  const categories = Object.keys(CANONICAL_CATEGORIES) as CanonicalCategory[];

  categories.forEach((cat) => {
    const variants: IconVariant[] = ['unvisited', 'visited', 'selected', 'normal', 'hot', 'visited-hot'];

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
    if (typeof id === 'string') {
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

