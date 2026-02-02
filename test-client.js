const http = require('http');

/**
 * Make HTTP request
 */
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            body: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            body: data
          });
        }
      });
    });
    
    req.on('error', reject);
    
    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

/**
 * Decode JWT (without verification)
 */
function decodeJWT(token) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

  return { header, payload };
}

/**
 * Run tests
 */
async function runTests() {
  console.log('🧪 Testing JWKS Server\n');
  console.log('='.repeat(60));

  try {
    // Test 1: Get JWKS
    console.log('\n📋 Test 1: Fetching JWKS (public keys)');
    console.log('-'.repeat(60));
    const jwksResponse = await makeRequest({
      hostname: 'localhost',
      port: 8080,
      path: '/.well-known/jwks.json',
      method: 'GET'
    });

    console.log(`Status: ${jwksResponse.statusCode}`);
    console.log(`Number of keys: ${jwksResponse.body.keys.length}`);
    console.log('Keys:', JSON.stringify(jwksResponse.body, null, 2));

    // Test 2: Get valid JWT
    console.log('\n📋 Test 2: Getting valid JWT');
    console.log('-'.repeat(60));
    const validAuthResponse = await makeRequest({
      hostname: 'localhost',
      port: 8080,
      path: '/auth',
      method: 'POST'
    });

    console.log(`Status: ${validAuthResponse.statusCode}`);
    if (validAuthResponse.body.token) {
      const validJWT = decodeJWT(validAuthResponse.body.token);
      console.log('JWT Header:', JSON.stringify(validJWT.header, null, 2));
      console.log('JWT Payload:', JSON.stringify(validJWT.payload, null, 2));
      
      const now = Math.floor(Date.now() / 1000);
      const isExpired = validJWT.payload.exp < now;
      console.log(`Token expired: ${isExpired}`);
      console.log(`Expires at: ${new Date(validJWT.payload.exp * 1000).toISOString()}`);
    }

    // Test 3: Get expired JWT
    console.log('\n📋 Test 3: Getting expired JWT');
    console.log('-'.repeat(60));
    const expiredAuthResponse = await makeRequest({
      hostname: 'localhost',
      port: 8080,
      path: '/auth?expired',
      method: 'POST'
    });

    console.log(`Status: ${expiredAuthResponse.statusCode}`);
    if (expiredAuthResponse.body.token) {
      const expiredJWT = decodeJWT(expiredAuthResponse.body.token);
      console.log('JWT Header:', JSON.stringify(expiredJWT.header, null, 2));
      console.log('JWT Payload:', JSON.stringify(expiredJWT.payload, null, 2));
      
      const now = Math.floor(Date.now() / 1000);
      const isExpired = expiredJWT.payload.exp < now;
      console.log(`Token expired: ${isExpired}`);
      console.log(`Expired at: ${new Date(expiredJWT.payload.exp * 1000).toISOString()}`);
    }

    // Test 4: Try invalid endpoint
    console.log('\n📋 Test 4: Testing 404 handling');
    console.log('-'.repeat(60));
    const notFoundResponse = await makeRequest({
      hostname: 'localhost',
      port: 8080,
      path: '/invalid',
      method: 'GET'
    });

    console.log(`Status: ${notFoundResponse.statusCode}`);
    console.log('Response:', JSON.stringify(notFoundResponse.body, null, 2));

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests completed!\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\nMake sure the JWKS server is running on port 8080');
    console.error('Start it with: node jwks-server.js');
  }
}

// Run tests after a short delay to ensure server is ready
console.log('Waiting for server to be ready...\n');
setTimeout(runTests, 1000);