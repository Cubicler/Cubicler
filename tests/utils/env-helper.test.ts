import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { substituteEnvVars, getEnvTimeout } from '../../src/utils/env-helper.js';

describe('Environment Helper', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('substituteEnvVars', () => {
    it('should substitute environment variables in strings', () => {
      process.env.TEST_VAR = 'test_value';
      process.env.ANOTHER_VAR = 'another_value';

      const result = substituteEnvVars('Hello {{env.TEST_VAR}} and {{env.ANOTHER_VAR}}');

      expect(result).toBe('Hello test_value and another_value');
    });

    it('should leave placeholder when env var not found', () => {
      delete process.env.MISSING_VAR;

      const result = substituteEnvVars('Hello {{env.MISSING_VAR}}');

      expect(result).toBe('Hello {{env.MISSING_VAR}}');
    });

    it('should handle multiple occurrences of same variable', () => {
      process.env.REPEAT_VAR = 'repeated';

      const result = substituteEnvVars('{{env.REPEAT_VAR}} and {{env.REPEAT_VAR}} again');

      expect(result).toBe('repeated and repeated again');
    });

    it('should handle non-string values unchanged', () => {
      expect(substituteEnvVars(123)).toBe(123);
      expect(substituteEnvVars(true)).toBe(true);
      expect(substituteEnvVars(null)).toBe(null);
      expect(substituteEnvVars(undefined)).toBe(undefined);
      expect(substituteEnvVars({ key: 'value' })).toEqual({ key: 'value' });
    });

    it('should handle strings without placeholders', () => {
      const result = substituteEnvVars('No placeholders here');

      expect(result).toBe('No placeholders here');
    });

    it('should handle empty strings', () => {
      const result = substituteEnvVars('');

      expect(result).toBe('');
    });
  });

  describe('getEnvTimeout', () => {
    it('should return parsed timeout value', () => {
      process.env.TEST_TIMEOUT = '5000';

      const result = getEnvTimeout('TEST_TIMEOUT', 1000);

      expect(result).toBe(5000);
    });

    it('should return default value when env var not set', () => {
      delete process.env.TEST_TIMEOUT;

      const result = getEnvTimeout('TEST_TIMEOUT', 3000);

      expect(result).toBe(3000);
    });

    it('should return default for invalid number', () => {
      process.env.TEST_TIMEOUT = 'not_a_number';

      const result = getEnvTimeout('TEST_TIMEOUT', 2000);

      expect(result).toBe(2000);
    });

    it('should return default for negative numbers', () => {
      process.env.TEST_TIMEOUT = '-500';

      const result = getEnvTimeout('TEST_TIMEOUT', 1500);

      expect(result).toBe(1500);
    });

    it('should return default for zero', () => {
      process.env.TEST_TIMEOUT = '0';

      const result = getEnvTimeout('TEST_TIMEOUT', 1200);

      expect(result).toBe(1200);
    });

    it('should handle decimal numbers by parsing as integer', () => {
      process.env.TEST_TIMEOUT = '1500.75';

      const result = getEnvTimeout('TEST_TIMEOUT', 1000);

      expect(result).toBe(1500); // parseInt truncates decimals
    });
  });
});
