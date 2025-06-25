import express from "express";
import path from "path";
import { registerRoutes } from "./routes.js";

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;
  
  res.send = function(data) {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} ${res.statusCode} in ${duration}ms`);
    return originalSend.call(this, data);
  };
  
  next();
});

async function startServer() {
  const server = await registerRoutes(app);
  
  // Error handler
  app.use((err: any, _req: any, res: any, _next: any) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Server error:", err);
    res.status(status).json({ message });
  });

  // Serve static files from client/dist - NO VITE IMPORTS
  const distPath = path.resolve(process.cwd(), "client", "dist");
  app.use(express.static(distPath));
  
  // Catch-all handler for SPA
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });

  const port = parseInt(process.env.PORT || "5000");
  server.listen({ port, host: "0.0.0.0" }, () => {
    console.log(`ShareZidi production server running on port ${port}`);
    console.log(`Serving static files from: ${distPath}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});