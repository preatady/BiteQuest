/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ChevronUp } from 'lucide-react';
import { Place } from '../types';
import { SmartDecisionState } from '../services/smartSearchDecisionEngine';
import { useLanguage } from '../context/LanguageContext';

interface SmartDecisionCardProps {
  decision: SmartDecisionState;
  onSelectVenue: (venue: Place) => void;
  isLoading?: boolean;
  onToggleCollapse?: () => void;
  customBadgeTitle?: string;
}

export const SmartDecisionCard: React.FC<SmartDecisionCardProps> = ({
  decision,
  onSelectVenue,
  isLoading = false,
  onToggleCollapse,
  customBadgeTitle,
}) => {
  const { isVi, t } = useLanguage();
  const { bestRoute, closestRoute, isDifferent, explanation } = decision;
  const bestPlace = bestRoute.place;
  const confidence = explanation?.confidenceScore ?? 94;

  const defaultBadgeTitle = isVi ? 'Lựa chọn Tối ưu BiteQuest' : 'BiteQuest Smart Choice';
  const badgeTitle = customBadgeTitle || defaultBadgeTitle;

  return (
    <div
      className="mx-3.5 my-2.5 p-3.5 rounded-2xl bg-gradient-to-br from-amber-50/90 via-orange-50/40 to-stone-50 border border-amber-200/90 shadow-sm transition-all animate-fade-in"
      id={`smart-decision-card-${bestPlace.id}`}
    >
      {/* Header Pill & Confidence Badge & Collapse Chevron */}
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-900 text-[11px] font-heading font-bold">
          <span className="text-xs">🧠</span>
          <span>{badgeTitle}</span>
        </div>

        <div className="flex items-center gap-2">
          {confidence >= 85 && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-[10.5px] font-heading font-bold shadow-2xs"
              title={
                isVi
                  ? 'Độ tin cậy cao dựa trên định vị GPS, tuyến đường thực tế và khung giờ giao thông đô thị'
                  : 'High confidence based on GPS data, live routing, and urban traffic peak windows'
              }
              id="confidence-badge-green"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span>
                {isVi ? `Độ tin cậy ${confidence}%` : `Confidence ${confidence}%`}
              </span>
            </div>
          )}

          <span className="text-[10.5px] font-semibold text-stone-500 font-heading">
            {bestRoute.distanceKmFormatted} • ~{bestRoute.estimatedDurationMinutes}{' '}
            {isVi ? 'phút' : 'mins'}
          </span>

          {onToggleCollapse && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse();
              }}
              className="p-1 rounded-lg bg-amber-100/80 hover:bg-amber-200 text-amber-900 transition-all flex items-center gap-0.5 text-[10.5px] font-heading font-bold cursor-pointer"
              title={isVi ? 'Kéo về bình thường / Ẩn chi tiết' : 'Collapse details'}
            >
              <ChevronUp className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>

      {/* Main Recommendation Content */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-[14px] font-heading font-bold text-stone-900 truncate">
              {bestPlace.name}
            </h4>
            {bestPlace.rating && (
              <span className="px-1.5 py-0.2 rounded text-[10.5px] font-heading font-bold bg-amber-100 text-amber-800 shrink-0">
                ★ {bestPlace.rating}
              </span>
            )}
          </div>
          <p className="text-[11.5px] text-stone-500 truncate mt-0.5">
            {bestPlace.address || bestPlace.district || (isVi ? 'Hà Nội' : 'Hanoi')}
          </p>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={() => onSelectVenue(bestPlace)}
          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#FF6B35] to-[#E85D2A] hover:brightness-110 text-white text-xs font-heading font-bold shadow-xs active:scale-95 transition-all shrink-0 cursor-pointer"
          id="btn-select-smart-best"
        >
          {isVi ? 'Chọn quán này' : 'Select Venue'}
        </button>
      </div>

      {/* Traffic & Safety Indicator Row */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-amber-200/60 text-[11px]">
        <span className="px-2 py-0.5 rounded-md bg-white border border-stone-200/80 font-medium text-stone-700 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          <span>
            {bestRoute.trafficLabel
              ? isVi
                ? bestRoute.trafficLabel
                : bestRoute.trafficLabel.includes('thông thoáng') || bestRoute.trafficLabel.includes('thuận lợi')
                ? 'Clear Traffic'
                : bestRoute.trafficLabel.includes('Ùn')
                ? 'Light Traffic'
                : 'Heavy Traffic'
              : isVi
              ? 'Giao thông thuận lợi'
              : 'Clear Traffic'}
          </span>
        </span>

        {bestRoute.weatherFlood?.routeFloodRisk === 'none' && (
          <span className="px-2 py-0.5 rounded-md bg-white border border-stone-200/80 font-medium text-emerald-700 flex items-center gap-1">
            <span>🛡️</span>
            <span>{isVi ? 'Đường khô ráo, không ngập' : 'Dry roads, flood-safe'}</span>
          </span>
        )}

        {isDifferent && closestRoute && (
          <span className="px-2 py-0.5 rounded-md bg-orange-100/80 border border-orange-300/60 font-medium text-orange-900 flex items-center gap-1">
            <span>⚖️</span>
            <span>
              {isVi
                ? `Né tắc đường so với ${closestRoute.place.name}`
                : `Avoids traffic vs. ${closestRoute.place.name}`}
            </span>
          </span>
        )}
      </div>

      {/* Gemini AI Grounded Explanation Reason */}
      {explanation && (
        <div className="mt-2.5 p-2.5 rounded-xl bg-white/95 border border-amber-200/70 shadow-xs">
          <div className="flex items-center gap-1.5 text-[11px] font-heading font-bold text-amber-900 mb-1">
            <span>✨</span>
            <span>{explanation.headline || (isVi ? 'Lý do BiteQuest đề xuất:' : 'Why BiteQuest Recommends:')}</span>
          </div>

          <p className="text-[11.5px] leading-relaxed text-stone-700 font-normal">
            {explanation.summary}
          </p>

          {explanation.bulletPoints && explanation.bulletPoints.length > 0 && (
            <ul className="mt-2 space-y-1 text-[11px] text-stone-600 pl-3.5 list-disc">
              {explanation.bulletPoints.slice(0, 3).map((bp, idx) => (
                <li key={idx} className="leading-tight">
                  {bp}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

