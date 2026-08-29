import React, { useState, useEffect, useRef } from 'react';
import { User, Place, BiteCheckin, DistrictPassport, AchievementBadge } from './types';
import {
  INITIAL_USER,
  EMPTY_USER,
  INITIAL_PLACES,
  INITIAL_FEED_BITES,
  INITIAL_PASSPORT_CAU_GIAY,
  EMPTY_PASSPORT_CAU_GIAY,
  createDefaultPassport,
  INITIAL_ACHIEVEMENTS,
} from './data/seedData';
import { getInitialTriRegionPlaces } from './data/triRegionVenues';
import { auth, googleProvider } from './firebase';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import {
  syncUserProfile,
  getPlacesFromDb,
  getFeedBitesFromDb,
  saveCheckinToDb,
  savePlaceToDb,
  savePassportToDb,
} from './services/firebaseDb';
import { TopAppBar } from './components/TopAppBar';
import { BottomNavBar, TabType } from './components/BottomNavBar';
import { MapView } from './components/MapView';
import { FriendFeedView } from './components/FriendFeedView';
import { CameraBiteView } from './components/CameraBiteView';
import { PassportView } from './components/PassportView';
import { ProfileView } from './components/ProfileView';
import { CommunitySpotModal } from './components/CommunitySpotModal';
import { AchievementToast } from './components/AchievementToast';
import { KnowledgeQuestModal } from './components/KnowledgeQuestModal';
import { NavigationDrawer } from './components/NavigationDrawer';
import { AboutModal } from './components/AboutModal';
import { JudgeDevModal } from './components/JudgeDevModal';
import { AuthModal, AuthMode } from './components/AuthModal';
import { OnboardingModal } from './components/OnboardingModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PostBiteExperienceModal } from './components/PostBiteExperienceModal';
import { BiteBotModal } from './components/BiteBotModal';
import { NotificationCenterModal } from './components/NotificationCenterModal';
import { AppNotification, getInitialNotifications } from './services/notificationService';
import { PostBiteResultData } from './types';
import { KnowledgeTrackId, KNOWLEDGE_TRACKS, META_KNOWLEDGE_TITLE } from './data/knowledgeQuestions';
import { saveKnowledgeProgressToDb } from './services/firebaseDb';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('explore');
  const [user, setUser] = useState<User>(EMPTY_USER);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const isSigningInRef = useRef<boolean>(false);
  const [places, setPlaces] = useState<Place[]>(() => [...INITIAL_PLACES, ...getInitialTriRegionPlaces()]);
  const [feedBites, setFeedBites] = useState<BiteCheckin[]>([]);
  const [passport, setPassport] = useState<DistrictPassport>(EMPTY_PASSPORT_CAU_GIAY);
  const [achievements, setAchievements] = useState<AchievementBadge[]>(() =>
    INITIAL_ACHIEVEMENTS.map((a) => ({ ...a, isUnlocked: false, unlockedAt: undefined }))
  );

  const [selectedPlace, setSelectedPlace] = useState<Place | null>(INITIAL_PLACES[0] || null);
  const [cameraPreselectedPlace, setCameraPreselectedPlace] = useState<Place | null>(null);
  const [savedPlaceIds, setSavedPlaceIds] = useState<string[]>(['place_blackbird_coffee']);

  // Modals & Toasts
  const [communitySpotModalData, setCommunitySpotModalData] = useState<any | null>(null);
  const [activeKnowledgeQuestTrack, setActiveKnowledgeQuestTrack] = useState<KnowledgeTrackId | null>(null);
  const [activeToast, setActiveToast] = useState<{
    title: string;
    subtitle: string;
    emoji: string;
    xpEarned?: number;
  } | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showJudgeDevModal, setShowJudgeDevModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalInitialMode, setAuthModalInitialMode] = useState<AuthMode>('entry');
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [showBiteBotModal, setShowBiteBotModal] = useState(false);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    getInitialNotifications({ latitude: 21.0285, longitude: 105.7958 }, 'Cầu Giấy')
  );
  const [targetMapFocus, setTargetMapFocus] = useState<{ latitude: number; longitude: number; name?: string } | null>(null);
  const [openTrafficSheetDirectly, setOpenTrafficSheetDirectly] = useState(false);
  const [postBiteResult, setPostBiteResult] = useState<PostBiteResultData | null>(null);

  const unreadNotificationsCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkNotificationAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const handleMarkAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleDeleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
  };

  const addNotification = (notif: Omit<AppNotification, 'id' | 'timestamp' | 'timeFormatted' | 'isRead'>) => {
    const newNotif: AppNotification = {
      ...notif,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date(),
      timeFormatted: 'Vừa xong',
      isRead: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  // Monitor Firebase Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setIsLoggedIn(true);
        try {
          const profile = await syncUserProfile(fbUser);
          setUser(profile);
          if (!profile.onboardingCompleted) {
            setShowOnboardingModal(true);
          }
        } catch (e) {
          console.warn('Sync profile error:', e);
        }
      } else {
        setIsLoggedIn(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Bootstrap data from backend & Firestore on mount
  useEffect(() => {
    async function loadBootstrapData() {
      try {
        const res = await fetch('/api/bootstrap');
        if (res.ok) {
          const data = await res.json();
          if (data.user && !isLoggedIn) setUser(data.user);
          if (data.places) setPlaces(data.places);
          if (data.feedBites) setFeedBites(data.feedBites);
          if (data.passport) setPassport(data.passport);
          if (data.achievements) setAchievements(data.achievements);
        }
      } catch (err) {
        console.warn('Using local bootstrap seed:', err);
      }
    }
    loadBootstrapData();
  }, [isLoggedIn]);

  // Handle Google Sign-in
  const handleGoogleSignIn = async () => {
    // Concurrency guard: reject duplicate popup triggers
    if (isSigningInRef.current) {
      console.info('[Auth] Google Sign-In already in progress, ignoring duplicate trigger.');
      return;
    }

    isSigningInRef.current = true;
    setIsSigningIn(true);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        const profile = await syncUserProfile(result.user);
        setUser(profile);
        setActiveToast({
          title: 'Đăng nhập thành công!',
          subtitle: `Chào mừng ${result.user.displayName || 'Bite Explorer'} gia nhập BiteQuest!`,
          emoji: '🎉',
        });
      }
    } catch (err: any) {
      const errorCode = err?.code || '';

      // Treat expected user cancellation codes as non-errors (no red error UI, no error toasts)
      if (
        errorCode === 'auth/popup-closed-by-user' ||
        errorCode === 'auth/cancelled-popup-request'
      ) {
        console.info('[Auth] Google Sign-In popup closed or cancelled by user:', errorCode);
        return;
      }

      // Preserve and report genuine auth errors
      console.error('[Auth] Google Sign-In error:', err);
      let errorSubtitle = 'Không thể kết nối dịch vụ đăng nhập. Vui lòng thử lại sau.';
      if (errorCode === 'auth/network-request-failed') {
        errorSubtitle = 'Lỗi kết nối mạng. Vui lòng kiểm tra đường truyền.';
      } else if (errorCode === 'auth/unauthorized-domain') {
        errorSubtitle = 'Tên miền ứng dụng chưa được ủy quyền xác thực OAuth.';
      } else if (errorCode === 'auth/operation-not-allowed') {
        errorSubtitle = 'Phương thức đăng nhập Google chưa được kích hoạt.';
      } else if (errorCode === 'auth/invalid-credential') {
        errorSubtitle = 'Thông tin xác thực Google không hợp lệ.';
      }

      setActiveToast({
        title: 'Đăng nhập không thành công',
        subtitle: errorSubtitle,
        emoji: '⚠️',
      });
    } finally {
      isSigningInRef.current = false;
      setIsSigningIn(false);
    }
  };

  // Handle Sign-out
  const handleGoogleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(INITIAL_USER);
      setIsLoggedIn(false);
      setActiveToast({
        title: 'Đã đăng xuất',
        subtitle: 'Hẹn gặp lại bạn trong hành trình ẩm thực tiếp theo!',
        emoji: '👋',
      });
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  // Handle Auth Modal Success
  const handleAuthSuccess = (profile: User, isNewUser?: boolean) => {
    setUser(profile);
    setIsLoggedIn(true);
    if (isNewUser || !profile.onboardingCompleted) {
      setShowOnboardingModal(true);
    }
    setActiveToast({
      title: 'Đăng nhập thành công!',
      subtitle: `Chào mừng ${profile.displayName || profile.name} đến với BiteQuest!`,
      emoji: '🎉',
    });
  };

  // Handle Onboarding Completion
  const handleOnboardingComplete = (updatedUser: User) => {
    setUser(updatedUser);
    setShowOnboardingModal(false);
    setActiveToast({
      title: 'Hoàn tất cá nhân hoá! ✨',
      subtitle: 'Gu ẩm thực của bạn đã được thiết lập thành công.',
      emoji: '🍜',
    });
  };

  // Handle Save / Bookmark toggle
  const handleSavePlaceToggle = (placeId: string) => {
    setSavedPlaceIds((prev) => {
      const exists = prev.includes(placeId);
      if (exists) {
        return prev.filter((id) => id !== placeId);
      } else {
        setActiveToast({
          title: 'Đã lưu quán!',
          subtitle: 'Quán đã được lưu vào bộ sưu tập cá nhân.',
          emoji: '🔖',
        });
        return [...prev, placeId];
      }
    });
  };

  // Handle navigating from map / card to camera with context
  const handleNavigateToCamera = (place?: Place, context?: { mode?: 'scout' | 'echo' | 'quest'; title?: string }) => {
    if (place) {
      setCameraPreselectedPlace(place);
    }
    if (context?.title) {
      setActiveToast({
        title: context.mode === 'scout' ? '🥇 Chế độ Scout Verifier' : context.mode === 'echo' ? '🔥 Đi theo dấu bạn bè' : '🎯 Mở khóa thử thách',
        subtitle: `Chụp ảnh tại ${place?.name || 'quán ăn'} để xác minh!`,
        emoji: context.mode === 'scout' ? '👀' : context.mode === 'echo' ? '🔥' : '🗺️',
      });
    }
    setActiveTab('camera');
  };

  // Handle emoji reaction on friend's post
  const handleReaction = async (biteId: string, emoji: string) => {
    // Optimistic UI update
    setFeedBites((prev) =>
      prev.map((bite) => {
        if (bite.id !== biteId) return bite;
        const exists = bite.reactions.find((r) => r.emoji === emoji);
        let updatedReactions;
        if (exists) {
          updatedReactions = bite.reactions.map((r) =>
            r.emoji === emoji
              ? {
                  ...r,
                  count: r.userReacted ? r.count - 1 : r.count + 1,
                  userReacted: !r.userReacted,
                }
              : r
          );
        } else {
          updatedReactions = [...bite.reactions, { emoji, count: 1, userReacted: true }];
        }
        return { ...bite, reactions: updatedReactions };
      })
    );

    try {
      await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ biteId, emoji, userId: user.id }),
      });
    } catch (err) {
      console.error('Reaction API error:', err);
    }
  };

  // Handle Check-in completion
  const handleCheckinSuccess = async (checkinData: any) => {
    const newBite = checkinData.bite || checkinData.checkin;
    if (newBite) {
      setFeedBites((prev) => [newBite, ...prev]);
      saveCheckinToDb(newBite);

      // If this checkin is at a pending community spot, mark it verified (Scout Window closed, First Verifier won!)
      setPlaces((prev) =>
        prev.map((p) => {
          if (p.id === newBite.placeId && p.isCommunitySpot && !p.communityVerified) {
            return {
              ...p,
              communityStatus: 'verified',
              communityVerified: true,
              verifiedByUserId: user.id,
              verifiedAt: 'Vừa xong',
            };
          }
          return p;
        })
      );
    }

    if (checkinData.user) {
      setUser(checkinData.user);
    }

    if (checkinData.passport) {
      setPassport(checkinData.passport);
      if (user.id) {
        savePassportToDb(user.id, checkinData.passport);
      }
    }

    // Authoritative Post-Bite Experience state
    setPostBiteResult(checkinData);

    // Also add to Notification Center
    if (newBite) {
      addNotification({
        category: 'quest',
        title: 'Check-in thành công! 🎉',
        message: `Bạn vừa ghi nhận một trải nghiệm ẩm thực mới và nhận +${checkinData.earnedXp || 50} XP.`,
        actionType: 'open_passport',
        metadata: {
          xpEarned: checkinData.earnedXp || 50,
          placeName: newBite.placeName,
        },
      });
    }

    setActiveTab('explore');
  };

  // Handle Community Spot creation (Draft / Pending - Server authoritative)
  const handleCommunitySpotSubmit = async (spotData: any) => {
    try {
      const res = await fetch('/api/community-spots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...spotData,
          contributorId: user.id,
          contributorName: user.name,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.spot) {
          setPlaces((prev) => [data.spot, ...prev]);
        }
        if (data.user) {
          setUser(data.user);
        }
      }

      setCommunitySpotModalData(null);

      setActiveToast({
        title: 'Đã Đóng Góp Quán Mới!',
        subtitle: 'Quán ngõ đã được lưu (chờ xác nhận). Đang chờ bạn thứ 2 ghé ăn để mở khóa 150 XP First Bite!',
        emoji: '🛵',
        xpEarned: 0,
      });

      setActiveTab('explore');
    } catch (err) {
      console.error('Submit community spot error:', err);
      setCommunitySpotModalData(null);
    }
  };

  // Simulate Second-user First Bite verification (Server authoritative)
  const handleTriggerDemoFirstBite = async () => {
    try {
      const res = await fetch('/api/verify-community-spot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spotId: 'place_nem_nuong_co_diep',
        }),
      });

      if (res.ok) {
        const data = await res.json();

        // Update achievements
        setAchievements((prev) =>
          prev.map((a) =>
            a.id === 'badge_first_scout'
              ? { ...a, isUnlocked: true, unlockedAt: 'Hôm nay' }
              : a
          )
        );

        if (data.user) {
          setUser(data.user);
        }

        setActiveToast({
          title: '🥇 MỞ KHÓA HUY HIỆU FIRST BITE!',
          subtitle: 'Một Foodie khác đã xác minh quán ngõ của bạn. Bạn chính thức nhận danh hiệu First Verifier!',
          emoji: '🥇',
          xpEarned: data.awardedXp || 60,
        });
      }
    } catch (err) {
      console.error('Trigger first bite error:', err);
    }
  };

  // Handle Knowledge Quest Track completion
  const handleCompleteKnowledgeTrack = async (result: {
    trackId: KnowledgeTrackId;
    score: number;
    total: number;
    passed: boolean;
    earnedXp: number;
    unlockedBoth: boolean;
  }) => {
    try {
      const res = await fetch('/api/knowledge-quests/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackId: result.trackId,
          score: result.score,
          total: result.total,
          passed: result.passed,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          if (isLoggedIn) {
            saveKnowledgeProgressToDb(user.id, data.user);
          }
        }
        if (data.achievements) {
          setAchievements(data.achievements);
        }

        const trackInfo = KNOWLEDGE_TRACKS[result.trackId];

        if (result.passed) {
          addNotification({
            category: 'achievement',
            title: `Mở khóa huy hiệu: ${trackInfo.titleVi}`,
            message: `Bạn đã vượt qua ${result.score}/${result.total} câu hỏi và nhận +${data.earnedXp || 100} XP!`,
            actionType: 'open_profile',
            metadata: {
              xpEarned: data.earnedXp || 100,
              badgeName: trackInfo.titleVi,
            },
          });

          setActiveToast({
            title: `🛡️ MỞ KHÓA HUY HIỆU: ${trackInfo.titleVi.toUpperCase()}!`,
            subtitle: `Bạn đã xuất sắc vượt qua ${result.score}/${result.total} câu hỏi thực tế. Đã mở khóa sticker & huy hiệu!`,
            emoji: trackInfo.badgeEmoji,
            xpEarned: data.earnedXp || 0,
          });

          if (result.unlockedBoth || data.unlockedMetaTitle) {
            setTimeout(() => {
              addNotification({
                category: 'achievement',
                title: 'Danh hiệu cao cấp mở khóa! 🏆',
                message: `Bạn chính thức sở hữu danh hiệu "${META_KNOWLEDGE_TITLE}" trên hồ sơ cá nhân.`,
                actionType: 'open_profile',
              });

              setActiveToast({
                title: '🏆 DANH HIỆU CAO CẤP MỞ KHÓA!',
                subtitle: `Chúc mừng bạn đã mở khóa danh hiệu "${META_KNOWLEDGE_TITLE}" trên trang cá nhân!`,
                emoji: '🏆',
              });
            }, 3500);
          }
        }
      }
    } catch (err) {
      console.error('Complete knowledge track error:', err);
    } finally {
      setActiveKnowledgeQuestTrack(null);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#FDFCF8] text-[#2D2926] font-sans select-none antialiased">
      {/* 1. Global Top App Bar (Shown across tabs, hidden only in full-bleed camera mode) */}
      {activeTab !== 'camera' && (
        <TopAppBar
          districtName={passport.districtName}
          xp={user.xp}
          unreadCount={unreadNotificationsCount}
          onOpenMenu={() => setIsDrawerOpen(true)}
          onOpenBiteBot={() => setShowBiteBotModal(true)}
          onOpenNotifications={() => setShowNotificationCenter(true)}
        />
      )}

      {/* 2. Achievement / Confirmation Toast */}
      <AchievementToast toast={activeToast} onClose={() => setActiveToast(null)} />

      {/* 3. Main Tab Views */}
      <main className="w-full min-h-screen">
        {(activeTab === 'explore' || activeTab === 'radar') && (
          <ErrorBoundary
            fallbackTitle="Bản đồ đang tải lại"
            fallbackMessage="Bản đồ khám phá ẩm thực đang được kết nối lại. Nhấn để tải lại giao diện."
          >
            <MapView
              places={places}
              selectedPlace={selectedPlace}
              onSelectPlace={(p) => setSelectedPlace(p)}
              onNavigateToCamera={handleNavigateToCamera}
              onSavePlaceToggle={handleSavePlaceToggle}
              savedPlaceIds={savedPlaceIds}
              feedBites={feedBites}
              passport={passport}
              user={user}
              isRadarOpen={activeTab === 'radar'}
              onRadarOpenChange={(open) => setActiveTab(open ? 'radar' : 'explore')}
              onOpenBiteBot={() => setShowBiteBotModal(true)}
              onOpenMenu={() => setIsDrawerOpen(true)}
              onOpenNotifications={() => setShowNotificationCenter(true)}
              targetMapFocus={targetMapFocus}
              onClearTargetMapFocus={() => setTargetMapFocus(null)}
              openTrafficSheetDirectly={openTrafficSheetDirectly}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'friends' && (
          <FriendFeedView
            feedBites={feedBites}
            onReact={handleReaction}
            onNavigateToPlace={(placeId) => {
              const p = places.find((item) => item.id === placeId);
              if (p) setSelectedPlace(p);
              setActiveTab('explore');
            }}
          />
        )}

        {activeTab === 'camera' && (
          <CameraBiteView
            preselectedPlace={cameraPreselectedPlace}
            onClose={() => setActiveTab('explore')}
            onCheckinSuccess={(data) => {
              handleCheckinSuccess(data);
            }}
            onOpenCommunitySpotModal={(data) => setCommunitySpotModalData(data)}
          />
        )}

        {activeTab === 'passport' && (
          <PassportView
            passport={passport}
            user={user}
            onNavigateToExplore={() => setActiveTab('explore')}
            onNavigateToCamera={() => handleNavigateToCamera()}
            onOpenKnowledgeQuest={(trackId) => setActiveKnowledgeQuestTrack(trackId)}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileView
            user={user}
            achievements={achievements}
            onUpdateTitle={(title) => setUser((prev) => ({ ...prev, activeTitle: title }))}
            onNavigateToPassport={() => setActiveTab('passport')}
            onNavigateToFriends={() => setActiveTab('friends')}
            onOpenKnowledge={() => setActiveKnowledgeQuestTrack('smart_biter')}
            onOpenAbout={() => setShowAboutModal(true)}
            onOpenJudgeDev={() => setShowJudgeDevModal(true)}
            onOpenAuthModal={() => {
              setAuthModalInitialMode('entry');
              setShowAuthModal(true);
            }}
            onOpenPersonalization={() => setShowOnboardingModal(true)}
            onOpenBiteBot={() => setShowBiteBotModal(true)}
            onGoogleSignIn={handleGoogleSignIn}
            onGoogleSignOut={handleGoogleSignOut}
            isLoggedIn={isLoggedIn}
            isSigningIn={isSigningIn}
          />
        )}
      </main>

      {/* 4. Persistent Bottom Navigation (Hidden in full-bleed Camera mode) */}
      {activeTab !== 'camera' && (
        <BottomNavBar
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab)}
          isNearActiveVenue={Boolean(selectedPlace)}
        />
      )}

      {/* 5. Navigation Drawer (Slide from Left) */}
      <NavigationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        user={user}
        onOpenAbout={() => setShowAboutModal(true)}
        onOpenJudgeDev={() => setShowJudgeDevModal(true)}
        onOpenAuthModal={() => {
          setAuthModalInitialMode('entry');
          setShowAuthModal(true);
        }}
        onOpenBiteBot={() => setShowBiteBotModal(true)}
        onGoogleSignIn={handleGoogleSignIn}
        onGoogleSignOut={handleGoogleSignOut}
        isLoggedIn={isLoggedIn}
        isSigningIn={isSigningIn}
      />

      {/* 6. Auth Modal (Login / Register / Google / Guest) */}
      <AuthModal
        isOpen={showAuthModal}
        initialMode={authModalInitialMode}
        isSigningIn={isSigningIn}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* 7. Lightweight Personalized Onboarding (Food Preferences + Exploration Style) */}
      <OnboardingModal
        isOpen={showOnboardingModal}
        user={user}
        onComplete={handleOnboardingComplete}
      />

      {/* 8. Knowledge Quest Modal */}
      {activeKnowledgeQuestTrack && (
        <KnowledgeQuestModal
          trackId={activeKnowledgeQuestTrack}
          user={user}
          onClose={() => setActiveKnowledgeQuestTrack(null)}
          onCompleteTrack={handleCompleteKnowledgeTrack}
        />
      )}

      {/* 9. Community Spot Discovery Modal */}
      {communitySpotModalData && (
        <CommunitySpotModal
          prefillData={communitySpotModalData.prefillData}
          imageUrl={communitySpotModalData.imageUrl}
          latitude={communitySpotModalData.latitude}
          longitude={communitySpotModalData.longitude}
          onClose={() => setCommunitySpotModalData(null)}
          onSubmit={handleCommunitySpotSubmit}
        />
      )}

      {/* 10. About BiteQuest Info Modal */}
      <AboutModal
        isOpen={showAboutModal}
        onClose={() => setShowAboutModal(false)}
      />

      {/* 11. Judge & Developer Console Modal */}
      <JudgeDevModal
        isOpen={showJudgeDevModal}
        onClose={() => setShowJudgeDevModal(false)}
        onTriggerDemoFirstBite={handleTriggerDemoFirstBite}
      />

      {/* 12. Authoritative Post-Bite Value & Journey Experience */}
      {postBiteResult && (
        <PostBiteExperienceModal
          result={postBiteResult}
          onContinueExplore={() => {
            setPostBiteResult(null);
            setActiveTab('explore');
          }}
          onViewJourney={() => {
            setPostBiteResult(null);
            setActiveTab('passport');
          }}
        />
      )}

      {/* 13. BiteBot - Professional Culinary AI Concierge Modal */}
      <BiteBotModal
        isOpen={showBiteBotModal}
        onClose={() => setShowBiteBotModal(false)}
        places={places}
        userLocation={{ latitude: 21.0285, longitude: 105.7958, district: passport.districtName || 'Cầu Giấy' }}
        userPreferences={user.foodPreferences}
        onSelectPlace={(place) => {
          setSelectedPlace(place);
          setActiveTab('explore');
          setShowBiteBotModal(false);
        }}
      />

      {/* 14. Standard, Sharp Notification Center (Traffic 5km, Quests, Achievements, Exploration) */}
      <NotificationCenterModal
        isOpen={showNotificationCenter}
        onClose={() => setShowNotificationCenter(false)}
        notifications={notifications}
        onMarkAsRead={handleMarkNotificationAsRead}
        onMarkAllAsRead={handleMarkAllNotificationsAsRead}
        onDeleteNotification={handleDeleteNotification}
        onClearAllNotifications={handleClearAllNotifications}
        onSelectTrafficHotspot={(hotspot) => {
          setTargetMapFocus({
            latitude: hotspot.latitude,
            longitude: hotspot.longitude,
            name: hotspot.name,
          });
          setActiveTab('explore');
          setActiveToast({
            title: 'Vị trí điểm nghẽn giao thông',
            subtitle: `Đã di chuyển bản đồ đến: ${hotspot.name}`,
            emoji: '🚦',
          });
        }}
        onNavigateToTab={(tab) => {
          setActiveTab(tab);
        }}
      />
    </div>
  );
}
