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

  // 1. Hero Context Selection Logic
  const heroOpportunity = useMemo(() => {
    if (!todayOpportunities || todayOpportunities.length === 0) return null;
    const sorted = [...todayOpportunities].sort((a, b) => {
      const pA = HERO_PRIORITY_MAP[a.type] ?? 99;
      const pB = HERO_PRIORITY_MAP[b.type] ?? 99;
      return pA - pB;
    });
    return sorted[0];
  }, [todayOpportunities]);

  // 2. Truthful Location Copy & Context
  const heroTitle = isRealUserLocation ? 'Khám phá gần bạn' : 'Gợi ý trong khu vực này';
  const locationPhrase = isRealUserLocation ? 'quanh bạn' : 'khu vực này';

  if (isLoading && totalVenuesCount === 0) {
    return null;
  }

  if (totalVenuesCount === 0 || !todayOpportunities || todayOpportunities.length === 0) {
    return null;
  }

  const todayCount = todayOpportunities.length;

  if (isDismissed) {
    return (
      <div className="absolute bottom-20 left-3 z-30 pointer-events-auto">
        <button
          type="button"
          onClick={() => setIsDismissed(false)}
          className="bg-white/90 hover:bg-white text-[#2D2926] backdrop-blur-md px-3 py-1.5 rounded-full shadow-md border border-stone-200 text-xs font-heading font-semibold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
          title="Mở gợi ý hôm nay"
        >
          <span>🎯</span>
          <span>{todayCount} gợi ý</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="absolute bottom-20 left-3 right-3 md:left-1/2 md:-translate-x-1/2 md:w-[480px] z-30 pointer-events-auto transition-all duration-300 ease-out"
      id="smart-discovery-card-container"
    >
      {/* 1. COLLAPSED SMART GLANCE BAR (Default Context-Aware Action Card) */}
      {!isOpen && heroOpportunity && (
        <div
          onClick={() => setIsOpen(true)}
          className="bg-white/96 hover:bg-white active:scale-[0.99] text-[#2D2926] backdrop-blur-md px-3 py-2 rounded-xl shadow-[0_4px_20px_rgba(45,41,38,0.12)] border border-stone-200/90 flex items-center justify-between gap-2.5 transition-all cursor-pointer group"
          id="smart-discovery-glance-bar"
          role="button"
          tabIndex={0}
          aria-label="Mở danh sách gợi ý khám phá hôm nay"
        >
          {/* Left Context Pulse Indicator */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center text-xs font-bold shrink-0 border border-orange-200/60">
              {heroOpportunity.type === 'JOURNEY_MATCH'
                ? '🎯'
                : heroOpportunity.type === 'SCOUT'
                ? '⭐'
                : '📍'}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 leading-tight">
                <span className="font-heading text-xs font-bold text-[#2D2926] truncate">
                  {heroOpportunity.title}
                </span>

                {heroOpportunity.type === 'JOURNEY_MATCH' && (
                  <span className="bg-amber-100 text-amber-900 text-[9px] font-heading font-bold px-1.5 py-0.2 rounded-full shrink-0">
                    Hành trình
                  </span>
                )}
                {heroOpportunity.type === 'SCOUT' && (
                  <span className="bg-teal-100 text-teal-900 text-[9px] font-heading font-bold px-1.5 py-0.2 rounded-full shrink-0">
                    First Bite
                  </span>
                )}
              </div>

              <p className="text-[10px] text-stone-500 font-medium truncate leading-tight mt-0.5">
                {heroOpportunity.reasonPrimary || `${todayCount} điểm đến hấp dẫn ${locationPhrase}`}
              </p>
            </div>
          </div>

          {/* Right Action & Dismiss */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectVenue(heroOpportunity.venueId);
              }}
              className="px-2.5 py-1 rounded-full bg-[#FF6B35] hover:bg-[#E85D2A] text-white font-heading text-[11px] font-bold transition-colors cursor-pointer shadow-2xs"
              title="Xem vị trí trên bản đồ"
            >
              Xem
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsDismissed(true);
              }}
              className="w-6 h-6 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
              title="Thu nhỏ"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. EXPANDED SMART DISCOVERY BOTTOM SHEET (When tapped) */}
      {isOpen && (
        <>
          {/* Backdrop to dismiss when clicking anywhere on map */}
          <div
            className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px] transition-opacity"
            onClick={() => setIsOpen(false)}
            id="discovery-peek-backdrop"
          />

          <div
            className="fixed bottom-20 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:w-[480px] z-50 bg-[#FDFCF8]/98 backdrop-blur-md rounded-3xl border border-[#2D2926]/12 shadow-[0_16px_48px_rgba(45,41,38,0.25)] p-4 sm:p-5 flex flex-col gap-3.5 animate-slide-up"
            id="today-discovery-popover"
            role="dialog"
            aria-modal="true"
            aria-label="Danh sách gợi ý ẩm thực hôm nay"
          >
            {/* Header Row */}
            <div className="flex items-center justify-between border-b border-[#2D2926]/8 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#FF6B35]/15 text-[#FF6B35] flex items-center justify-center text-sm font-bold shadow-2xs">
                  ✨
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-heading text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[#2D2926]">
                      {heroTitle}
                    </h3>
                    <span className="bg-[#2EC4B6]/15 text-[#006A62] text-[8.5px] font-heading font-black px-1.5 py-0.2 rounded-md uppercase">
                      AI Riser Engine
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8D7168] mt-0.5">
                    {totalVenuesCount} địa điểm {locationPhrase} • Chọn lọc {todayCount} nơi đáng thử nhất
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-[#2D2926]/5 hover:bg-[#2D2926]/10 text-[#594139] hover:text-[#2D2926] flex items-center justify-center transition-all cursor-pointer active:scale-90"
                title="Thu nhỏ danh sách"
                id="btn-close-discovery-popover"
                aria-label="Đóng danh sách"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* List of Contextual Opportunities */}
            <div className="space-y-2 max-h-[48vh] overflow-y-auto pr-0.5 no-scrollbar">
              {todayOpportunities.map((opp, idx) => (
                <div
                  key={opp.venueId || idx}
                  onClick={() => {
                    onSelectVenue(opp.venueId);
                    setIsOpen(false);
                  }}
                  className="bg-white hover:bg-[#FAF9F5] p-3.5 rounded-2xl border border-[#2D2926]/8 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-2xs hover:shadow-xs active:scale-[0.99] group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="font-heading text-xs sm:text-sm font-bold text-[#2D2926] group-hover:text-[#FF6B35] transition-colors truncate">
                        {opp.title}
                      </span>
                      {opp.type === 'JOURNEY_MATCH' && (
                        <span className="bg-[#FF9F1C]/20 text-[#9E5D00] text-[9px] font-heading font-black px-1.5 py-0.2 rounded-full shrink-0">
                          Hành trình
                        </span>
                      )}
                      {opp.type === 'SCOUT' && (
                        <span className="bg-[#2EC4B6]/20 text-[#006A62] text-[9px] font-heading font-black px-1.5 py-0.2 rounded-full shrink-0">
                          First Bite +2x
                        </span>
                      )}
                    </div>
                    <p className="text-[11.5px] text-[#FF6B35] font-semibold truncate leading-tight">
                      {opp.reasonPrimary}
                    </p>
                    {opp.reasonSecondary && (
                      <p className="text-[10.5px] text-[#8D7168] truncate mt-0.5 leading-tight">
                        {opp.reasonSecondary}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center">
                    <span className="w-8 h-8 rounded-full bg-[#FF6B35]/10 text-[#FF6B35] group-hover:bg-[#FF6B35] group-hover:text-white flex items-center justify-center transition-all shadow-2xs">
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Subtle Footer Note */}
            <div className="pt-2 border-t border-[#2D2926]/6 flex items-center justify-between text-[10px] text-[#8D7168]">
              <span>Tự động tối ưu theo vị trí và khẩu vị</span>
              <span className="font-heading font-bold text-[#FF6B35]">BiteQuest × AI Riser</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

