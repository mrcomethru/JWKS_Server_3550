# JWKS_Server_3550
RESTful JWKS server that provides public keys with unique identifiers for verifying JSON Web Tokens.

# JWKS Server with JWT Authentication

A RESTful JWKS (JSON Web Key Set) server that provides public keys for verifying JSON Web Tokens (JWTs) with key expiry management and authentication endpoints.

## Features

-  RSA key pair generation with unique Key IDs (`kid`)
-  Key expiry timestamps for enhanced security
-  RESTful JWKS endpoint serving only non-expired public keys
-  Authentication endpoint for JWT issuance
-  Support for issuing expired JWTs (for testing purposes)
-  Fully compliant with JWT and JWKS standards

## Requirements

- Node.js (v14 or higher)
- No external dependencies (uses only Node.js built-in modules)

## Installation

No installation required! The server uses only Node.js core modules.

## Running the Server

```bash
node jwks-server.js
```

The server will start on port 8080 and automatically generate:
- 1 valid RSA key pair (expires in 1 hour)
- 1 expired RSA key pair (for testing expired JWTs)

## API Endpoints

### 1. JWKS Endpoint - GET `/.well-known/jwks.json`

Returns the public keys in JWKS format. **Only non-expired keys are included.**

**Request:**
```bash
curl http://localhost:8080/.well-known/jwks.json
```

**Response:**
```json
{
  "keys": [
    {
      "kid": "a1b2c3d4e5f6...",
      "kty": "RSA",
      "use": "sig",
      "alg": "RS256",
      "n": "xGOr-H7A...",
      "e": "AQAB"
    }
  ]
}
```

### 2. Authentication Endpoint - POST `/auth`

Issues a signed JWT with a non-expired key.

**Request:**
```bash
curl -X POST http://localhost:8080/auth
```

**Response:**
```json
{
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImExYjJjM2Q0ZTVmNi4uLiJ9..."
}
```

### 3. Expired JWT Endpoint - POST `/auth?expired`

Issues a JWT signed with an **expired** key pair. The JWT itself is also expired.

**Request:**
```bash
curl -X POST "http://localhost:8080/auth?expired"
```

**Response:**
```json
{
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4OTBhYmNkZWYxMi4uLiJ9..."
}
```

## JWT Structure

All JWTs include the following claims:

**Header:**
```json
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "unique-key-identifier"
}
```

**Payload:**
```json
{
  "sub": "user123",
  "username": "testuser",
  "email": "user@example.com",
  "iat": 1234567890,
  "exp": 1234571490
}
```

## Testing

Run the included test client to verify all functionality:

```bash
# Terminal 1: Start the server
node jwks-server.js

# Terminal 2: Run tests
node test-client.js
```

The test client will:
1. Fetch the JWKS and display available public keys
2. Request a valid JWT and decode it
3. Request an expired JWT and decode it
4. Test error handling (404)

## Implementation Details

### Key Generation

- Uses RSA-2048 for cryptographic security
- Each key has a unique `kid` (32-character hex string)
- Keys include an expiry timestamp
- Private keys are stored in memory (PKCS8 PEM format)
- Public keys are exported as JWK (JSON Web Key)

### Security Features

1. **Key Expiry**: Only non-expired keys are served via JWKS endpoint
2. **Key Rotation**: Easy to add new keys and expire old ones
3. **RS256 Algorithm**: Industry-standard RSA signature algorithm
4. **Unique Key IDs**: Each key has a unique identifier for key management

### Base64URL Encoding

The server implements proper Base64URL encoding for JWT components:
- Replace `+` with `-`
- Replace `/` with `_`
- Remove padding `=`

## Architecture

```
┌─────────────────┐
│   HTTP Client   │
└────────┬────────┘
         │
         │ GET /.well-known/jwks.json
         │ POST /auth
         │ POST /auth?expired
         │
         ▼
┌─────────────────────────────┐
│      JWKS Server (8080)     │
├─────────────────────────────┤
│ • Key Generation            │
│ • Key Storage (in-memory)   │
│ • JWT Creation & Signing    │
│ • JWKS Formatting           │
└─────────────────────────────┘
         │
         │ Keys with kid + expiry
         ▼
┌─────────────────────────────┐
│    In-Memory Key Store      │
│  [ Valid Keys | Expired ]   │
└─────────────────────────────┘
```

## Error Handling

The server handles the following error cases:

- **405 Method Not Allowed**: Wrong HTTP method
- **404 Not Found**: Invalid endpoint
- **400 Bad Request**: No expired keys available
- **500 Internal Server Error**: No valid keys available

## Use Cases

1. **Development**: Testing JWT authentication flows
2. **Testing**: Simulating key rotation and expiry
3. **Learning**: Understanding JWKS and JWT standards
4. **Integration**: Backend for OAuth2/OpenID Connect flows

## License

MIT License - Feel free to use and modify for your projects.

## Author

Created as a demonstration of JWKS and JWT authentication standards.