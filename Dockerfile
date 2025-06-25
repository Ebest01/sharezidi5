# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Build both frontend and backend in one step

# Build the production server (ZERO VITE DEPENDENCIES) - Cache bust v6
RUN npx vite build client && npx esbuild server/prod-server.ts --bundle --platform=node --target=node20 --format=esm --outfile=dist/prod-server.js --external:ws --external:express

# Production stage  
FROM node:20-alpine AS production

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/dist ./client/dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/api/auth/user || exit 1

# Start the application
CMD ["node", "dist/prod-server.js"]