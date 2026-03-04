FROM node:20-bookworm

WORKDIR /app

# =========================
# 1. Install Node deps
# =========================
COPY package*.json ./
RUN npm install && npx playwright install --with-deps firefox

# =========================
# 3. Copy source code
# =========================
COPY . .

# =========================
# 4. Build app
# =========================
RUN npm run build

# =========================
# 5. Expose port
# =========================
EXPOSE 8080

# =========================
# 6. Xvfb display
# =========================
ENV DISPLAY=:99
ENV NODE_ENV=production

# =========================
# 7. Start app
# =========================
CMD ["sh", "-c", "rm -f /tmp/.X99-lock && Xvfb :99 -screen 0 1280x720x24 & npm start"]

