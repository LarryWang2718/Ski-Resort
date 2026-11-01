# Frontend Dockerfile (build context: repository root)
FROM node:24-alpine AS build

WORKDIR /app

# Copy package files
COPY client/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY client/ .

# Mapbox public token is baked into the bundle at build time
ARG REACT_APP_MAPBOX_TOKEN=""
ENV REACT_APP_MAPBOX_TOKEN=$REACT_APP_MAPBOX_TOKEN

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Serves the app and proxies /api to the backend container
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
