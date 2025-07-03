import { users, type User, type InsertUser } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createFullUser(user: typeof users.$inferInsert): Promise<User>;
  updateUserTransferCount(id: number): Promise<User | undefined>;
  upgradeUserToPro(id: number): Promise<User | undefined>;
  updateUserPassword(id: number, hashedPassword: string): Promise<User | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createFullUser(userData: typeof users.$inferInsert): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async updateUserTransferCount(id: number): Promise<User | undefined> {
    // First get the current user to increment their transfer count
    const currentUser = await this.getUser(id);
    if (!currentUser) return undefined;
    
    const [user] = await db
      .update(users)
      .set({ 
        transferCount: (currentUser.transferCount || 0) + 1,
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async upgradeUserToPro(id: number): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ 
        isPro: true,
        subscriptionDate: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async updateUserPassword(id: number, hashedPassword: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ 
        password: hashedPassword,
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }
}

export const storage = new DatabaseStorage();
