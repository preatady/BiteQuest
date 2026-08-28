import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { User, AuthProviderType } from '../types';
import { EMPTY_USER } from '../data/seedData';
import {
  validateUsername,
  validateDisplayName,
  validateEmail,
  validatePassword,
} from '../services/authValidation';
import { checkUsernameAvailability, syncUserProfile } from '../services/firebaseDb';

export type AuthMode = 'entry' | 'login' | 'register' | 'guest_setup';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User, isNewUser?: boolean) => void;
  isSigningIn?: boolean;
  initialMode?: AuthMode;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  isSigningIn = false,
  initialMode = 'entry',
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');

  // Status & Validation
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [usernameFeedback, setUsernameFeedback] = useState<{
    status: 'idle' | 'checking' | 'valid' | 'invalid';
    message?: string;
  }>({ status: 'idle' });

  // Guest temporary user object awaiting username/name
  const [pendingGuestUser, setPendingGuestUser] = useState<any | null>(null);

  if (!isOpen) return null;

  // Handle Username live format validation
  const handleUsernameChange = (val: string) => {
    // Strip spaces and normalize to alphanumeric characters
    const cleanVal = val.replace(/\s+/g, '');
    setUsername(cleanVal);

    if (!cleanVal) {
      setUsernameFeedback({ status: 'idle' });
      return;
    }

    const validation = validateUsername(cleanVal);
    if (!validation.valid) {
      setUsernameFeedback({ status: 'invalid', message: validation.error });
    } else {
      setUsernameFeedback({ status: 'valid', message: 'ID người dùng hợp lệ' });
    }
  };

  // Google Sign-In
  const handleGoogleAuth = async () => {
    if (loading || isSigningIn) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        const profile = await syncUserProfile(result.user, {
          displayName: result.user.displayName || 'Bite Explorer',
          authProvider: 'google',
          isGuest: false,
        });
        onSuccess(profile, !profile.onboardingCompleted);
        onClose();
      }
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        // Normal user cancellation - do not treat as an error
        return;
      }
      console.error('[Auth] Google sign-in failed:', err);
      setErrorMessage(
        code === 'auth/network-request-failed'
          ? 'Lỗi kết nối mạng. Vui lòng thử lại.'
          : code === 'auth/unauthorized-domain'
          ? 'Tên miền chưa được cấu hình xác thực Google.'
          : 'Đăng nhập Google không thành công. Vui lòng thử lại.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Anonymous Guest Sign-In (with instant graceful local fallback)
  const handleAnonymousGuest = async () => {
    if (loading) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const result = await signInAnonymously(auth);
      if (result.user) {
        setPendingGuestUser(result.user);
        // Prompt guest for ID and display name to personalize profile
        setUsername(`guest${result.user.uid.slice(0, 5)}`);
        setDisplayName('Khách Ẩm Thực');
        setMode('guest_setup');
        return;
      }
    } catch (err: any) {
      console.warn('[Auth] Firebase Anonymous provider not enabled, using fallback guest session:', err);
    }

    // Resilient Fallback: Generate guest session so the user is never blocked
    const fallbackGuestUid = `guest_${Math.random().toString(36).substring(2, 9)}`;
    const fallbackUser = {
      uid: fallbackGuestUid,
      displayName: 'Khách Ẩm Thực',
      isAnonymous: true,
    };
    setPendingGuestUser(fallbackUser);
    setUsername(`guest${fallbackGuestUid.slice(6, 11)}`);
    setDisplayName('Khách Ẩm Thực');
    setMode('guest_setup');
    setLoading(false);
  };

  // Submit Guest Profile (Username + Display Name)
  const handleSubmitGuestProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingGuestUser) return;

    setErrorMessage(null);
    const userVal = validateUsername(username);
    if (!userVal.valid) {
      setErrorMessage(userVal.error || 'ID người dùng không hợp lệ');
      return;
    }

    const nameVal = validateDisplayName(displayName);
    if (!nameVal.valid) {
      setErrorMessage(nameVal.error || 'Họ tên không hợp lệ');
      return;
    }

    setLoading(true);
    try {
      // Check username availability
      const avail = await checkUsernameAvailability(username, pendingGuestUser.uid);
      if (!avail.available) {
        setErrorMessage(avail.error || 'ID người dùng này đã được sử dụng.');
        setLoading(false);
        return;
      }

      if (typeof pendingGuestUser.getIdToken === 'function') {
        try {
          await updateProfile(pendingGuestUser, { displayName: displayName.trim() });
        } catch (e) {
          console.warn('updateProfile warning:', e);
        }
        const profile = await syncUserProfile(pendingGuestUser, {
          username: username.trim(),
          displayName: displayName.trim(),
          authProvider: 'anonymous',
          isGuest: true,
          onboardingCompleted: false,
        });
        onSuccess(profile, true);
        onClose();
      } else {
        // Fallback local guest profile
        const now = new Date().toISOString();
        const fallbackProfile: User = {
          ...EMPTY_USER,
          id: pendingGuestUser.uid,
          uid: pendingGuestUser.uid,
          username: username.trim(),
          name: displayName.trim(),
          displayName: displayName.trim(),
          authProvider: 'anonymous',
          isGuest: true,
          foodPreferences: [],
          onboardingCompleted: false,
          createdAt: now,
          updatedAt: now,
        };
        try {
          localStorage.setItem('bitequest_guest_session', JSON.stringify(fallbackProfile));
        } catch (e) {}
        onSuccess(fallbackProfile, true);
        onClose();
      }
    } catch (err: any) {
      console.warn('[Auth] Save guest profile fallback:', err);
      const now = new Date().toISOString();
      const fallbackProfile: User = {
        ...EMPTY_USER,
        id: pendingGuestUser.uid || `guest_${Date.now()}`,
        uid: pendingGuestUser.uid || `guest_${Date.now()}`,
        username: username.trim() || `guest${Date.now().toString().slice(-4)}`,
        name: displayName.trim() || 'Khách Ẩm Thực',
        displayName: displayName.trim() || 'Khách Ẩm Thực',
        authProvider: 'anonymous',
        isGuest: true,
        foodPreferences: [],
        onboardingCompleted: false,
        createdAt: now,
        updatedAt: now,
      };
      onSuccess(fallbackProfile, true);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  // Email Login
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const emailVal = validateEmail(email);
    if (!emailVal.valid) {
      setErrorMessage(emailVal.error || 'Email không hợp lệ');
      return;
    }

    const passVal = validatePassword(password);
    if (!passVal.valid) {
      setErrorMessage(passVal.error || 'Mật khẩu không hợp lệ');
      return;
    }

    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (result.user) {
        const profile = await syncUserProfile(result.user);
        onSuccess(profile, !profile.onboardingCompleted);
        onClose();
      }
    } catch (err: any) {
      const code = err?.code || '';
      console.error('[Auth] Email login failed:', err);
      if (
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential'
      ) {
        setErrorMessage('Email hoặc mật khẩu không chính xác.');
      } else if (code === 'auth/too-many-requests') {
        setErrorMessage('Quá nhiều lần thử thất bại. Vui lòng đợi trong giây lát.');
      } else {
        setErrorMessage('Đăng nhập không thành công. Vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Email Registration
  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const emailVal = validateEmail(email);
    if (!emailVal.valid) {
      setErrorMessage(emailVal.error || 'Email không hợp lệ');
      return;
    }

    const passVal = validatePassword(password);
    if (!passVal.valid) {
      setErrorMessage(passVal.error || 'Mật khẩu tối thiểu 6 ký tự');
      return;
    }

    const userVal = validateUsername(username);
    if (!userVal.valid) {
      setErrorMessage(userVal.error || 'ID người dùng không hợp lệ');
      return;
    }

    const nameVal = validateDisplayName(displayName);
    if (!nameVal.valid) {
      setErrorMessage(nameVal.error || 'Họ tên không hợp lệ');
      return;
    }

    setLoading(true);
    try {
      // 1. Authoritative username uniqueness check
      const avail = await checkUsernameAvailability(username);
      if (!avail.available) {
        setErrorMessage(avail.error || 'ID người dùng này đã được sử dụng.');
        setLoading(false);
        return;
      }

      // 2. Create Firebase Auth user
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (result.user) {
        await updateProfile(result.user, { displayName: displayName.trim() });
        const profile = await syncUserProfile(result.user, {
          username: username.trim(),
          displayName: displayName.trim(),
          authProvider: 'password',
          isGuest: false,
          onboardingCompleted: false,
        });

        onSuccess(profile, true);
        onClose();
      }
    } catch (err: any) {
      const code = err?.code || '';
      console.error('[Auth] Email registration failed:', err);
      if (code === 'auth/email-already-in-use') {
        setErrorMessage('Email này đã được sử dụng. Vui lòng đăng nhập hoặc dùng email khác.');
      } else if (code === 'auth/weak-password') {
        setErrorMessage('Mật khẩu quá ngắn. Vui lòng đặt tối thiểu 6 ký tự.');
      } else {
        setErrorMessage('Đăng ký không thành công. Vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="auth-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        id="auth-modal-container"
        className="w-full max-w-sm bg-[#FFFDF9] rounded-3xl p-5 sm:p-6 shadow-2xl border border-[#FF6B35]/20 max-h-[calc(100dvh-2rem)] overflow-y-auto relative flex flex-col"
      >
        {/* Close Button */}
        {!loading && (
          <button
            type="button"
            id="auth-modal-close-btn"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#F5F3ED] hover:bg-neutral-200 flex items-center justify-center text-neutral-500 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        )}

        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#FF6B35] to-[#FFA07A] flex items-center justify-center text-white text-2xl mx-auto shadow-md mb-2">
            🍜
          </div>
          <h2 className="text-xl font-heading font-black text-[#1A1D1E] tracking-tight">
            BiteQuest Hà Nội
          </h2>
          <p className="text-xs text-neutral-500 font-sans mt-0.5">
            Khám phá & chinh phục bản đồ ẩm thực thật
          </p>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div
            id="auth-error-banner"
            className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px] text-red-500 shrink-0">
              error
            </span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* =======================================================
            VIEW 1: ENTRY SCREEN (4 CLEAR ACTIONS)
        ======================================================== */}
        {mode === 'entry' && (
          <div id="auth-entry-view" className="space-y-3">
            {/* 1. Google Sign-in */}
            <button
              type="button"
              id="auth-google-btn"
              onClick={handleGoogleAuth}
              disabled={loading || isSigningIn}
              className={`w-full py-3 px-4 bg-white border border-neutral-200 hover:border-[#FF6B35]/40 text-[#1A1D1E] rounded-2xl font-heading text-sm font-bold flex items-center justify-center gap-2.5 shadow-xs transition-all ${
                loading || isSigningIn
                  ? 'opacity-60 cursor-not-allowed'
                  : 'hover:shadow-md active:scale-98'
              }`}
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">
                    progress_activity
                  </span>
                  <span>Đang kết nối Google...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Tiếp tục với Google</span>
                </>
              )}
            </button>

            {/* 2. Login with Email */}
            <button
              type="button"
              id="auth-login-view-btn"
              onClick={() => {
                setErrorMessage(null);
                setMode('login');
              }}
              disabled={loading}
              className="w-full py-3 px-4 bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white rounded-2xl font-heading text-sm font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-98 transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">mail</span>
              <span>Đăng nhập</span>
            </button>

            {/* 3. Register with Email */}
            <button
              type="button"
              id="auth-register-view-btn"
              onClick={() => {
                setErrorMessage(null);
                setMode('register');
              }}
              disabled={loading}
              className="w-full py-3 px-4 bg-[#F5F3ED] hover:bg-neutral-200 text-[#1A1D1E] rounded-2xl font-heading text-sm font-bold flex items-center justify-center gap-2 active:scale-98 transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              <span>Đăng ký</span>
            </button>

            {/* 4. Guest Mode */}
            <div className="pt-2 text-center">
              <button
                type="button"
                id="auth-guest-btn"
                onClick={handleAnonymousGuest}
                disabled={loading}
                className="text-xs text-neutral-500 hover:text-[#FF6B35] font-sans font-medium flex items-center justify-center gap-1 mx-auto underline decoration-dotted underline-offset-4 transition-colors"
              >
                <span>Tiếp tục với tư cách khách</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>
          </div>
        )}

        {/* =======================================================
            VIEW 2: LOGIN (EMAIL + PASSWORD)
        ======================================================== */}
        {mode === 'login' && (
          <form id="auth-login-form" onSubmit={handleEmailLogin} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                Email
              </label>
              <input
                id="login-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3.5 py-2.5 bg-[#F5F3ED] rounded-xl text-sm text-[#1A1D1E] focus:outline-none focus:ring-2 focus:ring-[#FF6B35] border border-transparent focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                Mật khẩu
              </label>
              <input
                id="login-password-input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-[#F5F3ED] rounded-xl text-sm text-[#1A1D1E] focus:outline-none focus:ring-2 focus:ring-[#FF6B35] border border-transparent focus:bg-white"
              />
            </div>

            <button
              type="submit"
              id="login-submit-btn"
              disabled={loading}
              className="w-full py-3 bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white rounded-2xl font-heading text-sm font-bold shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <span className="material-symbols-outlined text-[18px] animate-spin">
                  progress_activity
                </span>
              ) : (
                <span>Đăng nhập</span>
              )}
            </button>

            <div className="flex items-center justify-between text-xs pt-1 text-neutral-500 font-sans">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setMode('entry');
                }}
                className="hover:text-neutral-800"
              >
                ← Quay lại
              </button>
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setMode('register');
                }}
                className="text-[#FF6B35] font-bold hover:underline"
              >
                Chưa có tài khoản? Đăng ký
              </button>
            </div>
          </form>
        )}

        {/* =======================================================
            VIEW 3: EMAIL REGISTRATION (EMAIL, PW, USERNAME, NAME)
        ======================================================== */}
        {mode === 'register' && (
          <form id="auth-register-form" onSubmit={handleEmailRegister} className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                ID Người dùng (Username)
              </label>
              <input
                id="register-username-input"
                type="text"
                required
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder="ví dụ: minh123, huynguyen"
                className="w-full px-3.5 py-2.5 bg-[#F5F3ED] rounded-xl text-sm text-[#1A1D1E] focus:outline-none focus:ring-2 focus:ring-[#FF6B35] border border-transparent focus:bg-white"
              />
              <p
                className={`text-[10px] mt-1 ${
                  usernameFeedback.status === 'invalid'
                    ? 'text-red-600'
                    : usernameFeedback.status === 'valid'
                    ? 'text-emerald-600'
                    : 'text-neutral-400'
                }`}
              >
                {usernameFeedback.message || '3–20 ký tự, chữ và số không dấu, không khoảng trắng'}
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                Họ và tên
              </label>
              <input
                id="register-name-input"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nguyễn Văn Minh"
                className="w-full px-3.5 py-2.5 bg-[#F5F3ED] rounded-xl text-sm text-[#1A1D1E] focus:outline-none focus:ring-2 focus:ring-[#FF6B35] border border-transparent focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                Email
              </label>
              <input
                id="register-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3.5 py-2.5 bg-[#F5F3ED] rounded-xl text-sm text-[#1A1D1E] focus:outline-none focus:ring-2 focus:ring-[#FF6B35] border border-transparent focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                Mật khẩu
              </label>
              <input
                id="register-password-input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                className="w-full px-3.5 py-2.5 bg-[#F5F3ED] rounded-xl text-sm text-[#1A1D1E] focus:outline-none focus:ring-2 focus:ring-[#FF6B35] border border-transparent focus:bg-white"
              />
            </div>

            <button
              type="submit"
              id="register-submit-btn"
              disabled={loading}
              className="w-full py-3 bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white rounded-2xl font-heading text-sm font-bold shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <span className="material-symbols-outlined text-[18px] animate-spin">
                  progress_activity
                </span>
              ) : (
                <span>Tạo tài khoản</span>
              )}
            </button>

            <div className="flex items-center justify-between text-xs pt-1 text-neutral-500 font-sans">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setMode('entry');
                }}
                className="hover:text-neutral-800"
              >
                ← Quay lại
              </button>
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setMode('login');
                }}
                className="text-[#FF6B35] font-bold hover:underline"
              >
                Đã có tài khoản? Đăng nhập
              </button>
            </div>
          </form>
        )}

        {/* =======================================================
            VIEW 4: GUEST PROFILE SETUP (USERNAME + DISPLAY NAME)
        ======================================================== */}
        {mode === 'guest_setup' && (
          <form id="auth-guest-form" onSubmit={handleSubmitGuestProfile} className="space-y-3.5">
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/60 text-xs text-amber-800">
              <p className="font-bold">🎭 Tài khoản Khách với Firebase UID thật</p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Bạn có thể nâng cấp hoặc liên kết tài khoản Google sau này mà không mất lịch sử check-in.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                ID Người dùng (Username)
              </label>
              <input
                id="guest-username-input"
                type="text"
                required
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder="bite2026"
                className="w-full px-3.5 py-2.5 bg-[#F5F3ED] rounded-xl text-sm text-[#1A1D1E] focus:outline-none focus:ring-2 focus:ring-[#FF6B35] border border-transparent focus:bg-white"
              />
              <p
                className={`text-[10px] mt-1 ${
                  usernameFeedback.status === 'invalid'
                    ? 'text-red-600'
                    : usernameFeedback.status === 'valid'
                    ? 'text-emerald-600'
                    : 'text-neutral-400'
                }`}
              >
                {usernameFeedback.message || '3–20 ký tự, chữ và số không dấu'}
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                Biệt danh hiển thị
              </label>
              <input
                id="guest-name-input"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Bite Explorer"
                className="w-full px-3.5 py-2.5 bg-[#F5F3ED] rounded-xl text-sm text-[#1A1D1E] focus:outline-none focus:ring-2 focus:ring-[#FF6B35] border border-transparent focus:bg-white"
              />
            </div>

            <button
              type="submit"
              id="guest-submit-btn"
              disabled={loading}
              className="w-full py-3 bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white rounded-2xl font-heading text-sm font-bold shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <span className="material-symbols-outlined text-[18px] animate-spin">
                  progress_activity
                </span>
              ) : (
                <span>Vào trải nghiệm ngay</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
