import React, { useState, useEffect } from 'react';
import {
  KnowledgeTrackId,
  KnowledgeQuestion,
  KNOWLEDGE_TRACKS,
  getRandomizedQuestQuestions,
  META_KNOWLEDGE_TITLE,
} from '../data/knowledgeQuestions';
import { User } from '../types';

interface KnowledgeQuestModalProps {
  trackId: KnowledgeTrackId;
  user: User;
  onClose: () => void;
  onCompleteTrack: (result: {
    trackId: KnowledgeTrackId;
    score: number;
    total: number;
    passed: boolean;
    earnedXp: number;
    unlockedBoth: boolean;
  }) => void;
}

export const KnowledgeQuestModal: React.FC<KnowledgeQuestModalProps> = ({
  trackId,
  user,
  onClose,
  onCompleteTrack,
}) => {
  const trackInfo = KNOWLEDGE_TRACKS[trackId];
  const [questions, setQuestions] = useState<KnowledgeQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState<boolean>(false);
  const [userAnswers, setUserAnswers] = useState<{ [questionId: string]: string }>({});
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  // Initialize randomized 5 questions on mount or track change
  useEffect(() => {
    const randomized = getRandomizedQuestQuestions(trackId, 5);
    setQuestions(randomized);
    setCurrentIndex(0);
    setSelectedChoiceId(null);
    setIsAnswerSubmitted(false);
    setUserAnswers({});
    setCorrectCount(0);
    setIsFinished(false);
  }, [trackId]);

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const progressPercent = totalQuestions > 0 ? Math.round(((currentIndex + 1) / totalQuestions) * 100) : 0;

  const handleSelectChoice = (choiceId: string) => {
    if (isAnswerSubmitted) return;
    setSelectedChoiceId(choiceId);
  };

  const handleConfirmAnswer = () => {
    if (!selectedChoiceId || !currentQuestion || isAnswerSubmitted) return;

    // Haptic feedback
    if (typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(selectedChoiceId === currentQuestion.correctChoiceId ? [30, 40] : 60);
      } catch (e) {
        // Safe catch
      }
    }

    const isCorrect = selectedChoiceId === currentQuestion.correctChoiceId;
    if (isCorrect) {
      setCorrectCount((prev) => prev + 1);
    }

    setUserAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: selectedChoiceId,
    }));
    setIsAnswerSubmitted(true);
  };

  const handleNextQuestion = () => {
    if (currentIndex + 1 < totalQuestions) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedChoiceId(null);
      setIsAnswerSubmitted(false);
    } else {
      setIsFinished(true);
    }
  };

  const handleRetry = () => {
    const randomized = getRandomizedQuestQuestions(trackId, 5);
    setQuestions(randomized);
    setCurrentIndex(0);
    setSelectedChoiceId(null);
    setIsAnswerSubmitted(false);
    setUserAnswers({});
    setCorrectCount(0);
    setIsFinished(false);
  };

  const handleFinishAndClaim = () => {
    const passed = correctCount >= 4;
    const existingProgress = user.knowledgeProgress?.[trackId === 'smart_biter' ? 'smartBiter' : 'biteGuardian'];
    const otherTrackId: KnowledgeTrackId = trackId === 'smart_biter' ? 'bite_guardian' : 'smart_biter';
    const otherProgress = user.knowledgeProgress?.[otherTrackId === 'smart_biter' ? 'smartBiter' : 'biteGuardian'];
    const alreadyClaimed = existingProgress?.claimedReward || false;
    const earnedXp = passed && !alreadyClaimed ? trackInfo.rewardXp : 0;
    const unlockedBoth = passed && (otherProgress?.completed || false);

    onCompleteTrack({
      trackId,
      score: correctCount,
      total: totalQuestions,
      passed,
      earnedXp,
      unlockedBoth,
    });
  };

  if (!currentQuestion && !isFinished) {
    return null;
  }

  const otherTrackId: KnowledgeTrackId = trackId === 'smart_biter' ? 'bite_guardian' : 'smart_biter';
  const otherTrackProgress = user.knowledgeProgress?.[otherTrackId === 'smart_biter' ? 'smartBiter' : 'biteGuardian'];
  const willUnlockMetaTitle = correctCount >= 4 && (otherTrackProgress?.completed || false);
  const alreadyClaimedReward = user.knowledgeProgress?.[trackId === 'smart_biter' ? 'smartBiter' : 'biteGuardian']?.claimedReward || false;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 select-none overflow-y-auto animate-fade-in"
      id="knowledge-quest-modal"
    >
      <div className="bg-[#FAF9F5] text-[#2D2926] rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-[#2D2926]/10 flex flex-col my-auto max-h-[92vh]">
        {/* ========================================================= */}
        {/* 1. MODAL HEADER                                           */}
        {/* ========================================================= */}
        <header className="px-5 pt-5 pb-3 bg-white border-b border-[#2D2926]/5 flex flex-col gap-2 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{trackInfo.badgeEmoji}</span>
              <div>
                <span className="text-[10px] font-heading font-extrabold text-[#FF6B35] tracking-wider uppercase">
                  {trackInfo.badgeName}
                </span>
                <h3 className="font-heading text-base font-black text-[#2D2926] leading-tight">
                  {trackInfo.titleVi}
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#F4F4F0] hover:bg-[#E9E8E4] text-[#594139] flex items-center justify-center text-sm font-bold active:scale-95 transition-transform"
              title="Đóng"
            >
              ✕
            </button>
          </div>

          {!isFinished && (
            <div className="flex flex-col gap-1.5 mt-1">
              <div className="flex justify-between items-center text-[11px] font-heading font-bold text-[#594139]">
                <span className="inline-flex items-center gap-1 bg-[#2EC4B6]/15 text-[#006A62] px-2 py-0.5 rounded-full text-[10px]">
                  💡 {currentQuestion.contextPill || 'Tình huống thực tế'}
                </span>
                <span>
                  Câu hỏi <strong className="text-[#FF6B35]">{currentIndex + 1}</strong> / {totalQuestions}
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full bg-[#E9E8E4] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#FF6B35] to-[#ff8c5a] rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </header>

        {/* ========================================================= */}
        {/* 2. BODY CONTENT (SCENARIO CARD OR RESULTS CARD)            */}
        {/* ========================================================= */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4">
          {!isFinished ? (
            /* Active Scenario Card */
            <div className="flex flex-col gap-4 animate-fade-in">
              {/* Scenario Context Card */}
              <div className="bg-white rounded-2xl p-4 border border-[#2D2926]/5 shadow-sm">
                <div className="flex items-center gap-1.5 text-xs font-heading font-bold text-[#FF6B35] mb-1.5">
                  <span>{currentQuestion.scenarioTitle}</span>
                </div>
                <p className="text-xs text-[#2D2926] font-medium leading-relaxed">
                  {currentQuestion.scenario}
                </p>
              </div>

              {/* 4 Choices */}
              <div className="flex flex-col gap-2">
                {currentQuestion.choices.map((choice, idx) => {
                  const isSelected = selectedChoiceId === choice.id;
                  const isCorrectChoice = choice.id === currentQuestion.correctChoiceId;
                  const optionLetter = String.fromCharCode(65 + idx); // A, B, C, D

                  let buttonStyle = 'bg-white text-[#2D2926] border-[#2D2926]/10 hover:border-[#FF6B35]/50';

                  if (isAnswerSubmitted) {
                    if (isCorrectChoice) {
                      buttonStyle = 'bg-[#2EC4B6]/15 border-[#2EC4B6] text-[#006A62] font-semibold';
                    } else if (isSelected && !isCorrectChoice) {
                      buttonStyle = 'bg-[#BA1A1A]/10 border-[#BA1A1A]/60 text-[#BA1A1A]';
                    } else {
                      buttonStyle = 'bg-white/60 text-[#594139]/60 border-[#2D2926]/5 opacity-60';
                    }
                  } else if (isSelected) {
                    buttonStyle = 'bg-[#FF6B35]/10 border-[#FF6B35] text-[#FF6B35] font-semibold shadow-sm';
                  }

                  return (
                    <button
                      key={choice.id}
                      onClick={() => handleSelectChoice(choice.id)}
                      disabled={isAnswerSubmitted}
                      className={`p-3.5 rounded-2xl border text-left text-xs transition-all flex items-start gap-3 active:scale-98 ${buttonStyle}`}
                    >
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-heading font-bold flex-shrink-0 mt-0.5 ${
                          isAnswerSubmitted && isCorrectChoice
                            ? 'bg-[#2EC4B6] text-white'
                            : isAnswerSubmitted && isSelected && !isCorrectChoice
                            ? 'bg-[#BA1A1A] text-white'
                            : isSelected
                            ? 'bg-[#FF6B35] text-white'
                            : 'bg-[#F4F4F0] text-[#594139]'
                        }`}
                      >
                        {isAnswerSubmitted && isCorrectChoice ? '✓' : isAnswerSubmitted && isSelected && !isCorrectChoice ? '✕' : optionLetter}
                      </span>
                      <span className="flex-1 leading-relaxed">{choice.text}</span>
                    </button>
                  );
                })}
              </div>

              {/* Immediate Feedback Card after confirmation */}
              {isAnswerSubmitted && (
                <div
                  className={`p-4 rounded-2xl text-xs flex flex-col gap-1.5 border animate-fade-in ${
                    selectedChoiceId === currentQuestion.correctChoiceId
                      ? 'bg-[#2EC4B6]/10 border-[#2EC4B6]/30 text-[#006A62]'
                      : 'bg-[#FFD166]/20 border-[#FFD166]/50 text-[#594139]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-heading font-bold">
                    {selectedChoiceId === currentQuestion.correctChoiceId ? (
                      <>
                        <span className="text-base">✓</span>
                        <span className="text-[#006A62]">Chính xác! +1 Smart Move</span>
                      </>
                    ) : (
                      <>
                        <span className="text-base">💡</span>
                        <span className="text-[#2D2926]">Ghi nhớ nhanh:</span>
                      </>
                    )}
                  </div>
                  <p className="text-[11px] text-[#2D2926]/90 leading-relaxed font-normal">
                    {currentQuestion.explanation}
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Results Screen */
            <div className="flex flex-col items-center text-center gap-4 py-2 animate-fade-in">
              {correctCount >= 4 ? (
                /* Passed state */
                <>
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#2EC4B6]/20 to-[#FFD166]/30 flex items-center justify-center shadow-inner ring-4 ring-[#2EC4B6]/30 animate-pulse">
                      <span className="text-5xl">{trackInfo.badgeEmoji}</span>
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-[#2EC4B6] text-white text-xs px-2 py-0.5 rounded-full font-heading font-bold shadow">
                      ✓ Đạt
                    </div>
                  </div>

                  <div>
                    <span className="inline-block bg-[#2EC4B6]/15 text-[#006A62] px-3 py-1 rounded-full text-[11px] font-heading font-extrabold uppercase tracking-wide mb-1.5">
                      Đã mở khóa Huy hiệu Kỹ Năng
                    </span>
                    <h3 className="font-heading text-2xl font-black text-[#2D2926]">
                      {trackInfo.titleVi}
                    </h3>
                    <p className="text-xs text-[#594139] mt-1 max-w-xs mx-auto">
                      Bạn đã hoàn thành xuất sắc <strong>{correctCount} / {totalQuestions}</strong> câu hỏi tình huống thực tế!
                    </p>
                  </div>

                  {/* Rewards Breakdown Box */}
                  <div className="w-full bg-white rounded-2xl p-4 border border-[#2D2926]/10 text-left flex flex-col gap-2.5 shadow-sm">
                    <span className="text-[11px] font-heading font-bold text-[#594139] uppercase tracking-wider">
                      Phần thưởng mở khóa:
                    </span>

                    <div className="flex items-center justify-between text-xs font-heading font-semibold text-[#2D2926]">
                      <span className="flex items-center gap-2">
                        <span>🛡️</span>
                        <span>Huy hiệu {trackInfo.badgeName}</span>
                      </span>
                      <span className="text-[#2EC4B6] font-bold">✓ Trang cá nhân</span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-heading font-semibold text-[#2D2926]">
                      <span className="flex items-center gap-2">
                        <span>📸</span>
                        <span>Sticker Camera Bite {trackInfo.badgeEmoji}</span>
                      </span>
                      <span className="text-[#2EC4B6] font-bold">✓ Mở khóa</span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-heading font-semibold text-[#2D2926]">
                      <span className="flex items-center gap-2">
                        <span>⚡</span>
                        <span>Điểm kinh nghiệm EXP</span>
                      </span>
                      <span className="text-[#FF6B35] font-bold">
                        {alreadyClaimedReward ? 'Đã nhận trước đó' : `+${trackInfo.rewardXp} XP`}
                      </span>
                    </div>

                    {willUnlockMetaTitle && (
                      <div className="pt-2 border-t border-[#2D2926]/5 flex items-center justify-between text-xs font-heading font-bold text-[#FF6B35]">
                        <span className="flex items-center gap-1.5">
                          <span>🏆</span>
                          <span>Danh hiệu: {META_KNOWLEDGE_TITLE}</span>
                        </span>
                        <span className="bg-[#FF6B35]/15 text-[#FF6B35] px-2 py-0.5 rounded-full text-[10px]">
                          Cả 2 tracks!
                        </span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Failed state: Gần đạt rồi — thử lại nhé */
                <>
                  <div className="w-20 h-20 rounded-full bg-[#FFD166]/20 flex items-center justify-center text-4xl shadow-inner">
                    <span>💡</span>
                  </div>

                  <div>
                    <h3 className="font-heading text-xl font-black text-[#2D2926]">
                      Gần đạt rồi — thử lại nhé!
                    </h3>
                    <p className="text-xs text-[#594139] mt-1 max-w-xs mx-auto">
                      Bạn đạt <strong>{correctCount} / {totalQuestions}</strong> câu đúng (cần tối thiểu 4/5 để mở khóa huy hiệu).
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl p-4 border border-[#2D2926]/10 text-xs text-[#594139] text-left leading-relaxed w-full">
                    <p className="font-heading font-bold text-[#2D2926] mb-1">
                      💡 Mẹo hữu ích:
                    </p>
                    <p>
                      Mỗi lần thử lại sẽ có các câu hỏi mới ngẫu nhiên. Hãy luôn ưu tiên hỏi giá trước, đối chiếu hóa đơn và kiểm chứng sự thật trước khi đưa ra nhận xét nhé!
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* 3. MODAL FOOTER ACTIONS                                    */}
        {/* ========================================================= */}
        <footer className="p-4 bg-white border-t border-[#2D2926]/5 flex gap-3">
          {!isFinished ? (
            !isAnswerSubmitted ? (
              <button
                onClick={handleConfirmAnswer}
                disabled={!selectedChoiceId}
                className="w-full bg-[#FF6B35] disabled:bg-[#E9E8E4] disabled:text-[#594139]/40 hover:bg-[#FF6B35]/90 text-white py-3.5 rounded-full font-heading text-xs font-bold shadow-md flex items-center justify-center gap-2 active:scale-98 transition-all"
                id="btn-confirm-knowledge-answer"
              >
                <span>Xác nhận câu trả lời</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            ) : (
              <button
                onClick={handleNextQuestion}
                className="w-full bg-[#2EC4B6] hover:bg-[#2EC4B6]/90 text-white py-3.5 rounded-full font-heading text-xs font-bold shadow-md flex items-center justify-center gap-2 active:scale-98 transition-all"
                id="btn-next-knowledge-question"
              >
                <span>{currentIndex + 1 < totalQuestions ? 'Câu hỏi tiếp theo' : 'Xem kết quả'}</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            )
          ) : correctCount >= 4 ? (
            <button
              onClick={handleFinishAndClaim}
              className="w-full bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white py-3.5 rounded-full font-heading text-xs font-bold shadow-lg shadow-[#FF6B35]/25 flex items-center justify-center gap-2 active:scale-98 transition-all"
              id="btn-claim-knowledge-badge"
            >
              <span>Nhận Huy Hiệu & Hoàn Tất</span>
              <span className="material-symbols-outlined text-[16px]">verified</span>
            </button>
          ) : (
            <div className="flex gap-2 w-full">
              <button
                onClick={onClose}
                className="flex-1 bg-[#F4F4F0] hover:bg-[#E9E8E4] text-[#594139] py-3 rounded-full font-heading text-xs font-bold transition-all"
              >
                Để sau
              </button>
              <button
                onClick={handleRetry}
                className="flex-2 bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white py-3 rounded-full font-heading text-xs font-bold shadow flex items-center justify-center gap-1.5 active:scale-98 transition-all"
                id="btn-retry-knowledge-quest"
              >
                <span>Thử lại ngay</span>
                <span className="material-symbols-outlined text-[16px]">refresh</span>
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
};
