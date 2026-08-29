/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Place } from '../types';

interface MysteryDropModalProps {
  isOpen: boolean;
  onClose: () => void;
  nearbyPlaces: Place[];
  onNavigateToPlace: (place: Place) => void;
}

export const MysteryDropModal: React.FC<MysteryDropModalProps> = ({
  isOpen,
  onClose,
  nearbyPlaces,
  onNavigateToPlace,
}) => {
  const [isOpened, setIsOpened] = useState(false);
  const [isOpening, setIsOpening] = useState(false);

  if (!isOpen) return null;

  const targetPlace =
    nearbyPlaces.length > 0
      ? nearbyPlaces[Math.floor(Math.random() * nearbyPlaces.length)]
      : null;

  const handleOpenChest = () => {
    if (isOpened || isOpening) return;
    setIsOpening(true);
    setTimeout(() => {
      setIsOpening(false);
      setIsOpened(true);
    }, 900);
  };

  const handleResetAndClose = () => {
    setIsOpened(false);
    setIsOpening(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={handleResetAndClose}
    >
      <div
        className="bg-gradient-to-b from-[#1C1917] via-[#292524] to-[#1C1917] text-white w-full max-w-sm rounded-3xl p-6 border border-amber-500/40 shadow-[0_16px_50px_rgba(245,158,11,0.25)] flex flex-col items-center text-center gap-4 animate-slide-up relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Background Aura Glow */}
        <div className="absolute -top-16 -left-16 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-orange-500/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Close Button */}
        <button
          type="button"
          onClick={handleResetAndClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-stone-800/80 hover:bg-stone-700 text-stone-300 flex items-center justify-center text-sm transition-colors cursor-pointer"
        >
          ✕
        </button>

        {!isOpened ? (
          <>
            {/* Chest Visual */}
            <div className="relative mt-2">
              <div
                className={`text-6xl select-none transition-transform duration-300 cursor-pointer ${
                  isOpening
                    ? 'animate-ping scale-125'
                    : 'hover:scale-110 active:scale-95 animate-bounce'
                }`}
                onClick={handleOpenChest}
              >
                🎁
              </div>
              <div className="absolute -inset-4 bg-amber-400/20 rounded-full blur-xl pointer-events-none"></div>
            </div>

            {/* Title & FOMO copy */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  ⚡ FLASH DROP GIỜ VÀNG
                </span>
              </div>
              <h3 className="font-heading text-lg font-bold text-amber-200 mt-1">
                Rương Kho Báu Ẩm Thực!
              </h3>
              <p className="text-xs text-stone-300 max-w-xs leading-relaxed">
                Một rương bí mật vừa rơi tại tọa độ gần bạn. Mở ngay để nhận quà độc quyền và nhiệm vụ x2 XP!
              </p>
            </div>

            {/* Tap to open button */}
            <button
              type="button"
              onClick={handleOpenChest}
              disabled={isOpening}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 font-heading font-black text-sm rounded-2xl shadow-[0_4px_16px_rgba(245,158,11,0.4)] transition-all transform active:scale-95 cursor-pointer"
            >
              {isOpening ? 'Đang giải mã phong ấn...' : '✨ CHẠM ĐỂ MỞ RƯƠNG ✨'}
            </button>
          </>
        ) : (
          <>
            {/* Revealed Reward Visual */}
            <div className="relative mt-1">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-3xl shadow-lg border-2 border-white animate-bounce">
                👑
              </div>
              <div className="absolute -inset-3 bg-amber-400/30 rounded-full blur-xl pointer-events-none"></div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-amber-400 tracking-wide uppercase">
                🎉 Chúc mừng bạn đã mở khóa!
              </span>
              <h3 className="font-heading text-xl font-black text-white">
                +150 XP & Deal x2 Quán Hot
              </h3>
              {targetPlace && (
                <div className="mt-2 p-3 rounded-2xl bg-stone-900/80 border border-amber-500/30 text-left flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-600/30 text-orange-400 flex items-center justify-center text-xl shrink-0">
                    🍜
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] text-amber-300 font-bold">
                      Nhiệm vụ bí mật hôm nay:
                    </span>
                    <strong className="text-xs font-bold text-white truncate">
                      {targetPlace.name}
                    </strong>
                    <span className="text-[10.5px] text-stone-400 truncate">
                      {targetPlace.address || 'Quán đang được quan tâm nhiều nhất'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 w-full mt-1">
              {targetPlace && (
                <button
                  type="button"
                  onClick={() => {
                    handleResetAndClose();
                    onNavigateToPlace(targetPlace);
                  }}
                  className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-heading font-bold text-xs rounded-2xl shadow-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>📍 Bay đến quán & Check-in ngay</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleResetAndClose}
                className="w-full py-2.5 text-xs text-stone-400 hover:text-stone-200 transition-colors cursor-pointer font-medium"
              >
                Để sau
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
