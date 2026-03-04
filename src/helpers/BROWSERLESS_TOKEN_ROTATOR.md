# Browserless Token Rotator

## Overview
Helper utility for managing multiple Browserless API tokens with automatic round-robin rotation for load balancing and rate limit distribution.

## Features

- ✅ **Multiple Token Support** - Use comma-separated tokens
- 🔄 **Round-Robin Rotation** - Automatic load balancing
- 📊 **Token Monitoring** - Track usage and availability
- 🛡️ **Error Handling** - Graceful fallback if no tokens
- 🎯 **Singleton Pattern** - Single shared instance
- 📝 **TypeScript Support** - Full type safety

## Configuration

### Single Token
```env
BROWSERLESS_API_TOKEN=your_token_here
```

### Multiple Tokens (Round-Robin)
```env
BROWSERLESS_API_TOKEN=token1,token2,token3
```

Spaces are automatically trimmed:
```env
BROWSERLESS_API_TOKEN=token1, token2, token3
```

## Usage

### Basic Usage

```typescript
import { getNextBrowserlessToken } from '@/helpers';

// Get next token (automatically rotates)
const token = getNextBrowserlessToken();

if (token) {
  const url = `https://production-sfo.browserless.io/chromium/bql?token=${token}`;
  // Make your API call
}
```

### Check Availability

```typescript
import { hasBrowserlessTokens, getBrowserlessTokenCount } from '@/helpers';

if (hasBrowserlessTokens()) {
  console.log(`Using ${getBrowserlessTokenCount()} token(s)`);
} else {
  console.error('No tokens configured');
}
```

### In API Routes

```typescript
import { getNextBrowserlessToken } from '@/helpers';

export async function screenshotHandler(req, res) {
  const token = getNextBrowserlessToken();
  
  if (!token) {
    return res.status(500).json({ 
      error: 'Browserless API not configured' 
    });
  }
  
  const response = await fetch(
    `https://production-sfo.browserless.io/chromium/bql?token=${token}`,
    { /* ... */ }
  );
  
  // Handle response...
}
```

## How Round-Robin Works

With 3 tokens configured:
```
Request 1 → Token 1
Request 2 → Token 2
Request 3 → Token 3
Request 4 → Token 1 (cycles back)
Request 5 → Token 2
...
```

### Benefits

1. **Load Distribution** - Spreads requests across multiple accounts
2. **Rate Limit Avoidance** - Each token has its own rate limit
3. **High Availability** - Continue working if one token is rate-limited
4. **Cost Management** - Utilize multiple free tiers

## API Reference

### Functions

#### `getNextBrowserlessToken()`
Returns the next token in rotation.
```typescript
const token = getNextBrowserlessToken();
// Returns: string | undefined
```

#### `hasBrowserlessTokens()`
Check if any tokens are configured.
```typescript
if (hasBrowserlessTokens()) {
  // Tokens available
}
// Returns: boolean
```

#### `getBrowserlessTokenCount()`
Get total number of tokens.
```typescript
const count = getBrowserlessTokenCount();
// Returns: number
```

#### `browserlessTokenRotator`
Direct access to rotator instance for advanced usage.
```typescript
import { browserlessTokenRotator } from '@/helpers';

// Reset rotation to first token
browserlessTokenRotator.reset();

// Get current token without rotating
const current = browserlessTokenRotator.getCurrentToken();

// Get all tokens (for debugging)
const all = browserlessTokenRotator.getAllTokens();

// Set specific index (for testing)
browserlessTokenRotator.setIndex(0);
```

## Examples

### Multiple Sequential Requests
```typescript
// Automatically distributes across tokens
for (let i = 0; i < 10; i++) {
  const token = getNextBrowserlessToken();
  await makeScreenshotRequest(token);
}
```

### Error Handling with Retry
```typescript
async function fetchWithRetry(maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const token = getNextBrowserlessToken();
    
    try {
      const response = await fetch(
        `https://production-sfo.browserless.io/chromium/bql?token=${token}`,
        { /* ... */ }
      );
      
      if (response.ok) {
        return await response.json();
      }
      
      console.log(`Attempt ${attempt} failed, rotating token...`);
    } catch (error) {
      if (attempt === maxRetries) throw error;
    }
  }
}
```

### Parallel Requests
```typescript
const urls = ['url1', 'url2', 'url3', 'url4'];

// Each request gets a different token automatically
const results = await Promise.all(
  urls.map(url => {
    const token = getNextBrowserlessToken();
    return fetch(
      `https://production-sfo.browserless.io/chromium/bql?token=${token}`,
      { /* ... */ }
    );
  })
);
```

## Monitoring

### Check Configuration
```typescript
import { 
  hasBrowserlessTokens, 
  getBrowserlessTokenCount,
  browserlessTokenRotator 
} from '@/helpers';

console.log('Token Status:', {
  configured: hasBrowserlessTokens(),
  count: getBrowserlessTokenCount(),
  tokens: browserlessTokenRotator.getAllTokens().map(t => 
    `${t.slice(0, 8)}...${t.slice(-4)}`
  )
});
```

### Logs
The rotator logs token usage automatically:
```
✅ [BROWSERLESS] Loaded 3 token(s)
🔄 [BROWSERLESS] Using token 1/3
🔄 [BROWSERLESS] Using token 2/3
🔄 [BROWSERLESS] Using token 3/3
🔄 [BROWSERLESS] Using token 1/3
```

## Best Practices

1. **Use Multiple Tokens** - Spread load across accounts
2. **Monitor Usage** - Track which tokens are being used
3. **Handle Missing Tokens** - Always check `if (token)` before use
4. **Don't Expose Tokens** - Keep them in .env, never in code
5. **Rotate Free Tiers** - Maximize free usage across multiple accounts

## Integration

Already integrated in:
- ✅ `bestExpressScreenshouter.ts` - Uses round-robin token rotation
- ✅ Environment configuration - Automatic token parsing
- ✅ Type-safe - Full TypeScript support

## Troubleshooting

### No tokens available
```
❌ [BROWSERLESS] No tokens available
```
**Solution:** Set `BROWSERLESS_API_TOKEN` in .env file

### Token not rotating
Check if you have multiple tokens configured:
```typescript
console.log(getBrowserlessTokenCount()); // Should be > 1
```

### Testing specific token
```typescript
browserlessTokenRotator.setIndex(0); // Use first token
const token = browserlessTokenRotator.getCurrentToken();
```

## See Also

- [browserlessTokenRotator.ts](./browserlessTokenRotator.ts) - Implementation
- [browserlessTokenRotator.examples.ts](./browserlessTokenRotator.examples.ts) - Usage examples
- [bestExpressScreenshouter.ts](./bestExpressScreenshouter.ts) - Real-world usage
