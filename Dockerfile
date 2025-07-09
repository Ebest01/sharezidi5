# Use Node.js 20 LTS
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Make build script executable
RUN chmod +x build-production.sh

# Build application using custom script (with MongoDB externals)
RUN ./build-production.sh

# Expose port
EXPOSE 5000

# Start command
CMD ["npm", "start"]