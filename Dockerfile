
# Multi-stage build for NestJS application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY nodejs_space/package.json nodejs_space/yarn.lock* ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY nodejs_space/ ./

# Build TypeScript
RUN yarn build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY nodejs_space/package.json nodejs_space/yarn.lock* ./

# Install production dependencies only
RUN yarn install --production --frozen-lockfile

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

USER nestjs

EXPOSE 8000

CMD ["node", "dist/main"]
