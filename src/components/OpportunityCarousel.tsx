import React, { useRef, useState, useEffect } from 'react';
import { BiteOpportunity } from '../types';

interface OpportunityCarouselProps {
  opportunities: BiteOpportunity[];
  selectedPlaceId?: string | null;
  onSelectOpportunity: (opportunity: BiteOpportunity) => void;
  onActionClick: (opportunity: BiteOpportunity) => void;
  onDismiss?: () => void;
}

export const OpportunityCarousel: React.FC<OpportunityCarouselProps> = ({
  opportunities,
  selectedPlaceId,
  onSelectOpportunity,
  onActionClick,
  onDismiss,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMouseDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasMovedRef = useRef(false);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Top 3 attention budget ceiling
  const displayOpps = opportunities.slice(0, 3);

  // Check scroll boundary to enable/disable arrow buttons
  const checkScrollability = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScrollability();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScrollability);
      window.addEventListener('resize', checkScrollability);
      return () => {
        el.removeEventListener('scroll', checkScrollability);
        window.removeEventListener('resize', checkScrollability);
      };
    }
  }, [displayOpps.length]);

  // Smooth scroll left/right handlers
  const handleScrollStep = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const cardWidth = 290;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -cardWidth : cardWidth,
        behavior: 'smooth',
      });
    }
  };

  // Mouse Drag to Scroll handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    isMouseDownRef.current = true;
    hasMovedRef.current = false;
    startXRef.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeftRef.current = scrollRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDownRef.current || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    if (Math.abs(walk) > 5) {
      hasMovedRef.current = true;
    }
    scrollRef.current.scrollLeft = scrollLeftRef.current - walk;
    checkScrollability();
  };

  const handleMouseUpOrLeave = () => {
    isMouseDownRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (scrollRef.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      scrollRef.current.scrollLeft += e.deltaY * 0.8;
      checkScrollability();
    }
  };

  if (displayOpps.length === 0) return null;

  return (
    <div
      className="w-full flex flex-col pointer-events-none"
      id="opportunity-carousel-surface"
    >
      {/* 1. Carousel Header: Consumer-first header */}
      <div className="flex items-center justify-between px-4 pb-1.5 pointer-events-auto">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-[#2D2926]/90 backdrop-blur-md px-3 py-1 rounded-full text-white text-[11px] font-heading font-bold shadow-sm">
            <span>✨</span>
            <span>{displayOpps.length} nơi đáng đi · Gợi ý Radar</span>
          </div>

          {/* Quick desktop/touch left/right navigation arrows */}
          {displayOpps.length > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleScrollStep('left')}
                disabled={!canScrollLeft}
                className={`w-7 h-7 rounded-full backdrop-blur-md flex items-center justify-center transition-all ${
                  canScrollLeft
                    ? 'bg-black/60 hover:bg-black/80 text-white active:scale-90 shadow-sm cursor-pointer'
                    : 'bg-black/25 text-white/30 cursor-not-allowed'
                }`}
                aria-label="Cuộn sang trái"
                title="Cuộn sang trái"
                id="btn-carousel-scroll-prev"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>
              <button
                type="button"
                onClick={() => handleScrollStep('right')}
                disabled={!canScrollRight}
                className={`w-7 h-7 rounded-full backdrop-blur-md flex items-center justify-center transition-all ${
                  canScrollRight
                    ? 'bg-black/60 hover:bg-black/80 text-white active:scale-90 shadow-sm cursor-pointer'
                    : 'bg-black/25 text-white/30 cursor-not-allowed'
                }`}
                aria-label="Cuộn sang phải"
                title="Cuộn sang phải"
                id="btn-carousel-scroll-next"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          )}
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="h-7 px-2.5 bg-[#2D2926]/80 hover:bg-[#2D2926] backdrop-blur-md text-white rounded-full flex items-center justify-center gap-1 text-[11px] font-heading font-semibold shadow-sm active:scale-95 transition-all focus:outline-none cursor-pointer"
            aria-label="Đóng Radar"
            title="Đóng Radar"
            id="btn-collapse-opportunity-carousel"
          >
            <span className="material-symbols-outlined text-[15px]">close</span>
            <span className="text-[10px]">Đóng</span>
          </button>
        )}
      </div>

      {/* 2. Horizontal Scrollable Track */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-2 pt-0.5 pointer-events-auto snap-x snap-mandatory cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onWheel={handleWheel}
        onTouchMove={(e) => e.stopPropagation()}
        id="opportunity-carousel-scroll-track"
      >
        {displayOpps.map((opp) => {
          const isSelected = selectedPlaceId === opp.placeId;
          const place = opp.place;

          // Dynamic Badge Styling based on OpportunityType
          let badgeColor = 'bg-[#FF6B35]/15 text-[#D9381E] border-[#FF6B35]/30';
          let badgeLabel = opp.reasonData?.badgeText || '🎯 Gợi ý Radar';
          let ctaText = opp.reasonData?.ctaText || 'Khám phá →';
          let ctaIcon = opp.reasonData?.ctaIcon || 'explore';

          if (opp.type === 'SCOUT_WINDOW') {
            badgeColor = 'bg-[#2EC4B6]/15 text-[#006A62] border-[#2EC4B6]/40';
            badgeLabel = opp.reasonData?.badgeText || '🥇 First Verifier';
            ctaText = 'Đi xác minh →';
            ctaIcon = 'verified';
          } else if (opp.type === 'QUEST_MATCH') {
            badgeColor = 'bg-[#FF9F1C]/20 text-[#8C4A00] border-[#FF9F1C]/40';
            badgeLabel = opp.reasonData?.badgeText || '🗺️ Hành trình';
            ctaText = 'Hoàn thành thử thách →';
            ctaIcon = 'flag';
          } else if (opp.type === 'STARTER_QUEST') {
            badgeColor = 'bg-[#2EC4B6]/20 text-[#006A62] border-[#2EC4B6]/50';
            badgeLabel = opp.reasonData?.badgeText || '🌱 Bite đầu tiên';
            ctaText = 'Bắt đầu Bite →';
            ctaIcon = 'photo_camera';
          } else if (opp.type === 'FRESH_VERIFIED') {
            badgeColor = 'bg-[#2EC4B6]/15 text-[#006A62] border-[#2EC4B6]/40';
            badgeLabel = opp.reasonData?.badgeText || '✨ Vừa xác minh';
            ctaText = 'Khám phá quán →';
            ctaIcon = 'explore';
          } else if (opp.type === 'NEW_TO_YOU') {
            badgeColor = 'bg-[#FF6B35]/15 text-[#C83E00] border-[#FF6B35]/30';
            badgeLabel = opp.reasonData?.badgeText || '👀 Mới với bạn';
            ctaText = 'Khám phá quán →';
            ctaIcon = 'explore';
          }

          const distanceText =
            opp.distanceMeters < 1000 ? `${opp.distanceMeters}m` : `${(opp.distanceMeters / 1000).toFixed(1)}km`;

          const primaryReason = opp.reasonData?.title || opp.reasons[0]?.text || 'Địa điểm ẩm thực quanh bạn';
          const secondaryReason = opp.reasonData?.subtitle;

          return (
            <div
              key={opp.id}
              onClick={() => {
                if (hasMovedRef.current) return;
                onSelectOpportunity(opp);
              }}
              className={`w-[285px] max-w-[85vw] shrink-0 bg-white/95 backdrop-blur-md rounded-2xl p-3.5 border transition-all cursor-pointer snap-start snap-always flex flex-col justify-between shadow-[0_4px_20px_rgba(45,41,38,0.08)] hover:shadow-md active:scale-[0.99] ${
                isSelected
                  ? 'border-[#FF6B35] ring-2 ring-[#FF6B35]/25 scale-[1.01]'
                  : 'border-[#2D2926]/10 hover:border-[#2D2926]/20'
              }`}
              id={`opp-card-${opp.id}`}
            >
              {/* Header: Badge & Distance */}
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span
                  className={`text-[11px] font-heading font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 whitespace-nowrap ${badgeColor}`}
                >
                  {badgeLabel}
                </span>
                <span className="text-[11px] font-semibold text-[#594139] bg-[#F4F4F0] px-2 py-0.5 rounded-md whitespace-nowrap">
                  {distanceText}
                </span>
              </div>

              {/* WHAT: Place Name & Category */}
              <div className="mb-2">
                <h4 className="font-heading text-sm font-bold text-[#2D2926] line-clamp-1">
                  {place.name}
                </h4>
                <p className="text-[11px] text-[#594139]/80 font-medium truncate">
                  {place.categoryLabel || place.district}
                </p>
              </div>

              {/* WHY: Truthful Reason to Go */}
              <div className="space-y-0.5 mb-2.5 bg-[#FAF9F5] p-2 rounded-xl border border-[#2D2926]/5">
                <div className="flex items-center gap-1.5 text-xs text-[#2D2926]">
                  <span className="text-sm shrink-0">{opp.reasonData?.icon || opp.reasons[0]?.icon || '✨'}</span>
                  <span className="font-bold text-[11px] leading-tight text-[#2D2926]">{primaryReason}</span>
                </div>
                {secondaryReason && (
                  <p className="text-[10px] text-[#594139] pl-5 font-medium">
                    {secondaryReason}
                  </p>
                )}
              </div>

              {/* ACTION: Purposeful CTA Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (hasMovedRef.current) return;
                  onActionClick(opp);
                }}
                className={`w-full h-8.5 rounded-xl font-heading text-xs font-bold flex items-center justify-center gap-1 transition-all active:scale-95 shadow-sm whitespace-nowrap ${
                  opp.type === 'SCOUT_WINDOW'
                    ? 'bg-[#2EC4B6] hover:bg-[#2EC4B6]/90 text-white'
                    : opp.type === 'QUEST_MATCH'
                    ? 'bg-[#FF9F1C] hover:bg-[#FF9F1C]/90 text-[#2D2926]'
                    : opp.type === 'STARTER_QUEST'
                    ? 'bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white'
                    : 'bg-[#2D2926] hover:bg-[#2D2926]/90 text-white'
                }`}
                id={`btn-action-${opp.id}`}
              >
                <span className="material-symbols-outlined text-[15px]">{ctaIcon}</span>
                <span>{ctaText}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
