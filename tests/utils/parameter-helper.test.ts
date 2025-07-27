import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  validateAndConvertParameter,
  validateAndConvertParameters,
  validateAndConvertPayload,
  convertParametersForQuery,
} from '../../src/utils/parameter-helper.js';
import type { ParameterDefinition } from '../../src/model/definitions.js';

describe('parameterHelper', () => {
  describe('validateAndConvertParameter', () => {
    it('should convert string values correctly', () => {
      const result = validateAndConvertParameter(123, { type: 'string' }, 'testParam');
      expect(result).toBe('123');
    });

    it('should convert number values correctly', () => {
      const result = validateAndConvertParameter('123.45', { type: 'number' }, 'testParam');
      expect(result).toBe(123.45);
    });

    it('should throw error for invalid number', () => {
      expect(() => {
        validateAndConvertParameter('not-a-number', { type: 'number' }, 'testParam');
      }).toThrow("Parameter 'testParam' must be a valid number, got 'not-a-number'");
    });

    it('should convert boolean values correctly', () => {
      expect(validateAndConvertParameter('true', { type: 'boolean' }, 'testParam')).toBe(true);
      expect(validateAndConvertParameter('false', { type: 'boolean' }, 'testParam')).toBe(false);
      expect(validateAndConvertParameter('1', { type: 'boolean' }, 'testParam')).toBe(true);
      expect(validateAndConvertParameter('0', { type: 'boolean' }, 'testParam')).toBe(false);
      expect(validateAndConvertParameter(1, { type: 'boolean' }, 'testParam')).toBe(true);
      expect(validateAndConvertParameter(0, { type: 'boolean' }, 'testParam')).toBe(false);
      expect(validateAndConvertParameter(true, { type: 'boolean' }, 'testParam')).toBe(true);
      expect(validateAndConvertParameter(false, { type: 'boolean' }, 'testParam')).toBe(false);
    });

    it('should throw error for invalid boolean', () => {
      expect(() => {
        validateAndConvertParameter('maybe', { type: 'boolean' }, 'testParam');
      }).toThrow("Parameter 'testParam' must be a valid boolean, got 'maybe'");
    });

    it('should validate array type correctly', () => {
      const array = [1, 2, 3];
      const result = validateAndConvertParameter(array, { type: 'array' }, 'testParam');
      expect(result).toEqual(array);
    });

    it('should throw error for invalid array', () => {
      expect(() => {
        validateAndConvertParameter('not-an-array', { type: 'array' }, 'testParam');
      }).toThrow("Parameter 'testParam' must be an array, got 'string'");
    });

    it('should validate object type correctly', () => {
      const obj = { key: 'value' };
      const result = validateAndConvertParameter(obj, { type: 'object' }, 'testParam');
      expect(result).toEqual(obj);
    });

    it('should throw error for invalid object (array)', () => {
      expect(() => {
        validateAndConvertParameter([1, 2, 3], { type: 'object' }, 'testParam');
      }).toThrow("Parameter 'testParam' must be an object, got 'object'");
    });

    it('should handle null values for non-required parameters', () => {
      const result = validateAndConvertParameter(null, { type: 'object' }, 'testParam');
      expect(result).toBe(null);
    });

    it('should throw error for null values when required', () => {
      expect(() => {
        validateAndConvertParameter(null, { type: 'object', required: true }, 'testParam');
      }).toThrow("Required parameter 'testParam' is missing");
    });

    it('should throw error for unsupported types', () => {
      expect(() => {
        validateAndConvertParameter(123, { type: 'unknown' as any }, 'testParam');
      }).toThrow("Unsupported parameter type 'unknown' for parameter 'testParam'");
    });

    it('should handle null/undefined values', () => {
      expect(validateAndConvertParameter(null, { type: 'string' }, 'testParam')).toBe(null);
      expect(validateAndConvertParameter(undefined, { type: 'string' }, 'testParam')).toBe(
        undefined
      );
    });

    it('should throw error for missing required parameters', () => {
      expect(() => {
        validateAndConvertParameter(undefined, { type: 'string', required: true }, 'testParam');
      }).toThrow("Required parameter 'testParam' is missing");
    });
  });

  describe('validateAndConvertParameters', () => {
    const parameterDefinitions: Record<string, ParameterDefinition> = {
      id: { type: 'string', required: true },
      count: { type: 'number' },
      active: { type: 'boolean' },
      tags: { type: 'array' },
      metadata: { type: 'object' },
    };

    it('should validate and convert multiple parameters', () => {
      const parameters = {
        id: 123,
        count: '45.5',
        active: 'true',
        tags: ['tag1', 'tag2'],
        metadata: { key: 'value' },
      };

      const result = validateAndConvertParameters(parameters, parameterDefinitions);

      expect(result).toEqual({
        id: '123',
        count: 45.5,
        active: true,
        tags: ['tag1', 'tag2'],
        metadata: { key: 'value' },
      });
    });

    it('should handle missing optional parameters', () => {
      const parameters = { id: 'test-id' };
      const result = validateAndConvertParameters(parameters, parameterDefinitions);
      expect(result).toEqual({ id: 'test-id' });
    });

    it('should throw error for missing required parameters', () => {
      const parameters = { count: 10 }; // missing required 'id'

      expect(() => {
        validateAndConvertParameters(parameters, parameterDefinitions);
      }).toThrow("Required parameter 'id' is missing");
    });

    it('should warn about undefined parameters', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const parameters = {
        id: 'test-id',
        unknownParam: 'value',
      };

      const result = validateAndConvertParameters(parameters, parameterDefinitions);

      expect(result).toEqual({
        id: 'test-id',
        unknownParam: 'value',
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        "Parameter 'unknownParam' is not defined in the spec"
      );

      consoleSpy.mockRestore();
    });

    it('should handle empty parameters object', () => {
      const result = validateAndConvertParameters({}, {});
      expect(result).toEqual({});
    });

    it('should handle null/undefined parameters', () => {
      expect(validateAndConvertParameters(null as any, parameterDefinitions)).toEqual({});
      expect(validateAndConvertParameters(undefined as any, parameterDefinitions)).toEqual({});
    });

    it('should handle missing parameter definitions', () => {
      const parameters = { id: 'test', value: 123 };
      const result = validateAndConvertParameters(parameters, undefined);
      expect(result).toEqual(parameters);
    });
  });

  describe('validateAndConvertPayload', () => {
    it('should validate object payload', () => {
      const payload = { key: 'value', count: 42 };
      const payloadDef = { type: 'object' as const };

      const result = validateAndConvertPayload(payload, payloadDef);
      expect(result).toEqual(payload);
    });

    it('should validate array payload', () => {
      const payload = ['item1', 'item2'];
      const payloadDef = { type: 'array' as const };

      const result = validateAndConvertPayload(payload, payloadDef);
      expect(result).toEqual(payload);
    });

    it('should handle undefined payload definition', () => {
      const payload = { key: 'value' };
      const result = validateAndConvertPayload(payload, undefined);
      expect(result).toEqual(payload);
    });

    it('should handle null payload when not required', () => {
      const result = validateAndConvertPayload(null, { type: 'object' });
      expect(result).toBe(null);
    });

    it('should throw error for missing required payload', () => {
      expect(() => {
        validateAndConvertPayload(undefined, { type: 'object', required: true });
      }).toThrow('Required payload is missing');
    });
  });

  describe('convertParametersForQuery', () => {
    it('should convert various types for query string', () => {
      const parameters = {
        stringValue: 'hello',
        numberValue: 123,
        booleanValue: true,
        arrayValue: ['a', 'b', 'c'],
        objectValue: { key: 'value' },
        nullValue: null,
        undefinedValue: undefined,
      };

      const result = convertParametersForQuery(parameters);

      expect(result).toEqual({
        stringValue: 'hello',
        numberValue: '123',
        booleanValue: 'true',
        arrayValue: '["a","b","c"]', // Minified JSON
        objectValue: '{"key":"value"}', // Minified JSON
        // nullValue and undefinedValue should be excluded
      });
    });

    it('should handle empty parameters', () => {
      const result = convertParametersForQuery({});
      expect(result).toEqual({});
    });

    it('should skip null and undefined values', () => {
      const parameters = {
        keepThis: 'value',
        skipNull: null,
        skipUndefined: undefined,
        keepFalse: false,
        keepZero: 0,
      };

      const result = convertParametersForQuery(parameters);

      expect(result).toEqual({
        keepThis: 'value',
        keepFalse: 'false',
        keepZero: '0',
      });
    });

    it('should properly minify complex objects and arrays', () => {
      const parameters = {
        complexObject: {
          nested: { array: [1, 2, 3] },
          boolean: true,
        },
        complexArray: [
          { id: 1, name: 'first' },
          { id: 2, name: 'second' },
        ],
      };

      const result = convertParametersForQuery(parameters);

      expect(result).toEqual({
        complexObject: '{"nested":{"array":[1,2,3]},"boolean":true}',
        complexArray: '[{"id":1,"name":"first"},{"id":2,"name":"second"}]',
      });
    });
  });

  describe('strict parameter validation', () => {
    const originalEnv = process.env.CUBICLER_STRICT_PARAMS;

    afterEach(() => {
      // Restore original env value
      if (originalEnv !== undefined) {
        process.env.CUBICLER_STRICT_PARAMS = originalEnv;
      } else {
        delete process.env.CUBICLER_STRICT_PARAMS;
      }
    });

    it('should allow unknown parameters when strict mode is disabled', () => {
      process.env.CUBICLER_STRICT_PARAMS = 'false';

      const parameters = { known: 'value', unknown: 'should-be-allowed' };
      const definitions = { known: { type: 'string' } as ParameterDefinition };

      const result = validateAndConvertParameters(parameters, definitions);

      expect(result).toEqual({ known: 'value', unknown: 'should-be-allowed' });
    });

    it('should throw error for unknown parameters when strict mode is enabled', () => {
      process.env.CUBICLER_STRICT_PARAMS = 'true';

      const parameters = { known: 'value', unknown: 'should-cause-error' };
      const definitions = { known: { type: 'string' } as ParameterDefinition };

      expect(() => {
        validateAndConvertParameters(parameters, definitions);
      }).toThrow("Unknown parameter 'unknown' is not allowed in strict mode");
    });

    it('should validate payload properties in strict mode', () => {
      process.env.CUBICLER_STRICT_PARAMS = 'true';

      const payload = { known: 'value', unknown: 'should-cause-error' };
      const payloadDefinition = {
        type: 'object' as const,
        properties: {
          known: { type: 'string' as const },
        },
      };

      expect(() => {
        validateAndConvertPayload(payload, payloadDefinition);
      }).toThrow("Unknown payload property 'unknown' is not allowed in strict mode");
    });

    it('should allow payload properties in non-strict mode', () => {
      process.env.CUBICLER_STRICT_PARAMS = 'false';

      const payload = { known: 'value', unknown: 'should-be-allowed' };
      const payloadDefinition = {
        type: 'object' as const,
        properties: {
          known: { type: 'string' as const },
        },
      };

      const result = validateAndConvertPayload(payload, payloadDefinition);
      expect(result).toEqual({ known: 'value', unknown: 'should-be-allowed' });
    });
  });
});
