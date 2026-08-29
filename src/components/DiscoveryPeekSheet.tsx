import React, { useState, useMemo } from 'react';
import { TodayOpportunity, TodayOpportunityType } from '../services/todayIntelligenceAdapter';

interface DiscoveryPeekSheetProps {
  todayOpportunities: TodayOpportunity[];
  totalVenuesCount: number;
  isRealUserLocation: boolean;
  isLoading: boolean;
  onSelectVenue: (venueId: string) => void;
}

const HERO_PRIORITY_MAP: Record<TodayOpportunityType, number> = {
  JOURNEY_MATCH: 1,
  SCOUT: 2,
  PREFERENCE_MATCH: 3,
  NEW_TO_YOU: 4,
  FRESH_VERIFIED: 5,
  PROXIMITY: 6,
};

export const DiscoveryPeekSheet: React.FC<DiscoveryPeekSheetProps> = ({
  todayOpportunities,
  totalVenuesCount,
  isRealUserLocation,
  isLoading,
  onSelectVenue,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // 1. Standout Hero Opportunity Selection
  const heroOpportunity = useMemo(() => {
    if (!todayOpportunities || todayOpportunities.length === 0) return null;
    const sorted = [...todayOpportunities].sort((a, b) => {
      const pA = HERO_PRIORITY_MAP[a.type] ?? 99;
      const pB = HERO_PRIORITY_MAP[b.type] ?? 99;
      return pA - pB;
    });
    return sorted[0];
  }, [todayOpportunities]);

  // Secondary choices (limited to 2 for simplicity)
  const secondaryOpportunities = useMemo(() => {
    if (!todayOpportunities || todayOpportunities.length <= 1) return [];
    return todayOpportunities.slice(1, 3);
  }, [todayOpportunities]);

  if (isLoading && totalVenuesCount === 0) {
    return null;
  }

  if (totalVenuesCount === 0 || !todayOpportunities || todayOpportunities.length === 0 || !heroOpportunity) {
    return null;
  }

  const todayCount = todayOpportunities.length;

  if (isDismissed) {
    return (
      <div className="absolute bottom-20 left-3 z-30 pointer-events-auto">
        <button
          type="button"
          onClick={() => setIsDismissed(false)}
          className="bg-white/95 hover:bg-white text-[#2D2926] backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-[0_4px_16px_rgba(45,41,38,0.12)] border border-stone-200/90 text-xs font-heading font-semibold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
          title="Mở gợi ý quanh đây"
        >
          <span className="text-amber-500">✨</span>
          <span>Có gợi ý cho bạn</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="absolute bottom-20 left-3 right-3 md:left-1/2 md:-translate-x-1/2 md:w-[460px] z-30 pointer-events-auto transition-all duration-300 ease-out"
      id="smart-discovery-card-container"
    >
      {/* 1. COMPACT STANDOUT RECOMMENDATION (Calm, Curious, Intelligent) */}
      <div
        className="bg-[#FDFCF8]/98 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgba(45,41,38,0.14)] border border-[#2D2926]/10 p-3.5 transition-all duration-300"
        id="smart-recommendation-card"
      >
        {/* Subtle Curious Header */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 text-xs font-heading font-bold text-[#FF6B35]">
            <span className="text-xs">✨</span>
            <span>Có một lựa chọn khá hợp với bạn</span>
          </div>

          <div className="flex items-center gap-1">
            {secondaryOpportunities.length > 0 && (
              <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className="text-[11px] font-heading font-medium text-stone-500 hover:text-stone-800 transition-colors px-2 py-0.5 rounded-full hover:bg-stone-100 cursor-pointer flex items-center gap-0.5"
              >
                <span>{isOpen ? 'Thu gọn' : `+${secondaryOpportunities.length} lựa chọn`}</span>
                <span className="material-symbols-outlined text-[14px]">
                  {isOpen ? 'expand_less' : 'expand_more'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="w-6 h-6 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
              title="Tạm ẩn"
              aria-label="Tạm ẩn"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          </div>
        </div>

        {/* Hero Spotlight Venue */}
        <div
          onClick={() => onSelectVenue(heroOpportunity.venueId)}
          className="flex items-center justify-between gap-3 bg-white hover:bg-stone-50/80 p-2.5 rounded-xl border border-stone-200/70 transition-all cursor-pointer group"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="font-heading text-sm font-bold text-[#2D2926] group-hover:text-[#FF6B35] transition-colors truncate">
                {heroOpportunity.title}
              </h3>
              <span className="text-[11px] text-amber-600 font-heading font-bold shrink-0">
                4.8 ★
              </span>
            </div>

            {/* Human context line: Time / Road state / Real Reason */}
            <p className="text-[11.5px] text-[#594139] font-medium truncate mt-0.5">
              {heroOpportunity.reasonPrimary || 'Đường khá thoáng lúc này · Quán ngon gần bạn'}
            </p>
          </div>

          {/* Clean Action Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectVenue(heroOpportunity.venueId);
            }}
            className="px-3 py-1.5 rounded-xl bg-[#FF6B35] hover:bg-[#E85D2A] text-white font-heading text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0 flex items-center gap-1"
          >
            <span>Xem</span>
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </button>
        </div>

        {/* 2. Optional Secondary Choices (Expanded quietly on request) */}
        {isOpen && secondaryOpportunities.length > 0 && (
          <div className="mt-2.5 pt-2.5 border-t border-stone-200/60 space-y-1.5 animate-fade-in">
            {secondaryOpportunities.map((opp) => (
              <div
                key={opp.venueId}
                onClick={() => onSelectVenue(opp.venueId)}
                className="flex items-center justify-between gap-2.5 p-2 rounded-xl hover:bg-stone-100/80 transition-colors cursor-pointer group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-heading text-xs font-bold text-stone-800 group-hover:text-[#FF6B35] transition-colors truncate">
                      {opp.title}
                    </span>
                    <span className="text-[10.5px] text-stone-400 font-medium shrink-0">
                      • {opp.type === 'JOURNEY_MATCH' ? 'Thử thách' : 'Được thích'}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 truncate mt-0.2">
                    {opp.reasonPrimary || 'Điểm đến hấp dẫn quanh đây'}
                  </p>
                </div>

                <span className="text-[11px] font-heading font-semibold text-[#FF6B35] shrink-0 group-hover:translate-x-0.5 transition-transform">
                  Xem →
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};


