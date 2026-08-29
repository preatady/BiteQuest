import React, { useState } from 'react';
import { BiteCheckin } from '../types';

interface FriendFeedViewProps {
  feedBites: BiteCheckin[];
  onReact: (biteId: string, emoji: string) => void;
  onNavigateToPlace: (placeId: string) => void;
  onNavigateToCamera?: () => void;
}

export const FriendFeedView: React.FC<FriendFeedViewProps> = ({
  feedBites,
  onReact,
  onNavigateToPlace,
  onNavigateToCamera,
}) => {
  const [activeReactionTray, setActiveReactionTray] = useState<string | null>(null);
  const extraEmojis = ['🤤', '🔥', '💯', '❤️', '🙌', '🥺', '🍜', '☕', '🍔', '😋'];

  return (
    <div className="min-h-screen bg-[#FDFCF8] text-[#2D2926] pt-[calc(4.5rem+env(safe-area-inset-top,0px))] pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] px-4 max-w-lg mx-auto" id="friends-feed-container">
      {/* Feed Page Title */}
      <div className="mb-6">
        <h2 className="font-heading text-2xl font-black text-[#2D2926]">
          Bản tin ẩm thực 😋
        </h2>
        <p className="text-sm text-[#594139] opacity-80 mt-1">
          Cập nhật những món ngon đã xác minh và dấu mốc mới từ cộng đồng Foodie.
        </p>
      </div>

      {feedBites.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border border-[#2D2926]/5 shadow-sm text-center flex flex-col items-center gap-4 my-6 animate-fade-in" id="empty-feed-card">
          <div className="w-16 h-16 rounded-full bg-[#FF6B35]/12 flex items-center justify-center text-3xl">
            📸
          </div>
          <div>
            <h3 className="font-heading text-base font-bold text-[#2D2926]">Chưa có bài đăng nào</h3>
            <p className="text-xs text-[#594139] mt-1 leading-relaxed max-w-xs mx-auto">
              Hãy là người đầu tiên ghé quán, chụp món ăn bằng camera AI để nhận huy hiệu First Bite và đăng lên Bản tin!
            </p>
          </div>
          {onNavigateToCamera && (
            <button
              type="button"
              onClick={onNavigateToCamera}
              className="mt-2 px-5 py-2.5 rounded-full bg-[#FF6B35] text-white font-heading font-bold text-xs shadow-sm hover:bg-[#E85D2A] active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">photo_camera</span>
              Chụp & Check-in món ngay
            </button>
          )}
        </div>
      ) : (
        /* Feed List */
        <div className="flex flex-col gap-6">
          {feedBites.map((bite) => (
          <article
            key={bite.id}
            className="bg-white rounded-3xl shadow-[0_4px_24px_rgba(45,41,38,0.06)] border border-[#2D2926]/5 overflow-hidden transition-transform duration-200 hover:-translate-y-0.5"
            id={`post-${bite.id}`}
          >
            {/* Header: User Info */}
            <div className="flex items-center justify-between p-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#E9E8E4] ring-2 ring-[#FF6B35]/20">
                  <img
                    src={bite.userAvatar}
                    alt={bite.userName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="font-heading text-sm font-bold text-[#2D2926]">
                    {bite.userName}
                  </span>
                  <span className="text-xs text-[#594139]/70">{bite.createdAt}</span>
                </div>
              </div>

              {/* Quick Heart Favorite */}
              <button
                onClick={() => onReact(bite.id, '❤️')}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-[#F4F4F0] text-[#594139] hover:bg-[#FF6B35] hover:text-white transition-colors active:scale-90"
                title="Yêu thích"
              >
                <span className="material-symbols-outlined text-[18px]">favorite</span>
              </button>
            </div>

            {/* Photo Container (Locket Style with Floating Badges) */}
            <div className="w-full aspect-[4/4.5] relative px-4 pb-2">
              <div className="w-full h-full rounded-2xl overflow-hidden shadow-inner relative">
                <img
                  src={bite.imageUrl}
                  alt={bite.placeName}
                  className="w-full h-full object-cover"
                />

                {/* Floating Bottom Location & Verification Badges */}
                <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2 drop-shadow-md">
                  <button
                    onClick={() => onNavigateToPlace(bite.placeId)}
                    className="bg-[#FDFCF8]/95 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-white/30 text-left max-w-[65%] hover:scale-102 transition-transform shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[16px] text-[#FF6B35] fill flex-shrink-0">
                      location_on
                    </span>
                    <span className="font-heading text-xs font-bold text-[#2D2926] truncate">
                      {bite.placeName}
                    </span>
                  </button>

                  {bite.isVerified && (
                    <div className="bg-[#2EC4B6]/20 backdrop-blur-md text-[#006A62] px-2.5 py-1 rounded-full flex items-center gap-1 border border-[#2EC4B6]/30 shadow-sm flex-shrink-0">
                      <span className="text-[11px] font-heading font-semibold">Đã xác minh</span>
                      <span className="material-symbols-outlined text-[14px] fill">check_circle</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Content & Social Quotes */}
            <div className="px-4 pb-4 pt-2 flex flex-col gap-3">
              <p className="text-sm text-[#2D2926] leading-relaxed font-normal">
                "{bite.caption}"
              </p>

              {/* Quick Emoji Reaction Buttons */}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                {bite.reactions.map((r, idx) => (
                  <button
                    key={idx}
                    onClick={() => onReact(bite.id, r.emoji)}
                    className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all text-xs font-semibold ${
                      r.userReacted
                        ? 'bg-[#FF6B35]/15 border border-[#FF6B35]/40 text-[#FF6B35] scale-105'
                        : 'bg-[#F4F4F0] hover:bg-[#E9E8E4] text-[#2D2926]'
                    }`}
                  >
                    <span className="text-base leading-none">{r.emoji}</span>
                    <span className="text-xs font-bold">{r.count}</span>
                  </button>
                ))}

                {/* Add Reaction Toggle */}
                <button
                  onClick={() =>
                    setActiveReactionTray(activeReactionTray === bite.id ? null : bite.id)
                  }
                  className="ml-auto flex items-center gap-1 text-[#594139]/60 hover:text-[#FF6B35] transition-colors p-1.5 rounded-full hover:bg-[#F4F4F0]"
                  title="Thêm cảm xúc"
                >
                  <span className="material-symbols-outlined text-[20px]">add_reaction</span>
                </button>
              </div>

              {/* Popover Emoji Tray */}
              {activeReactionTray === bite.id && (
                <div className="flex items-center gap-2 p-2 bg-[#F4F4F0] rounded-2xl animate-fade-in border border-[#2D2926]/10 flex-wrap">
                  {extraEmojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        onReact(bite.id, emoji);
                        setActiveReactionTray(null);
                      }}
                      className="text-xl p-1 hover:scale-125 transition-transform"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
      )}
    </div>
  );
};
