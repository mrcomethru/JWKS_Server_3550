const http = require('http');
const crypto = require('crypto');
const url = require('url');

// In-memory key storage
const keys = [];

/**
 * Generate an RSA key pair with kid and expiry timestamp
 */
function generateKeyPair(expiresIn = 3600000) { // Default: 1 hour
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  const kid = crypto.randomBytes(16).toString('hex');
  const expiry = Date.now() + expiresIn;

  return {
    kid,
    publicKey,
    privateKey,
    expiry
  };
}

/**
 * Convert PEM public key to JWK format
 */
function pemToJwk(pem, kid) {
  const keyObject = crypto.createPublicKey(pem);
  const jwk = keyObject.export({ format: 'jwk' });
  
  return {
    kid,
    kty: jwk.kty,
    use: 'sig',
    alg: 'RS256',
    n: jwk.n,
    e: jwk.e
  };
}

/**
 * Base64URL encode
 */
function base64UrlEncode(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Create a JWT
 */
function createJWT(payload, privateKey, kid, expiresIn = 3600) {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid
  };

  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn
  };

  const encodedHeader = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(Buffer.from(JSON.stringify(jwtPayload)));
  
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signatureInput), privateKey);
  const encodedSignature = base64UrlEncode(signature);

  return `${signatureInput}.${encodedSignature}`;
}

/**
 * Get non-expired keys
 */
function getNonExpiredKeys() {
  const now = Date.now();
  return keys.filter(key => key.expiry > now);
}

/**
 * Get expired keys
 */
function getExpiredKeys() {
  const now = Date.now();
  return keys.filter(key => key.expiry <= now);
}

/**
 * Handle JWKS endpoint
 */
function handleJWKS(req, res) {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const nonExpiredKeys = getNonExpiredKeys();
  const jwks = {
    keys: nonExpiredKeys.map(key => pemToJwk(key.publicKey, key.kid))
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(jwks, null, 2));
}

/**
 * Handle authentication endpoint
 */
function handleAuth(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const isExpired = parsedUrl.query.expired !== undefined;

  let keyToUse;
  let expiry;

  if (isExpired) {
    // Use an expired key
    const expiredKeys = getExpiredKeys();
    if (expiredKeys.length === 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No expired keys available' }));
      return;
    }
    keyToUse = expiredKeys[0];
    // Set JWT expiry to past (already expired)
    expiry = -3600; // Expired 1 hour ago
  } else {
    // Use a non-expired key
    const nonExpiredKeys = getNonExpiredKeys();
    if (nonExpiredKeys.length === 0) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No valid keys available' }));
      return;
    }
    keyToUse = nonExpiredKeys[0];
    expiry = 3600; // Valid for 1 hour
  }

  // Fake user authentication (in real scenario, validate credentials from request body)
  const payload = {
    sub: 'user123',
    username: 'testuser',
    email: 'user@example.com'
  };

  const token = createJWT(payload, keyToUse.privateKey, keyToUse.kid, expiry);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ token }));
}

/**
 * Main request handler
 */
function requestHandler(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === '/.well-known/jwks.json') {
    handleJWKS(req, res);
  } else if (pathname === '/auth') {
    handleAuth(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
}

/**
 * Initialize server
 */
function initializeServer() {
  // Generate initial keys
  console.log('Generating keys');
  
  // Generate a valid key (expires in 1 hour)
  const validKey = generateKeyPair(3600000);
  keys.push(validKey);
  console.log(`Generated valid key with kid: ${validKey.kid}`);
  console.log(`  Expires at: ${new Date(validKey.expiry).toISOString()}`);
  
  // Generate an expired key (already expired)
  const expiredKey = generateKeyPair(-1000); // Expired 1 second ago
  keys.push(expiredKey);
  console.log(`Generated expired key with kid: ${expiredKey.kid}`);
  console.log(`  Expired at: ${new Date(expiredKey.expiry).toISOString()}`);

  // Create and start server
  const server = http.createServer(requestHandler);
  const PORT = 8080;

  server.listen(PORT, () => {
    console.log(`\nJWKS Server running on http://localhost:${PORT}`);
    console.log(`\nAvailable endpoints:`);
    console.log(`  GET  /.well-known/jwks.json - Public keys (non-expired only)`);
    console.log(`  POST /auth                   - Issue JWT (valid)`);
    console.log(`  POST /auth?expired           - Issue JWT (expired)`);
    console.log(`\nExample requests:`);
    console.log(`  curl http://localhost:${PORT}/.well-known/jwks.json`);
    console.log(`  curl -X POST http://localhost:${PORT}/auth`);
    console.log(`  curl -X POST "http://localhost:${PORT}/auth?expired"`);
  });
}

// Start the server
initializeServer();