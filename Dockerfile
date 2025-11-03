# Backend Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY server/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY server/ .

# Expose port
EXPOSE 5000

# Start the application
CMD ["npm", "start"] 