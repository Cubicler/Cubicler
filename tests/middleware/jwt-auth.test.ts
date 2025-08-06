import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Response, NextFunction } from 'express';
import {
  createJwtMiddleware,
  createOptionalJwtMiddleware,
  extractJwtToken,
  type AuthenticatedRequest,
} from '../../src/middleware/jwt-auth.js';
import * as jwtHelper from '../../src/utils/jwt-helper.js';

// Mock the JWT helper
vi.mock('../../src/utils/jwt-helper.js');

describe('JWT Auth Middleware', () => {
  const mockJwtHelper = vi.mocked(jwtHelper.default);
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      headers: {},
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  describe('createJWTMiddleware', () => {
    const testConfig = {
      secret: 'test-secret',
      issuer: 'test-issuer',
      audience: 'test-audience',
    };

    it('should authenticate valid JWT token', async () => {
      const testPayload = { sub: 'user123', email: 'test@example.com' };
      const token = jwt.sign(testPayload, testConfig.secret);

      mockReq.headers = { authorization: `Bearer ${token}` };
      mockJwtHelper.verifyToken.mockResolvedValue(testPayload);

      const middleware = createJwtMiddleware(testConfig);
      await middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockJwtHelper.verifyToken).toHaveBeenCalledWith(token, testConfig.secret, {
        issuer: testConfig.issuer,
        audience: testConfig.audience,
        algorithms: undefined,
      });
      expect(mockReq.jwt).toEqual(testPayload);
      expect(mockReq.user).toEqual({
        id: 'user123',
        name: undefined,
        roles: undefined,
        ...testPayload,
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header is missing', async () => {
      const middleware = createJwtMiddleware(testConfig);
      await middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authorization header is required',
        code: 'MISSING_AUTH_HEADER',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header does not use Bearer scheme', async () => {
      mockReq.headers = { authorization: 'Basic user:pass' };

      const middleware = createJwtMiddleware(testConfig);
      await middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authorization header must use Bearer scheme',
        code: 'INVALID_AUTH_SCHEME',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when Bearer token is empty', async () => {
      mockReq.headers = { authorization: 'Bearer ' };

      const middleware = createJwtMiddleware(testConfig);
      await middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'JWT token is required',
        code: 'MISSING_TOKEN',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when JWT verification fails', async () => {
      const token = 'invalid.jwt.token';
      mockReq.headers = { authorization: `Bearer ${token}` };
      mockJwtHelper.verifyToken.mockRejectedValue(
        new Error('JWT verification failed: invalid signature')
      );

      const middleware = createJwtMiddleware(testConfig);
      await middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'JWT token is invalid',
        code: 'TOKEN_INVALID',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 with specific error for expired token', async () => {
      const token = jwt.sign({ sub: 'user123' }, testConfig.secret);
      mockReq.headers = { authorization: `Bearer ${token}` };
      mockJwtHelper.verifyToken.mockRejectedValue(new Error('JWT token has expired'));

      const middleware = createJwtMiddleware(testConfig);
      await middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'JWT token has expired',
        code: 'TOKEN_EXPIRED',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 with specific error for invalid token', async () => {
      const token = 'invalid.token';
      mockReq.headers = { authorization: `Bearer ${token}` };
      mockJwtHelper.verifyToken.mockRejectedValue(new Error('JWT token is invalid'));

      const middleware = createJwtMiddleware(testConfig);
      await middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'JWT token is invalid',
        code: 'TOKEN_INVALID',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 with specific error for issuer mismatch', async () => {
      const token = jwt.sign({ sub: 'user123' }, testConfig.secret);
      mockReq.headers = { authorization: `Bearer ${token}` };
      mockJwtHelper.verifyToken.mockRejectedValue(new Error('JWT token issuer mismatch'));

      const middleware = createJwtMiddleware(testConfig);
      await middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'JWT token issuer mismatch',
        code: 'ISSUER_MISMATCH',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 with specific error for audience mismatch', async () => {
      const token = jwt.sign({ sub: 'user123' }, testConfig.secret);
      mockReq.headers = { authorization: `Bearer ${token}` };
      mockJwtHelper.verifyToken.mockRejectedValue(new Error('JWT token audience mismatch'));

      const middleware = createJwtMiddleware(testConfig);
      await middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'JWT token audience mismatch',
        code: 'AUDIENCE_MISMATCH',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('createOptionalJwtMiddleware', () => {
    const testConfig = {
      secret: 'test-secret',
      issuer: 'test-issuer',
      audience: 'test-audience',
    };

    it('should proceed without authentication when no authorization header', async () => {
      const middleware = createOptionalJwtMiddleware(testConfig);
      await middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockReq.jwt).toBeUndefined();
      expect(mockReq.user).toBeUndefined();
    });

    it('should authenticate when valid JWT token is provided', async () => {
      const testPayload = { sub: 'user123', email: 'test@example.com' };
      const token = jwt.sign(testPayload, testConfig.secret);

      mockReq.headers = { authorization: `Bearer ${token}` };
      mockJwtHelper.verifyToken.mockResolvedValue(testPayload);

      const middleware = createOptionalJwtMiddleware(testConfig);
      await middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockJwtHelper.verifyToken).toHaveBeenCalled();
      expect(mockReq.jwt).toEqual(testPayload);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 401 when invalid JWT token is provided', async () => {
      const token = 'invalid.jwt.token';
      mockReq.headers = { authorization: `Bearer ${token}` };
      mockJwtHelper.verifyToken.mockRejectedValue(new Error('JWT verification failed'));

      const middleware = createOptionalJwtMiddleware(testConfig);
      await middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('extractJwtToken', () => {
    it('should extract token from valid Bearer authorization header', () => {
      const token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.test.token';
      const authHeader = `Bearer ${token}`;

      const result = extractJwtToken(authHeader);

      expect(result).toBe(token);
    });

    it('should return null for missing authorization header', () => {
      const result = extractJwtToken(undefined);

      expect(result).toBeNull();
    });

    it('should return null for non-Bearer authorization header', () => {
      const result = extractJwtToken('Basic user:pass');

      expect(result).toBeNull();
    });

    it('should return null for Bearer header without token', () => {
      const result = extractJwtToken('Bearer ');

      expect(result).toBeNull();
    });

    it('should return null for Bearer header with only spaces', () => {
      const result = extractJwtToken('Bearer   ');

      expect(result).toBeNull();
    });
  });
});
