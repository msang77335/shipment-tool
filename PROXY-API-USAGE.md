# Proxy Management API: Usage Guide

## Quick Start

### Base URL
```
http://localhost:3000/api/v1
```

### Common Operations

#### 1. Add a Proxy
```bash
curl -X POST http://localhost:3000/api/v1/proxy \
  -H "Content-Type: application/json" \
  -d '{
    "server": "proxy1.example.com:8080",
    "username": "user123",
    "password": "pass456",
    "bypass": "localhost,127.0.0.1"
  }'
```

#### 2. List All Proxies
```bash
curl http://localhost:3000/api/v1/proxy
```

#### 3. Remove a Proxy
```bash
curl -X DELETE http://localhost:3000/api/v1/proxy/proxy1.example.com%3A8080
```

#### 4. Get Pool Statistics
```bash
curl http://localhost:3000/api/v1/proxy/stats
```

---

## Proxy Management Endpoints

### Create Proxy

**Endpoint**: `POST /api/v1/proxy`

**Request Body**:
```json
{
  "server": "proxy1.example.com:8080",
  "username": "user123",
  "password": "pass456",
  "bypass": "localhost,127.0.0.1"
}
```

**Response (Success)**:
```json
{
  "success": true,
  "message": "Proxy added successfully",
  "data": {
    "server": "proxy1.example.com:8080",
    "username": "user123",
    "password": "****",
    "bypass": "localhost,127.0.0.1"
  }
}
```

**Response (Error)**:
```json
{
  "success": false,
  "message": "Proxy already exists"
}
```

---

### List All Proxies

**Endpoint**: `GET /api/v1/proxy`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "server": "proxy1.example.com:8080",
      "username": "user123",
      "password": "****",
      "bypass": "localhost,127.0.0.1"
    },
    {
      "server": "proxy2.example.com:8080",
      "username": "user456",
      "password": "****",
      "bypass": "localhost,127.0.0.1"
    }
  ]
}
```

---

### Get Pool Statistics

**Endpoint**: `GET /api/v1/proxy/stats`

**Response**:
```json
{
  "success": true,
  "data": {
    "total": 10,
    "active": 8,
    "blacklisted": 1,
    "graylist": 1,
    "activeProxies": [
      "proxy1.example.com:8080",
      "proxy2.example.com:8080",
      "proxy3.example.com:8080"
    ]
  }
}
```

---

### Update Proxy

**Endpoint**: `PUT /api/v1/proxy/:server`

**Request Body**:
```json
{
  "username": "newuser",
  "password": "newpass",
  "bypass": "localhost"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Proxy updated successfully"
}
```

---

### Remove Proxy

**Endpoint**: `DELETE /api/v1/proxy/:server`

**Response**:
```json
{
  "success": true,
  "message": "Proxy removed successfully"
}
```

---

### Check Proxy Availability

**Endpoint**: `GET /api/v1/proxy/check/:server`

**Response (Available)**:
```json
{
  "success": true,
  "data": {
    "server": "proxy1.example.com:8080",
    "exists": true,
    "isBlacklisted": false,
    "isInGraylist": false,
    "status": "active"
  }
}
```

**Response (Blacklisted)**:
```json
{
  "success": true,
  "data": {
    "server": "proxy1.example.com:8080",
    "exists": true,
    "isBlacklisted": true,
    "blacklistEntry": {
      "reason": "QUOTA_EXCEEDED",
      "since": "2026-03-27T10:30:00.000Z",
      "expiresAt": "2026-03-27T11:30:00.000Z"
    },
    "status": "blacklisted"
  }
}
```

---

## Blacklist Management Endpoints

### Get All Blacklist Entries

**Endpoint**: `GET /api/v1/proxy/blacklist`

**Response**:
```json
{
  "success": true,
  "data": {
    "totalEntries": 2,
    "entries": [
      {
        "provider": "JT EXPRESS",
        "proxyServer": "proxy1.example.com:8080",
        "reason": "QUOTA_EXCEEDED",
        "timestamp": "2026-03-27T10:30:00.000Z",
        "code": 403,
        "expiresIn": 3600000
      },
      {
        "provider": "USPS",
        "proxyServer": "proxy2.example.com:8080",
        "reason": "IP_BLOCKED",
        "timestamp": "2026-03-27T10:35:00.000Z",
        "code": 403,
        "expiresIn": 3598000
      }
    ]
  }
}
```

---

### Get Blacklist Statistics

**Endpoint**: `GET /api/v1/proxy/blacklist/stats`

**Response**:
```json
{
  "success": true,
  "data": {
    "totalEntries": 2,
    "byReason": {
      "QUOTA_EXCEEDED": 1,
      "IP_BLOCKED": 1,
      "RATE_LIMITED": 0
    },
    "byProvider": {
      "JT EXPRESS": {
        "count": 1,
        "proxyServers": ["proxy1.example.com:8080"]
      },
      "USPS": {
        "count": 1,
        "proxyServers": ["proxy2.example.com:8080"]
      }
    }
  }
}
```

---

### Check if Blacklisted

**Endpoint**: `GET /api/v1/proxy/blacklist/check?provider=JT EXPRESS&server=proxy1.example.com:8080`

**Response (Blacklisted)**:
```json
{
  "success": true,
  "data": {
    "isBlacklisted": true,
    "entry": {
      "provider": "JT EXPRESS",
      "proxyServer": "proxy1.example.com:8080",
      "reason": "QUOTA_EXCEEDED",
      "timestamp": "2026-03-27T10:30:00.000Z",
      "expiresAt": "2026-03-27T11:30:00.000Z"
    }
  }
}
```

**Response (Not Blacklisted)**:
```json
{
  "success": true,
  "data": {
    "isBlacklisted": false
  }
}
```

---

### Remove from Blacklist

**Endpoint**: `POST /api/v1/proxy/blacklist/remove`

**Request Body**:
```json
{
  "provider": "JT EXPRESS",
  "proxyServer": "proxy1.example.com:8080"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Removed JT EXPRESS from blacklist for proxy proxy1.example.com:8080"
}
```

---

### Clear All Blacklist

**Endpoint**: `POST /api/v1/proxy/blacklist/clear`

**Response**:
```json
{
  "success": true,
  "message": "Cleared 2 entries from blacklist"
}
```

---

## Gray List Management Endpoints

### Get All Gray List Entries

**Endpoint**: `GET /api/v1/proxy/graylist`

**Response**:
```json
{
  "success": true,
  "data": {
    "totalEntries": 3,
    "entries": [
      {
        "provider": "JT EXPRESS",
        "proxyServer": "proxy1.example.com:8080",
        "tries": 5,
        "reason": "NO_TRACKING_DATA",
        "lastAttempt": "2026-03-27T10:45:30.123Z"
      },
      {
        "provider": "USPS",
        "proxyServer": "proxy2.example.com:8080",
        "tries": 2,
        "reason": "NO_TRACKING_DATA",
        "lastAttempt": "2026-03-27T10:50:45.456Z"
      },
      {
        "provider": "DHL",
        "proxyServer": "proxy3.example.com:8080",
        "tries": 1,
        "reason": "NO_TRACKING_DATA",
        "lastAttempt": "2026-03-27T10:55:12.789Z"
      }
    ]
  }
}
```

---

### Get Gray List Statistics

**Endpoint**: `GET /api/v1/proxy/graylist/stats`

**Response**:
```json
{
  "success": true,
  "data": {
    "totalEntries": 3,
    "byProvider": {
      "JT EXPRESS": {
        "count": 1,
        "totalTries": 5
      },
      "USPS": {
        "count": 1,
        "totalTries": 2
      },
      "DHL": {
        "count": 1,
        "totalTries": 1
      }
    },
    "highestTries": {
      "provider": "JT EXPRESS",
      "proxyServer": "proxy1.example.com:8080",
      "tries": 5
    }
  }
}
```

---

### Remove from Gray List

**Endpoint**: `DELETE /api/v1/proxy/graylist/:proxyServer?provider=PROVIDER`

**Example**:
```bash
curl -X DELETE "http://localhost:3000/api/v1/proxy/graylist/proxy1.example.com%3A8080?provider=JT%20EXPRESS"
```

**Response**:
```json
{
  "success": true,
  "message": "Removed JT EXPRESS from gray list for proxy proxy1.example.com:8080"
}
```

---

### Clear All Gray List

**Endpoint**: `POST /api/v1/proxy/graylist/clear`

**Response**:
```json
{
  "success": true,
  "message": "Cleared 3 entries from gray list"
}
```

---

## Practical Examples

### Example 1: Monitor Unreliable Proxies

```bash
#!/bin/bash

echo "Getting gray list statistics..."
curl -s http://localhost:3000/api/v1/proxy/graylist/stats | jq '.'

# Output shows highest tries proxy
# {
#   "highestTries": {
#     "provider": "JT EXPRESS",
#     "proxyServer": "proxy1.example.com:8080",
#     "tries": 12
#   }
# }

# If tries > 10, consider removing
```

### Example 2: Remove Bad Proxies

```bash
#!/bin/bash

# Get all gray list entries with tries > 10
ENTRIES=$(curl -s http://localhost:3000/api/v1/proxy/graylist | \
  jq '.data.entries[] | select(.tries > 10)')

echo "$ENTRIES" | jq -r '. | 
  "curl -X DELETE http://localhost:3000/api/v1/proxy/graylist/\(.proxyServer | @uri)?provider=\(.provider | @uri)"' | sh

echo "Removed bad proxies"
```

### Example 3: Auto-Cleanup Script

```bash
#!/bin/bash

# Run every 6 hours
GRAYLIST=$(curl -s http://localhost:3000/api/v1/proxy/graylist)

# Remove entries with tries > 15
echo "$GRAYLIST" | jq -r '.data.entries[] | 
  select(.tries > 15) |
  "Removing: \(.provider) from \(.proxyServer) (tries: \(.tries))"'

echo "$GRAYLIST" | jq -r '.data.entries[] | 
  select(.tries > 15) |
  "\(.proxyServer)|\(.provider)"' | while IFS='|' read -r server provider; do
  curl -X DELETE "http://localhost:3000/api/v1/proxy/graylist/${server}?provider=${provider}"
done

echo "Cleanup complete"
```

### Example 4: Health Dashboard

```bash
#!/bin/bash

echo "=== PROXY POOL HEALTH DASHBOARD ==="
echo ""

echo "1. Pool Status:"
curl -s http://localhost:3000/api/v1/proxy/stats | jq '.data | {total, active, blacklisted, graylist}'

echo ""
echo "2. Blacklist Summary:"
curl -s http://localhost:3000/api/v1/proxy/blacklist/stats | jq '.data | {totalEntries, byReason}'

echo ""
echo "3. Gray List Summary:"
curl -s http://localhost:3000/api/v1/proxy/graylist/stats | jq '.data | {totalEntries, highestTries}'

echo ""
echo "=== END DASHBOARD ==="
```

### Example 5: Add Multiple Proxies

```bash
#!/bin/bash

PROXIES=(
  "proxy1.example.com:8080|user1|pass1"
  "proxy2.example.com:8080|user2|pass2"
  "proxy3.example.com:8080|user3|pass3"
)

for proxy in "${PROXIES[@]}"; do
  IFS='|' read -r server username password <<< "$proxy"
  
  curl -X POST http://localhost:3000/api/v1/proxy \
    -H "Content-Type: application/json" \
    -d "{
      \"server\": \"$server\",
      \"username\": \"$username\",
      \"password\": \"$password\",
      \"bypass\": \"localhost,127.0.0.1\"
    }"
  
  echo "Added: $server"
done
```

---

## Error Handling

### Common Errors

#### Proxy Already Exists
```json
{
  "success": false,
  "message": "Proxy already exists"
}
```

**Solution**: Update existing proxy or remove and re-add

#### Proxy Not Found
```json
{
  "success": false,
  "message": "Proxy not found"
}
```

**Solution**: Check proxy server name format (must include port)

#### Invalid Request Body
```json
{
  "success": false,
  "message": "Invalid request: server is required"
}
```

**Solution**: Ensure all required fields are provided

---

## Best Practices

### 1. Regular Monitoring
```bash
# Set up cron job to run every hour
0 * * * * /path/to/health-check.sh
```

### 2. Threshold-Based Actions
```bash
# Remove proxies with too many failures
if [ $tries -gt 15 ]; then
  DELETE /api/v1/proxy/graylist/:server
fi
```

### 3. Batch Operations
```bash
# Add proxies from file
while read line; do
  curl -X POST http://localhost:3000/api/v1/proxy -d "$line"
done < proxies.txt
```

### 4. Logging
```bash
# Log all operations
curl -X POST http://localhost:3000/api/v1/proxy 2>&1 | tee -a proxy.log
```

### 5. Backups
```bash
# Regular backup of proxy list
curl -s http://localhost:3000/api/v1/proxy > proxy-backup-$(date +%Y%m%d).json
```

---

## Response Time Expectations

| Operation | Typical Time |
|-----------|--------------|
| List proxies | 10-50ms |
| Add proxy | 20-100ms |
| Check status | 5-30ms |
| Get stats | 10-50ms |
| Remove proxy | 15-80ms |
| Query blacklist | 10-40ms |
| Query gray list | 10-40ms |

---

## Rate Limiting

Currently no rate limiting. For production, consider implementing:

```bash
# Recommended limits
- Max 100 requests/minute per IP
- Max 1000 requests/hour per IP
- Max 5 concurrent requests
```

---

## Version History

### v1.0.0 (Current)
- ✅ Proxy CRUD operations
- ✅ Blacklist management
- ✅ Gray list management
- ✅ Statistics and monitoring
- ✅ Auto-expiring blacklist entries
