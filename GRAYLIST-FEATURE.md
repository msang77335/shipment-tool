# Gray List Feature

## Overview

The Gray List tracks proxies that fail to return tracking data without being blocked (no captcha issue, no IP block, etc.). This helps identify proxies that are unreliable for tracking but not necessarily blocked.

### Gray List vs Blacklist

| Feature | Gray List | Blacklist |
|---------|-----------|-----------|
| **Trigger** | No tracking data found | Blocking issue detected |
| **Auto-expires** | No (persists) | Yes (1 hour) |
| **Tries** | Incremented each time | Single entry |
| **Action** | Send retry to other proxy | Close context & blacklist proxy |
| **Use case** | Monitor unreliable proxies | Block problematic proxies |

---

## How It Works

### Detection Flow

```
Aftership Request
        ↓
Check for blocking issue (captcha)
        ↓
    ┌───┴───┐
   Yes      No
    │        │
   Close    Check for tracking data
   Close     │
   & Add to  ┌───┴────┐
   Blacklist │        │
            Yes       No
             │        │
          Return   Add to Gray List
          Data    & Retry with other
                  proxy
```

### When Entry Added to Gray List

**Condition**: No blocking issue (captcha) AND no tracking data found

**Action**: 
1. Add provider + proxy to gray list
2. Increment tries counter
3. Retry request with different proxy
4. Don't close browser context

---

## API Endpoints

### 1. Get All Gray List Entries

**GET** `/api/v1/proxy/graylist`

Returns all proxies that failed to find tracking data.

#### Response

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
      }
    ]
  }
}
```

---

### 2. Get Gray List Statistics

**GET** `/api/v1/proxy/graylist/stats`

Get summary statistics about gray list entries.

#### Response

```json
{
  "success": true,
  "data": {
    "totalEntries": 3,
    "byProvider": {
      "JT EXPRESS": {
        "count": 2,
        "totalTries": 7
      },
      "USPS": {
        "count": 1,
        "totalTries": 2
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

### 3. Remove Entry from Gray List

**DELETE** `/api/v1/proxy/graylist/:proxyServer?provider=PROVIDER`

Remove a specific entry from gray list.

#### Request

```
DELETE /api/v1/proxy/graylist/proxy1.example.com%3A8080?provider=JT%20EXPRESS
```

#### Response

```json
{
  "success": true,
  "message": "Removed JT EXPRESS from gray list for proxy proxy1.example.com:8080"
}
```

---

### 4. Clear All Gray List Entries

**POST** `/api/v1/proxy/graylist/clear`

Clear entire gray list.

#### Response

```json
{
  "success": true,
  "message": "Cleared 3 entries from gray list"
}
```

---

## Usage Examples

### View all unreliable proxies

```bash
curl http://localhost:3000/api/v1/proxy/graylist
```

### Get statistics

```bash
curl http://localhost:3000/api/v1/proxy/graylist/stats
```

### Remove problematic proxy from gray list

```bash
curl -X DELETE "http://localhost:3000/api/v1/proxy/graylist/proxy1.example.com%3A8080?provider=JT%20EXPRESS"
```

### Clear all gray list entries

```bash
curl -X POST http://localhost:3000/api/v1/proxy/graylist/clear
```

---

## Use Cases

### 1. Monitor Unreliable Proxies

Check gray list stats to find proxies with high failure rates:
```bash
curl http://localhost:3000/api/v1/proxy/graylist/stats | jq '.data.highestTries'

# Output:
# {
#   "provider": "JT EXPRESS",
#   "proxyServer": "proxy1.example.com:8080",
#   "tries": 15
# }
```

### 2. Identify Problem Proxies Before Blacklisting

Gray list entries with `tries > 10` might be candidates for removal:
```bash
curl http://localhost:3000/api/v1/proxy/graylist | jq '.data.entries[] | select(.tries > 10)'
```

### 3. Track Provider Reliability

Check which providers have the most failures:
```bash
curl http://localhost:3000/api/v1/proxy/graylist/stats | jq '.data.byProvider'
```

---

## Workflow Example

### Scenario: Tracking Request with No Data

```
1. POST /api/v1/tracking?provider=JT EXPRESS&codes=123456
   ↓
2. Browser loads aftership.com
   ↓
3. Check: Is there Quota Exceeded message?
   → NO (no blocking issue)
   ↓
4. Check: Is there tracking data?
   → NO (no shipment found)
   ↓
5. Add to gray list:
   - provider: "JT EXPRESS"
   - proxyServer: "proxy1.example.com:8080"
   - tries: 1 (increments on next attempt)
   - reason: "NO_TRACKING_DATA"
   ↓
6. Retry with different proxy (next round-robin)
   ↓
7. On subsequent attempts with same provider + proxy:
   - Move to next proxy in rotation
   - Gray list tries incremented (2, 3, 4, etc.)
   - No context close, just keep retrying
```

---

## Monitoring Strategy

### Daily Check

```bash
#!/bin/bash
# Check for high-fail proxies

TRIES_THRESHOLD=10

curl -s http://localhost:3000/api/v1/proxy/graylist | \
  jq ".data.entries[] | select(.tries > $TRIES_THRESHOLD)" | \
  jq -s '.'

# If results found:
# - Consider removing these proxies
# - Or investigate why they're failing
# - Check network connectivity
# - Check proxy provider status
```

### Remove Bad Proxies

```bash
#!/bin/bash
# Remove proxies with more than 15 failures

curl -s http://localhost:3000/api/v1/proxy/graylist | \
  jq -r '.data.entries[] | select(.tries > 15) | 
          "\(.proxyServer) \(.provider)"' | \
  while read proxy provider; do
    echo "Removing: $provider from $proxy"
    curl -X DELETE "http://localhost:3000/api/v1/proxy/graylist/${proxy}?provider=${provider}"
  done
```

---

## Integration with Aftership Tracking

In [aftershipTrackingShipment.ts](src/helpers/trackingShipment/aftershipTrackingShipment.ts):

```typescript
async function attemptScreenshot({ page, codes, provider, ... }) {
  // Check for blocking issues
  const hasBlockingIssue = await checkForQuotaOrBlockingIssues(page);
  if (hasBlockingIssue) {
    // → Add to BLACKLIST
    proxyManager.addToBlacklist({...});
    return null;
  }

  // Check for tracking data
  const hasTrackingData = await checkTrackingData(page);
  if (hasTrackingData) {
    // → Return data
    return { buffer, status };
  }

  // No blocking + No data → Add to GRAY LIST
  console.log(`⚠️ No tracking data found`);
  proxyManager.addToGrayList({
    provider,
    proxyServer: currentProxyServer,
    reason: 'NO_TRACKING_DATA'
  });

  return null; // Retry with different proxy
}
```

---

## Key Differences from Blacklist

### Blacklist
- ✅ Blocking issue (quota exceeded, IP block)
- ✅ Expires after 1 hour
- ✅ Close browser context immediately
- ✅ Force new proxy for next request

### Gray List
- ✅ No tracking data found
- ✅ Persists (no auto-expiry)
- ⊘ Keep browser context alive
- ✅ Continue with next proxy in rotation
- ✅ Tracks number of failures

---

## Best Practices

1. **Regular Monitoring**: Check gray list stats daily
2. **Threshold-based Removal**: Remove proxies after `tries > 15`
3. **Provider Analysis**: Use `byProvider` stats to identify weak providers
4. **Cleanup Schedule**: Clear entries after fixing issues
5. **Alert on High Fails**: Notify when `highestTries > 20`

---

## Future Enhancements

1. **Config Threshold**: Auto-remove after N failures
2. **Time-based Cleanup**: Clear entries older than 7 days
3. **Provider Alerts**: Alert when provider has N% failure rate
4. **Pattern Detection**: Identify time-based failures
5. **Remediation**: Auto-disable underperforming proxies
