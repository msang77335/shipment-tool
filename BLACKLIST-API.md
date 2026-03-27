# Blacklist Management API

## Overview

The Blacklist Manager tracks providers and proxies that encounter blocking issues (quota exceeded, IP blocks, rate limiting, etc.) during shipment tracking operations. This helps prevent unnecessary retries against already-blocked providers and improves overall system efficiency.

### Features

- **Automatic Tracking**: Blocking issues are automatically detected and added to blacklist
- **Time-based Expiry**: Entries automatically expire after 1 hour
- **Query & Manage**: Retrieve current blacklist, check status, and manually remove entries
- **Statistics**: Get insights into blocking issues by reason and provider

---

## API Endpoints

### 1. Get Current Blacklist

**GET** `/api/v1/blacklist`

Retrieve all currently blacklisted providers and proxies.

#### Response

```json
{
  "success": true,
  "data": {
    "totalEntries": 2,
    "entries": [
      {
        "provider": "JT EXPRESS",
        "proxyServer": "proxy.example.com:8080",
        "reason": "QUOTA_EXCEEDED",
        "timestamp": "2026-03-27T10:30:45.123Z",
        "code": "12345",
        "expiresIn": 3600
      },
      {
        "provider": "USPS",
        "proxyServer": "N/A",
        "reason": "QUOTA_EXCEEDED",
        "timestamp": "2026-03-27T10:25:30.456Z",
        "code": "N/A",
        "expiresIn": 1800
      }
    ]
  }
}
```

---

### 2. Get Blacklist Statistics

**GET** `/api/v1/blacklist/stats`

Get summary statistics about blacklist entries.

#### Response

```json
{
  "success": true,
  "data": {
    "totalEntries": 5,
    "byReason": {
      "QUOTA_EXCEEDED": 3,
      "IP_BLOCKED": 2
    },
    "byProvider": {
      "JT EXPRESS": 2,
      "USPS": 1,
      "VIETTEL POST": 2
    }
  }
}
```

---

### 3. Check If Provider Is Blacklisted

**GET** `/api/v1/blacklist/check`

Check if a specific provider/proxy is currently blacklisted.

#### Query Parameters

- `provider` (required): Provider name
- `proxyServer` (optional): Specific proxy server address

#### Example Request

```
GET /api/v1/blacklist/check?provider=JT EXPRESS&proxyServer=proxy.example.com:8080
```

#### Response

```json
{
  "success": true,
  "data": {
    "provider": "JT EXPRESS",
    "proxyServer": "proxy.example.com:8080",
    "isBlacklisted": true,
    "reason": "QUOTA_EXCEEDED",
    "timestamp": "2026-03-27T10:30:45.123Z",
    "code": "12345"
  }
}
```

---

### 4. Remove Entry From Blacklist

**POST** `/api/v1/blacklist/remove`

Manually remove a provider/proxy from the blacklist.

#### Request Body

```json
{
  "provider": "JT EXPRESS",
  "proxyServer": "proxy.example.com:8080"
}
```

#### Response

```json
{
  "success": true,
  "message": "Removed JT EXPRESS (proxy.example.com:8080) from blacklist"
}
```

---

### 5. Clear All Blacklist Entries

**POST** `/api/v1/blacklist/clear`

Clear all entries from the blacklist. Use with caution!

#### Response

```json
{
  "success": true,
  "message": "Cleared 5 entries from blacklist"
}
```

---

## Implementation Details

### Automatic Blacklisting

When the system detects a blocking issue during Aftership tracking:

1. The issue is logged with reason `QUOTA_EXCEEDED`
2. Provider and proxy information are recorded
3. The tracking code that triggered the issue is stored
4. Entry automatically expires after **1 hour**

### Blocking Issue Detection

Currently detected by:
- Presence of "Quota Exceeded" message on Aftership page
- (Can be extended to detect other blocking patterns)

### Integration with Tracking

The `aftershipTrackingShipment` function:
- Automatically adds entries when blocking is detected
- Closes the context/browser to prevent re-use
- Continues retry with a fresh context and different proxy

---

## Usage Examples

### Check Blocking Status

```bash
curl "http://localhost:3000/api/v1/blacklist/check?provider=JT%20EXPRESS"
```

### Get All Blacklisted Entries

```bash
curl "http://localhost:3000/api/v1/blacklist"
```

### Remove a Blocked Provider

```bash
curl -X POST "http://localhost:3000/api/v1/blacklist/remove" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "JT EXPRESS",
    "proxyServer": "proxy.example.com:8080"
  }'
```

### Get Statistics

```bash
curl "http://localhost:3000/api/v1/blacklist/stats"
```

---

## Configuration

### Blacklist Expiry Time

Current setting: **1 hour** (`BLACKLIST_EXPIRY_TIME = 60 * 60 * 1000`)

To modify, edit `src/helpers/blacklistManager.ts`:

```typescript
private readonly BLACKLIST_EXPIRY_TIME = 60 * 60 * 1000; // 1 hour
```

---

## Future Enhancements

1. **Persistent Storage**: Save blacklist to database (Redis, MongoDB)
2. **Auto-Recovery**: Automatically retry after expiry
3. **Alert System**: Notify admins of repeated blocking
4. **Provider-specific Rules**: Different expiry times per provider
5. **Manual Blocking**: Admin ability to pre-block problematic providers
