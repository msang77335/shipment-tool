# Feature Tracking Route

Tài liệu này mô tả chi tiết feature của tracking route, luồng xử lý, và provider nào đang sử dụng 2captcha, Gemini, Browserless, proxy.

## 1) Endpoint

- Method: `POST`
- Path: `/api/v1/tracking`
- Body:

```json
{
  "provider": "spx",
  "codes": "SPXVN0123456789",
  "bankAccountName": "optional"
}
```

- Bắt buộc:
  - `provider`: tên nhà vận chuyển/alias
  - `codes`: 1 hoặc nhiều mã vận đơn (comma-separated)
- Tùy chọn:
  - `bankAccountName`: dùng cho J&T flow

## 2) Response

### Success

- Status: `200`
- Content-Type: `image/png`
- Headers:
  - `X-Tracking-Status`: `DELIVERED` hoặc `UNKNOWN`
  - `X-Processing-Time`: ví dụ `3456ms`

### Error

- Status: `400` khi thiếu tham số hoặc provider chưa hỗ trợ
- Status: `500` khi lỗi runtime
- Body:

```json
{
  "success": false,
  "error": "...",
  "message": "...",
  "duration": "...ms"
}
```

## 3) Provider Mapping (trackingRoutes)

| Provider matcher | Handler |
|---|---|
| `isViettelPost` | `viettelPostTrackingShipment` |
| `isSPX` | `trackingShipment` |
| `isGiaoHangNhanh` | `trackingShipment` |
| `isYunExpress` | `trackingShipment` |
| `isOnTrac` | `trackingShipment` |
| `isYW` | `ywTrackingShipment` |
| `isJTExpress` | `jntShipmentTrackingShipment` (qua J&T queue) |
| `isUSPS` | `uspsTrackingShipment` |
| `isVnPost` | `vnPostTrackingShipment` |
| `isBestExpress` | `bestExpressTrackingShipment` |
| `isUNIUNI` | `uniTrackingShipment` |
| `isEVRI` | `evriTrackingShipment` |
| `isASENDIA` | `trackingShipment` |
| `isSingPost` | `singPostTrackingShipment` |
| `isAfterShip` (DHL/Royal Mail/Aramex...) | `aftershipTrackingShipment` |
| `isGofo` | `gofoTrackingShipment` |
| `isSTALLION` | `stallionTrackingShipment` |
| `isAustraliaPost` | `australiaPostTrackingShipment` |
| `isUPS` | `upsTrackingShipment` |
| `isFedEx` | `fedexTrackingShipment` |
| `isCanadaPost` | `trackingShipment` |
| `is4PX` | `fourPXTrackingShipment` |
| `isSPEEDX` | `trackingShipment` |

## 4) Ai đang dùng 2captcha, Gemini, Browserless, Proxy

### 4.1 Dùng 2captcha (`CAPTCHA_SOLVER_API_KEY`)

1. `Viettel Post`
- File: `src/helpers/trackingShipment/viettelPostTrackingShipment.ts`
- Có `new Solver(...)` từ package `@2captcha/captcha-solver`
- Gọi `solver.recaptcha(...)` để lấy token captcha trước khi call API Viettel

2. `SingPost`
- File: `src/helpers/trackingShipment/singPostTrackingShipment.ts`
- Gọi `page.solveRecaptchas()`
- `solveRecaptchas()` được cung cấp bởi recaptcha plugin đã config 2captcha trong browser singleton

3. `Aftership flow` (bao gồm một số provider match `isAfterShip`, và J&T fallback)
- File: `src/helpers/trackingShipment/aftershipTrackingShipment.ts`
- Gọi `page.solveRecaptchas()`
- Sử dụng 2captcha qua plugin recaptcha

Ghi chú:
- Plugin recaptcha được setup trong browser singleton, provider id = `2captcha`, token lấy từ `CAPTCHA_SOLVER_API_KEY`.

### 4.2 Dùng Gemini (`GEMINI_API_KEY`)

1. `VN Post`
- File: `src/helpers/trackingShipment/vnPostTrackingShipment.ts`
- Chụp captcha image, gọi `readCaptchaWithGemini(...)`
- Dùng model `gemini-3.1-flash-lite-preview` để OCR captcha

### 4.3 Dùng Browserless (`BROWSERLESS_API_TOKEN`)

1. `Australia Post`
- File: `src/helpers/trackingShipment/australiaTrackingShipment.ts`
- Gọi Browserless BQL endpoint

2. `Best Express`
- File: `src/helpers/trackingShipment/bestExpressTrackingShipment.ts`
- Gọi Browserless stealth BQL endpoint

### 4.4 Dùng Proxy pool (`PROXY_LIST`, `WEBSHARE_API_KEY`)

1. `Aftership`
- Tạo context qua `PlaywrightBrowserSingleton.getContextWithProxy()`
- Có blacklist proxy khi gặp `Quota Exceeded`

2. `J&T tracking` (HTTP flow)
- File: `src/helpers/trackingShipment/jntTrackingShipment.ts`
- Lấy proxy từ `proxyManager` và gắn vào `HttpProxyAgent/HttpsProxyAgent`

## 5) J&T Queue Behavior

- File: `src/routes/trackingRoutes.ts`
- Có queue cho request J&T:
  - Biến `jntActiveCount`
  - Delay theo bậc: `13s * số request đang active`
- Mục đích: giảm xung đột/tốc độ cao khi gọi J&T

## 6) Lưu ý vận hành

1. Nếu thiếu `CAPTCHA_SOLVER_API_KEY`
- Các flow cần solve captcha (Viettel, SingPost, Aftership) sẽ dễ fail hoặc kết quả kém ổn định

2. Nếu thiếu `GEMINI_API_KEY`
- VN Post captcha OCR sẽ fail

3. Nếu thiếu `BROWSERLESS_API_TOKEN`
- Australia Post và Best Express sẽ throw error

4. Nếu provider không match bất kỳ predicate nào
- API trả `400` với message provider chưa được hỗ trợ

## 7) File tham chiếu chính

- `src/routes/trackingRoutes.ts`
- `src/helpers/trackingShipment/viettelPostTrackingShipment.ts`
- `src/helpers/trackingShipment/vnPostTrackingShipment.ts`
- `src/helpers/trackingShipment/aftershipTrackingShipment.ts`
- `src/helpers/trackingShipment/singPostTrackingShipment.ts`
- `src/helpers/trackingShipment/australiaTrackingShipment.ts`
- `src/helpers/trackingShipment/bestExpressTrackingShipment.ts`
- `src/helpers/browser/PlaywrightBrowserSingleton.ts`
