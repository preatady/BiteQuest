import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy,
  CheckCircle2,
  MapPin,
  Sparkles,
  Compass,
  Map,
  Share2,
  Check,
  Camera,
  Users,
} from 'lucide-react';
import { PostBiteResultData } from '../types';

interface PostBiteExperienceModalProps {
  result: PostBiteResultData | null;
  onContinueExplore: () => void;
  onViewJourney: () => void;
  onViewFeed?: () => void;
}

export const PostBiteExperienceModal: React.FC<PostBiteExperienceModalProps> = ({
  result,
  onContinueExplore,
  onViewJourney,
  onViewFeed,
}) => {
  const [copied, setCopied] = useState(false);

  if (!result) return null;

  const isVerified = Boolean(result.bite?.isVerified);
  const isFirstBite = Boolean(result.isFirstBite && isVerified);
  const isCommunityVerification = Boolean(result.isCommunityVerification && isVerified);
  const venueName = result.bite?.placeName || 'Địa điểm này';

  const journeyProgress = result.journeyProgress || {
    districtName: result.bite?.district || 'Cầu Giấy',
    completedCount: 0,
    totalCount: 6,
    milestoneCompletedTitle: result.unlockedChallenge,
    journeyChanged: Boolean(result.unlockedChallenge),
    challenges: [],
  };

  const completedRatio =
    journeyProgress.totalCount > 0
      ? Math.min(100, Math.round((journeyProgress.completedCount / journeyProgress.totalCount) * 100))
      : 0;

  // Authoritative contribution copy
  const hasAuthoritativeCount =
    typeof result.verifiedBiteCount === 'number' && result.verifiedBiteCount > 0;
  const contributionMessage = !isVerified
    ? 'Ảnh từ thư viện không được tính vào số lượt Verified Bites của địa điểm.'
    : hasAuthoritativeCount
    ? `${venueName} hiện có ${result.verifiedBiteCount} Verified Bites.`
    : 'Bạn vừa thêm 1 Verified Bite cho địa điểm này.';

  const handleShare = async () => {
    const district = journeyProgress.districtName;
    const shareText = isFirstBite
      ? `🏆 Tôi vừa là người đầu tiên xác minh First Bite tại ${venueName} (${district}) trên BiteQuest! 🍜`
      : `🌟 Tôi vừa xác minh Bite tại ${venueName} (${district}) · Hành trình ${journeyProgress.completedCount}/${journeyProgress.totalCount} trên BiteQuest!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `BiteQuest - ${venueName}`,
          text: shareText,
          url: window.location.href,
        });
        return;
      } catch (err) {
        // Fallback to clipboard on cancel or fail
      }
    }

    try {
      await navigator.clipboard.writeText(`${shareText}\n${window.location.href}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <AnimatePresence>
      <div
        id="postbite-experience-overlay"
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="postbite-heading"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="bg-[#FDFCF8] text-[#2D2926] rounded-2xl w-full max-w-md shadow-2xl border border-[#EDE8DE] overflow-hidden flex flex-col my-auto max-h-[90vh]"
          id="postbite-modal-card"
        >
          {/* Top Banner / Hero Achievement Status */}
          <div
            id="postbite-hero-header"
            className={`px-5 pt-5 pb-4 border-b ${
              !isVerified
                ? 'bg-[#F7F5F0] border-[#E8E3D9]'
                : isFirstBite
                ? 'bg-gradient-to-b from-[#FFF9E6] to-[#FDFCF8] border-[#FFE299]'
                : isCommunityVerification
                ? 'bg-gradient-to-b from-[#EDFBF4] to-[#FDFCF8] border-[#B7EBD0]'
                : 'bg-gradient-to-b from-[#FFF5EB] to-[#FDFCF8] border-[#FFDFCC]'
            }`}
          >
            {/* Primary Achievement Pill & Authoritative XP */}
            <div className="flex items-center justify-between gap-2 mb-2">
              {!isVerified ? (
                <span
                  id="postbite-status-pill"
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E8E3D9] text-[#6B6357]"
                >
                  <Camera className="w-3.5 h-3.5" />
                  ẢNH TỪ THƯ VIỆN
                </span>
              ) : isFirstBite ? (
                <span
                  id="postbite-status-pill"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FFD700]/20 text-[#8C6D00] border border-[#FFD700]/40"
                >
                  <Trophy className="w-3.5 h-3.5 text-[#B8860B]" />
                  FIRST BITE
                </span>
              ) : isCommunityVerification ? (
                <span
                  id="postbite-status-pill"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#0D9488]/10 text-[#0F766E] border border-[#0D9488]/30"
                >
                  <Users className="w-3.5 h-3.5 text-[#0D9488]" />
                  XÁC MINH CỘNG ĐỒNG
                </span>
              ) : (
                <span
                  id="postbite-status-pill"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FF6B35]/10 text-[#C84B18] border border-[#FF6B35]/25"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#FF6B35]" />
                  ĐÃ XÁC MINH BITE
                </span>
              )}

              {/* Authoritative XP Badge (strictly from server result.earnedXp) */}
              <div
                id="postbite-xp-badge"
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                  isVerified ? 'bg-[#FF6B35] text-white shadow-xs' : 'bg-[#E5E0D5] text-[#7A7265]'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                {isVerified ? `+${result.earnedXp} XP` : '+0 XP'}
              </div>
            </div>

            {/* Main Headline */}
            <h2 id="postbite-heading" className="text-xl font-bold text-[#2D2926] leading-snug">
              {!isVerified
                ? 'Ảnh đã được lưu'
                : isFirstBite
                ? 'Bạn là người đầu tiên xác minh quán này!'
                : isCommunityVerification
                ? 'Xác minh Quán Ngõ thành công'
                : 'Xác minh tại quán thành công'}
            </h2>

            {/* Context Subtitle */}
            <p id="postbite-subtitle" className="text-xs sm:text-sm text-[#665E55] mt-1 break-words">
              {!isVerified
                ? 'Ảnh từ thư viện không đủ điều kiện cho Verified Bite.'
                : isFirstBite
                ? `Bạn là người đầu tiên xác minh ${venueName} trên BiteQuest.`
                : isCommunityVerification
                ? 'Bạn vừa giúp cộng đồng xác minh một Quán Ngõ mới phát hiện.'
                : venueName}
            </p>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 text-left" id="postbite-modal-body">
            {/* 1. Venue Summary Card */}
            <div
              id="postbite-venue-card"
              className="bg-white rounded-xl p-3 sm:p-3.5 border border-[#EDE8DE] flex items-center gap-3 shadow-xs"
            >
              {result.bite?.imageUrl ? (
                <img
                  src={result.bite.imageUrl}
                  alt={result.bite.placeName}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-cover flex-shrink-0 bg-[#F0ECE1] border border-[#E8E3D9]"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-[#F0ECE1] flex items-center justify-center flex-shrink-0 border border-[#E8E3D9]">
                  <MapPin className="w-6 h-6 text-[#9A9184]" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3
                  id="postbite-venue-name"
                  className="font-bold text-[#2D2926] text-sm sm:text-base truncate leading-tight"
                >
                  {result.bite?.placeName || 'Địa điểm ẩm thực'}
                </h3>
                <p className="text-xs text-[#7A7265] truncate mt-0.5">
                  {result.bite?.placeAddress || journeyProgress.districtName}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap mt-1.5 text-[11px] text-[#594139]">
                  {result.bite?.dishName && (
                    <span className="bg-[#FF6B35]/15 text-[#C84B18] px-2 py-0.5 rounded font-bold">
                      🍽️ {result.bite.dishName}
                    </span>
                  )}
                  <span className="bg-[#F5F2EB] px-2 py-0.5 rounded font-medium">
                    {result.bite?.foodCategory === 'coffee'
                      ? '☕ Café / Trà'
                      : result.bite?.foodCategory === 'noodles'
                      ? '🍜 Bún / Phở'
                      : result.bite?.foodCategory === 'rice'
                      ? '🍛 Cơm'
                      : result.bite?.foodCategory === 'dessert'
                      ? '🍮 Tráng miệng'
                      : result.bite?.foodCategory === 'street_food'
                      ? '🛵 Quán ngõ / Ăn vặt'
                      : '🍴 Ẩm thực'}
                  </span>
                  {result.bite?.tags && result.bite.tags.length > 0 && (
                    result.bite.tags.slice(0, 2).map((t, idx) => (
                      <span key={idx} className="bg-[#F5F2EB] text-[#FF6B35] px-1.5 py-0.5 rounded text-[10px] font-semibold">
                        {t}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* 2. Journey Progress Consequence (Hành trình - Verified Only) */}
            {isVerified && (
              <div id="postbite-journey-section" className="bg-white rounded-xl p-3.5 border border-[#EDE8DE] shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Map className="w-4 h-4 text-[#FF6B35]" />
                    <span className="font-bold text-xs sm:text-sm text-[#2D2926]">
                      Hành trình {journeyProgress.districtName}
                    </span>
                  </div>
                  <span
                    id="postbite-journey-count"
                    className="text-xs font-bold text-[#C84B18] bg-[#FFF5EB] px-2 py-0.5 rounded-full"
                  >
                    {journeyProgress.completedCount}/{journeyProgress.totalCount} mốc
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-[#EFECE6] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#FF6B35] h-full rounded-full transition-all duration-500"
                    style={{ width: `${completedRatio}%` }}
                  />
                </div>

                {/* Milestone Consequence Callout (if changed in this checkin) */}
                {journeyProgress.milestoneCompletedTitle && (
                  <div
                    id="postbite-milestone-banner"
                    className="mt-2.5 p-2 rounded-lg bg-[#F0FDF4] border border-[#DCFCE7] text-[#166534] text-xs font-semibold flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#16A34A] flex-shrink-0" />
                    <span className="truncate">
                      Hoàn thành mốc: <strong>{journeyProgress.milestoneCompletedTitle}</strong>
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* 3. Concrete Authoritative Contribution Consequence */}
            <div
              id="postbite-contribution-card"
              className="bg-white rounded-xl p-3 border border-[#EDE8DE] flex items-center gap-3 shadow-xs"
            >
              <div className="w-7 h-7 rounded-full bg-[#FFF5EB] flex items-center justify-center flex-shrink-0 text-[#FF6B35]">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="text-xs text-[#594139] flex-1 min-w-0">
                <p id="postbite-contribution-text" className="font-medium text-[#2D2926] leading-snug">
                  {contributionMessage}
                </p>
              </div>
            </div>

            {/* 4. Tertiary Action: Lightweight Share Action */}
            <div className="pt-1 flex justify-center">
              <button
                type="button"
                id="btn-postbite-share"
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-medium text-[#7A7265] hover:text-[#2D2926] hover:bg-[#F2EFE8] transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                    <span className="text-[#16A34A] font-semibold">Đã sao chép liên kết chia sẻ</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Chia sẻ Bite này</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Bottom Action Footer (CTAs) */}
          <div
            id="postbite-footer-actions"
            className="p-4 sm:p-5 bg-[#F7F5F0] border-t border-[#EDE8DE] flex flex-col gap-2 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]"
          >
            {/* Primary Action CTA - View on Feed */}
            {onViewFeed && (
              <button
                type="button"
                id="btn-postbite-view-feed"
                onClick={onViewFeed}
                className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-[#FF6B35] to-[#FFA07A] hover:opacity-95 text-white shadow-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
              >
                <Users className="w-4 h-4" />
                Xem bài đăng trên Bản tin bạn bè
              </button>
            )}

            <div className="grid grid-cols-2 gap-2">
              {/* Secondary Action CTA - Continue Explore */}
              <button
                type="button"
                id="btn-postbite-continue-explore"
                onClick={onContinueExplore}
                className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors active:scale-[0.99] ${
                  onViewFeed
                    ? 'bg-white hover:bg-[#F2EFE8] text-[#594139] border border-[#D5CEC5]'
                    : 'bg-[#FF6B35] hover:bg-[#E8551E] text-white shadow-sm'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                Tiếp tục khám phá
              </button>

              {/* Secondary Action CTA - View Journey */}
              <button
                type="button"
                id="btn-postbite-view-journey"
                onClick={onViewJourney}
                className="w-full py-2.5 px-3 rounded-xl font-medium text-xs sm:text-sm bg-white hover:bg-[#F2EFE8] text-[#594139] border border-[#D5CEC5] flex items-center justify-center gap-1.5 transition-colors"
              >
                <Map className="w-3.5 h-3.5 text-[#FF6B35]" />
                Xem Hành trình
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

