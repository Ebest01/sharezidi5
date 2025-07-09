import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sharezidi';

if (!MONGODB_URI) {
  throw new Error(
    "MONGODB_URI must be set. Did you forget to configure your MongoDB connection?",
  );
}

// MongoDB connection with proper configuration
export async function connectMongoDB() {
  try {
    console.log("[MONGODB] Attempting to connect...");
    await mongoose.connect(MONGODB_URI, {
      // Modern connection options
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log("[MONGODB] Connected successfully");
    return mongoose.connection;
  } catch (error) {
    console.error("[MONGODB] Connection failed:", error);
    throw error;
  }
}

// Export the connection for use in other modules
export const db = mongoose.connection;

// Test database connection on startup
(async () => {
  try {
    console.log("[MONGODB] Initializing connection test...");
    await connectMongoDB();
    
    // Test model access
    console.log("[MONGODB] Testing User model access...");
    const { User } = await import("@shared/schema");
    const userCount = await User.countDocuments();
    console.log("[MONGODB] User collection accessible, document count:", userCount);
  } catch (error) {
    console.error("[MONGODB] Connection or model access failed:", error);
  }
})();
