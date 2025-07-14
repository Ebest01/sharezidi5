// Production server entry point that uses the same code as development
// This ensures dev/prod parity by importing the working server/index.ts

// Re-export everything from the main server file
export * from "./index.js";