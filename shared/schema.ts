import mongoose, { Schema, Document } from 'mongoose';
import { z } from 'zod';

// User interface and schema
export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  username: string;
  password: string;
  transferCount: number;
  isPro: boolean;
  subscriptionDate: Date;
  lastResetDate: Date;
  lastVisitTime: Date;
  totalFilesTransferred: number;
  totalBytesTransferred: number;
  deviceCount: number;
  createdAt: Date;
  updatedAt: Date;
  
  // Geolocation fields for user registration analytics
  ipAddress?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  timezone?: string;
  latitude?: string;
  longitude?: string;
  isp?: string;
}

const userSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, maxlength: 255 },
  username: { type: String, maxlength: 100 },
  password: { type: String, maxlength: 255 },
  transferCount: { type: Number, default: 0 },
  isPro: { type: Boolean, default: false },
  subscriptionDate: { type: Date },
  lastResetDate: { type: Date, default: Date.now },
  lastVisitTime: { type: Date, default: Date.now },
  totalFilesTransferred: { type: Number, default: 0 },
  totalBytesTransferred: { type: Number, default: 0 },
  deviceCount: { type: Number, default: 0 },
  
  // Geolocation fields
  ipAddress: { type: String, maxlength: 45 },
  country: { type: String, maxlength: 100 },
  countryCode: { type: String, maxlength: 2 },
  region: { type: String, maxlength: 100 },
  city: { type: String, maxlength: 100 },
  timezone: { type: String, maxlength: 50 },
  latitude: { type: String, maxlength: 20 },
  longitude: { type: String, maxlength: 20 },
  isp: { type: String, maxlength: 200 }
}, {
  timestamps: true // Automatically manage createdAt and updatedAt
});

// Visitor interface and schema
export interface IVisitor extends Document {
  _id: mongoose.Types.ObjectId;
  sessionId: string;
  ipAddress: string;
  userAgent?: string;
  lastVisitTime: Date;
  visitCount: number;
  pageViews: number;
  sessionDuration: number;
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  timezone?: string;
  latitude?: string;
  longitude?: string;
  isp?: string;
  referrer?: string;
  visitedAt: Date;
}

const visitorSchema = new Schema<IVisitor>({
  sessionId: { type: String, required: true, maxlength: 100 },
  ipAddress: { type: String, required: true, maxlength: 45 },
  userAgent: { type: String, maxlength: 500 },
  lastVisitTime: { type: Date, default: Date.now },
  visitCount: { type: Number, default: 1 },
  pageViews: { type: Number, default: 1 },
  sessionDuration: { type: Number, default: 0 },
  country: { type: String, maxlength: 100 },
  countryCode: { type: String, maxlength: 2 },
  region: { type: String, maxlength: 100 },
  city: { type: String, maxlength: 100 },
  timezone: { type: String, maxlength: 50 },
  latitude: { type: String, maxlength: 20 },
  longitude: { type: String, maxlength: 20 },
  isp: { type: String, maxlength: 200 },
  referrer: { type: String, maxlength: 500 },
  visitedAt: { type: Date, default: Date.now }
});

// Create models
export const User = mongoose.model<IUser>('User', userSchema);
export const Visitor = mongoose.model<IVisitor>('Visitor', visitorSchema);

// Zod schemas for validation
export const insertUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const loginUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const guestUserSchema = z.object({
  email: z.string().email(),
  password: z.string().optional(),
});

export const insertVisitorSchema = z.object({
  sessionId: z.string().max(100),
  ipAddress: z.string().max(45),
  userAgent: z.string().max(500).optional(),
  country: z.string().max(100).optional(),
  countryCode: z.string().max(2).optional(),
  region: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  timezone: z.string().max(50).optional(),
  latitude: z.string().max(20).optional(),
  longitude: z.string().max(20).optional(),
  isp: z.string().max(200).optional(),
  referrer: z.string().max(500).optional(),
});

// Type exports
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserType = IUser;
export type InsertVisitor = z.infer<typeof insertVisitorSchema>;
export type VisitorType = IVisitor;

// Legacy type exports for compatibility
export type User = IUser;
export type Visitor = IVisitor;