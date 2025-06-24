import { users, type User, type InsertUser } from "@shared/schema";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserTransferCount(id: number): Promise<User | undefined>;
  upgradeUserToPro(id: number): Promise<User | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  currentId: number;

  constructor() {
    this.users = new Map();
    this.currentId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { 
      ...insertUser, 
      id,
      transferCount: 0,
      isPro: false,
      subscriptionDate: null,
      lastResetDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserTransferCount(id: number): Promise<User | undefined> {
    const user = this.users.get(id);
    if (user) {
      const updatedUser = {
        ...user,
        transferCount: (user.transferCount || 0) + 1,
        updatedAt: new Date()
      };
      this.users.set(id, updatedUser);
      return updatedUser;
    }
    return undefined;
  }

  async upgradeUserToPro(id: number): Promise<User | undefined> {
    const user = this.users.get(id);
    if (user) {
      const updatedUser = {
        ...user,
        isPro: true,
        subscriptionDate: new Date(),
        updatedAt: new Date()
      };
      this.users.set(id, updatedUser);
      return updatedUser;
    }
    return undefined;
  }
}

export const storage = new MemStorage();
