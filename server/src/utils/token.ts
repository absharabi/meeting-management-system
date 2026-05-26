import jwt from 'jsonwebtoken';

export interface JwtPayload {
  id:   string;
  role: string;
}

export const generateAccessToken = (userId: string, role: string) =>
  jwt.sign({ id: userId, role }, process.env.JWT_SECRET!, { expiresIn: '7d' });

export const generateRefreshToken = (userId: string) =>
  jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' });

export const verifyAccessToken = (token: string): JwtPayload =>
  jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

export const verifyRefreshToken = (token: string): JwtPayload =>
  jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as JwtPayload;