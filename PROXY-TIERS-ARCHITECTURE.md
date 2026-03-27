# Proxy Management System: Three-Tier Architecture

## System Overview

The proxy management system categorizes proxies into three tiers based on their performance and failure modes:

```
┌─────────────────────────────────────────────────────────────────┐
│                    INCOMING REQUEST                             │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ↓
        ┌──────────────────────────────┐
        │  Load Balancer (Round-Robin) │
        └──────────────┬───────────────┘
                       │
        ┌──────────────┴──────────────┐
        ↓                             ↓
   ┌─────────┐               ┌──────────────┐
   │ ACTIVE  │               │  BLACKLIST?  │
   │ PROXIES │               │   (Check)    │
   └────┬────┘               └──────┬───────┘
        │                           │
        │                    ┌──────┴────────┐
        │                    │ YES: Skip node│
        │                    └────────┬──────┘
        │                             │
        │              ┌──────────────┘
        │              ↓
        │      ┌───────────────────┐
        └─────►│ Use Active Proxy  │
               └─────────┬─────────┘
                         │
                         ↓
              ┌──────────────────────┐
              │ Check Blocking Issue │
              │ (Captcha, Quota, IP) │
              └──────────┬───────────┘
                    ┌────┴────┐
                   YES        NO
                    │         │
              ┌─────▼──┐  ┌───▼────────────┐
              │BLACKLIST│  │Check Tracking  │
              │ (1 hour)│  │Data Found?     │
              └─────────┘  └───┬────────────┘
                              ┌┴───┐
                             YES    NO
                              │     │
                         ┌────▼─┐ ┌┴──────────┐
                         │Return│ │GRAY LIST  │
                         │Data  │ │(Persistent)
                         └──────┘ └───┬──────┘
                                      │
                                      ↓
                                  Retry with
                                  next proxy
```

---

## Tier 1: Active Proxies

### Characteristics
- ✅ Successfully returning tracking data
- ✅ No blocking issues detected
- ✅ No timeout/connection issues
- ✅ Actively used in rotation

### Identification
```json
GET /api/v1/proxy/stats

{
  "total": 10,
  "active": 8,
  "blacklisted": 1,
  "graylist": 1
}
```

### Behavior
- Used as primary proxy pool for requests
- Round-robin rotation starts from first active proxy
- Immediately return tracking data when successful
- Move to next proxy only on failure

### Example
```bash
Request #1: proxy1.example.com:8080 → Returns tracking data ✅
Request #2: proxy2.example.com:8080 → Returns tracking data ✅
Request #3: proxy3.example.com:8080 → Returns tracking data ✅
```

---

## Tier 2: Blacklist

### Characteristics
- ❌ Confirmed blocking issue
- ❌ IP been blocked by tracker
- ❌ Quota exceeded
- ❌ Rate limited
- ⏱️ Auto-expires after 1 hour

### Triggers
```javascript
// These conditions add proxy to blacklist
- Quota Exceeded message detected
- IP Blocked message detected  
- Rate Limited message detected
- 403 Forbidden from tracker site
```

### Blacklist Entry Structure
```typescript
{
  provider: "JT EXPRESS",
  proxyServer: "proxy1.example.com:8080",
  reason: "QUOTA_EXCEEDED" | "IP_BLOCKED" | "RATE_LIMITED" | "OTHER",
  timestamp: "2026-03-27T10:30:00.000Z",
  code?: 403,
  expiresIn: 3600000  // 1 hour in milliseconds
}
```

### API Management

**View all blacklisted entries**
```bash
curl http://localhost:3000/api/v1/proxy/blacklist
```

**Get blacklist statistics**
```bash
curl http://localhost:3000/api/v1/proxy/blacklist/stats
```

**Remove from blacklist manually**
```bash
curl -X POST http://localhost:3000/api/v1/proxy/blacklist/remove \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "JT EXPRESS",
    "proxyServer": "proxy1.example.com:8080"
  }'
```

**Clear all blacklist entries**
```bash
curl -X POST http://localhost:3000/api/v1/proxy/blacklist/clear
```

### Behavior Flow
```
1. Detect blocking issue
2. Add to blacklist with reason + code
3. Close browser context for that proxy
4. Skip this proxy for next 1 hour
5. After 1 hour: Automatically removed, becomes active again
6. Return null (tracking failed)
```

### Example Timeline
```
10:30:00 → proxy1.com blocked (quota exceeded)
           → Added to blacklist, expires at 11:30:00
10:31:00 → Request for same provider: skip proxy1.com
10:35:00 → Request for same provider: skip proxy1.com
11:30:00 → Blacklist entry expires
11:31:00 → proxy1.com is active again
```

---

## Tier 3: Gray List

### Characteristics
- ⚠️ No tracking data found
- ⚠️ No blocking issue detected
- ⚠️ Proxy working, but tracker has no shipment info
- 📊 Tracks number of attempts (tries)
- ♻️ Persists until manually removed

### Triggers
```javascript
// This condition adds proxy to gray list
- No captcha/blocking issue detected AND
- No tracking data found on tracker site
```

### Gray List Entry Structure
```typescript
{
  provider: "JT EXPRESS",
  proxyServer: "proxy1.example.com:8080",
  tries: 5,  // Incremented on each no-data attempt
  reason: "NO_TRACKING_DATA",
  lastAttempt: "2026-03-27T10:45:30.123Z"
}
```

### API Management

**View all gray list entries**
```bash
curl http://localhost:3000/api/v1/proxy/graylist
```

**Get gray list statistics**
```bash
curl http://localhost:3000/api/v1/proxy/graylist/stats
```

**Remove specific entry from gray list**
```bash
curl -X DELETE "http://localhost:3000/api/v1/proxy/graylist/proxy1.example.com%3A8080?provider=JT%20EXPRESS"
```

**Clear all gray list entries**
```bash
curl -X POST http://localhost:3000/api/v1/proxy/graylist/clear
```

### Behavior Flow
```
1. No blocking issue detected
2. No tracking data found
3. Add to gray list (or increment tries if exists)
4. Update lastAttempt timestamp
5. DO NOT close browser context
6. Return null and retry with next proxy
7. Entry persists in gray list
```

### Example Timeline
```
10:30:00 → Attempt 1: No data found → Add to gray list (tries=1)
10:35:00 → Attempt 2: Same provider, no data → Increment tries=2
10:40:00 → Attempt 3: Same provider, no data → Increment tries=3
...
11:15:00 → Attempt 8: Same provider, no data → tries=8
          → Proxy shows pattern of unreliability
```

### Usage Pattern: Monitoring Unreliable Proxies
```bash
# Get all gray list entries with sorting by tries
curl http://localhost:3000/api/v1/proxy/graylist | \
  jq '.data.entries | sort_by(.tries) | reverse'

# Output:
# [
#   {"provider": "JT EXPRESS", "tries": 12, ...},
#   {"provider": "USPS", "tries": 5, ...},
#   {"provider": "DHL", "tries": 3, ...}
# ]

# Decision logic:
# tries > 10 → Consider removing proxy
# tries > 5  → Monitor closely
# tries < 5  → Keep and monitor
```

---

## Comparison Matrix

| Aspect | Active | Blacklist | Gray List |
|--------|--------|-----------|-----------|
| **Return Data** | ✅ Yes | ❌ No | ❌ No |
| **Issue Type** | None | Blocking | Silent |
| **Auto-Expires** | N/A | ✅ Yes (1h) | ❌ No |
| **Browser Context** | Keep alive | Close | Keep alive |
| **Action** | Use | Skip & retry | Retry |
| **Tries Counter** | N/A | 1 entry | Incremented |
| **Use Case** | Production | Protect pool | Monitor |
| **Manual Removal** | Yes | Yes | Yes |
| **API Visibility** | Yes | Yes | Yes |

---

## Request Flow Examples

### Scenario 1: Successful Tracking (Active)
```
✅ All green:
Request → Active proxy → Load page → Data found → Return buffer
          ↓
        Stays ACTIVE
```

### Scenario 2: IP Blocked (Blacklist)
```
❌ Blocking detected:
Request → Active proxy → Load page → "IP Blocked" detected
          ↓
        Add to BLACKLIST (1 hour)
        ↓
        Next request → Skip this proxy
```

### Scenario 3: Shipment Not Found (Gray List)
```
⚠️ No data but working:
Request → Active proxy → Load page → No blocking, but no data found
          ↓
        Add to GRAY LIST (tries++)
        ↓
        Continue retrying with next proxy
        ↓
        Keep tries count for monitoring
```

---

## Decision Tree

```
START: New request for tracking data
│
├─ Proxy blacklisted?
│  ├─ YES → SKIP (use next proxy)
│  └─ NO → PROCEED
│
├─ Load page with proxy
│
├─ Blocking issue detected (captcha/quota/IP)?
│  ├─ YES → ADD TO BLACKLIST (1 hour)
│  │         Close context
│  │         Return NULL
│  │         END
│  └─ NO → PROCEED
│
├─ Tracking data found?
│  ├─ YES → RETURN DATA
│  │         Keep proxy ACTIVE
│  │         END
│  └─ NO → PROCEED
│
└─ ADD TO GRAY LIST
   (tries++)
   Keep context alive
   Return NULL
   Retry with next proxy
   END
```

---

## Monitoring and Maintenance

### Daily Health Check
```bash
#!/bin/bash

echo "=== PROXY POOL HEALTH CHECK ==="

# Check stats
echo "Pool Status:"
curl -s http://localhost:3000/api/v1/proxy/stats

# Check blacklist
echo "Blacklisted proxies:"
curl -s http://localhost:3000/api/v1/proxy/blacklist/stats

# Check gray list
echo "Unreliable proxies:"
curl -s http://localhost:3000/api/v1/proxy/graylist/stats
```

### Decision Rules
```
IF blacklist.size > pool.size * 0.3
  → Warn: More than 30% blacklisted
  → Action: Check proxy provider status

IF graylist.entries.tries.max > 15
  → Warn: High failure proxy detected
  → Action: Consider removing proxy

IF graylist.byProvider.JT_EXPRESS.count > 5
  → Warn: Provider issue detected
  → Action: Investigate JT EXPRESS service
```

### Cleanup Strategy
```
Every 6 hours:
1. Get gray list stats
2. Remove entries with tries > 20
3. Log removed proxies
4. Send notification

Every midnight:
1. Get all blacklist entries (already auto-expire)
2. Verify no infinite loops
3. Generate report on most-blocked proxies
4. Alert on pattern changes
```

---

## Implementation in Code

### ProxyManager Class
```typescript
// Tier management
class ProxyManager {
  // Active proxies
  private proxies: Map<string, ProxyInfo>;
  
  // Blacklist (1 hour expiry)
  private blacklist: Map<string, BlacklistEntry>;
  
  // Gray List (persistent)
  private graylist: Map<string, GrayListEntry>;
  
  // Get next active proxy
  getProxies() { return [...this.proxies.values()]; }
  
  // Check if blacklisted
  isBlacklisted(provider, proxyServer) { ... }
  
  // Add to gray list
  addToGrayList({provider, proxyServer, reason}) { ... }
}
```

### Browser Singleton Integration
```typescript
class PlaywrightBrowserSingleton {
  async getOrCreateBrowserForProxy(proxyInfo) {
    // Check if proxy is blacklisted
    if (proxyManager.isBlacklisted(provider, proxyServer)) {
      return null; // Skip blacklisted proxy
    }
    
    // Create browser with active proxy
    return this.createBrowser(proxyInfo);
  }
}
```

### Tracking Integration
```typescript
// aftershipTrackingShipment.ts
async function attemptScreenshot() {
  const hasBlockingIssue = checkBlockingIssue(page);
  if (hasBlockingIssue) {
    // Tier 2: Add to BLACKLIST
    proxyManager.addToBlacklist({...});
    return null;
  }
  
  const hasTrackingData = checkTrackingData(page);
  if (hasTrackingData) {
    // Tier 1: Stay ACTIVE
    return { buffer, status };
  }
  
  // Tier 3: Add to GRAY LIST
  proxyManager.addToGrayList({...});
  return null;
}
```

---

## Summary

The three-tier system provides:

1. **Active Tier** → Production usage, successful tracking
2. **Blacklist Tier** → Protection from confirmed blocks (1h auto-removal)
3. **Gray List Tier** → Observability of unreliable proxies (persistent)

This architecture enables:
- ✅ Automatic failure categorization
- ✅ Smart retry strategies
- ✅ Proxy health monitoring
- ✅ Manual management via API
- ✅ Pattern detection for optimization
