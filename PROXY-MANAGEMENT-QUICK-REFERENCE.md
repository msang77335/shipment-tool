# Proxy Management System - Quick Reference

## What is This?

A three-tier proxy management system that automatically categorizes proxies based on their performance:

1. **ACTIVE** → Working proxies returning tracking data
2. **BLACKLIST** → Blocked proxies (auto-expires in 1 hour)
3. **GRAY LIST** → Unreliable proxies (persists, for monitoring)

---

## Key Files

| File | Purpose |
|------|---------|
| [src/helpers/proxyManager.ts](src/helpers/proxyManager.ts) | Core proxy pool + blacklist + gray list logic |
| [src/routes/proxyRoutes.ts](src/routes/proxyRoutes.ts) | All API endpoints (20+) |
| [src/helpers/trackingShipment/aftershipTrackingShipment.ts](src/helpers/trackingShipment/aftershipTrackingShipment.ts) | Integration point (uses proxyManager) |
| [src/helpers/PlaywrightBrowserSingleton.ts](src/helpers/PlaywrightBrowserSingleton.ts) | Uses dynamic proxies from proxyManager |

---

## API Quick Commands

### Proxy Management
```bash
# Add proxy
POST /api/v1/proxy → {server, username, password, bypass}

# List all
GET /api/v1/proxy

# Get stats
GET /api/v1/proxy/stats

# Remove
DELETE /api/v1/proxy/:server

# Update
PUT /api/v1/proxy/:server


# Check if exists/blacklisted/graylisted
GET /api/v1/proxy/check/:server
```

### Blacklist Management
```bash
# View all
GET /api/v1/proxy/blacklist

# Get stats (by reason, by provider)
GET /api/v1/proxy/blacklist/stats

# Check if blacklisted
GET /api/v1/proxy/blacklist/check?provider=X&server=Y

# Remove entry manually
POST /api/v1/proxy/blacklist/remove

# Clear all
POST /api/v1/proxy/blacklist/clear
```

### Gray List Management
```bash
# View all entries (with tries counter)
GET /api/v1/proxy/graylist

# Get stats (totalEntries, byProvider, highestTries)
GET /api/v1/proxy/graylist/stats

# Remove entry
DELETE /api/v1/proxy/graylist/:server?provider=X

# Clear all
POST /api/v1/proxy/graylist/clear
```

---

## How It Works

### Request Flow
```
1. Check if proxy blacklisted
   YES → Skip to next proxy
   NO  → Continue

2. Load tracking page with proxy

3. Check for blocking issue (captcha/quota/IP block)
   YES → Add to BLACKLIST (1 hour)
   NO  → Continue

4. Check for tracking data
   YES → Return data (stay ACTIVE)
   NO  → Add to GRAY LIST & retry
```

### Example Timeline
```
10:30 → Request with proxy1
        No blocking, no data
        → Add to gray list (tries=1)

10:35 → Request with proxy1 again
        No blocking, no data
        → Increment to gray list (tries=2)

10:40 → Request with proxy2 (rotation)
        Quota exceeded error
        → Add to BLACKLIST (expires 11:40)

10:45 → Gray list: proxy1 has tries=2
        Blacklist: proxy2 expires in 55 min
        Active: 8 proxies ready
```

---

## Monitoring Examples

### Get Pool Health
```bash
curl http://localhost:3000/api/v1/proxy/stats
# Shows: total, active, blacklisted, graylist counts
```

### Find Bad Proxies
```bash
curl http://localhost:3000/api/v1/proxy/graylist/stats | jq '.data.highestTries'
# Shows proxy with most failures
```

### Remove Unreliable Proxies
```bash
# Remove proxies with tries > 10
curl http://localhost:3000/api/v1/proxy/graylist | \
  jq '.data.entries[] | select(.tries > 10) | .proxyServer'
```

---

## Code Integration Points

### In Your Tracking Code
```typescript
// aftershipTrackingShipment.ts

if (!hasBlockingIssue && !hasTrackingData) {
  // Automatically added to gray list
  proxyManager.addToGrayList({
    provider,
    proxyServer: currentProxyServer,
    reason: 'NO_TRACKING_DATA'
  });
}
```

### In Browser Manager
```typescript
// PlaywrightBrowserSingleton.ts

// Proxies now dynamically loaded from proxyManager
const proxies = proxyManager.getAllProxies();
const proxy = proxies[index];
```

---

## Decision Rules

### When to Remove Proxy?

| Scenario | Action |
|----------|--------|
| Gray list tries > 15 | Remove from pool |
| Blacklist reason = QUOTA_EXCEEDED | Monitor, maybe remove |
| Blacklist reason = IP_BLOCKED | Remove after 2nd block |
| Active for 24h+ with 0 issues | Keep |
| Provider has > 50% gray list rate | Investigate provider |

---

## Useful Scripts

### Monitor in Real-Time
```bash
while true; do
  clear
  echo "=== PROXY POOL STATUS ==="
  curl -s http://localhost:3000/api/v1/proxy/stats | jq '.data'
  echo ""
  echo "=== BLACKLIST ==="
  curl -s http://localhost:3000/api/v1/proxy/blacklist/stats | jq '.data'
  echo ""
  echo "=== GRAY LIST ==="
  curl -s http://localhost:3000/api/v1/proxy/graylist/stats | jq '.data'
  sleep 10
done
```

### Auto-Cleanup bad proxies
```bash
# Run every 6 hours
curl -s http://localhost:3000/api/v1/proxy/graylist | \
  jq -r '.data.entries[] | select(.tries > 15) | 
          "\(.proxyServer)|\(.provider)"' | \
  while IFS='|' read -r server provider; do
    curl -X DELETE "http://localhost:3000/api/v1/proxy/graylist/${server}?provider=${provider}"
    echo "Removed $provider from $server"
  done
```

---

## Common Questions

### Q: Why doesn't gray list auto-expire?
A: Because we want to observe patterns of unreliability, not automatically remove proxies. You decide when to remove based on tries count.

### Q: What's the difference between gray list and blacklist?
A: Blacklist = confirmed blocking (auto-expire 1h). Gray list = no data but working (persistent, for monitoring).

### Q: How do I know which proxy to remove?
A: Check gray list stats, remove those with tries > 15. Or use API to monitor them.

### Q: Can I manually remove from gray list?
A: Yes! DELETE /api/v1/proxy/graylist/:server?provider=X

### Q: Does gray list slow down requests?
A: No, it only tracks stats. Requests still timeout normally and move to next proxy.

---

## Statistics Explained

### GET /api/v1/proxy/stats Response
```json
{
  "total": 10,           // Total proxies in pool
  "active": 8,           // Working proxies
  "blacklisted": 1,      // Currently blocked (will expire)
  "graylist": 1          // Unreliable (for monitoring)
}
```

### GET /api/v1/proxy/graylist/stats Response
```json
{
  "totalEntries": 3,     // How many proxies in gray list
  "byProvider": {        // Breakdown by carrier
    "JT EXPRESS": {
      "count": 2,        // 2 proxies for JT EXPRESS
      "totalTries": 7    // Combined 7 failures
    }
  },
  "highestTries": {      // Most problematic proxy
    "provider": "JT EXPRESS",
    "proxyServer": "proxy1.com:8080",
    "tries": 5           // Failed 5 times
  }
}
```

---

## Troubleshooting

### Proxy always in gray list?
1. Check if proxy is working: `curl -x http://proxy1.com:8080 http://example.com`
2. Check if tracker site is down: Visit manually
3. Check network issues: Review logs

### Blacklist keeps growing?
1. Check proxy quality: Test with curl
2. Check tracker API status: Contact provider
3. Monitor provider load: May need more proxies

### High gray list numbers?
1. Carrier may have changed website structure
2. Tracking codes may be invalid
3. Proxies may be rate-limited (not blocked, just slow)

---

## Production Checklist

- [ ] Load at least 5 proxies into pool
- [ ] Set up monitoring script (run every hour)
- [ ] Define removal threshold (tries > 15)
- [ ] Set up alerting if gray list > 30% of pool
- [ ] Backup proxy list daily
- [ ] Review logs weekly
- [ ] Monitor provider status (contact if high failures)
- [ ] Have rotation plan if provider unhealthy

---

## Architecture Diagram

```
        Request for Tracking
              │
              ▼
    Is proxy blacklisted?
      ├─ YES → Skip (use next)
      └─ NO ──┐
               │
               ▼
        Try to load page
               │
      ┌────────┴────────┐
      │                 │
   BLOCKS?             DATA?
      │                 │
     YES                YES ─── Return data (ACTIVE)
      │                 │
      ▼                NO
     Add to         
   BLACKLIST        Add to
  (1 hour)         GRAY LIST
          └────────┬────────┘
                   │
                   ▼
              Retry with
              next proxy
```

---

## Documentation Files

- [GRAYLIST-FEATURE.md](GRAYLIST-FEATURE.md) - Detailed gray list docs
- [PROXY-TIERS-ARCHITECTURE.md](PROXY-TIERS-ARCHITECTURE.md) - Three-tier system explained
- [PROXY-API-USAGE.md](PROXY-API-USAGE.md) - Complete API reference
- [API-KEY-AUTHENTICATION.md](API-KEY-AUTHENTICATION.md) - Auth setup
- [DOCKER.md](DOCKER.md) - Docker deployment

---

## Quick Status Check

```bash
# One command to see everything
(
  echo "=== POOL ===";
  curl -s http://localhost:3000/api/v1/proxy/stats | jq '.data | to_entries[] | "\(.key): \(.value)"';
  echo "";
  echo "=== BLACKLIST ===";
  curl -s http://localhost:3000/api/v1/proxy/blacklist/stats | jq '.data | "entries: \(.totalEntries)"';
  echo "";
  echo "=== GRAYLIST ===";
  curl -s http://localhost:3000/api/v1/proxy/graylist/stats | jq '.data | "entries: \(.totalEntries), worst: \(.highestTries.tries)"'
)
```

---

## Summary

✅ **Automatic categorization** of proxy health
✅ **API-driven** proxy management
✅ **Observable metrics** for decision making
✅ **Auto-expiring blacklist** for confirmed blocks
✅ **Persistent gray list** for monitoring unreliability

**Result**: Production-grade proxy rotation with health tracking and manual control.
