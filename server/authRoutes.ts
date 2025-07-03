import type { Express } from "express";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import session from "express-session";
import { GeolocationService } from "./services/geolocationService";
import {
  generatePassword,
  extractUsernameFromEmail,
  validateEmail,
} from "./utils/passwordGenerator";
import { sendEmail, createRegistrationEmail } from "./utils/emailService";

export function setupAuthRoutes(app: Express) {
  // Session middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "dev-secret-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    }),
  );

  // Email registration endpoint - Step 1: Register with email only
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email || !validateEmail(email)) {
        return res
          .status(400)
          .json({ error: "Valid email address is required" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res
          .status(400)
          .json({ error: "User already exists with this email" });
      }

      // Generate username from email prefix
      const username = extractUsernameFromEmail(email);

      // Generate password in format [A-Z{3}][0-9{5}][a-z{2}]
      const generatedPassword = generatePassword();

      // Get user's IP address and geolocation data
      const clientIP = GeolocationService.extractIPAddress(req);
      let locationData;
      try {
        locationData = await GeolocationService.getLocationData(clientIP);
      } catch (error) {
        console.warn(
          "[Registration] Geolocation failed, proceeding without location data",
        );
        locationData = null;
      }

      // Hash the generated password
      const hashedPassword = await bcrypt.hash(generatedPassword, 10);

      // Create user with geolocation data
      const userData: any = {
        email,
        username,
        password: hashedPassword,
        transferCount: 0,
        isPro: false,
        subscriptionDate: null,
        lastResetDate: new Date(),
      };

      // Add geolocation data if available
      if (locationData) {
        userData.ipAddress = clientIP;
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

      // Send registration email with password
      const emailContent = createRegistrationEmail(
        email,
        username,
        generatedPassword,
      );
      const emailSent = await sendEmail({
        to: email,
        from: "noreply@sharezidi.com",
        ...emailContent,
      });

      // Log registration with location info
      const location = locationData
        ? `${locationData.city}, ${locationData.country}`
        : "Unknown Location";
      console.log(
        `[Registration] New user ${user.email} (${username}) registered from ${location}`,
      );
      console.log(
        `[Registration] Password sent via email: ${emailSent ? "SUCCESS" : "FAILED"}`,
      );

      // Store user in session after successful registration
      (req.session as any).userId = user.id;

      // Return success response (don't include password or sensitive data)
      res.status(201).json({
        message:
          "Registration successful! Check your email for login credentials.",
        email: user.email,
        username: user.username,
        emailSent,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          transferCount: user.transferCount,
          isPro: user.isPro,
        },
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(400).json({ error: "Registration failed" });
    }
  });

  // Resend password email endpoint
  app.post("/api/auth/resend-password", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email || !validateEmail(email)) {
        return res
          .status(400)
          .json({ error: "Valid email address is required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res
          .status(404)
          .json({ error: "No account found with this email" });
      }

      // Generate new password
      const newPassword = generatePassword();
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update user's password in database
      await storage.updateUserPassword(user.id, hashedPassword);

      // Send new password via email
      const emailContent = createRegistrationEmail(
        user.email,
        user.username || extractUsernameFromEmail(user.email),
        newPassword,
      );
      const emailSent = await sendEmail({
        to: email,
        from: "noreply@sharezidi.com",
        ...emailContent,
      });

      console.log(
        `[Password Resend] New password sent to ${email}: ${emailSent ? "SUCCESS" : "FAILED"}`,
      );

      res.json({
        message: "New password sent to your email!",
        emailSent,
      });
    } catch (error) {
      console.error("Password resend error:", error);
      res.status(400).json({ error: "Failed to resend password" });
    }
  });

  // Login endpoint
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      console.log("[DEBUG] Login attempt:", { email, hasPassword: !!password });

      // Special admin login bypass for development
      if (email === "AxDMIxN" && password === "AZQ00001xx") {
        console.log("[Admin] Development admin login bypassing email system");

        // Check if admin user exists, create if not
        console.log("[DEBUG] Checking for admin user in database...");
        let adminUser = await storage.getUserByEmail("deshabunda2@gmail.com");
        console.log("[DEBUG] Admin user query result:", adminUser ? { id: adminUser.id, username: adminUser.username, email: adminUser.email } : "NOT FOUND");
        
        if (!adminUser) {
          // Create admin user
          const hashedPassword = await bcrypt.hash("AZQ00001xx", 10);
          adminUser = await storage.createFullUser({
            email: "deshabunda2@gmail.com",
            password: hashedPassword,
            username: "AxDMIxN",
            transferCount: 0,
            isPro: true, // Admin gets pro access
            subscriptionDate: new Date(),
            lastResetDate: new Date(),
            ipAddress: GeolocationService.extractIPAddress(req),
            country: "Development",
            city: "Admin Console",
          });
          console.log("[Admin] Created new admin user with email: deshabunda2@gmail.com");
        }

        // Store admin in session
        (req.session as any).userId = adminUser.id;
        console.log("[DEBUG] Admin stored in session with ID:", adminUser.id);

        // Return admin user data
        const { password: _, ...userWithoutPassword } = adminUser;
        console.log("[DEBUG] Returning admin user data:", { id: userWithoutPassword.id, username: userWithoutPassword.username, email: userWithoutPassword.email });
        return res.json({
          message: "Admin login successful",
          user: userWithoutPassword,
        });
      }

      // Regular user login - treat email field as email for normal users
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Check password (skip for OAuth users who don't have passwords)
      if (user.password && password) {
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
          return res.status(401).json({ error: "Invalid credentials" });
        }
      } else if (!user.password && !password) {
        // OAuth user trying to log in without password - that's ok
      } else {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Update user's location data on login if not already set
      if (!user.ipAddress) {
        const ip = GeolocationService.extractIPAddress(req);
        try {
          const locationData = await GeolocationService.getLocationData(ip);
          if (locationData) {
            console.log(
              `[Login] Captured location for ${email}: ${locationData.city}, ${locationData.country}`,
            );
          }
        } catch (error) {
          console.warn("[Login] Geolocation failed for existing user");
        }
      }

      // Store user in session
      (req.session as any).userId = user.id;

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Login error:", error);
      res.status(400).json({ error: "Login failed" });
    }
  });

  // Get current user endpoint
  app.get("/api/auth/user", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      console.log("[Auth Check] Session user ID:", userId);
      console.log("[Auth Check] Session exists:", !!req.session);
      
      if (!userId) {
        console.log("[Auth Check] No userId in session - returning 401");
        return res.status(401).json({ error: "Not authenticated" });
      }

      console.log("[Auth Check] Looking up user in database:", userId);
      const user = await storage.getUser(userId);
      if (!user) {
        console.log("[Auth Check] User not found in database - returning 401");
        return res.status(401).json({ error: "User not found" });
      }

      console.log("[Auth Check] User found, returning data:", user.email);
      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("[Auth Check] Error:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });
}
