// Basic schema for ShareZidi
export interface User {
  id: string;
  email: string;
  username?: string;
  password?: string;
  createdAt: Date;
}

export interface InsertUser {
  email: string;
  username?: string;
  password?: string;
}

export interface Visitor {
  id: string;
  ip: string;
  timestamp: Date;
  location?: any;
}

export interface InsertVisitor {
  ip: string;
  location?: any;
}