import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sharezidi';

// MongoDB connection with simplified configuration
export async function connectMongoDB() {
  try {
    console.log("[MONGODB] Connecting to:", MONGODB_URI.replace(/\/\/.*@/, '//***@'));
    
    // Close any existing connections
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    
    await mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      family: 4, // Use IPv4, skip trying IPv6
    });
    
    console.log("[MONGODB] ✅ Connected successfully");
    
    // Set up connection event handlers
    mongoose.connection.on('error', (error) => {
      console.error("[MONGODB] Connection error:", error);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log("[MONGODB] Disconnected from MongoDB");
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log("[MONGODB] Reconnected to MongoDB");
    });
    
    return mongoose.connection;
  } catch (error) {
    console.error("[MONGODB] Connection failed:", error);
    throw error;
  }
}

// Export the connection for use in other modules
export const db = mongoose.connection;
