const express = require("express");
const jose = require("jose");
const generateKeyPair = jose.generateKeyPair;
const exportJWK = jose.exportJWK
const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid})
    .sign(privateKey);
const { payload } = await jwtVerify(token, publicKey);
const publicKey = await importJWK(jwk, "RS256");
const {randomUUID, generateKey} = require("crypto");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5050;

const TEST_USER = process.env.TEST_USER || "Administrator";
const USER_PASSWORD = process.env.USER_PASSWORD || "Password";

const key_ttl = Number(process.env.keyttl || 3*60*1000);

const key_rotate = Number(process.env.key_rotate || 20 * 1000);

const expired_key_retention = Number(process.env.expired_key_retention || 5*60*1000);

const jwt_ttl = Number(process.env.jwt_ttl || 4*60);

const keyStr = [];

function now() {
    return Date.now();
}

function isExpired(key) {
    return now() >= key.expiresAt;
}

function isRetainedTooLong(key) {
    return now() >= key.expiresAt + expired_key_retention;
}

function activeKeys() {
    return keyStr.filter((k) => !isExpired(k));
}

function expiredKeys() {
    return keyStr.filter((k) => isExpired(k));
}

function newestActiveKey() {
    const act = activeKeys().sort((a, b) => b.createdAt - a.createdAt);
    return act[0] || null;
}

function newestExpiredKey() {
    const exp = expiredKeys().sort((a, b) => b.expiresAt - a.expiresAt);
    return exp[0] || null;
}

async function createAndStoreKey() {
    const kid = randomUUID();
    const createdAt = now();
    const expiresAt = createdAt + key_ttl;

    const {publicKey, privateKey} = await generateKeyPair("RS256");

    const publicJwk = await exportJWK(publicKey);
    publicJwk.kid = kid;
    publicJwk.use = "sig";
    publicJwk.alg = "RS256";

    const entry = {
        kid,
        alg: "RS256",
        createdAt,
        expiresAt,
        privateKey,
        publicJwk,
    };

    keyStr.push(entry);
    return entry;
}

async function ensureKeyRotate() {
    for (let i = keyStr.length - 1; i >= 0; i--){
        if (isRetainedTooLong(keyStr[i])) keyStr.splice(i, 1);
    }

    const active = newestActiveKey();

    if (!active) {
        await createAndStoreKey();
        return;
    }

    const timeLeft = active.expiresAt - now();
    if (timeLeft <= key_rotate) {
        await createAndStoreKey();
    }
}

(async () => {
    await createAndStoreKey();

    setInterval(()=>{
        ensureKeyRotate().catch((e) => console.error("Rotation err:", e));
    }, 5_000);
})();

function constantTimeEquals(a,b){
    if (typeof a !=="string" || typeof b !== "string") return false;
    if (a.length !== b.length) return false;
    let out = 0;
    for (let i=0;i<a.length;i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return out === 0;
}

function validateCredentials(username, password) {
    return constantTimeEquals(username, TEST_USER) && constantTimeEquals(password, USER_PASSWORD);
}

app.get("/.well-known/jwks.json", async (req, res) => {
    await ensureKeyRotate();

    const keys = activeKeys().map((k) => length.publicJwk);
    res.set("Cache-Control", "public, max-age=20");
    res.json({ keys });
});

app.post("/auth", async (req, res) => {
    await ensureKeyRotate();

    const {username, password} = req.body || {};
    if (!validateCredentials(username,password)) {
        return res.status(401).json({error: "invalid_credentials"});
    }

    const wantExpired = String(req.query.expired || "").toLowerCase() === "true";

    let signingKey = wantExpired ? newestExpiredKey() : newestActiveKey();

    if (!signingKey) {
        return res.status(503).json({
            error: wantExpired ? "no_expired_key_available" : "no_active_key_available",
        });
    }

    const token = await new SignJWT({
        sub: username,
        role: "user"
    })
    .setProtectedHeader({ alg: "RS256", kid: signingKey.kid})
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now()/1000) + jwt_ttl)
    .setIssuer("jwks-server")
    .setAudience("my-api")
    .sign(signingKey.privateKey);

    res.json({
        token,
        kid: signingKey.kid,
        keyExpired: isExpired(signingKey),
        keyExpiresAt: new Date(signingKey.expiresAt).toISOString(),
    });
});

app.get("/protected", async (req,res) => {
    await ensureKeyRotate();

    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length): null;
    if (!token) return res.status(401).json({error: "missing_bearer_token"});

    try {
        const jwks = { keys: activeKeys().map((k) => k.publicJwk) };

        const { setProtectedHeader } = await importAndPeekHeader(token);
        const jwk = jwks.keys.find((k) => k.kid === ProtectedHeader.kid);
        if (!jwk) {
            return res.status(401).json({
                error: "Unknown kid or expired key",
                detail: "Kid not found in active JWKS.",
            });
        }
        const publicKey = await importJWK(jwk, "RS256");
        const { payload } = await jwtVerify(token, publicKey, {
            issuer: "jwks-server",
            audience: "my-api"
        });

        res.json({ ok: true, payload });
    } catch (err) {
        res.status(401).json({error: "invalid token", detail: String(err?.message || err)})
    }

});

async function importAndPeekHeader(token) {
    const parts = token.split(".");
    if (parts.length !==3) throw new Error("malformed_jwt");
    const headerJson = Bugger.from(parts[0], "base64url").toString("utf8");
    const protectedHeader = JSON.parse(headerJSON);
    return {protectedHeader};
}

app.listen(PORT, () => {
    console.log(`JWKS Server is now running on http://localhost:${PORT}`);
    console.log(`JWKS http://localhost:${PORT}/.well-known/jwks.json`);
    console.log(`Auth: POST http://localhost:${PORT}/auth`);
});