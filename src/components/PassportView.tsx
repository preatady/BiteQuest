import React, { useState } from 'react';
import { DistrictPassport, User } from '../types';
import { KnowledgeTrackId, KNOWLEDGE_TRACKS, META_KNOWLEDGE_TITLE } from '../data/knowledgeQuestions';

interface PassportViewProps {
  passport: DistrictPassport;
  user?: User;
  onNavigateToExplore: () => void;
  onNavigateToCamera: () => void;
  onOpenKnowledgeQuest?: (trackId: KnowledgeTrackId) => void;
}

export const PassportView: React.FC<PassportViewProps> = ({
  passport,
  user,
  onNavigateToExplore,
  onNavigateToCamera,
  onOpenKnowledgeQuest,
}) => {
  const [selectedDistrict, setSelectedDistrict] = useState<string>('cau_giay');

  const completedCount = passport.challenges.filter((c) => c.isCompleted).length;
  const totalCount = passport.challenges.length;
  const progressPercent = Math.round((passport.xp / passport.maxXp) * 100);

  const smartBiterProgress = user?.knowledgeProgress?.smartBiter;
  const biteGuardianProgress = user?.knowledgeProgress?.biteGuardian;
  const isBothCompleted = (smartBiterProgress?.completed && biteGuardianProgress?.completed);

  return (
    <div className="min-h-screen bg-[#FDFCF8] text-[#2D2926] pt-[calc(4.5rem+env(safe-area-inset-top,0px))] pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] px-4 max-w-lg mx-auto flex flex-col gap-6" id="passport-container">
      {/* District Switcher Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setSelectedDistrict('cau_giay')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-heading font-bold transition-all ${
            selectedDistrict === 'cau_giay'
              ? 'bg-[#FF6B35] text-white shadow-sm'
              : 'bg-[#F4F4F0] text-[#594139] hover:bg-[#E9E8E4]'
          }`}
        >
          Cầu Giấy ({completedCount}/{totalCount})
        </button>

        <button
          onClick={() => setSelectedDistrict('dong_da')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-heading font-bold transition-all ${
            selectedDistrict === 'dong_da'
              ? 'bg-[#FF6B35] text-white shadow-sm'
              : 'bg-[#F4F4F0] text-[#594139] hover:bg-[#E9E8E4]'
          }`}
        >
          Đống Đa (4/6)
        </button>

        <button
          onClick={() => setSelectedDistrict('ba_dinh')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-heading font-bold transition-all ${
            selectedDistrict === 'ba_dinh'
              ? 'bg-[#FF6B35] text-white shadow-sm'
              : 'bg-[#F4F4F0] text-[#594139] hover:bg-[#E9E8E4]'
          }`}
        >
          Ba Đình (2/6)
        </button>
      </div>

      {/* Passport Header Card */}
      <section className="bg-white rounded-3xl p-5 shadow-[0_8px_30px_rgba(45,41,38,0.06)] border border-[#2D2926]/5 relative overflow-hidden">
        {/* Cover illustration / Photo */}
        <div className="aspect-[16/9] w-full rounded-2xl overflow-hidden bg-[#E9E8E4] relative shadow-inner mb-4">
          <img
            src={passport.coverImage}
            alt={passport.districtName}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#2D2926]/70 via-transparent to-transparent flex items-end p-3">
            <div className="flex items-center gap-1.5 text-white font-heading text-xs font-bold">
              <span className="material-symbols-outlined text-[16px] text-[#FF6B35] fill">location_on</span>
              <span>{passport.districtName}, HN</span>
            </div>
          </div>
        </div>

        {/* Passport Tag & Title */}
        <div className="flex flex-col gap-2">
          <div className="inline-flex items-center gap-1 bg-[#2EC4B6]/15 text-[#006A62] px-3 py-1 rounded-full text-xs font-heading font-bold w-fit">
            <span>🗺️</span> Hành trình khu vực
          </div>

          <div>
            <h2 className="font-heading text-2xl font-black text-[#2D2926]">
              Hành trình {passport.districtName}
            </h2>
            <p className="text-xs text-[#594139] flex items-center gap-1 mt-0.5">
              <span>{passport.subtitle}</span>
            </p>
          </div>

          {/* Level Progression Box */}
          <div className="bg-[#F4F4F0] p-3.5 rounded-2xl flex flex-col gap-2.5 mt-2">
            <div className="flex justify-between items-end">
              <div className="flex items-baseline gap-2">
                <span className="font-heading text-lg font-black text-[#FF6B35]">
                  Lv. {passport.currentLevel}
                </span>
                <span className="font-heading text-[11px] font-bold text-[#594139] uppercase tracking-wider">
                  {passport.levelTitle}
                </span>
              </div>
              <span className="font-heading text-xs font-bold text-[#2D2926]">
                {passport.xp} <span className="text-[#594139]/70 font-normal">/ {passport.maxXp} XP</span>
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-3 w-full bg-[#E9E8E4] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#FF6B35] to-[#ff8c5a] rounded-full transition-all duration-700"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 2. KNOWLEDGE QUESTS & SKILL BADGES (BITEQUEST GAMIFIED)   */}
      {/* ========================================================= */}
      <section className="bg-white rounded-3xl p-5 shadow-[0_4px_20px_rgba(45,41,38,0.06)] border border-[#2D2926]/5 flex flex-col gap-3.5">
        <div className="flex justify-between items-center px-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">💡</span>
            <div>
              <h3 className="font-heading text-sm font-bold text-[#2D2926] leading-tight">
                Kiến thức khám phá
              </h3>
              <p className="text-[10px] text-[#594139]">
                Tình huống thực tế & Mở khóa Huy hiệu Kỹ Năng
              </p>
            </div>
          </div>

          {isBothCompleted && (
            <span className="bg-[#FF6B35]/15 text-[#FF6B35] px-2.5 py-0.5 rounded-full text-[10px] font-heading font-extrabold flex items-center gap-1">
              <span>🏆</span> Sành Sỏi
            </span>
          )}
        </div>

        {/* 2 Knowledge Tracks Grid */}
        <div className="grid grid-cols-1 gap-3">
          {/* Track 1: Smart Biter / Ăn Tỉnh Táo */}
          <div
            onClick={() => onOpenKnowledgeQuest?.('smart_biter')}
            className="bg-[#FAF9F5] hover:bg-[#F4F4F0] p-4 rounded-2xl border border-[#2D2926]/8 flex items-center justify-between gap-3 cursor-pointer active:scale-98 transition-all group shadow-sm"
            id="quest-track-smart-biter"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 transition-transform group-hover:scale-105 shadow-sm ${
                  smartBiterProgress?.completed
                    ? 'bg-[#2EC4B6]/20 border border-[#2EC4B6]/30'
                    : 'bg-white border border-[#2D2926]/10'
                }`}
              >
                <span>🛡️</span>
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-heading font-extrabold text-[#FF6B35] tracking-wider uppercase">
                    SMART BITER
                  </span>
                  {smartBiterProgress?.completed ? (
                    <span className="bg-[#2EC4B6]/20 text-[#006A62] text-[9px] font-heading font-bold px-1.5 py-0.2 rounded-full">
                      ✓ Đã đạt {smartBiterProgress.bestScore}/5
                    </span>
                  ) : (
                    <span className="bg-[#594139]/10 text-[#594139] text-[9px] font-heading font-medium px-1.5 py-0.2 rounded-full">
                      {smartBiterProgress?.bestScore ? `${smartBiterProgress.bestScore}/5` : '0/5'}
                    </span>
                  )}
                </div>
                <h4 className="font-heading text-xs font-bold text-[#2D2926]">
                  Ăn Tỉnh Táo
                </h4>
                <p className="text-[10px] text-[#594139] line-clamp-1">
                  Minh bạch giá cả, đối chiếu hóa đơn & bằng chứng thực tế
                </p>
              </div>
            </div>

            <div className="flex-shrink-0 text-right">
              <span
                className={`px-3 py-1 rounded-full text-[11px] font-heading font-bold transition-colors inline-block ${
                  smartBiterProgress?.completed
                    ? 'bg-[#2EC4B6] text-white shadow-sm'
                    : 'bg-[#FF6B35] text-white shadow-sm'
                }`}
              >
                {smartBiterProgress?.completed ? 'Luyện tập' : 'Bắt đầu'}
              </span>
            </div>
          </div>

          {/* Track 2: Bite Guardian / Người Khám Phá Có Trách Nhiệm */}
          <div
            onClick={() => onOpenKnowledgeQuest?.('bite_guardian')}
            className="bg-[#FAF9F5] hover:bg-[#F4F4F0] p-4 rounded-2xl border border-[#2D2926]/8 flex items-center justify-between gap-3 cursor-pointer active:scale-98 transition-all group shadow-sm"
            id="quest-track-bite-guardian"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 transition-transform group-hover:scale-105 shadow-sm ${
                  biteGuardianProgress?.completed
                    ? 'bg-[#2EC4B6]/20 border border-[#2EC4B6]/30'
                    : 'bg-white border border-[#2D2926]/10'
                }`}
              >
                <span>🧭</span>
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-heading font-extrabold text-[#00A7CB] tracking-wider uppercase">
                    BITE GUARDIAN
                  </span>
                  {biteGuardianProgress?.completed ? (
                    <span className="bg-[#2EC4B6]/20 text-[#006A62] text-[9px] font-heading font-bold px-1.5 py-0.2 rounded-full">
                      ✓ Đã đạt {biteGuardianProgress.bestScore}/5
                    </span>
                  ) : (
                    <span className="bg-[#594139]/10 text-[#594139] text-[9px] font-heading font-medium px-1.5 py-0.2 rounded-full">
                      {biteGuardianProgress?.bestScore ? `${biteGuardianProgress.bestScore}/5` : '0/5'}
                    </span>
                  )}
                </div>
                <h4 className="font-heading text-xs font-bold text-[#2D2926]">
                  Người Khám Phá Có Trách Nhiệm
                </h4>
                <p className="text-[10px] text-[#594139] line-clamp-1">
                  Xác minh độc lập, tôn trọng quyền riêng tư & an toàn cộng đồng
                </p>
              </div>
            </div>

            <div className="flex-shrink-0 text-right">
              <span
                className={`px-3 py-1 rounded-full text-[11px] font-heading font-bold transition-colors inline-block ${
                  biteGuardianProgress?.completed
                    ? 'bg-[#2EC4B6] text-white shadow-sm'
                    : 'bg-[#FF6B35] text-white shadow-sm'
                }`}
              >
                {biteGuardianProgress?.completed ? 'Luyện tập' : 'Bắt đầu'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Challenges Section */}
      <section className="flex flex-col gap-3">
        <div className="flex justify-between items-center px-1">
          <h3 className="font-heading text-base font-bold text-[#2D2926]">Thử thách thực địa</h3>
          <span className="bg-[#FF6B35]/15 text-[#FF6B35] px-3 py-1 rounded-full text-xs font-heading font-bold">
            {completedCount} / {totalCount} thử thách
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {passport.challenges.map((ch) => (
            <div
              key={ch.id}
              onClick={() => {
                if (!ch.isCompleted) {
                  onNavigateToCamera();
                }
              }}
              className={`bg-white rounded-2xl p-3.5 flex items-center gap-3.5 border transition-all ${
                ch.isCompleted
                  ? 'border-l-4 border-l-[#2EC4B6] border-[#2D2926]/5 shadow-sm opacity-90'
                  : 'border-l-4 border-l-[#E1BFB5] border-[#2D2926]/5 shadow-sm hover:border-l-[#FF6B35] cursor-pointer hover:shadow-md active:scale-98'
              }`}
            >
              {/* Checkmark or circle */}
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                  ch.isCompleted
                    ? 'bg-[#2EC4B6]/20 text-[#006A62]'
                    : 'bg-[#F4F4F0] text-[#594139]/60'
                }`}
              >
                {ch.isCompleted ? (
                  <span className="material-symbols-outlined text-[20px] fill text-[#2EC4B6]">
                    check_circle
                  </span>
                ) : (
                  <span className="material-symbols-outlined text-[20px]">
                    radio_button_unchecked
                  </span>
                )}
              </div>

              {/* Title & info */}
              <div className="flex-grow">
                <h4
                  className={`font-heading text-xs font-bold ${
                    ch.isCompleted
                      ? 'text-[#2D2926] line-through opacity-70'
                      : 'text-[#2D2926]'
                  }`}
                >
                  {ch.title}
                </h4>
                <p className="text-[11px] text-[#594139]/80">
                  {ch.isCompleted ? ch.completedAt : `Thưởng +${ch.rewardXp} XP`}
                </p>
              </div>

              {/* Food Emoji Icon */}
              <div className={`text-2xl flex-shrink-0 ${ch.isCompleted ? '' : 'grayscale opacity-75'}`}>
                {ch.icon}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Button */}
      <div className="mt-2">
        <button
          onClick={onNavigateToCamera}
          className="w-full bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white py-3.5 rounded-full font-heading text-sm font-bold shadow-lg shadow-[#FF6B35]/30 flex items-center justify-center gap-2 active:scale-98 transition-transform"
          id="btn-passport-unlock-next"
        >
          <span>Đi mở khóa tiếp</span>
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
      </div>
    </div>
  );
};

