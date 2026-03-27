# Proxy Manager API

## Overview

The Proxy Manager provides dynamic management of the proxy pool. You can add new proxies, remove proxies, and automatically remove proxies that are in the blacklist due to blocking issues.

### Features

- **Add Proxies**: Dynamically add new proxies to the pool
- **Remove Proxies**: Remove individual proxies and close their browser instances
- **Auto-remove Blacklisted**: Remove all proxies that are currently in the blacklist
- **Statistics**: Track proxy health and status
- **Updates**: Modify proxy credentials

---

## API Endpoints

### 1. Get All Proxies

**GET** `/api/v1/proxy`

Retrieve all currently active proxies with statistics.

#### Response

```json
{
  "success": true,
  "data": {
    "stats": {
      "total": 5,
      "blacklisted": 1,
      "active": 4
    },
    "proxies": [
      {
        "server": "proxy1.example.com:8080",
        "username": "user1",
        "password": "***",
        "bypass": "N/A"
      },
      {
        "server": "proxy2.example.com:8080",
        "username": "N/A",
        "password": "N/A",
        "bypass": "localhost,127.0.0.1"
      }
    ]
  }
}
```

---

### 2. Get Proxy Statistics

**GET** `/api/v1/proxy/stats`

Get summary statistics about proxies.

#### Response

```json
{
  "success": true,
  "data": {
    "total": 5,
    "blacklisted": 1,
    "active": 4
  }
}
```

---

### 3. Get Blacklisted Proxies

**GET** `/api/v1/proxy/blacklisted`

Get all proxies that are currently in the blacklist.

#### Response

```json
{
  "success": true,
  "data": {
    "count": 1,
    "proxies": [
      {
        "server": "proxy3.example.com:8080",
        "username": "user3"
      }
    ]
  }
}
```

---

### 4. Add a New Proxy

**POST** `/api/v1/proxy`

Add a new proxy to the pool.

#### Request Body

```json
{
  "server": "proxy4.example.com:8080",
  "username": "user4",
  "password": "pass4",
  "bypass": "localhost,127.0.0.1"
}
```

#### Response

```json
{
  "success": true,
  "message": "Proxy proxy4.example.com:8080 added successfully",
  "totalProxies": 6
}
```

#### Error Response

```json
{
  "success": false,
  "error": "Proxy proxy4.example.com:8080 already exists",
  "totalProxies": 5
}
```

---

### 5. Check If Proxy Exists

**GET** `/api/v1/proxy/check/:proxyServer`

Check if a specific proxy exists in the pool.

#### URL Parameter

- `:proxyServer` - Proxy server URL (URL encoded)

#### Example Request

```
GET /api/v1/proxy/check/proxy1.example.com%3A8080
```

#### Response

```json
{
  "success": true,
  "data": {
    "exists": true,
    "proxy": {
      "server": "proxy1.example.com:8080",
      "username": "user1"
    }
  }
}
```

---

### 6. Update a Proxy

**PUT** `/api/v1/proxy/:proxyServer`

Update proxy credentials.

#### URL Parameter

- `:proxyServer` - Proxy server URL (URL encoded)

#### Request Body

```json
{
  "username": "newuser",
  "password": "newpass",
  "bypass": "localhost"
}
```

#### Response

```json
{
  "success": true,
  "message": "Proxy proxy1.example.com:8080 updated successfully",
  "proxy": {
    "server": "proxy1.example.com:8080",
    "username": "newuser",
    "password": "***",
    "bypass": "localhost"
  }
}
```

---

### 7. Remove a Proxy

**DELETE** `/api/v1/proxy/:proxyServer`

Remove a proxy from the pool and close its browser instances.

#### URL Parameter

- `:proxyServer` - Proxy server URL (URL encoded)

#### Example Request

```
DELETE /api/v1/proxy/proxy1.example.com%3A8080
```

#### Response

```json
{
  "success": true,
  "message": "Proxy proxy1.example.com:8080 removed successfully",
  "totalProxies": 4
}
```

---

### 8. Remove All Blacklisted Proxies

**POST** `/api/v1/proxy/remove-blacklisted`

Remove all proxies that are currently in the blacklist. This is useful for cleaning up problematic proxies.

#### Response

```json
{
  "success": true,
  "message": "Removed 1 blacklisted proxies",
  "removed": [
    {
      "server": "proxy3.example.com:8080",
      "username": "user3"
    }
  ],
  "remainingProxies": 4
}
```

---

## Usage Examples

### Add a new proxy

```bash
curl -X POST "http://localhost:3000/api/v1/proxy" \
  -H "Content-Type: application/json" \
  -d '{
    "server": "proxy.example.com:8080",
    "username": "myuser",
    "password": "mypass"
  }'
```

### Get all proxies with statistics

```bash
curl "http://localhost:3000/api/v1/proxy"
```

### Get proxy statistics only

```bash
curl "http://localhost:3000/api/v1/proxy/stats"
```

### Check if proxy exists

```bash
curl "http://localhost:3000/api/v1/proxy/check/proxy.example.com%3A8080"
```

### Update proxy credentials

```bash
curl -X PUT "http://localhost:3000/api/v1/proxy/proxy.example.com%3A8080" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "password": "newpass"
  }'
```

### Remove a proxy

```bash
curl -X DELETE "http://localhost:3000/api/v1/proxy/proxy.example.com%3A8080"
```

### Remove all blacklisted proxies

```bash
curl -X POST "http://localhost:3000/api/v1/proxy/remove-blacklisted"
```

### Get blacklisted proxies

```bash
curl "http://localhost:3000/api/v1/proxy/blacklisted"
```

---

## Integration with Blacklist

### How It Works

1. **Automatic Tracking**: When a proxy encounters blocking issues (quota exceeded, IP blocked), it's added to the blacklist
2. **Visibility**: Use `/api/v1/proxy/blacklisted` to see which proxies have issues
3. **Cleanup**: Use `/api/v1/proxy/remove-blacklisted` to automatically remove problematic proxies
4. **Browser Cleanup**: When a proxy is removed, all its browser instances are closed

### Workflow Example

```
1. Proxy encounters blocking issue
   → Automatically added to blacklist

2. Check status
   GET /api/v1/proxy/stats
   → Shows 1 blacklisted proxy

3. Clean up
   POST /api/v1/proxy/remove-blacklisted
   → Removes blacklisted proxy and closes browser

4. Add replacement proxy
   POST /api/v1/proxy
   → New proxy added to pool
```

---

## URL Encoding

When using proxy server URLs in path parameters, they must be URL encoded:

| Character | Encoded |
|-----------|---------|
| `:` | `%3A` |
| `/` | `%2F` |
| `.` | `.` (no encoding) |

**Example**: `proxy.example.com:8080` → `proxy.example.com%3A8080`

---

## Error Codes

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 201 | Proxy created |
| 400 | Bad request (missing fields, duplicate proxy) |
| 404 | Proxy not found |
| 500 | Server error |

---

## Best Practices

1. **Monitor Blacklist**: Regularly check blacklisted proxies
2. **Auto-cleanup**: Run cleanup before proxy issues affect tracking
3. **Backup Pool**: Maintain multiple proxies for redundancy
4. **Update Credentials**: Keep proxy credentials current
5. **Check Status**: Use stats endpoint to monitor pool health

---

## Integration with Playwright Browser Manager

When a proxy is removed:
- All browser instances for that proxy are closed
- All context pools are cleared
- Browser state is reset
- New proxy connections can start fresh on next request
