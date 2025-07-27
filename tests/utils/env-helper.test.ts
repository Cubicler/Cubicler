import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  substituteEnvVars,
  substituteEnvVarsInObject,
  getEnvBoolean,
  isStrictParamsEnabled,
} from '../../src/utils/env-helper.js';

describe('envHelper', () => {
  beforeEach(() => {
    // Clear any existing environment variables that might interfere
    delete process.env.TEST_VAR;
    delete process.env.API_KEY;
    delete process.env.MISSING_VAR;
  });

  describe('substituteEnvVars', () => {
    it('should substitute environment variables in strings', () => {
      process.env.TEST_VAR = 'test-value';

      const result = substituteEnvVars('Hello {{env.TEST_VAR}} world');
      expect(result).toBe('Hello test-value world');
    });

    it('should handle multiple environment variables in one string', () => {
      process.env.API_KEY = 'secret-key';
      process.env.BASE_URL = 'https://api.example.com';

      const result = substituteEnvVars('{{env.BASE_URL}}/auth?key={{env.API_KEY}}');
      expect(result).toBe('https://api.example.com/auth?key=secret-key');
    });

    it('should leave placeholder unchanged if environment variable is not found', () => {
      const result = substituteEnvVars('Hello {{env.MISSING_VAR}} world');
      expect(result).toBe('Hello {{env.MISSING_VAR}} world');
    });

    it('should return non-string values unchanged', () => {
      expect(substituteEnvVars(123)).toBe(123);
      expect(substituteEnvVars(null)).toBe(null);
      expect(substituteEnvVars(undefined)).toBe(undefined);
      expect(substituteEnvVars(true)).toBe(true);
      expect(substituteEnvVars({})).toEqual({});
    });

    it('should handle strings without environment variables', () => {
      const result = substituteEnvVars('Just a regular string');
      expect(result).toBe('Just a regular string');
    });

    it('should handle empty strings', () => {
      const result = substituteEnvVars('');
      expect(result).toBe('');
    });
  });

  describe('substituteEnvVarsInObject', () => {
    it('should substitute environment variables in object values', () => {
      process.env.API_KEY = 'secret-key';
      process.env.BASE_URL = 'https://api.example.com';

      const input = {
        authorization: 'Bearer {{env.API_KEY}}',
        baseUrl: '{{env.BASE_URL}}',
        version: 'v1',
      };

      const result = substituteEnvVarsInObject(input);
      expect(result).toEqual({
        authorization: 'Bearer secret-key',
        baseUrl: 'https://api.example.com',
        version: 'v1',
      });
    });

    it('should handle objects with missing environment variables', () => {
      const input = {
        authorization: 'Bearer {{env.MISSING_KEY}}',
        baseUrl: 'https://api.example.com',
      };

      const result = substituteEnvVarsInObject(input);
      expect(result).toEqual({
        authorization: 'Bearer {{env.MISSING_KEY}}',
        baseUrl: 'https://api.example.com',
      });
    });

    it('should return undefined for undefined input', () => {
      const result = substituteEnvVarsInObject(undefined);
      expect(result).toBeUndefined();
    });

    it('should handle empty objects', () => {
      const result = substituteEnvVarsInObject({});
      expect(result).toEqual({});
    });

    it('should handle objects with non-string values', () => {
      process.env.TEST_VAR = 'test-value';

      const input = {
        stringValue: 'Hello {{env.TEST_VAR}}',
        numberValue: 123,
        booleanValue: true,
        nullValue: null,
        objectValue: { nested: 'value' },
      };

      const result = substituteEnvVarsInObject(input);
      expect(result).toEqual({
        stringValue: 'Hello test-value',
        numberValue: 123,
        booleanValue: true,
        nullValue: null,
        objectValue: { nested: 'value' },
      });
    });

    it('should handle nested placeholder patterns', () => {
      process.env.DOMAIN = 'example.com';
      process.env.PROTOCOL = 'https';

      const input = {
        url: '{{env.PROTOCOL}}://{{env.DOMAIN}}/api',
      };

      const result = substituteEnvVarsInObject(input);
      expect(result).toEqual({
        url: 'https://example.com/api',
      });
    });
  });

  describe('getEnvBoolean', () => {
    const originalValue = process.env.TEST_BOOLEAN;

    afterEach(() => {
      // Restore original env value
      if (originalValue !== undefined) {
        process.env.TEST_BOOLEAN = originalValue;
      } else {
        delete process.env.TEST_BOOLEAN;
      }
    });

    it('should return true for "true" string', () => {
      process.env.TEST_BOOLEAN = 'true';
      expect(getEnvBoolean('TEST_BOOLEAN')).toBe(true);
    });

    it('should return true for "1" string', () => {
      process.env.TEST_BOOLEAN = '1';
      expect(getEnvBoolean('TEST_BOOLEAN')).toBe(true);
    });

    it('should return false for "false" string', () => {
      process.env.TEST_BOOLEAN = 'false';
      expect(getEnvBoolean('TEST_BOOLEAN')).toBe(false);
    });

    it('should return false for "0" string', () => {
      process.env.TEST_BOOLEAN = '0';
      expect(getEnvBoolean('TEST_BOOLEAN')).toBe(false);
    });

    it('should return default value when env var is not set', () => {
      delete process.env.TEST_BOOLEAN;
      expect(getEnvBoolean('TEST_BOOLEAN', true)).toBe(true);
      expect(getEnvBoolean('TEST_BOOLEAN', false)).toBe(false);
      expect(getEnvBoolean('TEST_BOOLEAN')).toBe(false); // default should be false
    });

    it('should be case insensitive', () => {
      process.env.TEST_BOOLEAN = 'TRUE';
      expect(getEnvBoolean('TEST_BOOLEAN')).toBe(true);

      process.env.TEST_BOOLEAN = 'FALSE';
      expect(getEnvBoolean('TEST_BOOLEAN')).toBe(false);
    });
  });

  describe('isStrictParamsEnabled', () => {
    const originalValue = process.env.CUBICLER_STRICT_PARAMS;

    afterEach(() => {
      // Restore original env value
      if (originalValue !== undefined) {
        process.env.CUBICLER_STRICT_PARAMS = originalValue;
      } else {
        delete process.env.CUBICLER_STRICT_PARAMS;
      }
    });

    it('should return true when CUBICLER_STRICT_PARAMS is "true"', () => {
      process.env.CUBICLER_STRICT_PARAMS = 'true';
      expect(isStrictParamsEnabled()).toBe(true);
    });

    it('should return false when CUBICLER_STRICT_PARAMS is "false"', () => {
      process.env.CUBICLER_STRICT_PARAMS = 'false';
      expect(isStrictParamsEnabled()).toBe(false);
    });

    it('should return false when CUBICLER_STRICT_PARAMS is not set', () => {
      delete process.env.CUBICLER_STRICT_PARAMS;
      expect(isStrictParamsEnabled()).toBe(false);
    });
  });
});
