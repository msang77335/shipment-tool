# Huong dan run local - Shipment Tracking Connector Service

Tai lieu nay huong dan chay du an local tu dau, bao gom clone repo dung branch, cau hinh env, va chay bang npm hoac Docker.

## 1. Clone repository dung branch

```bash
git clone -b feature/25032-shipment-tracking https://github.com/msang77335/shipment-tool.git
cd shipment-tool
```

Neu ban da clone truoc do:

```bash
git fetch origin
git checkout feature/25032-shipment-tracking
git pull origin feature/25032-shipment-tracking
```

## 2. Yeu cau moi truong

- Node.js >= 16
- npm (di kem Node.js)
- Khuyen nghi dung Node.js 20 LTS
- Neu can dung Docker: Docker Desktop + Docker Compose

Kiem tra nhanh:

```bash
node -v
npm -v
```

## 3. Cai dat dependencies

```bash
npm install
```

Cai browser cho Playwright:

```bash
npx playwright install --with-deps
```

## 4. Cau hinh environment (.env)

Tao file `.env` tu file mau:

```bash
cp .env.example .env
```

Cap nhat cac bien quan trong trong `.env`:

```env
# Environment
NODE_ENV=development
PORT=8080

# API Configuration
API_PREFIX=/api/v1
TRUST_PROXY=loopback, linklocal, uniquelocal
X_API_KEY=your_secret_api_key_here

# Proxy Configuration (round-robin)
# Format: ip:port:username:password|ip:port:username:password
PROXY_LIST=

# Captcha
CAPTCHA_SOLVER_API_KEY=

# Google AI (co the dung nhieu key, cach nhau boi dau phay)
GEMINI_API_KEY=

# Browserless (co the dung nhieu token, cach nhau boi dau phay)
BROWSERLESS_API_TOKEN=
```

### Luu y quan trong ve env

- `X_API_KEY`: can cung cap trong header `X-API-Key` khi goi API (tru endpoint health).
- `PROXY_LIST`: de trong neu khong dung proxy.
- `GEMINI_API_KEY`, `BROWSERLESS_API_TOKEN`, `CAPTCHA_SOLVER_API_KEY`: co the bo trong neu khong su dung tinh nang lien quan.

## 5. Run local (development)

```bash
npm run dev
```

Server mac dinh chay tai:

- `http://localhost:8080`
- Base API: `http://localhost:8080/api/v1`

## 6. Build va run production local

Build TypeScript:

```bash
npm run build
```

Chay production:

```bash
npm start
```

## 7. Test nhanh API

### Health check

```bash
curl http://localhost:8080/health
```

### Tracking endpoint

```bash
curl -X POST http://localhost:8080/api/v1/tracking \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_secret_api_key_here" \
  -d '{
    "provider": "spx",
    "codes": "SPXVN0123456789"
  }' \
  --output tracking-screenshot.png
```

## 8. Run local bang Docker (tuỳ chon)

### Cach 1: dung script

```bash
# Development
./docker-setup.sh --dev

# Production
./docker-setup.sh --prod
```

### Cach 2: dung docker compose

```bash
# Development
docker-compose -f docker-compose.dev.yml up

# Production
docker-compose up -d
```

## 9. Loi thuong gap

### Port 8080 dang bi chiem

Doi `PORT` trong `.env`, vi du:

```env
PORT=8081
```

### Chua cai browser Playwright

```bash
npx playwright install --with-deps
```

### Thieu API key

Neu da bat auth bang `X_API_KEY`, can gui header:

```http
X-API-Key: <gia_tri_trong_file_env>
```
