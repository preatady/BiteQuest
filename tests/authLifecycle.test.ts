import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Google Sign-In Lifecycle & Popup Concurrency Guard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Concurrency Guard & Exactly-One-Popup Invariant', () => {
    it('ensures one click creates exactly one popup request and rejects concurrent triggers', async () => {
      let popupExecutionCount = 0;
      let isSigningInRef = { current: false };
      let setIsSigningInState = vi.fn();
      let resolvePopup: any;

      const popupPromise = new Promise((resolve) => {
        resolvePopup = resolve;
      });

      const mockSignInWithPopup = vi.fn().mockImplementation(async () => {
        popupExecutionCount++;
        await popupPromise;
        return { user: { uid: 'u_123', displayName: 'Bite Scout' } };
      });

      const handleGoogleSignIn = async () => {
        if (isSigningInRef.current) {
          return;
        }
        isSigningInRef.current = true;
        setIsSigningInState(true);

        try {
          await mockSignInWithPopup();
        } finally {
          isSigningInRef.current = false;
          setIsSigningInState(false);
        }
      };

      // User triggers 3 rapid / simultaneous clicks
      const p1 = handleGoogleSignIn();
      const p2 = handleGoogleSignIn();
      const p3 = handleGoogleSignIn();

      // At this point, exactly 1 popup call was made, others rejected by guard
      expect(mockSignInWithPopup).toHaveBeenCalledTimes(1);
      expect(isSigningInRef.current).toBe(true);
      expect(setIsSigningInState).toHaveBeenCalledWith(true);

      // Resolve the initial popup
      resolvePopup();
      await Promise.all([p1, p2, p3]);

      // Exactly 1 execution occurred across all concurrent triggers
      expect(popupExecutionCount).toBe(1);
      expect(isSigningInRef.current).toBe(false);
      expect(setIsSigningInState).toHaveBeenLastCalledWith(false);
    });

    it('allows a new popup request after the previous one completes or closes', async () => {
      let isSigningInRef = { current: false };
      const mockSignInWithPopup = vi.fn().mockResolvedValue({
        user: { uid: 'u_456', displayName: 'Foodie Explorer' },
      });

      const handleGoogleSignIn = async () => {
        if (isSigningInRef.current) return;
        isSigningInRef.current = true;
        try {
          await mockSignInWithPopup();
        } finally {
          isSigningInRef.current = false;
        }
      };

      // First click
      await handleGoogleSignIn();
      expect(mockSignInWithPopup).toHaveBeenCalledTimes(1);

      // Second click after first completed
      await handleGoogleSignIn();
      expect(mockSignInWithPopup).toHaveBeenCalledTimes(2);
    });
  });

  describe('2. User Cancellation vs Real Error Classification', () => {
    it('treats auth/popup-closed-by-user as expected user cancellation (no error toast, no red UI)', async () => {
      let errorToastShown = false;
      const errorLogSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const infoLogSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      const mockError = { code: 'auth/popup-closed-by-user', message: 'Popup closed by user.' };
      const mockSignInWithPopup = vi.fn().mockRejectedValue(mockError);

      let isSigningInRef = { current: false };

      const handleGoogleSignIn = async () => {
        if (isSigningInRef.current) return;
        isSigningInRef.current = true;

        try {
          await mockSignInWithPopup();
        } catch (err: any) {
          const errorCode = err?.code || '';
          if (
            errorCode === 'auth/popup-closed-by-user' ||
            errorCode === 'auth/cancelled-popup-request'
          ) {
            console.info('[Auth] Google Sign-In popup closed or cancelled by user:', errorCode);
            return;
          }
          errorToastShown = true;
          console.error('[Auth] Google Sign-In error:', err);
        } finally {
          isSigningInRef.current = false;
        }
      };

      await handleGoogleSignIn();

      expect(errorToastShown).toBe(false);
      expect(errorLogSpy).not.toHaveBeenCalled();
      expect(infoLogSpy).toHaveBeenCalledWith(
        '[Auth] Google Sign-In popup closed or cancelled by user:',
        'auth/popup-closed-by-user'
      );
      expect(isSigningInRef.current).toBe(false);
    });

    it('treats auth/cancelled-popup-request as expected user cancellation', async () => {
      let errorToastShown = false;
      const errorLogSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockError = { code: 'auth/cancelled-popup-request', message: 'Popup cancelled.' };
      const mockSignInWithPopup = vi.fn().mockRejectedValue(mockError);

      let isSigningInRef = { current: false };

      const handleGoogleSignIn = async () => {
        if (isSigningInRef.current) return;
        isSigningInRef.current = true;

        try {
          await mockSignInWithPopup();
        } catch (err: any) {
          const errorCode = err?.code || '';
          if (
            errorCode === 'auth/popup-closed-by-user' ||
            errorCode === 'auth/cancelled-popup-request'
          ) {
            return;
          }
          errorToastShown = true;
          console.error('[Auth] Google Sign-In error:', err);
        } finally {
          isSigningInRef.current = false;
        }
      };

      await handleGoogleSignIn();

      expect(errorToastShown).toBe(false);
      expect(errorLogSpy).not.toHaveBeenCalled();
      expect(isSigningInRef.current).toBe(false);
    });

    it('preserves and surfaces genuine errors (e.g. auth/network-request-failed)', async () => {
      let activeToast: any = null;
      const errorLogSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockError = { code: 'auth/network-request-failed', message: 'A network error had occurred.' };
      const mockSignInWithPopup = vi.fn().mockRejectedValue(mockError);

      let isSigningInRef = { current: false };

      const handleGoogleSignIn = async () => {
        if (isSigningInRef.current) return;
        isSigningInRef.current = true;

        try {
          await mockSignInWithPopup();
        } catch (err: any) {
          const errorCode = err?.code || '';
          if (
            errorCode === 'auth/popup-closed-by-user' ||
            errorCode === 'auth/cancelled-popup-request'
          ) {
            return;
          }
          console.error('[Auth] Google Sign-In error:', err);
          let errorSubtitle = 'Không thể kết nối dịch vụ đăng nhập. Vui lòng thử lại sau.';
          if (errorCode === 'auth/network-request-failed') {
            errorSubtitle = 'Lỗi kết nối mạng. Vui lòng kiểm tra đường truyền.';
          } else if (errorCode === 'auth/unauthorized-domain') {
            errorSubtitle = 'Tên miền ứng dụng chưa được ủy quyền xác thực OAuth.';
          }

          activeToast = {
            title: 'Đăng nhập không thành công',
            subtitle: errorSubtitle,
            emoji: '⚠️',
          };
        } finally {
          isSigningInRef.current = false;
        }
      };

      await handleGoogleSignIn();

      expect(errorLogSpy).toHaveBeenCalled();
      expect(activeToast).toEqual({
        title: 'Đăng nhập không thành công',
        subtitle: 'Lỗi kết nối mạng. Vui lòng kiểm tra đường truyền.',
        emoji: '⚠️',
      });
      expect(isSigningInRef.current).toBe(false);
    });

    it('preserves and surfaces unauthorized-domain configuration errors', async () => {
      let activeToast: any = null;
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockError = { code: 'auth/unauthorized-domain', message: 'Domain not authorized.' };
      const mockSignInWithPopup = vi.fn().mockRejectedValue(mockError);

      let isSigningInRef = { current: false };

      const handleGoogleSignIn = async () => {
        if (isSigningInRef.current) return;
        isSigningInRef.current = true;

        try {
          await mockSignInWithPopup();
        } catch (err: any) {
          const errorCode = err?.code || '';
          if (
            errorCode === 'auth/popup-closed-by-user' ||
            errorCode === 'auth/cancelled-popup-request'
          ) {
            return;
          }
          let errorSubtitle = 'Không thể kết nối dịch vụ đăng nhập. Vui lòng thử lại sau.';
          if (errorCode === 'auth/unauthorized-domain') {
            errorSubtitle = 'Tên miền ứng dụng chưa được ủy quyền xác thực OAuth.';
          }

          activeToast = {
            title: 'Đăng nhập không thành công',
            subtitle: errorSubtitle,
            emoji: '⚠️',
          };
        } finally {
          isSigningInRef.current = false;
        }
      };

      await handleGoogleSignIn();

      expect(activeToast.subtitle).toContain('chưa được ủy quyền');
      expect(isSigningInRef.current).toBe(false);
    });
  });
});
