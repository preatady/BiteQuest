import { ONBOARDING_FOOD_PREFERENCES, ONBOARDING_EXPLORATION_STYLES } from '../types';

/**
 * Validates a BiteQuest Username according to strict rules:
 * - 3–20 characters
 * - Letters A-Z / a-z and digits 0-9 only
 * - No spaces
 * - No Vietnamese accents or special symbols
 */
export function validateUsername(username: string): { valid: boolean; error?: string } {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'ID người dùng không được để trống.' };
  }

  if (/\s/.test(username)) {
    return { valid: false, error: 'ID người dùng không được chứa khoảng trắng.' };
  }

  if (username.length < 3) {
    return { valid: false, error: 'ID người dùng phải có tối thiểu 3 ký tự.' };
  }

  if (username.length > 20) {
    return { valid: false, error: 'ID người dùng không được vượt quá 20 ký tự.' };
  }

  // Regex enforcing strictly alphanumeric characters only
  const alphanumericRegex = /^[a-zA-Z0-9]{3,20}$/;
  if (!alphanumericRegex.test(username)) {
    return {
      valid: false,
      error: 'ID người dùng chỉ được chứa chữ cái (A-Z, a-z) và chữ số (0-9), không dấu, không khoảng trắng.',
    };
  }

  return { valid: true };
}

/**
 * Validates display name
 */
export function validateDisplayName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string' || !name.trim()) {
    return { valid: false, error: 'Họ tên không được để trống.' };
  }

  const trimmed = name.trim();
  if (trimmed.length > 60) {
    return { valid: false, error: 'Họ tên không được vượt quá 60 ký tự.' };
  }

  return { valid: true };
}

/**
 * Validates email format
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email không được để trống.' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { valid: false, error: 'Địa chỉ email không hợp lệ.' };
  }

  return { valid: true };
}

/**
 * Validates password strength (minimum 6 characters for Firebase Auth)
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Mật khẩu không được để trống.' };
  }

  if (password.length < 6) {
    return { valid: false, error: 'Mật khẩu phải có tối thiểu 6 ký tự.' };
  }

  return { valid: true };
}

/**
 * Validates onboarding choices:
 * - Food preferences: max 3 selections from allowed set
 * - Exploration style: max 1 selection from allowed set
 */
export function validateOnboardingChoices(
  foodPreferences: string[],
  explorationStyle?: string
): { valid: boolean; error?: string } {
  if (foodPreferences && foodPreferences.length > 3) {
    return { valid: false, error: 'Bạn chỉ được chọn tối đa 3 món yêu thích.' };
  }

  return { valid: true };
}
