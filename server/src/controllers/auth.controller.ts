import { Request, Response } from 'express';
import { IUser } from '../models/User';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/token';
import User from '../models/User';

export const googleCallback = (req: Request, res: Response): void => {
  const user = req.user as unknown as IUser;
  const accessToken  = generateAccessToken(user._id.toString(), user.role);
  const refreshToken = generateRefreshToken(user._id.toString());
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   7 * 24 * 60 * 60 * 1000,
  });

  const params = new URLSearchParams({
    token: accessToken,
    user:  JSON.stringify({ id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar }),
  });

  res.redirect(`${frontendUrl}/dashboard?${params}`);
};

export const googleDenied = (req: Request, res: Response): void => {
  const message = (req.query.message as string) || 'ACCESS_DENIED';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  res.redirect(`${frontendUrl}/unauthorized?reason=${message}`);
};

export const refreshTokenHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) {
      res.status(401).json({ message: 'No refresh token' });
      return;
    }

    const payload = verifyRefreshToken(token);
    const user    = await User.findById(payload.id);

    if (!user || !user.isActive) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const accessToken = generateAccessToken(user._id.toString(), user.role);
    res.json({ accessToken });
  } catch {
    res.status(401).json({ message: 'Invalid refresh token' });
  }
};

export const logout = (_req: Request, res: Response): void => {
  res.cookie('refreshToken', '', { httpOnly: true, maxAge: 0 });
  res.json({ message: 'Logged out' });
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as any;
    const user = await User.findById(authReq.user.id).select('-googleId');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json(user);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};
