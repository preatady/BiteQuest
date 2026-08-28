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

  // 1. Hero Selection Logic
  const heroOpportunity = useMemo(() => {
    if (!todayOpportunities || todayOpportunities.length === 0) return null;
    const sorted = [...todayOpportunities].sort((a, b) => {
      const pA = HERO_PRIORITY_MAP[a.type] ?? 99;
      const pB = HERO_PRIORITY_MAP[b.type] ?? 99;
      return pA - pB;
    });
    return sorted[0];
  }, [todayOpportunities]);

  // 2. Truthful Location Copy
  const heroTitle = isRealUserLocation ? 'Hôm nay quanh bạn' : 'Hôm nay ở khu vực này';
  const locationPhrase = isRealUserLocation ? 'quanh đây' : 'trong khu vực này';

  if (isLoading && totalVenuesCount === 0) {
    return null;
  }

  if (totalVenuesCount === 0 || !todayOpportunities || todayOpportunities.length === 0) {
    return null;
  }

  const todayCount = todayOpportunities.length;

  return (
    <div
      className="absolute bottom-22 left-3 z-30 pointer-events-auto transition-all duration-300 ease-out"
      id="today-discovery-floating-widget"
    >
      {/* 1. COMPACT CORNER ICON / PILL (When collapsed) */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group bg-[#FDFCF8]/95 hover:bg-white active:scale-95 text-[#2D2926] backdrop-blur-md px-3.5 py-2.5 rounded-full shadow-[0_4px_18px_rgba(45,41,38,0.15)] border border-[#2D2926]/12 flex items-center gap-2 transition-all cursor-pointer hover:shadow-lg"
          id="btn-open-discovery-peek"
          title="Xem gợi ý ẩm thực hôm nay"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF6B35] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FF6B35]"></span>
          </span>

          <span className="font-heading text-xs font-bold tracking-tight text-[#2D2926]">
            Hôm nay
          </span>

          <span className="bg-[#FF6B35]/15 text-[#FF6B35] font-heading text-[10px] font-black px-1.5 py-0.5 rounded-full">
            {todayCount} gợi ý
          </span>

          <span className="material-symbols-outlined text-[16px] text-[#8D7168] group-hover:text-[#FF6B35] group-hover:-translate-y-0.5 transition-transform">
            expand_less
          </span>
        </button>
      )}

      {/* 2. EXPANDED POPUP CARD (When tapped) */}
      {isOpen && (
        <div
          className="w-[calc(100vw-24px)] max-w-sm sm:max-w-md bg-[#FDFCF8]/98 backdrop-blur-md rounded-3xl border border-[#2D2926]/12 shadow-[0_8px_32px_rgba(45,41,38,0.2)] p-4 flex flex-col gap-3 animate-slide-up"
          id="today-discovery-popover"
        >
          {/* Header Row */}
          <div className="flex items-center justify-between border-b border-[#2D2926]/8 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-[#FF6B35]/15 text-[#FF6B35] flex items-center justify-center text-sm font-bold">
                📍
              </div>
              <div>
                <h3 className="font-heading text-xs font-extrabold uppercase tracking-wider text-[#594139]">
                  {heroTitle}
                </h3>
                <p className="text-[11px] text-[#8D7168]">
                  {totalVenuesCount} địa điểm {locationPhrase} • Chọn {todayCount} nơi đáng thử
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-7 h-7 rounded-full bg-[#FAF9F5] hover:bg-[#F4F4F0] text-[#594139] hover:text-[#2D2926] flex items-center justify-center transition-all cursor-pointer active:scale-90"
              title="Thu nhỏ icon"
              id="btn-close-discovery-popover"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          {/* List of Today Opportunities */}
          <div className="space-y-2 max-h-[48vh] overflow-y-auto pr-0.5 no-scrollbar">
            {todayOpportunities.map((opp, idx) => (
              <div
                key={opp.venueId || idx}
                onClick={() => {
                  onSelectVenue(opp.venueId);
                  setIsOpen(false);
                }}
                className="bg-white hover:bg-[#FAF9F5] p-3 rounded-2xl border border-[#2D2926]/8 transition-all cursor-pointer flex items-center justify-between gap-2.5 shadow-2xs hover:shadow-xs active:scale-[0.98]"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="font-heading text-xs font-bold text-[#2D2926] truncate">
                      {opp.venueName}
                    </span>
                    {opp.type === 'JOURNEY_MATCH' && (
                      <span className="bg-[#FF9F1C]/20 text-[#9E5D00] text-[9px] font-heading font-black px-1.5 py-0.2 rounded-full shrink-0">
                        Hành trình
                      </span>
                    )}
                    {opp.type === 'SCOUT' && (
                      <span className="bg-[#2EC4B6]/20 text-[#006A62] text-[9px] font-heading font-black px-1.5 py-0.2 rounded-full shrink-0">
                        First Bite
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#FF6B35] font-semibold truncate">
                    {opp.headline}
                  </p>
                  <p className="text-[10px] text-[#8D7168] truncate mt-0.5">
                    {opp.subheadline}
                  </p>
                </div>

                <div className="shrink-0 flex items-center">
                  <span className="w-8 h-8 rounded-full bg-[#FF6B35]/10 text-[#FF6B35] flex items-center justify-center text-xs font-bold hover:bg-[#FF6B35] hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
