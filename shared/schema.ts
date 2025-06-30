import { pgTable, serial, varchar, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }),
  transferCount: integer("transfer_count").default(0),
  isPro: boolean("is_pro").default(false),
  subscriptionDate: timestamp("subscription_date"),
  lastResetDate: timestamp("last_reset_date").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  // Geolocation tracking
  ipAddress: varchar("ip_address", { length: 45 }), // IPv6 support
  country: varchar("country", { length: 100 }),
  countryCode: varchar("country_code", { length: 2 }),
  region: varchar("region", { length: 100 }),
  city: varchar("city", { length: 100 }),
  timezone: varchar("timezone", { length: 50 }),
  latitude: varchar("latitude", { length: 20 }),
  longitude: varchar("longitude", { length: 20 }),
  isp: varchar("isp", { length: 200 }),
});

// Visitor tracking for analytics
export const visitors = pgTable("visitors", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 100 }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }).notNull(),
  userAgent: varchar("user_agent", { length: 500 }),
  country: varchar("country", { length: 100 }),
  countryCode: varchar("country_code", { length: 2 }),
  region: varchar("region", { length: 100 }),
  city: varchar("city", { length: 100 }),
  timezone: varchar("timezone", { length: 50 }),
  latitude: varchar("latitude", { length: 20 }),
  longitude: varchar("longitude", { length: 20 }),
  isp: varchar("isp", { length: 200 }),
  referrer: varchar("referrer", { length: 500 }),
  visitedAt: timestamp("visited_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
});

export const loginUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
});

export const guestUserSchema = createInsertSchema(users).pick({
  email: true,
}).extend({
  password: z.string().optional(),
});

export const insertVisitorSchema = createInsertSchema(visitors).omit({
  id: true,
  visitedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertVisitor = z.infer<typeof insertVisitorSchema>;
export type Visitor = typeof visitors.$inferSelect;
