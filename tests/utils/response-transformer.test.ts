import { describe, it, expect } from 'vitest';
import { transformResponse } from '../../src/utils/response-transformer.js';

// Normalization tests removed (alpha: only canonical schema supported)
import type { ResponseTransform } from '../../src/model/providers.js';

describe('Response Transformer', () => {
  describe('transformResponse', () => {
    it('should return original data when no transforms provided', () => {
      const data = { test: 'value' };
      const result = transformResponse(data, []);
      expect(result).toEqual(data);
    });

    it('should return original data when transforms array is empty', () => {
      const data = { test: 'value' };
      const result = transformResponse(data, []);
      expect(result).toEqual(data);
    });

    it('should not mutate original data', () => {
      const data = { test: 'value', nested: { prop: 1 } };
      const transforms: ResponseTransform[] = [
        { path: 'test', transform: 'template', template: 'Transformed: {value}' },
      ];

      const result = transformResponse(data, transforms);

      expect(data.test).toBe('value'); // Original unchanged
      expect((result as typeof data).test).toBe('Transformed: value'); // Result transformed
    });
  });

  describe('Map Transform', () => {
    it('should map simple values', () => {
      const data = { status: '1' };
      const transforms: ResponseTransform[] = [
        {
          path: 'status',
          transform: 'map',
          map: { '0': 'Offline', '1': 'Online', '2': 'Away' },
        },
      ];

      const result = transformResponse(data, transforms) as typeof data;
      expect(result.status).toBe('Online');
    });

    it('should map numeric values', () => {
      const data = { status: 0 };
      const transforms: ResponseTransform[] = [
        {
          path: 'status',
          transform: 'map',
          map: { '0': 'Offline', '1': 'Online' },
        },
      ];

      const result = transformResponse(data, transforms) as typeof data;
      expect(result.status).toBe('Offline');
    });

    it('should keep original value if no mapping found', () => {
      const data = { status: '99' };
      const transforms: ResponseTransform[] = [
        {
          path: 'status',
          transform: 'map',
          map: { '0': 'Offline', '1': 'Online' },
        },
      ];

      const result = transformResponse(data, transforms) as typeof data;
      expect(result.status).toBe('99');
    });

    it('should work with nested object paths', () => {
      const data = { user: { profile: { status: '1' } } };
      const transforms: ResponseTransform[] = [
        {
          path: 'user.profile.status',
          transform: 'map',
          map: { '1': 'Active', '0': 'Inactive' },
        },
      ];

      const result = transformResponse(data, transforms) as typeof data;
      expect(result.user.profile.status).toBe('Active');
    });
  });

  describe('Date Format Transform', () => {
    it('should format ISO date strings', () => {
      const data = { timestamp: '2023-12-25T10:30:45.000Z' };
      const transforms: ResponseTransform[] = [
        {
          path: 'timestamp',
          transform: 'date_format',
          format: 'YYYY-MM-DD HH:mm:ss',
        },
      ];

      const result = transformResponse(data, transforms) as typeof data;
      expect(result.timestamp).toMatch(/2023-12-25 \d{2}:\d{2}:\d{2}/);
    });

    it('should format Date objects', () => {
      const date = new Date('2023-12-25T10:30:45.000Z');
      const data = { created_at: date };
      const transforms: ResponseTransform[] = [
        {
          path: 'created_at',
          transform: 'date_format',
          format: 'YYYY-MM-DD',
        },
      ];

      const result = transformResponse(data as any, transforms) as { created_at: string };
      expect(result.created_at).toMatch(/2023-12-25/);
    });

    it('should keep original value for invalid dates', () => {
      const data = { timestamp: 'invalid-date' };
      const transforms: ResponseTransform[] = [
        {
          path: 'timestamp',
          transform: 'date_format',
          format: 'YYYY-MM-DD',
        },
      ];

      const result = transformResponse(data, transforms) as { timestamp: string };
      expect(result.timestamp).toBe('invalid-date');
    });
  });

  describe('Template Transform', () => {
    it('should replace {value} with original value', () => {
      const data = { temperature: 25 };
      const transforms: ResponseTransform[] = [
        {
          path: 'temperature',
          transform: 'template',
          template: 'Temperature: {value}°C',
        },
      ];

      const result = transformResponse(data, transforms) as { temperature: string };
      expect(result.temperature).toBe('Temperature: 25°C');
    });

    it('should handle multiple {value} placeholders', () => {
      const data = { code: 'ABC' };
      const transforms: ResponseTransform[] = [
        {
          path: 'code',
          transform: 'template',
          template: 'Code: {value} (ref: {value})',
        },
      ];

      const result = transformResponse(data, transforms) as { code: string };
      expect(result.code).toBe('Code: ABC (ref: ABC)');
    });

    it('should convert non-string values to strings', () => {
      const data = { count: 42 };
      const transforms: ResponseTransform[] = [
        {
          path: 'count',
          transform: 'template',
          template: 'Total: {value} items',
        },
      ];

      const result = transformResponse(data, transforms) as { count: string };
      expect(result.count).toBe('Total: 42 items');
    });
  });

  describe('Regex Replace Transform', () => {
    it('should replace text using regex', () => {
      const data = { description: 'This  has   multiple    spaces' };
      const transforms: ResponseTransform[] = [
        {
          path: 'description',
          transform: 'regex_replace',
          pattern: '\\s+',
          replacement: ' ',
        },
      ];

      const result = transformResponse(data, transforms) as { description: string };
      expect(result.description).toBe('This has multiple spaces');
    });

    it('should handle global replacements', () => {
      const data = { text: 'foo-bar-baz' };
      const transforms: ResponseTransform[] = [
        {
          path: 'text',
          transform: 'regex_replace',
          pattern: '-',
          replacement: '_',
        },
      ];

      const result = transformResponse(data, transforms) as { text: string };
      expect(result.text).toBe('foo_bar_baz');
    });

    it('should keep original value for invalid regex', () => {
      const data = { text: 'test' };
      const transforms: ResponseTransform[] = [
        {
          path: 'text',
          transform: 'regex_replace',
          pattern: '[',
          replacement: '_',
        },
      ];

      const result = transformResponse(data, transforms) as { text: string };
      expect(result.text).toBe('test');
    });
  });

  describe('Remove Transform', () => {
    it('should remove specified property', () => {
      const data = {
        username: 'john',
        email: 'john@example.com',
        debug_info: { trace: 'sensitive data' },
      };
      const transforms: ResponseTransform[] = [{ path: 'debug_info', transform: 'remove' }];

      const result = transformResponse(data, transforms) as {
        username: string;
        email: string;
      };
      expect(result).toEqual({
        username: 'john',
        email: 'john@example.com',
      });
      expect('debug_info' in (result as any)).toBe(false);
    });

    it('should remove nested properties', () => {
      const data = {
        user: {
          name: 'john',
          sensitive: 'secret',
          profile: { bio: 'hello' },
        },
      };
      const transforms: ResponseTransform[] = [{ path: 'user.sensitive', transform: 'remove' }];

      const result = transformResponse(data, transforms) as {
        user: {
          name: string;
          profile: { bio: string };
        };
      };
      expect(result.user).toEqual({
        name: 'john',
        profile: { bio: 'hello' },
      });
      expect('sensitive' in (result.user as any)).toBe(false);
    });
  });

  describe('Array Transformations', () => {
    it('should transform root array elements', () => {
      const data = [
        { status: '1', name: 'user1' },
        { status: '0', name: 'user2' },
      ];
      const transforms: ResponseTransform[] = [
        {
          path: '_root[].status',
          transform: 'map',
          map: { '1': 'Active', '0': 'Inactive' },
        },
      ];

      const result = transformResponse(data, transforms) as Array<{
        status: string;
        name: string;
      }>;
      expect(result).toEqual([
        { status: 'Active', name: 'user1' },
        { status: 'Inactive', name: 'user2' },
      ]);
    });

    it('should transform array properties', () => {
      const data = {
        users: [{ status: '1' }, { status: '0' }],
      };
      const transforms: ResponseTransform[] = [
        {
          path: 'users[].status',
          transform: 'map',
          map: { '1': 'Online', '0': 'Offline' },
        },
      ];

      const result = transformResponse(data, transforms) as {
        users: Array<{ status: string }>;
      };
      expect(result.users).toEqual([{ status: 'Online' }, { status: 'Offline' }]);
    });

    it('should transform nested array elements', () => {
      const data = {
        groups: [
          {
            name: 'admins',
            users: [{ role: 'admin' }, { role: 'user' }],
          },
        ],
      };
      const transforms: ResponseTransform[] = [
        {
          path: 'groups[].users[].role',
          transform: 'template',
          template: 'Role: {value}',
        },
      ];

      const result = transformResponse(data, transforms) as {
        groups: Array<{
          name: string;
          users: Array<{ role: string }>;
        }>;
      };
      expect(result.groups[0].users).toEqual([{ role: 'Role: admin' }, { role: 'Role: user' }]);
    });

    it('should remove from arrays', () => {
      const data = [
        { name: 'user1', debug: 'info1' },
        { name: 'user2', debug: 'info2' },
      ];
      const transforms: ResponseTransform[] = [{ path: '_root[].debug', transform: 'remove' }];

      const result = transformResponse(data, transforms) as Array<{ name: string }>;
      expect(result).toEqual([{ name: 'user1' }, { name: 'user2' }]);
    });
  });

  describe('Multiple Transforms', () => {
    it('should apply multiple transforms in order', () => {
      const data = {
        status: '1',
        created_at: '2023-12-25T10:30:45.000Z',
        debug_info: 'sensitive',
      };
      const transforms: ResponseTransform[] = [
        {
          path: 'status',
          transform: 'map',
          map: { '1': 'Active', '0': 'Inactive' },
        },
        {
          path: 'created_at',
          transform: 'date_format',
          format: 'YYYY-MM-DD',
        },
        {
          path: 'debug_info',
          transform: 'remove',
        },
      ];

      const result = transformResponse(data, transforms) as {
        status: string;
        created_at: string;
      };
      expect(result.status).toBe('Active');
      expect(result.created_at).toMatch(/2023-12-25/);
      expect('debug_info' in (result as any)).toBe(false);
    });

    it('should handle transforms on non-existent paths gracefully', () => {
      const data = { existing: 'value' };
      const transforms: ResponseTransform[] = [
        {
          path: 'non_existent',
          transform: 'map',
          map: { a: 'b' },
        },
        {
          path: 'existing',
          transform: 'template',
          template: 'Found: {value}',
        },
      ];

      const result = transformResponse(data, transforms) as { existing: string };
      expect(result.existing).toBe('Found: value');
      expect('non_existent' in (result as any)).toBe(false);
    });
  });

  describe('Complex Nested Scenarios', () => {
    it('should handle complex nested object with arrays', () => {
      const data = {
        users: [
          {
            profile: {
              status: '1',
              tags: ['admin', 'user'],
              last_login: '2023-12-25T10:30:45.000Z',
            },
            debug: 'remove-me',
          },
        ],
      };

      const transforms: ResponseTransform[] = [
        {
          path: 'users[].profile.status',
          transform: 'map',
          map: { '1': 'Online', '0': 'Offline' },
        },
        {
          path: 'users[].profile.tags[]',
          transform: 'template',
          template: 'Tag: {value}',
        },
        {
          path: 'users[].profile.last_login',
          transform: 'date_format',
          format: 'YYYY-MM-DD',
        },
        {
          path: 'users[].debug',
          transform: 'remove',
        },
      ];

      const result = transformResponse(data, transforms) as {
        users: Array<{
          profile: {
            status: string;
            tags: string[];
            last_login: string;
          };
        }>;
      };

      expect(result.users[0].profile.status).toBe('Online');
      expect(result.users[0].profile.tags).toEqual(['Tag: admin', 'Tag: user']);
      expect(result.users[0].profile.last_login).toMatch(/2023-12-25/);
      expect('debug' in (result.users[0] as any)).toBe(false);
    });
  });
});
