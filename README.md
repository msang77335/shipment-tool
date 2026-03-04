# Shipment Tracking API

A robust REST API for tracking shipments across multiple carriers using automated browser screenshot capture. Built with **TypeScript**, **Express.js**, and **Playwright** for reliable cross-carrier package tracking.

## 🌟 Features

- 📦 **Multi-Carrier Support** - Track shipments from 9+ shipping providers
- 📸 **Screenshot-Based Tracking** - Visual proof of tracking status
- 🤖 **Browser Automation** - Playwright for reliable page rendering
- 🔐 **Security Hardened** - Helmet, CORS, and rate limiting enabled
- 🧩 **Captcha Solving** - Integrated 2Captcha and Anticaptcha support
- 🤝 **AI Integration** - Google Generative AI for enhanced data extraction
- ⚡ **Performance Optimized** - Browser instance singleton pattern
- 🚀 **Production Ready** - TypeScript strict mode, error handling, logging
- 🐳 **Docker Support** - Containerized deployment ready
- 📊 **Request Logging** - Morgan logger with detailed insights

## 📦 Supported Shipping Providers

| Provider | Region | Notes |
|----------|--------|-------|
| **Aftership** | Global | Aggregator platform |
| **Best Express** | Vietnam | Local logistics |
| **GHN** (Giao Hang Nhanh) | Vietnam | Express delivery |
| **JT Express** | Asia-Pacific | International shipping |
| **Shopee Express (SPX)** | Southeast Asia | E-commerce logistics |
| **USPS** | United States | Postal service |
| **Viettel Post** | Vietnam | Postal & logistics |
| **VN Post** | Vietnam | National postal service |
| **YunExpress** | China | International logistics |

## 🚀 Getting Started

### Prerequisites

- **Node.js** v16 or higher
- **npm** or **yarn**
- **Playwright** browser dependencies (automatically installed)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd shipment-tracking-api
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install Playwright browsers**
   ```bash
   npx playwright install --with-deps
   ```

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your configuration:
   ```env
   PORT=8080
   NODE_ENV=development
   TRUST_PROXY=loopback, linklocal, uniquelocal
   
   # API Key (optional - for authentication)
   X_API_KEY=your_secret_api_key_here
   
   # Captcha Services (optional)
   CAPTCHA_2CAPTCHA_KEY=your_2captcha_key
   CAPTCHA_ANTICAPTCHA_KEY=your_anticaptcha_key
   
   # Google AI (optional - supports multiple keys)
   GEMINI_API_KEY=key1,key2,key3
   
   # Browserless (optional - supports multiple tokens)
   BROWSERLESS_API_TOKEN=token1,token2,token3
   ```

### Development

**Start development server with hot reload:**
```bash
npm run dev
```

The server will start at `http://localhost:8080`

### Building for Production

**Compile TypeScript to JavaScript:**
```bash
npm run build
```

**Start production server:**
```bash
npm start
```

## � Docker Deployment

### Quick Start with Docker

**Using automated setup script:**
```bash
# Production deployment
./docker-setup.sh --prod

# Development deployment
./docker-setup.sh --dev

# Interactive menu
./docker-setup.sh
```

**Using Docker Compose:**
```bash
# Production
docker-compose up -d

# Development with hot reload
docker-compose -f docker-compose.dev.yml up
```

**Using Makefile:**
```bash
# See all available commands
make help

# Build and start production
make build && make up

# Build and start development
make build-dev && make up-dev

# View logs
make logs
```

See [DOCKER.md](DOCKER.md) for comprehensive Docker documentation.

## �📡 API Documentation

### Base URL
```
http://localhost:8080/api/v1
```

### Authentication
All API endpoints (except `/health`) require API key authentication.

**Include the `X-API-Key` header in all requests:**
```bash
curl -H "X-API-Key: your_secret_api_key_here" http://localhost:8080/api/v1/tracking
```

Set your API key in `.env`:
```env
X_API_KEY=your_secret_api_key_here
```

See [API-KEY-AUTHENTICATION.md](API-KEY-AUTHENTICATION.md) for detailed authentication documentation.

### Health Check
**GET** `/health`

Check if the server is running. **No authentication required.**

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

---

### Track Shipment
**POST** `/api/v1/tracking`

Get tracking information as a screenshot image with metadata.

#### Request Body
```json
{
  "provider": "spx",
  "codes": "SPXVN0123456789"
}
```

#### Parameters
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider` | string | Yes | Shipping provider code (see supported providers) |
| `codes` | string | Yes | Tracking number(s) - comma-separated for multiple |

#### Provider Codes
- `aftership` - Aftership
- `bestexpress` - Best Express
- `ghn` - Giao Hang Nhanh
- `jtexpress` - JT Express
- `spx` - Shopee Express
- `usps` - USPS
- `viettelpost` - Viettel Post
- `vnpost` - VN Post
- `yunexpress` - YunExpress

#### Response
Returns a **binary image** (PNG) with tracking screenshot.

**Headers:**
```
Content-Type: image/png
X-Provider: spx
X-Tracking-Codes: SPXVN0123456789
X-Status: In Transit
X-Processing-Time: 3542
```

#### Example cURL Request
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

#### Error Response
```json
{
  "success": false,
  "error": "Provider and codes parameters are required"
}
```

**Status Codes:**
- `200` - Success
- `400` - Bad Request (missing/invalid parameters)
- `404` - Tracking not found
- `429` - Rate limit exceeded
- `500` - Internal server error

---

## 📁 Project Structure

```
shipment-tracking-api/
├── src/
│   ├── index.ts                          # Application entry point
│   ├── helpers/                          # Helper utilities
│   │   ├── index.ts                      # Helper exports
│   │   ├── env.ts                        # Environment configuration
│   │   ├── browserlessTokenRotator.ts    # Browserless token rotation
│   │   ├── geminiApiKeyRotator.ts        # Gemini API key rotation
│   │   ├── PlaywrightBrowserSingleton.ts # Browser singleton
│   │   ├── screenshoter.ts               # Generic screenshoter
│   │   ├── aftershipSreenshouter.ts      # Aftership implementation
│   │   ├── bestExpressScreenshouter.ts   # Best Express implementation
│   │   ├── viettelPostScreenshoter.ts    # Viettel Post implementation
│   │   └── vnPostScreenshoter.ts         # VN Post implementation
│   ├── middleware/                       # Express middleware
│   │   ├── index.ts                      # Middleware exports
│   │   ├── apiKeyAuth.ts                 # API key authentication
│   │   ├── errorHandler.ts               # Global error handler
│   │   └── notFoundHandler.ts            # 404 handler
│   └── routes/                           # Route definitions
│       ├── index.ts                      # Main router
│       └── trackingRoutes.ts             # Tracking endpoints
├── templates/                            # HTML templates
│   └── viettel-tracking.html             # Viettel Post template
├── public/                               # Static files
├── dist/                                 # Compiled JavaScript (generated)
├── Dockerfile                            # Docker configuration
├── DOCKER.md                             # Docker documentation
├── tsconfig.json                         # TypeScript configuration
├── nodemon.json                          # Nodemon configuration
├── package.json                          # Dependencies and scripts
└── README.md                             # This file
```

## 🐳 Docker Deployment

**Build the Docker image:**
```bash
docker build -t shipment-tracking-api .
```

**Run the container:**
```bash
docker run -p 8080:8080 \
  -e PORT=8080 \
  -e NODE_ENV=production \
  shipment-tracking-api
```

See [DOCKER.md](DOCKER.md) for detailed Docker deployment instructions.

## 🛠️ Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run build:watch` | Compile TypeScript in watch mode |
| `npm start` | Start production server |
| `npm run lint` | Lint TypeScript files |
| `npm run lint:fix` | Fix linting errors automatically |
| `npm test` | Run Jest tests |
| `npm test:watch` | Run tests in watch mode |

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `TRUST_PROXY` | `loopback, linklocal, uniquelocal` | Proxy trust settings |
| `X_API_KEY` | - | API key for authentication (optional) |
| `CAPTCHA_2CAPTCHA_KEY` | - | 2Captcha API key (optional) |
| `CAPTCHA_ANTICAPTCHA_KEY` | - | Anticaptcha API key (optional) |
| `GEMINI_API_KEY` | - | Google Gemini API key(s) - comma-separated for rotation (optional) |
| `BROWSERLESS_API_TOKEN` | - | Browserless API token(s) - comma-separated for rotation (optional) |

### Rate Limiting

Default rate limit: **100 requests per 15 minutes per IP**

To modify, edit `/src/index.ts`:
```typescript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
});
```

### Request Timeouts

Default timeout: **5 minutes** for long-running screenshot operations

## 🔒 Security Features

- **API Key Authentication** - Optional X-API-Key header protection for all endpoints (see [API-KEY-AUTHENTICATION.md](API-KEY-AUTHENTICATION.md))
- **Helmet.js** - Sets secure HTTP headers
- **CORS** - Cross-Origin Resource Sharing enabled
- **Rate Limiting** - Prevents API abuse
- **Content Security Policy** - XSS protection
- **Request Size Limits** - 10MB max payload
- **Proxy Trust** - Secure IP detection behind reverse proxies

## 🧪 Testing

Run tests with Jest:
```bash
npm test
```

Run tests in watch mode:
```bash
npm test:watch
```

## 📝 Development Guidelines

See [copilot-instructions.md](copilot-instructions.md) for detailed development guidelines, code conventions, and best practices.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

ISC

## 🐛 Troubleshooting

### Playwright Installation Issues
```bash
# Install system dependencies for Playwright
npx playwright install-deps

# Or manually install Chromium
npx playwright install chromium
```

### Port Already in Use
Change the port in `.env`:
```env
PORT=8080
```

### Rate Limit Issues
Increase rate limits in `/src/index.ts` or implement per-user authentication.

## 📞 Support

For issues and questions, please open an issue on GitHub.