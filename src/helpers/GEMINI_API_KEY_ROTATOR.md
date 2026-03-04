# Gemini API Key Rotator

## Overview
Helper utility for managing multiple Gemini API keys with automatic round-robin rotation for load balancing and quota distribution.

## Features

- ✅ **Multiple Key Support** - Use comma-separated keys
- 🔄 **Round-Robin Rotation** - Automatic load balancing
- 📊 **Key Monitoring** - Track usage and availability
- 🛡️ **Error Handling** - Graceful fallback if no keys
- 🎯 **Singleton Pattern** - Single shared instance
- 📝 **TypeScript Support** - Full type safety
- 💰 **Quota Multiplier** - Combine multiple free tier quotas

## Configuration

### Single API Key
```env
GEMINI_API_KEY=AIzaSyABC123...
```

### Multiple API Keys (Round-Robin)
```env
GEMINI_API_KEY=AIzaSyABC123...,AIzaSyDEF456...,AIzaSyGHI789...
```

Spaces are automatically trimmed:
```env
GEMINI_API_KEY=key1, key2, key3
```

## Usage

### Basic Usage

```typescript
import { getNextGeminiApiKey } from '@/helpers';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Get next API key (automatically rotates)
const apiKey = getNextGeminiApiKey();

if (apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  
  const result = await model.generateContent('Your prompt');
  console.log(result.response.text());
}
```

### Check Availability

```typescript
import { hasGeminiApiKeys, getGeminiApiKeyCount } from '@/helpers';

if (hasGeminiApiKeys()) {
  console.log(`Using ${getGeminiApiKeyCount()} API key(s)`);
} else {
  console.error('No API keys configured');
}
```

### Captcha Solving (Real Example)

```typescript
import { getNextGeminiApiKey } from '@/helpers';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function solveCaptcha(imageBuffer: Buffer): Promise<string> {
  const apiKey = getNextGeminiApiKey();
  
  if (!apiKey) {
    throw new Error('No Gemini API key configured');
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  
  const prompt = 'Extract the text from this captcha image';
  
  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        data: imageBuffer.toString('base64'),
        mimeType: 'image/png',
      },
    },
  ]);
  
  return result.response.text().trim();
}
```

## How Round-Robin Works

With 3 API keys configured:
```
Request 1 → Key 1
Request 2 → Key 2
Request 3 → Key 3
Request 4 → Key 1 (cycles back)
Request 5 → Key 2
...
```

### Benefits

1. **Quota Multiplication** - 3 keys = 3x the quota
2. **Rate Limit Distribution** - Each key has independent rate limits
3. **High Availability** - Continue working if one key hits limits
4. **Cost Optimization** - Maximize free tier usage across multiple Google accounts

### Example: Free Tier Multiplication

Gemini Free Tier (per key):
- 15 RPM (Requests Per Minute)
- 1 million TPM (Tokens Per Minute)
- 1,500 RPD (Requests Per Day)

With 3 keys:
- **45 RPM** combined
- **3 million TPM** combined
- **4,500 RPD** combined

## API Reference

### Functions

#### `getNextGeminiApiKey()`
Returns the next API key in rotation.
```typescript
const apiKey = getNextGeminiApiKey();
// Returns: string | undefined
```

#### `hasGeminiApiKeys()`
Check if any API keys are configured.
```typescript
if (hasGeminiApiKeys()) {
  // Keys available
}
// Returns: boolean
```

#### `getGeminiApiKeyCount()`
Get total number of API keys.
```typescript
const count = getGeminiApiKeyCount();
// Returns: number
```

#### `geminiApiKeyRotator`
Direct access to rotator instance for advanced usage.
```typescript
import { geminiApiKeyRotator } from '@/helpers';

// Reset rotation to first key
geminiApiKeyRotator.reset();

// Get current key without rotating
const current = geminiApiKeyRotator.getCurrentKey();

// Get all keys (for debugging)
const all = geminiApiKeyRotator.getAllKeys();

// Set specific index (for testing)
geminiApiKeyRotator.setIndex(0);
```

## Examples

### Multiple Sequential Requests
```typescript
// Automatically distributes across keys
for (let i = 0; i < 10; i++) {
  const apiKey = getNextGeminiApiKey();
  const genAI = new GoogleGenerativeAI(apiKey);
  await processWithGemini(genAI);
}
```

### Error Handling with Quota Retry
```typescript
async function generateWithRetry(prompt: string, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const apiKey = getNextGeminiApiKey();
    
    if (!apiKey) {
      throw new Error('No API keys available');
    }
    
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      
      const result = await model.generateContent(prompt);
      return result.response.text();
      
    } catch (error: any) {
      // If quota exceeded, rotate to next key
      if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
        console.log(`Quota hit, rotating to key ${attempt + 1}...`);
        
        if (attempt === maxRetries) {
          throw new Error('All API keys exhausted quota');
        }
        
        continue;
      }
      
      throw error;
    }
  }
}
```

### Parallel Requests
```typescript
const prompts = ['prompt1', 'prompt2', 'prompt3', 'prompt4'];

// Each request gets a different key automatically
const results = await Promise.all(
  prompts.map(async (prompt) => {
    const apiKey = getNextGeminiApiKey();
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const result = await model.generateContent(prompt);
    return result.response.text();
  })
);
```

## Monitoring

### Check Configuration
```typescript
import { 
  hasGeminiApiKeys, 
  getGeminiApiKeyCount,
  geminiApiKeyRotator 
} from '@/helpers';

console.log('API Key Status:', {
  configured: hasGeminiApiKeys(),
  count: getGeminiApiKeyCount(),
  keys: geminiApiKeyRotator.getAllKeys().map(k => 
    `${k.slice(0, 15)}...${k.slice(-4)}`
  )
});
```

### Logs
The rotator logs key usage automatically:
```
✅ [GEMINI] Loaded 3 API key(s)
🔄 [GEMINI] Using API key 1/3
🔄 [GEMINI] Using API key 2/3
🔄 [GEMINI] Using API key 3/3
🔄 [GEMINI] Using API key 1/3
```

## Best Practices

1. **Use Multiple Keys** - Create multiple Google accounts for free tier multiplication
2. **Monitor Quota** - Track usage to avoid hitting limits
3. **Handle Errors** - Always check `if (apiKey)` before use
4. **Secure Keys** - Keep them in .env, never commit to git
5. **Rate Limit Awareness** - Add delays between requests if needed
6. **Error Retry Logic** - Rotate keys on quota/rate limit errors

## Quota Management

### Free Tier Limits (per key)
- **RPM**: 15 requests per minute
- **TPM**: 1 million tokens per minute
- **RPD**: 1,500 requests per day

### Strategies

**Strategy 1: Round-Robin (Default)**
- Simple rotation through all keys
- Good for distributed load
- Best for consistent usage

**Strategy 2: Quota-Aware**
- Track usage per key
- Switch when approaching limits
- Requires custom implementation

**Strategy 3: Geographic Distribution**
- Keys from different regions
- Reduces latency
- Better availability

## Integration

Already integrated in:
- ✅ `vnPostScreenshoter.ts` - Uses round-robin key rotation for captcha solving
- ✅ Environment configuration - Automatic key parsing
- ✅ Type-safe - Full TypeScript support

## Troubleshooting

### No keys available
```
❌ [GEMINI] No API keys available
```
**Solution:** Set `GEMINI_API_KEY` in .env file

### Quota exceeded on all keys
```
All API keys exhausted quota
```
**Solutions:**
- Add more API keys
- Wait for quota reset (daily/monthly)
- Upgrade to paid tier

### Key not rotating
Check if you have multiple keys configured:
```typescript
console.log(getGeminiApiKeyCount()); // Should be > 1
```

### Testing specific key
```typescript
geminiApiKeyRotator.setIndex(0); // Use first key
const key = geminiApiKeyRotator.getCurrentKey();
```

## Getting API Keys

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with Google account
3. Click "Create API Key"
4. Copy the key
5. Repeat with different Google accounts for multiple keys

## Security Notes

- ✅ Never commit API keys to version control
- ✅ Use .env files (in .gitignore)
- ✅ Rotate keys periodically
- ✅ Monitor for unauthorized usage
- ✅ Use different keys for dev/prod

## See Also

- [geminiApiKeyRotator.ts](./geminiApiKeyRotator.ts) - Implementation
- [geminiApiKeyRotator.examples.ts](./geminiApiKeyRotator.examples.ts) - Usage examples
- [vnPostScreenshoter.ts](./vnPostScreenshoter.ts) - Real-world usage
- [browserlessTokenRotator.ts](./browserlessTokenRotator.ts) - Similar pattern for Browserless
