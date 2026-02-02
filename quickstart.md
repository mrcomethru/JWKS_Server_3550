# Quick Start Guide

## Start the JWKS Server

```bash
node jwks-server.js
```

Expected output:
```
Generating initial keys...
Generated valid key with kid: a1b2c3d4e5f67890...
  Expires at: 2026-02-02T14:30:00.000Z
Generated expired key with kid: 7890abcdef123456...
  Expired at: 2026-02-02T13:29:59.000Z

✅ JWKS Server running on http://localhost:8080

Available endpoints:
  GET  /.well-known/jwks.json - Public keys (non-expired only)
  POST /auth                   - Issue JWT (valid)
  POST /auth?expired           - Issue JWT (expired)
```

## Test the Server

### Option 1: Use the Test Client

In a new terminal:
```bash
node test-client.js
```

### Option 2: Use curl

**Get public keys:**
```bash
curl http://localhost:8080/.well-known/jwks.json
```

**Get a valid JWT:**
```bash
curl -X POST http://localhost:8080/auth
```

**Get an expired JWT:**
```bash
curl -X POST "http://localhost:8080/auth?expired"
```

## Decode a JWT

Use [jwt.io](https://jwt.io) to decode and inspect JWTs:

1. Copy the token from the response
2. Paste it into jwt.io
3. View the header and payload

## Example Flow

1. **Start server**: `node jwks-server.js`
2. **Get JWKS**: The client fetches public keys from `/.well-known/jwks.json`
3. **Authenticate**: Client POSTs to `/auth` to get a JWT
4. **Verify**: Client uses the public key (from JWKS) to verify the JWT signature

## Key Points

- The server generates 2 keys on startup: 1 valid, 1 expired
- JWKS endpoint only returns non-expired keys
- `/auth` returns a JWT signed with a valid key
- `/auth?expired` returns a JWT signed with an expired key (for testing)
- All JWTs include `kid` in the header to identify which key signed them

## Next Steps

Check out the full [README.md](README.md) for:
- Detailed API documentation
- Architecture overview
- Extension examples
- Security considerations