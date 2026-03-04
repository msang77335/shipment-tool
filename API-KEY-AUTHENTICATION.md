# API Key Authentication

## Overview
The API uses API key authentication to secure endpoints. All API requests (except `/health`) require a valid API key in the request headers.

## Configuration

### Enable Authentication
Set the `X_API_KEY` environment variable in your `.env` file:

```env
X_API_KEY=your_secret_api_key_here
```

### Disable Authentication
Remove or comment out the `X_API_KEY` variable:

```env
# X_API_KEY=your_secret_api_key_here
```

Or leave it empty:
```env
X_API_KEY=
```

## Usage

### Making Authenticated Requests

Include the `X-API-Key` header in all API requests:

#### cURL Example
```bash
curl -X POST http://localhost:8080/api/v1/tracking \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_secret_api_key_here" \
  -d '{
    "provider": "spx",
    "codes": "SPXVN0123456789"
  }'
```

#### JavaScript/Fetch Example
```javascript
fetch('http://localhost:8080/api/v1/tracking', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your_secret_api_key_here'
  },
  body: JSON.stringify({
    provider: 'spx',
    codes: 'SPXVN0123456789'
  })
});
```

#### Axios Example
```javascript
import axios from 'axios';

const response = await axios.post(
  'http://localhost:8080/api/v1/tracking',
  {
    provider: 'spx',
    codes: 'SPXVN0123456789'
  },
  {
    headers: {
      'X-API-Key': 'your_secret_api_key_here'
    }
  }
);
```

#### Python Requests Example
```python
import requests

response = requests.post(
    'http://localhost:8080/api/v1/tracking',
    headers={
        'Content-Type': 'application/json',
        'X-API-Key': 'your_secret_api_key_here'
    },
    json={
        'provider': 'spx',
        'codes': 'SPXVN0123456789'
    }
)
```

## Error Responses

### Missing API Key
**Status Code:** `401 Unauthorized`

```json
{
  "success": false,
  "error": "API key is required. Please provide X-API-Key header."
}
```

### Invalid API Key
**Status Code:** `403 Forbidden`

```json
{
  "success": false,
  "error": "Invalid API key."
}
```

## Endpoints

### Protected Endpoints
All endpoints under `/api/v1` require authentication:
- `POST /api/v1/tracking` - Track shipments

### Public Endpoints
These endpoints do NOT require authentication:
- `GET /health` - Health check

## Best Practices

### Security
1. **Never commit API keys to version control**
   ```bash
   # .gitignore should include
   .env
   .env.*
   !.env.example
   ```

2. **Use strong API keys**
   ```bash
   # Generate secure random key
   openssl rand -hex 32
   # or
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Rotate keys regularly**
   - Change API keys periodically
   - Update all clients when rotating
   - Keep old keys for grace period

4. **Different keys per environment**
   ```env
   # Development
   X_API_KEY=dev_key_123

   # Production
   X_API_KEY=prod_key_xyz_very_secure_long_random_string
   ```

### Development

#### Disable for Local Development
For easier local testing, you can:

**Option 1:** Remove API key from `.env`
```env
# X_API_KEY=
```

**Option 2:** Comment out middleware in `src/index.ts`
```typescript
// API Key Authentication (apply to all API routes)
// Comment out the line below to disable API key authentication
// app.use(env.apiPrefix, apiKeyAuth);  // ← Comment this line
```

#### Optional Authentication
Use `optionalApiKeyAuth` for logging without enforcing:

```typescript
// In src/index.ts
import { optionalApiKeyAuth } from './middleware/apiKeyAuth';

// Replace apiKeyAuth with optionalApiKeyAuth
app.use(env.apiPrefix, optionalApiKeyAuth);
```

This allows requests without API keys but logs authentication status.

## Implementation Details

### Middleware Logic
1. Check if `X_API_KEY` is configured in environment
2. If not configured, skip authentication (allow all requests)
3. If configured, require `X-API-Key` header in requests
4. Validate header value matches configured key
5. Return 401/403 on authentication failure
6. Continue to route handler on success

### Code Location
- Middleware: [`src/middleware/apiKeyAuth.ts`](src/middleware/apiKeyAuth.ts)
- Configuration: [`src/helpers/env.ts`](src/helpers/env.ts)
- Application: [`src/index.ts`](src/index.ts)

## Testing

### Test with Valid Key
```bash
# Should return success
curl -X POST http://localhost:8080/api/v1/tracking \
  -H "X-API-Key: your_secret_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{"provider":"spx","codes":"TEST123"}'
```

### Test without Key
```bash
# Should return 401
curl -X POST http://localhost:8080/api/v1/tracking \
  -H "Content-Type: application/json" \
  -d '{"provider":"spx","codes":"TEST123"}'
```

### Test with Invalid Key
```bash
# Should return 403
curl -X POST http://localhost:8080/api/v1/tracking \
  -H "X-API-Key: wrong_key" \
  -H "Content-Type: application/json" \
  -d '{"provider":"spx","codes":"TEST123"}'
```

### Test Health Endpoint (Public)
```bash
# Should work without API key
curl http://localhost:8080/health
```

## Logging

The middleware logs authentication attempts:

```
✅ [API KEY AUTH] Valid API key, request authorized
❌ [API KEY AUTH] Missing API key in request
❌ [API KEY AUTH] Invalid API key provided
⚠️ [API KEY AUTH] No API key configured, skipping authentication
```

## Migration Guide

### Adding Authentication to Existing API

1. **Set API key in environment**
   ```bash
   # Generate secure key
   openssl rand -hex 32
   
   # Add to .env
   echo "X_API_KEY=generated_key_here" >> .env
   ```

2. **Restart server**
   ```bash
   npm run dev
   ```

3. **Update all clients**
   - Add `X-API-Key` header to all API requests
   - Test each integration
   - Monitor logs for authentication failures

4. **Gradual rollout** (Optional)
   - Start with `optionalApiKeyAuth` to track usage
   - Notify clients about upcoming requirement
   - Switch to `apiKeyAuth` after migration period

## Rate Limiting

API key authentication works alongside rate limiting:
- Rate limits apply per IP address
- Authenticated requests have same limits
- Consider per-key rate limiting for production

## Future Enhancements

Potential improvements:
- [ ] Multiple API keys support
- [ ] Per-key rate limiting
- [ ] API key expiration
- [ ] API key permissions/scopes
- [ ] Usage analytics per key
- [ ] Key rotation without downtime
- [ ] JWT tokens instead of static keys

## Troubleshooting

### Issue: 401 error despite correct key
- Check header name: must be `X-API-Key` (case-sensitive)
- Verify no extra spaces in key value
- Check `.env` file is loaded correctly
- Restart server after changing `.env`

### Issue: Authentication always passes
- Verify `X_API_KEY` is set in `.env`
- Check middleware is applied: `app.use(env.apiPrefix, apiKeyAuth)`
- Review server startup logs for API key status

### Issue: Can't test without key
- Remove `X_API_KEY` from `.env` temporarily
- Or use `optionalApiKeyAuth` middleware
- Health endpoint `/health` never requires auth

## Security Considerations

⚠️ **Important Security Notes:**

1. **HTTPS in Production**
   - Always use HTTPS to prevent API key interception
   - Plain HTTP exposes keys in transit

2. **Key Storage**
   - Never hardcode keys in source code
   - Use environment variables or secret managers
   - Don't log API keys

3. **Access Control**
   - Limit who can access `.env` files
   - Use different keys per environment
   - Rotate compromised keys immediately

4. **Monitoring**
   - Log authentication failures
   - Alert on suspicious patterns
   - Track API key usage

## See Also

- [Environment Configuration](src/helpers/env.ts)
- [Middleware Documentation](src/middleware/)
- [API Documentation](README.md#api-documentation)
