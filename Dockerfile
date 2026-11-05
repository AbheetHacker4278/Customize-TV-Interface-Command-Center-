FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install client dependencies & build
COPY client/package*.json ./client/
RUN cd client && npm install

COPY client ./client
RUN cd client && npm run build

# Production runtime
FROM node:20-bookworm-slim

WORKDIR /app

# Install python3 for cross-platform ADB support
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

# Copy server application
COPY server ./server

# Copy built frontend assets from builder
COPY --from=builder /app/client/dist ./client/dist

# Copy root package metadata
COPY package*.json ./

ENV NODE_ENV=production
ENV PORT=5050
EXPOSE 5050

CMD ["node", "server/server.js"]
