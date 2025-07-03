import type { Request, Response, NextFunction } from 'express';
import type { TokenPayload } from '../utils/jwt.js';

/**
 * Factory to create JWT authentication middleware using provided jwtUtils.
 * The middleware:
 * 1. Extracts Bearer token from Authorization header (or cookie, if needed).
 * 2. Verifies the token and attaches its payload to `req.user`.
 * 3. Returns 401 if token is missing or invalid.
 */
export function createAuthMiddleware(jwtUtils: {
  extractTokenFromHeader: (h?: string) => string | null;
  verifyAccessToken: (token: string) => Promise<{ success: boolean; payload?: TokenPayload }>;
}) {
  return async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = jwtUtils.extractTokenFromHeader(req.headers['authorization']);
      if (!token) {
        res.status(401).json({ success: false, message: 'Authorization token missing' });
        return;
      }

      const verification = await jwtUtils.verifyAccessToken(token);
      if (!verification.success || !verification.payload) {
        res.status(401).json({ success: false, message: 'Invalid or expired token' });
        return;
      }

      (req as any).user = verification.payload; // attach user payload
      next();
    } catch (error) {
      res.status(401).json({ success: false, message: 'Unauthorized', error: (error as Error).message });
    }
  };
} 