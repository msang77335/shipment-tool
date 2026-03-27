# Proxy Manager + Blacklist System Integration Guide

## Overview

The Proxy Manager and Blacklist System work together to automatically detect and handle problematic proxies:

1. **Blocking Detection**: When tracking encounters blocking issues (quota exceeded, IP blocked, rate limited), it's automatically recorded
2. **Auto-Blacklist**: Provider/proxy combination is added to the blacklist with expiry after 1 hour
3. **Management**: Use the Proxy Manager to remove blacklisted proxies or wait for auto-expiry
4. **Cleanup**: Optionally run cleanup to remove all currently blacklisted proxies

---

## Complete Workflow

### 1. Normal Operation

```
Request → Tracking → Success → Continue with same proxy
```

### 2. Blocking Issue Detected

```
Request → Tracking → Blocking detected
                   ↓
              Blacklist entry created
              (Provider + Proxy + Reason + Timestamp)
                   ↓
              Browser context closed
              Context pool cleared
                   ↓
              Retry with new context/proxy
```

### 3. Monitoring Blacklist

```bash
# Get current blacklist
curl http://localhost:3000/api/v1/blacklist

# Get proxy stats (including blacklisted count)
curl http://localhost:3000/api/v1/proxy/stats

# Get only blacklisted proxies
curl http://localhost:3000/api/v1/proxy/blacklisted
```

### 4. Cleanup Options

**Option A: Manual Removal (Immediate)**
```bash
# Remove all blacklisted proxies immediately
curl -X POST http://localhost:3000/api/v1/proxy/remove-blacklisted
```

**Option B: Auto-expiry (Wait)**
- Blacklist entries expire after **1 hour**
- Proxies can be reused after expiry
- No manual action required

**Option C: Remove Specific Proxy**
```bash
# Remove one specific proxy
curl -X DELETE "http://localhost:3000/api/v1/proxy/proxy.example.com%3A8080"
```

---

## API Call Examples

### Check Current System Status

```bash
# Get all proxies + stats
curl http://localhost:3000/api/v1/proxy

# Output:
{
  "success": true,
  "data": {
    "stats": {
      "total": 5,
      "blacklisted": 2,
      "active": 3
    },
    "proxies": [...]
  }
}
```

### View Blacklist Details

```bash
# Get full blacklist with reasons
curl http://localhost:3000/api/v1/blacklist

# Output shows each entry with:
# - Provider name
# - Proxy server
# - Reason (QUOTA_EXCEEDED, IP_BLOCKED, etc.)
# - Timestamp
# - Expires in (seconds)
```

### Get Blacklist Statistics

```bash
# Summary by reason and provider
curl http://localhost:3000/api/v1/blacklist/stats

# Output:
{
  "success": true,
  "data": {
    "totalEntries": 3,
    "byReason": {
      "QUOTA_EXCEEDED": 2,
      "IP_BLOCKED": 1
    },
    "byProvider": {
      "JT EXPRESS": 2,
      "USPS": 1
    }
  }
}
```

### Dynamic Proxy Management

```bash
# Add new replacement proxy
curl -X POST http://localhost:3000/api/v1/proxy \
  -H "Content-Type: application/json" \
  -d '{
    "server": "new-proxy.example.com:8080",
    "username": "user",
    "password": "pass"
  }'

# Remove problematic proxy
curl -X DELETE "http://localhost:3000/api/v1/proxy/bad-proxy.example.com%3A8080"

# Update proxy credentials
curl -X PUT "http://localhost:3000/api/v1/proxy/proxy.example.com%3A8080" \
  -H "Content-Type: application/json" \
  -d '{"password": "newpass"}'
```

---

## Real-World Scenarios

### Scenario 1: Quota Exceeded on One Proxy

```
1. Tracking attempt fails with "Quota Exceeded"
   ↓
2. Blacklist entry created:
   - Provider: "JT EXPRESS"
   - ProxyServer: "proxy1.example.com:8080"
   - Reason: "QUOTA_EXCEEDED"
   - Timestamp: 2026-03-27T10:30:45.123Z
   ↓
3. Browser context closed, next request uses different proxy
   ↓
4. You can check status:
   GET /api/v1/blacklist/check?provider=JT EXPRESS&proxyServer=proxy1.example.com:3A8080
   ↓
5. Either:
   a) Wait 1 hour for auto-expiry and retry with same proxy
   b) Remove immediately: DELETE /api/v1/proxy/proxy1.example.com%3A8080
   c) Add new proxy and remove bad one: POST /api/v1/proxy + DELETE old
```

### Scenario 2: Multiple Providers Affected by One Proxy

```
Proxy "proxy2.example.com:8080" has IP block:

Blacklist entries created:
✓ JT EXPRESS + proxy2.example.com:8080 → IP_BLOCKED
✓ USPS + proxy2.example.com:8080 → IP_BLOCKED
✓ VIETTEL POST + proxy2.example.com:8080 → IP_BLOCKED

Get stats:
GET /api/v1/proxy/stats
→ Shows: 1 blacklisted proxy (proxy2)

Solutions:
a) Remove that proxy immediately:
   DELETE /api/v1/proxy/proxy2.example.com%3A8080
   
b) Remove all blacklisted proxies at once:
   POST /api/v1/proxy/remove-blacklisted
   → Returns list of removed proxies
   → All providers now use different proxies
```

### Scenario 3: Monitoring and Cleanup Schedule

```bash
# Check system health (run periodically)
#!/bin/bash
curl -s http://localhost:3000/api/v1/proxy/stats | jq '.data'

# Output:
# {
#   "total": 10,
#   "blacklisted": 3,
#   "active": 7
# }

# If blacklisted count is high, cleanup:
curl -X POST http://localhost:3000/api/v1/proxy/remove-blacklisted

# Add replacement proxies:
curl -X POST http://localhost:3000/api/v1/proxy \
  -H "Content-Type: application/json" \
  -d '{"server": "new-proxy-1:8080"}'
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Tracking Request                          │
│  POST /api/v1/tracking?provider=JT EXPRESS&codes=123456    │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
        ┌─────────────────────┐
        │  Get Browser Context │
        │  (with proxy rotation)│
        └──────────┬──────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │   Navigate to URL    │
        │   & Get Page Content │
        └──────────┬───────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
     Success           Check for Blocking
        │              ┌──────────────────┐
        │              │ Quota Exceeded?  │
        │              │ IP Blocked?      │
        │              └────────┬─────────┘
        │                       │
        │                   Yes │ No
        │                       │
        │              ┌────────▼─────────┐
        │              │ Add to Blacklist │
        │              │ (expiry: 1 hour) │
        │              └────────┬─────────┘
        │                       │
        │              ┌────────▼──────────────────┐
        │              │ Close Browser Context    │
        │              │ Clear Context Pool       │
        │              │ Delete Browser Instance  │
        │              └────────┬─────────────────┘
        │                       │
        └───────────────┬───────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │  Ready for Next Request       │
        │  (rotates to different proxy) │
        └───────────────────────────────┘
```

---

## Monitoring & Alerting Ideas

### Monitor Using Cron (Example)

```bash
#!/bin/bash
# Check blacklist daily and alert if high

BLACKLIST_COUNT=$(curl -s http://localhost:3000/api/v1/blacklist \
  | jq '.data.totalEntries')

THRESHOLD=5

if [ "$BLACKLIST_COUNT" -gt "$THRESHOLD" ]; then
  echo "ALERT: $BLACKLIST_COUNT proxies blacklisted!"
  curl -s http://localhost:3000/api/v1/blacklist
  # Send email, Slack message, etc.
fi
```

### Auto-Cleanup Script

```bash
#!/bin/bash
# Run every 30 minutes to clean blacklisted proxies

BLACKLIST_COUNT=$(curl -s http://localhost:3000/api/v1/proxy/stats \
  | jq '.data.blacklisted')

if [ "$BLACKLIST_COUNT" -gt "0" ]; then
  echo "Removing $BLACKLIST_COUNT blacklisted proxies..."
  RESULT=$(curl -s -X POST http://localhost:3000/api/v1/proxy/remove-blacklisted)
  echo "$RESULT" | jq '.'
fi
```

---

## Configuration & Tuning

### Blacklist Expiry Time

**Current**: 1 hour (`BLACKLIST_EXPIRY_TIME = 60 * 60 * 1000`)

To adjust, edit `src/helpers/blacklistManager.ts`:

```typescript
// Increase to 2 hours for longer blocking isolation
private readonly BLACKLIST_EXPIRY_TIME = 2 * 60 * 60 * 1000;

// Decrease to 30 minutes for faster retry
private readonly BLACKLIST_EXPIRY_TIME = 30 * 60 * 1000;
```

### Proxy Pool Size

**Current**: Maximum 3 contexts per proxy

To adjust, edit `src/helpers/PlaywrightBrowserSingleton.ts`:

```typescript
// Increase concurrent contexts per proxy
private static readonly PROXY_MAX_CONTEXTS = 5; // was 3
```

---

## Best Practices

1. **Monitor Regularly**: Check blacklist and proxy stats daily
2. **Have Backup Proxies**: Keep 2-3x extra proxies as buffer
3. **Auto-cleanup**: Remove blacklisted proxies immediately rather than waiting
4. **Update Credentials**: Keep proxy auth current to avoid authentication blocks
5. **Test New Proxies**: Test added proxies before relying on them
6. **Log Events**: Track which proxies fail and why
7. **Analyze Patterns**: If specific proxies repeatedly fail, remove them permanently

---

## Troubleshooting

### Q: Why is my proxy blacklisted?

**A**: Check the reason:
```bash
curl http://localhost:3000/api/v1/blacklist | jq '.data.entries[].reason'
```

### Q: How do I know when a proxy will be usable again?

**A**: Check expiry time:
```bash
curl http://localhost:3000/api/v1/blacklist | jq '.data.entries[].expiresIn'
```

### Q: Can I use a blacklisted proxy before it expires?

**A**: Not recommended, but you can:
1. Remove it from blacklist manually: `POST /api/v1/blacklist/remove`
2. Or wait for auto-expiry
3. Or remove the proxy and re-add it fresh: `DELETE` then `POST`

### Q: What if all proxies get blacklisted?

**A**: Add new proxies immediately:
```bash
curl -X POST http://localhost:3000/api/v1/proxy \
  -d '{"server": "emergency-proxy:8080"}'
```
