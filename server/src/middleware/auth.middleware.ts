import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/token';

export interface AuthRequest extends Request {
  user?: { id: string; role: string };
}

export const protect = (req: Request, res: Response, next: NextFunction): void => {
  // TEMPORARY BYPASS FOR TESTING WITHOUT GOOGLE AUTH
  (req as AuthRequest).user = { id: '65f0a1b2c3d4e5f607890abc', role: 'SuperAdmin' };
  next();
  return;
  
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'No token provided' });
    return;
  }
  try {
    const token = header.split(' ')[1];
    (req as AuthRequest).user = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ message: 'Token invalid or expired' });
  }
};

export const authorize = (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;
    if (!authReq.user || !roles.includes(authReq.user.role)) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }
    next();
  };