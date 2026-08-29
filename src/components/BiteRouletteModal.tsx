/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Place } from '../types';

interface BiteRouletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  places: Place[];
  onSelectPlace: (place: Place) => void;
}

export const BiteRouletteModal: React.FC<BiteRouletteModalProps> = ({
  isOpen,
  onClose,
  places,
  onSelectPlace,
}) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [winnerPlace, setWinnerPlace] = useState<Place | null>(null);

  // Eligible candidate places (curated top 8 nearest places)
  const candidatePlaces = places.slice(0, 8);

  useEffect(() => {
    if (!isOpen) {
      setIsSpinning(false);
      setWinnerPlace(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartSpin = () => {
    if (isSpinning || candidatePlaces.length === 0) return;
    setIsSpinning(true);
    setWinnerPlace(null);

    let speed = 60;
    let currentIdx = 0;
    let iterations = 0;
    const totalIterations = 24 + Math.floor(Math.random() * 8);

    const spin = () => {
      currentIdx = (currentIdx + 1) % candidatePlaces.length;
      setHighlightedIndex(currentIdx);
      iterations++;

      if (iterations < totalIterations) {
        if (iterations > totalIterations - 8) {
          speed += 40; // Slow down effect near the end
        }
        setTimeout(spin, speed);
      } else {
        setIsSpinning(false);
        const selected = candidatePlaces[currentIdx];
        setWinnerPlace(selected);
      }
    };

    spin();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-b from-[#1C1917] via-[#292524] to-[#1C1917] text-white w-full max-w-sm rounded-3xl p-5 border border-amber-500/40 shadow-2xl flex flex-col items-center text-center gap-4 animate-slide-up relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between w-full pb-2 border-b border-stone-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎲</span>
            <div className="text-left">
              <h3 className="font-heading font-bold text-sm text-amber-200">
                Vòng Quay "Ăn Gì Bây Giờ?"
              </h3>
              <span className="text-[10px] text-stone-400">
                1 chạm giải cứu cơn đói & nhận x1.5 XP
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center text-xs transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Roulette Grid of 8 options */}
        <div className="grid grid-cols-2 gap-2 w-full">
          {candidatePlaces.map((place, idx) => {
            const isHighlighted = highlightedIndex === idx;
            const isWinner = winnerPlace?.id === place.id;
            return (
              <div
                key={place.id}
                className={`p-2.5 rounded-2xl border text-left transition-all duration-150 flex items-center gap-2 ${
                  isWinner
                    ? 'bg-amber-500 text-stone-950 border-white ring-4 ring-amber-400/50 scale-105 shadow-xl font-bold z-10'
                    : isHighlighted
                    ? 'bg-amber-500/30 border-amber-400 text-white scale-102 shadow-md'
                    : 'bg-stone-900/60 border-stone-800 text-stone-300 opacity-80'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center text-sm shrink-0 ${
                    isWinner
                      ? 'bg-stone-950 text-amber-400'
                      : isHighlighted
                      ? 'bg-amber-400 text-stone-950'
                      : 'bg-stone-800 text-stone-400'
                  }`}
                >
                  {idx + 1}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold truncate">
                    {place.name}
                  </span>
                  <span
                    className={`text-[9.5px] truncate ${
                      isWinner ? 'text-stone-900 font-semibold' : 'text-stone-400'
                    }`}
                  >
                    {place.category || 'Món ngon'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action button */}
        {!winnerPlace ? (
          <button
            type="button"
            onClick={handleStartSpin}
            disabled={isSpinning}
            className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 font-heading font-black text-xs rounded-2xl shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {isSpinning ? '🎲 ĐANG QUAY NGẪU NHIÊN...' : '🎲 QUAY NGAY (CHỌN QUÁN DUYÊN PHẬN)'}
          </button>
        ) : (
          <div className="flex flex-col gap-2 w-full animate-fade-in">
            <div className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-center gap-1.5">
              <span>🎉 Vũ trụ ẩm thực chọn:</span>
              <strong className="text-white">{winnerPlace.name}</strong>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onSelectPlace(winnerPlace);
              }}
              className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-heading font-bold text-xs rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer"
            >
              📍 Chốt quán này & Bay tới xem!
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
