# =============================================
# Stage 1: Builder (Alpine - nhẹ, chỉ build TS)
# =============================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# =============================================
# Stage 2: Production (Bookworm - đủ libs cho Playwright)
# =============================================
FROM node:20-bookworm-slim AS production

# Install Xvfb and system dependencies for Playwright Firefox
RUN apt-get update && apt-get install -y \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install production dependencies and Playwright Firefox
COPY package*.json ./
RUN npm install --omit=dev \
    && npx playwright install --with-deps firefox

# Copy built app from builder stage
COPY --from=builder /app/dist ./dist

# =========================
# Expose port
# =========================
EXPOSE 8080

# =========================
# Environment
# =========================
ENV DISPLAY=:99
ENV NODE_ENV=production

# =========================
# Start app
# =========================
CMD ["sh", "-c", "rm -f /tmp/.X99-lock && Xvfb :99 -screen 0 1280x720x24 & npm start"]

