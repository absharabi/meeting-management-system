import { Router, Request, Response } from 'express';
import passport from 'passport';
import { googleCallback, googleDenied, refreshTokenHandler, logout, getMe } from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/api/auth/google/denied',
    failureMessage: true,
  }),
  googleCallback
);

router.get('/google/denied', googleDenied);
router.post('/refresh', refreshTokenHandler);
router.post('/logout', logout);
router.get('/me', protect, getMe);

export default router;