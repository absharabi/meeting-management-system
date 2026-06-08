import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User, { Role } from '../models/User';

passport.use(
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL:  process.env.GOOGLE_CALLBACK_URL!,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0].value;
        if (!email) return done(new Error('No email from Google'));

        let user = await User.findOne({ email });
        
        // Auto-create user if they don't exist in the system yet
        if (!user) {
          user = await User.create({
            email,
            name: profile.displayName || 'New User',
            googleId: profile.id,
            avatar: profile.photos?.[0]?.value,
            role: Role.User, // Default role
            isActive: true,
          });
        }

        if (!user.isActive) return done(null, false);

        // Update Google ID/Avatar if missing on an existing user
        if (!user.googleId) {
          user.googleId = profile.id;
          user.avatar   = profile.photos?.[0]?.value || user.avatar;
          user.name     = profile.displayName || user.name;
          await user.save();
        }

        return done(null, user);
      } catch (err) {
        return done(err as Error);
      }
    }
  )
);

export default passport;