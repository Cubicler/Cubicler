import { substituteEnvVars, substituteEnvVarsInObject } from '../../src/utils/envHelper.js';

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
        url: '{{env.BASE_URL}}/api',
        authorization: 'Bearer {{env.API_KEY}}',
        version: 'v1'
      };
      
      const result = substituteEnvVarsInObject(input);
      expect(result).toEqual({
        url: 'https://api.example.com/api',
        authorization: 'Bearer secret-key',
        version: 'v1'
      });
    });

    it('should handle objects with missing environment variables', () => {
      const input = {
        existing: 'value',
        missing: '{{env.MISSING_VAR}}'
      };
      
      const result = substituteEnvVarsInObject(input);
      expect(result).toEqual({
        existing: 'value',
        missing: '{{env.MISSING_VAR}}'
      });
    });

    it('should return null/undefined unchanged', () => {
      expect(substituteEnvVarsInObject(null)).toBe(null);
      expect(substituteEnvVarsInObject(undefined)).toBe(undefined);
    });

    it('should handle empty objects', () => {
      const result = substituteEnvVarsInObject({});
      expect(result).toEqual({});
    });

    it('should handle objects with non-string values', () => {
      process.env.API_KEY = 'secret-key';
      
      const input = {
        stringValue: '{{env.API_KEY}}',
        numberValue: 123,
        booleanValue: true,
        nullValue: null
      };
      
      const result = substituteEnvVarsInObject(input);
      expect(result).toEqual({
        stringValue: 'secret-key',
        numberValue: 123,
        booleanValue: true,
        nullValue: null
      });
    });
  });

  afterEach(() => {
    // Clean up test environment variables
    delete process.env.TEST_VAR;
    delete process.env.API_KEY;
    delete process.env.BASE_URL;
  });
});
