# =============================================
# Stage 1: Builder (Debian-based - match production libc)
# =============================================
FROM node:20-bookworm-slim AS builder

# Install build tools for better-sqlite3 compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# =============================================
# Stage 2: Production (Bookworm - đủ libs cho Playwright)
# =============================================
FROM node:20-bookworm-slim AS production

# Install Xvfb + Chrome system dependencies for Playwright & Puppeteer + build tools for native addons
RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb \
    libnspr4 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install production dependencies, Playwright Firefox, and Chrome for Puppeteer
COPY package*.json ./
RUN npm install --omit=dev \
    && npx playwright install --with-deps firefox \
    && npx puppeteer browsers install chrome \
    && apt-get purge -y --auto-remove python3 make g++

# Copy built app from builder stage
COPY --from=builder /app/dist ./dist

# =========================
# Expose port
# =========================
EXPOSE 9066

# =========================
# Environment
# =========================
ENV DISPLAY=:99
ENV NODE_ENV=production

# =========================
# Start app
# =========================
CMD ["sh", "-c", "rm -f /tmp/.X99-lock && Xvfb :99 -screen 0 1280x720x24 & npm start"]

