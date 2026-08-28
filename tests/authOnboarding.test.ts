import { describe, it, expect } from 'vitest';
import {
  validateUsername,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validateOnboardingChoices,
} from '../src/services/authValidation';

describe('BiteQuest Auth & Onboarding Validation Tests', () => {
  describe('Username Rules (3-20 chars, letters & digits only, no spaces, no accents)', () => {
    it('accepts valid usernames', () => {
      const validExamples = ['minh123', 'huynguyen', 'bite2026', 'ABC', 'user123456789012345'];
      validExamples.forEach((u) => {
        const result = validateUsername(u);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    it('rejects usernames with less than 3 characters', () => {
      expect(validateUsername('ab').valid).toBe(false);
      expect(validateUsername('a').valid).toBe(false);
      expect(validateUsername('').valid).toBe(false);
    });

    it('rejects usernames with more than 20 characters', () => {
      expect(validateUsername('abcdefghijklmnopqrstu1').valid).toBe(false);
    });

    it('rejects usernames containing spaces', () => {
      expect(validateUsername('minh 123').valid).toBe(false);
      expect(validateUsername(' huynguyen').valid).toBe(false);
    });

    it('rejects usernames with Vietnamese accents or special characters', () => {
      expect(validateUsername('minhnguyễn').valid).toBe(false);
      expect(validateUsername('hùng_béo').valid).toBe(false);
      expect(validateUsername('user@123').valid).toBe(false);
      expect(validateUsername('bite.quest').valid).toBe(false);
    });
  });

  describe('Display Name Rules', () => {
    it('accepts valid display names with Vietnamese accents and spaces', () => {
      expect(validateDisplayName('Nguyễn Văn Minh').valid).toBe(true);
      expect(validateDisplayName('Trần Thị Hằng').valid).toBe(true);
      expect(validateDisplayName('Alex').valid).toBe(true);
    });

    it('rejects empty or whitespace-only display names', () => {
      expect(validateDisplayName('').valid).toBe(false);
      expect(validateDisplayName('   ').valid).toBe(false);
    });
  });

  describe('Email & Password Rules', () => {
    it('validates email correctly', () => {
      expect(validateEmail('test@bitequest.vn').valid).toBe(true);
      expect(validateEmail('invalid-email').valid).toBe(false);
      expect(validateEmail('').valid).toBe(false);
    });

    it('validates minimum 6 character password for Firebase Auth', () => {
      expect(validatePassword('123456').valid).toBe(true);
      expect(validatePassword('secret123').valid).toBe(true);
      expect(validatePassword('12345').valid).toBe(false);
      expect(validatePassword('').valid).toBe(false);
    });
  });

  describe('Onboarding Personalization Rules', () => {
    it('accepts up to 3 food preferences', () => {
      expect(validateOnboardingChoices(['🍜 Món Việt', '☕ Café', '🍰 Đồ ngọt']).valid).toBe(true);
      expect(validateOnboardingChoices(['🍜 Món Việt']).valid).toBe(true);
      expect(validateOnboardingChoices([]).valid).toBe(true);
    });

    it('rejects more than 3 food preferences', () => {
      const tooMany = ['🍜 Món Việt', '☕ Café', '🍰 Đồ ngọt', '🌶 Ăn cay'];
      expect(validateOnboardingChoices(tooMany).valid).toBe(false);
    });
  });
});
