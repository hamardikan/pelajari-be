import jwt, { type SignOptions } from 'jsonwebtoken';
import type { EnvironmentConfig } from '../../config/environment.js';

export type TokenPayload = {
  userId: string;
  email: string;
  role: string;
  managerId?: string;
};

export type JwtConfig = Pick<EnvironmentConfig, 'JWT_SECRET' | 'JWT_REFRESH_SECRET' | 'JWT_ACCESS_EXPIRES_IN' | 'JWT_REFRESH_EXPIRES_IN'>;

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

export type VerificationResult<T> = {
  success: boolean;
  payload?: T;
  error?: string;
};

function generateAccessToken(payload: TokenPayload, config: JwtConfig): Promise<string> {
  return new Promise((resolve, reject) => {
    const options: SignOptions = {
      expiresIn: config.JWT_ACCESS_EXPIRES_IN as any,
      issuer: 'pelajari-be',
      audience: 'pelajari-client',
    };
    
    jwt.sign(
      payload,
      config.JWT_SECRET,
      options,
      (error, token) => {
        if (error || !token) {
          reject(error || new Error('Token generation failed'));
        } else {
          resolve(token);
        }
      }
    );
  });
}

function generateRefreshToken(payload: TokenPayload, config: JwtConfig): Promise<string> {
  return new Promise((resolve, reject) => {
    const options: SignOptions = {
      expiresIn: config.JWT_REFRESH_EXPIRES_IN as any,
      issuer: 'pelajari-be',
      audience: 'pelajari-client',
    };
    
    jwt.sign(
      payload,
      config.JWT_REFRESH_SECRET,
      options,
      (error, token) => {
        if (error || !token) {
          reject(error || new Error('Refresh token generation failed'));
        } else {
          resolve(token);
        }
      }
    );
  });
}

async function generateTokenPair(payload: TokenPayload, config: JwtConfig): Promise<TokenPair> {
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(payload, config),
    generateRefreshToken(payload, config),
  ]);

  return {
    accessToken,
    refreshToken,
  };
}

function verifyAccessToken(token: string, config: JwtConfig): Promise<VerificationResult<TokenPayload>> {
  return new Promise((resolve) => {
    jwt.verify(
      token,
      config.JWT_SECRET,
      {
        issuer: 'pelajari-be',
        audience: 'pelajari-client',
      },
      (error, decoded) => {
        if (error) {
          resolve({
            success: false,
            error: error.message,
          });
        } else {
          resolve({
            success: true,
            payload: decoded as TokenPayload,
          });
        }
      }
    );
  });
}

function verifyRefreshToken(token: string, config: JwtConfig): Promise<VerificationResult<TokenPayload>> {
  return new Promise((resolve) => {
    jwt.verify(
      token,
      config.JWT_REFRESH_SECRET,
      {
        issuer: 'pelajari-be',
        audience: 'pelajari-client',
      },
      (error, decoded) => {
        if (error) {
          resolve({
            success: false,
            error: error.message,
          });
        } else {
          resolve({
            success: true,
            payload: decoded as TokenPayload,
          });
        }
      }
    );
  });
}

function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(' ');
  
  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

function extractTokenFromCookie(cookieHeader: string | undefined, cookieName: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      acc[name] = value;
    }
    return acc;
  }, {} as Record<string, string>);

  return cookies[cookieName] || null;
}

function createTokenExtractor(config: { cookieName?: string } = {}) {
  return function extractToken(authHeader?: string, cookieHeader?: string): string | null {
    // Try to extract from Authorization header first
    const headerToken = extractTokenFromHeader(authHeader);
    if (headerToken) {
      return headerToken;
    }

    // Fallback to cookie if available
    if (config.cookieName && cookieHeader) {
      return extractTokenFromCookie(cookieHeader, config.cookieName);
    }

    return null;
  };
}

function isTokenExpired(token: string): boolean {
  try {
    const decoded = jwt.decode(token) as { exp?: number };
    if (!decoded || !decoded.exp) {
      return true;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
  } catch {
    return true;
  }
}

function getTokenExpirationTime(token: string): Date | null {
  try {
    const decoded = jwt.decode(token) as { exp?: number };
    if (!decoded || !decoded.exp) {
      return null;
    }

    return new Date(decoded.exp * 1000);
  } catch {
    return null;
  }
}

function createJwtUtils(config: JwtConfig) {
  return {
    generateAccessToken: (payload: TokenPayload) => generateAccessToken(payload, config),
    generateRefreshToken: (payload: TokenPayload) => generateRefreshToken(payload, config),
    generateTokenPair: (payload: TokenPayload) => generateTokenPair(payload, config),
    verifyAccessToken: (token: string) => verifyAccessToken(token, config),
    verifyRefreshToken: (token: string) => verifyRefreshToken(token, config),
    extractTokenFromHeader,
    extractTokenFromCookie,
    createTokenExtractor,
    isTokenExpired,
    getTokenExpirationTime,
  };
}

export {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  extractTokenFromHeader,
  extractTokenFromCookie,
  createTokenExtractor,
  isTokenExpired,
  getTokenExpirationTime,
  createJwtUtils,
}; 