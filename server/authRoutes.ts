import type { Express } from 'express';
import { storage } from './storage';
import { insertUserSchema, loginUserSchema } from '@shared/schema';
import bcrypt from 'bcrypt';
import session from 'express-session';
import { GeolocationService } from './services/geolocationService';

export function setupAuthRoutes(app: Express) {
  // Session middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Register endpoint
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password } = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
      }

      // Validate password
      if (!password) {
        return res.status(400).json({ error: 'Password is required' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Capture geolocation data for new user
      const ip = GeolocationService.extractIPAddress(req);
      let locationData;
      try {
        locationData = await GeolocationService.getLocationData(ip);
      } catch (error) {
        console.warn('[Registration] Geolocation failed, proceeding without location data');
        locationData = null;
      }
      
      // Create user with geolocation data
      const userData: any = {
        email,
        password: hashedPassword
      };
      
      // Add geolocation data if available
      if (locationData) {
        userData.ipAddress = ip;
        userData.country = locationData.country;
        userData.countryCode = locationData.country_code;
        userData.region = locationData.region;
        userData.city = locationData.city;
        userData.timezone = locationData.timezone;
        userData.latitude = locationData.latitude;
        userData.longitude = locationData.longitude;
        userData.isp = locationData.isp;
      }
      
      const user = await storage.createUser(userData);
      console.log(`[Registration] New user ${email} registered from ${locationData?.city || 'Unknown'}, ${locationData?.country || 'Unknown'}`);

      // Store user in session
      (req.session as any).userId = user.id;

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('Registration error:', error);
      res.status(400).json({ error: 'Registration failed' });
    }
  });

  // Login endpoint
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = loginUserSchema.parse(req.body);
      
      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check password (skip for OAuth users who don't have passwords)
      if (user.password && password) {
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
      } else if (!user.password && !password) {
        // OAuth user trying to log in without password - that's ok
      } else {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Update user's location data on login if not already set
      if (!user.ipAddress) {
        const ip = GeolocationService.extractIPAddress(req);
        try {
          const locationData = await GeolocationService.getLocationData(ip);
          if (locationData) {
            console.log(`[Login] Captured location for ${email}: ${locationData.city}, ${locationData.country}`);
          }
        } catch (error) {
          console.warn('[Login] Geolocation failed for existing user');
        }
      }

      // Store user in session
      (req.session as any).userId = user.id;

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('Login error:', error);
      res.status(400).json({ error: 'Login failed' });
    }
  });

  // Get current user endpoint
  app.get('/api/auth/user', async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Failed to get user' });
    }
  });

  // Logout endpoint
  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.json({ message: 'Logged out successfully' });
    });
  });
}