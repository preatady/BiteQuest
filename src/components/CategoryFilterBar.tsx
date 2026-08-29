import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  ExploreFilterCategory,
  DynamicFilterChip,
} from '../services/maps/categoryNormalizer';

interface CategoryFilterBarProps {
  chips: DynamicFilterChip[];
  activeFilter: ExploreFilterCategory;
  onSelectFilter: (filterId: ExploreFilterCategory) => void;
  onOpenFullFilter: () => void;
  totalVenuesCount?: number;
  className?: string;
}

export const CategoryFilterBar: React.FC<CategoryFilterBarProps> = ({
  chips,
  activeFilter,
  onSelectFilter,
  onOpenFullFilter,
  totalVenuesCount = 0,
  className = '',
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Mouse drag-to-scroll state
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasMovedRef = useRef(false);

  // Check scroll boundary to show/hide scroll buttons and gradient masks
  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 6);
  }, []);

  useEffect(() => {
    updateScrollButtons();
    const el = scrollRef.current;
    if (!el) return;

    const handleResize = () => updateScrollButtons();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateScrollButtons, chips]);

  // Center the selected chip on active filter change
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const activeElement = el.querySelector<HTMLElement>(`[data-chip-id="${activeFilter}"]`);
    if (activeElement) {
      const containerWidth = el.clientWidth;
      const elementLeft = activeElement.offsetLeft;
      const elementWidth = activeElement.offsetWidth;
      
      el.scrollTo({
        left: Math.max(0, elementLeft - containerWidth / 2 + elementWidth / 2),
        behavior: 'smooth',
      });
    }
  }, [activeFilter]);

  // Mouse Drag to scroll handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startXRef.current = e.pageX - el.offsetLeft;
    scrollLeftRef.current = el.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const el = scrollRef.current;
    if (!el) return;

    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startXRef.current) * 1.5; // Drag sensitivity
    
    if (Math.abs(x - startXRef.current) > 4) {
      hasMovedRef.current = true;
    }
    
    el.scrollLeft = scrollLeftRef.current - walk;
    updateScrollButtons();
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  const handleChipClick = (filterId: ExploreFilterCategory) => {
    // If user was dragging, don't trigger click
    if (hasMovedRef.current) {
      hasMovedRef.current = false;
      return;
    }
    onSelectFilter(filterId);
  };

  const handleScrollStep = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const step = el.clientWidth * 0.6;
    el.scrollBy({
      left: direction === 'left' ? -step : step,
      behavior: 'smooth',
    });
  };

  const isCustomFilterActive = activeFilter !== 'ALL';

  return (
    <div
      className={`bg-white/90 backdrop-blur-md rounded-full shadow-[0_2px_10px_rgba(45,41,38,0.06)] border border-stone-200/80 p-1 flex items-center relative select-none ${className}`}
      id="category-filter-bar"
    >
      {/* Scrollable Area Wrapper (Confines all scrolling, gradients, and arrows inside) */}
      <div className="relative flex-1 min-w-0 flex items-center overflow-hidden">
        {/* Left Gradient Edge Fade */}
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white/95 via-white/80 to-transparent pointer-events-none z-10" />
        )}

        {/* Scroll Left Button */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => handleScrollStep('left')}
            className="absolute left-1 z-20 w-6 h-6 rounded-full bg-white shadow-md border border-stone-200 flex items-center justify-center text-stone-700 active:scale-95 transition-all cursor-pointer hidden sm:flex"
            aria-label="Cuộn sang trái"
            title="Cuộn sang trái"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
          </button>
        )}

        {/* Scrollable Chips Container */}
        <div
          ref={scrollRef}
          onScroll={updateScrollButtons}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth w-full px-1 py-0.5 cursor-grab active:cursor-grabbing touch-pan-x"
          role="tablist"
          aria-label="Thanh lọc danh mục ẩm thực"
        >
          {chips.map((chip) => {
            const isSelected = activeFilter === chip.id;
            const glyph = chip.metadata?.symbolGlyph || '🍴';
            const label = chip.metadata?.shortLabel || chip.label;

            return (
              <button
                key={chip.id}
                data-chip-id={chip.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => handleChipClick(chip.id)}
                className={`shrink-0 min-h-[30px] px-3 py-1 rounded-full text-[12px] font-heading flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap active:scale-95 focus-visible:ring-2 focus-visible:ring-[#FF6B35] focus-visible:outline-none ${
                  isSelected
                    ? 'text-white font-bold bg-[#FF6B35] shadow-xs'
                    : 'text-[#44403C] hover:text-[#1C1917] hover:bg-stone-100/90 font-medium bg-stone-100/70 border border-stone-200/50'
                }`}
                id={`filter-chip-${chip.id.toLowerCase()}`}
              >
                <span className="text-[12px] leading-none shrink-0">{glyph}</span>
                <span className="whitespace-nowrap font-medium">{label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Gradient Edge Fade */}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white/95 via-white/80 to-transparent pointer-events-none z-10" />
        )}

        {/* Scroll Right Button */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => handleScrollStep('right')}
            className="absolute right-1 z-20 w-6 h-6 rounded-full bg-white shadow-md border border-stone-200 flex items-center justify-center text-stone-700 active:scale-95 transition-all cursor-pointer hidden sm:flex"
            aria-label="Cuộn sang phải"
            title="Cuộn sang phải"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="w-[1px] h-4 bg-stone-200 shrink-0 mx-1" />

      {/* Pinned "Bộ lọc" (Filter) Button */}
      <button
        type="button"
        onClick={onOpenFullFilter}
        className={`shrink-0 min-h-[36px] sm:min-h-[38px] px-2.5 sm:px-3 py-1 rounded-xl text-xs sm:text-[12.5px] font-heading font-semibold flex items-center gap-1 transition-all select-none cursor-pointer whitespace-nowrap active:scale-95 focus-visible:ring-2 focus-visible:ring-[#FF6B35] focus-visible:outline-none ${
          isCustomFilterActive
            ? 'text-white bg-[#FF6B35] hover:bg-[#E85D2A] shadow-xs'
            : 'text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200/90'
        }`}
        id="btn-open-full-filter"
        title="Mở tất cả bộ lọc danh mục"
        aria-label="Xem tất cả bộ lọc danh mục ẩm thực"
      >
        <span className="material-symbols-outlined text-[17px]">tune</span>
        <span className="hidden xs:inline">Bộ lọc</span>
        {isCustomFilterActive && (
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        )}
      </button>
    </div>
  );
};
