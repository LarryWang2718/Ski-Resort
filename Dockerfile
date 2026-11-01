# Backend Dockerfile
FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

# Copy package files
COPY server/package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy source code
COPY server/ .

# Expose port
EXPOSE 5000

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD wget -qO- http://127.0.0.1:5000/api/health || exit 1

# Run node directly (not npm) so SIGTERM reaches the graceful shutdown handler
CMD ["node", "server.js"]
