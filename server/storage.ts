import { User, Visitor, type IUser, type InsertUser } from "@shared/schema";
import { connectMongoDB } from "./db";
import mongoose from "mongoose";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<IUser | undefined>;
  getUserByEmail(email: string): Promise<IUser | undefined>;
  createUser(user: InsertUser): Promise<IUser>;
  createFullUser(user: Partial<IUser>): Promise<IUser>;
  updateUserTransferCount(id: string): Promise<IUser | undefined>;
  upgradeUserToPro(id: string): Promise<IUser | undefined>;
  updateUserPassword(id: string, hashedPassword: string): Promise<IUser | undefined>;
}

export class DatabaseStorage implements IStorage {
  constructor() {
    // Ensure MongoDB connection is established
    connectMongoDB().catch(console.error);
  }

  async getUser(id: string): Promise<IUser | undefined> {
    console.log("[MONGODB] getUser called with ID:", id);
    try {
      const user = await User.findById(id);
      console.log("[MONGODB] getUser result:", user ? { id: user._id, username: user.username, email: user.email } : "NOT FOUND");
      return user || undefined;
    } catch (error) {
      console.error("[MONGODB] getUser error:", error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<IUser | undefined> {
    console.log("[MONGODB] getUserByEmail called with:", email);
    try {
      const user = await User.findOne({ email });
      console.log("[MONGODB] getUserByEmail result:", user ? { id: user._id, username: user.username, email: user.email } : "NOT FOUND");
      return user || undefined;
    } catch (error) {
      console.error("[MONGODB] getUserByEmail error:", error);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<IUser> {
    console.log("[MONGODB] createUser called with:", { email: insertUser.email });
    try {
      const user = new User(insertUser);
      await user.save();
      console.log("[MONGODB] createUser success:", { id: user._id, email: user.email });
      return user;
    } catch (error) {
      console.error("[MONGODB] createUser error:", error);
      throw error;
    }
  }

  async createFullUser(userData: Partial<IUser>): Promise<IUser> {
    console.log("[MONGODB] createFullUser called");
    try {
      const user = new User(userData);
      await user.save();
      console.log("[MONGODB] createFullUser success:", { id: user._id, email: user.email });
      return user;
    } catch (error) {
      console.error("[MONGODB] createFullUser error:", error);
      throw error;
    }
  }

  async updateUserTransferCount(id: string): Promise<IUser | undefined> {
    console.log("[MONGODB] updateUserTransferCount called with ID:", id);
    try {
      const user = await User.findByIdAndUpdate(
        id,
        { $inc: { transferCount: 1 } },
        { new: true }
      );
      console.log("[MONGODB] updateUserTransferCount result:", user ? "SUCCESS" : "NOT FOUND");
      return user || undefined;
    } catch (error) {
      console.error("[MONGODB] updateUserTransferCount error:", error);
      return undefined;
    }
  }

  async upgradeUserToPro(id: string): Promise<IUser | undefined> {
    console.log("[MONGODB] upgradeUserToPro called with ID:", id);
    try {
      const user = await User.findByIdAndUpdate(
        id,
        { 
          isPro: true,
          subscriptionDate: new Date()
        },
        { new: true }
      );
      console.log("[MONGODB] upgradeUserToPro result:", user ? "SUCCESS" : "NOT FOUND");
      return user || undefined;
    } catch (error) {
      console.error("[MONGODB] upgradeUserToPro error:", error);
      return undefined;
    }
  }

  async updateUserPassword(id: string, hashedPassword: string): Promise<IUser | undefined> {
    console.log("[MONGODB] updateUserPassword called with ID:", id);
    try {
      const user = await User.findByIdAndUpdate(
        id,
        { password: hashedPassword },
        { new: true }
      );
      console.log("[MONGODB] updateUserPassword result:", user ? "SUCCESS" : "NOT FOUND");
      return user || undefined;
    } catch (error) {
      console.error("[MONGODB] updateUserPassword error:", error);
      return undefined;
    }
  }
}

export const storage = new DatabaseStorage();