# ==============================================================================
# HUMA HIJAB COLLECTION — BACKEND MULTI-STAGE DOCKERFILE
# ==============================================================================

# Stage 1: Build TypeScript Codebase
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src ./src
RUN npm run build

# Stage 2: Production Minimal Runtime
FROM node:20-alpine AS runner
WORKDIR /app

# Install curl for container health check probes
RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV PORT=5000

# Copy package manifests and install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled JavaScript output from builder
COPY --from=builder /app/dist ./dist

# Create logs directory and assign permissions to non-root node user
RUN mkdir -p logs && chown -R node:node /app
USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

CMD ["node", "dist/server.js"]
