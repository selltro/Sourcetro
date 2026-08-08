const NOTIFICATION_ENDPOINT = "https://sourcetro-ebay-test.nydia-burgos.workers.dev/";
const SOURCETRO_ORIGIN = "https://selltro.github.io";
const SOURCETRO_APP_URL = "https://selltro.github.io/Sourcetro/";
const EBAY_AUTH_URL = "https://auth.ebay.com/oauth2/authorize";
const EBAY_TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const EBAY_API_URL = "https://api.ebay.com";
const EBAY_SCOPES = [
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
];
const TOKEN_RECORD_KEY = "primary-ebay-connection";
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

let accessTokenCache = null;

function corsHeaders(origin = "") {
  const allowedOrigin = origin === SOURCETRO_ORIGIN ? origin : SOURCETRO_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "Content-Type, X-SourceTro-Key",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

function json(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

function redirect(url) {
  return Response.redirect(url, 302);
}

function htmlPage(title, message, status = 400) {
  const safeTitle = String(title).replace(/[<>]/g, "");
  const safeMessage = String(message).replace(/[<>]/g, "");
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title></head><body style="font-family:system-ui;padding:40px;max-width:720px;margin:auto"><h1>${safeTitle}</h1><p>${safeMessage}</p><p><a href="${SOURCETRO_APP_URL}#marketplaces">Return to SourceTro</a></p></body></html>`, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function bytesToBase64Url(bytes) {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function utf8Base64(value) {
  return bytesToBase64(new TextEncoder().encode(value));
}

async function sha256Hex(value) {
  const encodedValue = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encodedValue);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacKey(secret, usage) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usage,
  );
}

async function createSignedState(secret) {
  const payload = JSON.stringify({ issuedAt: Date.now(), nonce: crypto.randomUUID() });
  const payloadPart = bytesToBase64Url(new TextEncoder().encode(payload));
  const key = await hmacKey(secret, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadPart));
  return `${payloadPart}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

async function verifySignedState(value, secret) {
  if (!value || !secret) return false;
  const [payloadPart, signaturePart, extra] = value.split(".");
  if (!payloadPart || !signaturePart || extra) return false;

  try {
    const key = await hmacKey(secret, ["verify"]);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(signaturePart),
      new TextEncoder().encode(payloadPart),
    );
    if (!valid) return false;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadPart)));
    return Number.isFinite(payload.issuedAt)
      && payload.issuedAt <= Date.now() + 60_000
      && Date.now() - payload.issuedAt <= STATE_MAX_AGE_MS;
  } catch {
    return false;
  }
}

function missingOAuthSetup(env) {
  const missing = [];
  if (!env.EBAY_CLIENT_ID) missing.push("EBAY_CLIENT_ID");
  if (!env.EBAY_CLIENT_SECRET) missing.push("EBAY_CLIENT_SECRET");
  if (!env.EBAY_RUNAME) missing.push("EBAY_RUNAME");
  if (!env.EBAY_STATE_SECRET) missing.push("EBAY_STATE_SECRET");
  if (!env.SOURCETRO_OWNER_KEY) missing.push("SOURCETRO_OWNER_KEY");
  if (!env.EBAY_TOKENS) missing.push("EBAY_TOKENS KV binding");
  return missing;
}

function ownerAuthorized(request, env) {
  const supplied = request.headers.get("X-SourceTro-Key") || "";
  return Boolean(env.SOURCETRO_OWNER_KEY && supplied && supplied === env.SOURCETRO_OWNER_KEY);
}

async function tokenRequest(env, params) {
  const response = await fetch(EBAY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${utf8Base64(`${env.EBAY_CLIENT_ID}:${env.EBAY_CLIENT_SECRET}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: new URLSearchParams(params),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = result.error_description || result.error || `eBay token request failed (${response.status}).`;
    throw new Error(message);
  }
  return result;
}

async function storeConnection(env, tokenResult) {
  if (!tokenResult.refresh_token) throw new Error("eBay did not return a refresh token.");

  const now = Date.now();
  const record = {
    refreshToken: tokenResult.refresh_token,
    scopes: EBAY_SCOPES,
    connectedAt: new Date(now).toISOString(),
    refreshTokenExpiresAt: tokenResult.refresh_token_expires_in
      ? new Date(now + Number(tokenResult.refresh_token_expires_in) * 1000).toISOString()
      : null,
  };

  await env.EBAY_TOKENS.put(TOKEN_RECORD_KEY, JSON.stringify(record));
  accessTokenCache = tokenResult.access_token
    ? { token: tokenResult.access_token, expiresAt: now + Number(tokenResult.expires_in || 7200) * 1000 }
    : null;
  return record;
}

async function getConnection(env) {
  if (!env.EBAY_TOKENS) return null;
  const raw = await env.EBAY_TOKENS.get(TOKEN_RECORD_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function getUserAccessToken(env) {
  if (accessTokenCache?.token && accessTokenCache.expiresAt > Date.now() + 60_000) {
    return accessTokenCache.token;
  }

  const connection = await getConnection(env);
  if (!connection?.refreshToken) throw new Error("eBay is not connected.");

  const result = await tokenRequest(env, {
    grant_type: "refresh_token",
    refresh_token: connection.refreshToken,
  });

  accessTokenCache = {
    token: result.access_token,
    expiresAt: Date.now() + Number(result.expires_in || 7200) * 1000,
  };
  return result.access_token;
}

async function ebayGet(accessToken, path) {
  const response = await fetch(`${EBAY_API_URL}${path}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json",
    },
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const ebayMessage = result?.errors?.[0]?.longMessage
      || result?.errors?.[0]?.message
      || result?.error_description
      || result?.error
      || `eBay API request failed (${response.status}).`;
    throw new Error(ebayMessage);
  }
  return result;
}

async function handleOAuthStart(request, env, origin) {
  const missing = missingOAuthSetup(env);
  if (missing.length) {
    return json({ ok: false, error: "eBay OAuth setup is incomplete.", missing }, 503, origin);
  }
  if (!ownerAuthorized(request, env)) {
    return json({ ok: false, error: "SourceTro owner authorization required." }, 401, origin);
  }

  const state = await createSignedState(env.EBAY_STATE_SECRET);
  const authUrl = new URL(EBAY_AUTH_URL);
  authUrl.searchParams.set("client_id", env.EBAY_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", env.EBAY_RUNAME);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", EBAY_SCOPES.join(" "));
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("locale", "en-US");
  authUrl.searchParams.set("prompt", "login");

  return json({ ok: true, authUrl: authUrl.toString() }, 200, origin);
}

async function handleOAuthCallback(url, env) {
  const missing = missingOAuthSetup(env);
  if (missing.length) {
    return htmlPage("SourceTro eBay setup is incomplete", `Missing: ${missing.join(", ")}.`, 503);
  }

  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  if (!code) return htmlPage("eBay connection did not complete", "No authorization code was returned by eBay.");
  if (!(await verifySignedState(state, env.EBAY_STATE_SECRET))) {
    return htmlPage("eBay connection blocked", "The authorization state could not be verified. Please start the connection again from SourceTro.", 403);
  }

  try {
    const tokenResult = await tokenRequest(env, {
      grant_type: "authorization_code",
      code,
      redirect_uri: env.EBAY_RUNAME,
    });
    await storeConnection(env, tokenResult);
    return redirect(`${SOURCETRO_APP_URL}?ebay=connected#marketplaces`);
  } catch (error) {
    console.error("eBay OAuth callback failed:", error);
    return htmlPage("eBay connection failed", error.message || "SourceTro could not finish the eBay connection.", 502);
  }
}

async function handleStatus(request, env, origin) {
  const missing = missingOAuthSetup(env);
  if (missing.length) {
    return json({ ok: true, connected: false, setupReady: false, missing }, 200, origin);
  }
  if (!ownerAuthorized(request, env)) {
    return json({ ok: false, error: "SourceTro owner authorization required." }, 401, origin);
  }

  const connection = await getConnection(env);
  if (!connection?.refreshToken) {
    return json({ ok: true, connected: false, setupReady: true, environment: "production" }, 200, origin);
  }

  try {
    await getUserAccessToken(env);
    return json({
      ok: true,
      connected: true,
      setupReady: true,
      environment: "production",
      connectedAt: connection.connectedAt || null,
      refreshTokenExpiresAt: connection.refreshTokenExpiresAt || null,
      scopes: connection.scopes || EBAY_SCOPES,
    }, 200, origin);
  } catch (error) {
    return json({
      ok: true,
      connected: false,
      setupReady: true,
      needsReconnect: true,
      error: "The saved eBay authorization needs to be renewed.",
    }, 200, origin);
  }
}

function policyMatch(policies, expectedName, idField) {
  const match = policies.find((policy) => policy?.name === expectedName);
  return match
    ? { found: true, name: match.name, id: match[idField] || null }
    : { found: false, name: expectedName, id: null };
}

async function handlePolicies(request, env, origin) {
  const missing = missingOAuthSetup(env);
  if (missing.length) {
    return json({ ok: false, error: "eBay OAuth setup is incomplete.", missing }, 503, origin);
  }
  if (!ownerAuthorized(request, env)) {
    return json({ ok: false, error: "SourceTro owner authorization required." }, 401, origin);
  }

  try {
    const accessToken = await getUserAccessToken(env);
    const [paymentResult, returnResult, fulfillmentResult] = await Promise.all([
      ebayGet(accessToken, "/sell/account/v1/payment_policy?marketplace_id=EBAY_US"),
      ebayGet(accessToken, "/sell/account/v1/return_policy?marketplace_id=EBAY_US"),
      ebayGet(accessToken, "/sell/account/v1/fulfillment_policy?marketplace_id=EBAY_US"),
    ]);

    const paymentPolicies = Array.isArray(paymentResult.paymentPolicies) ? paymentResult.paymentPolicies : [];
    const returnPolicies = Array.isArray(returnResult.returnPolicies) ? returnResult.returnPolicies : [];
    const fulfillmentPolicies = Array.isArray(fulfillmentResult.fulfillmentPolicies) ? fulfillmentResult.fulfillmentPolicies : [];

    const expected = {
      payment: policyMatch(paymentPolicies, "Budget Basket - Payment", "paymentPolicyId"),
      returns: policyMatch(returnPolicies, "Budget Basket - Returns", "returnPolicyId"),
      shipping: policyMatch(fulfillmentPolicies, "Budget Basket - Shipping", "fulfillmentPolicyId"),
    };

    return json({
      ok: true,
      marketplaceId: "EBAY_US",
      ready: expected.payment.found && expected.returns.found && expected.shipping.found,
      expected,
      counts: {
        payment: paymentPolicies.length,
        returns: returnPolicies.length,
        shipping: fulfillmentPolicies.length,
      },
      policies: {
        payment: paymentPolicies,
        returns: returnPolicies,
        shipping: fulfillmentPolicies,
      },
    }, 200, origin);
  } catch (error) {
    console.error("eBay policy check failed:", error);
    return json({
      ok: false,
      error: error.message || "SourceTro could not read the eBay business policies.",
    }, 502, origin);
  }
}

async function handleLocations(request, env, origin) {
  const missing = missingOAuthSetup(env);
  if (missing.length) {
    return json({ ok: false, error: "eBay OAuth setup is incomplete.", missing }, 503, origin);
  }
  if (!ownerAuthorized(request, env)) {
    return json({ ok: false, error: "SourceTro owner authorization required." }, 401, origin);
  }

  try {
    const accessToken = await getUserAccessToken(env);
    const result = await ebayGet(accessToken, "/sell/inventory/v1/location?limit=100");
    const locations = Array.isArray(result.locations) ? result.locations : [];
    const enabledLocations = locations.filter((item) => item?.merchantLocationStatus === "ENABLED");

    return json({
      ok: true,
      ready: enabledLocations.length > 0,
      total: Number(result.total || locations.length || 0),
      enabledCount: enabledLocations.length,
      locations,
    }, 200, origin);
  } catch (error) {
    console.error("eBay inventory location check failed:", error);
    return json({
      ok: false,
      error: error.message || "SourceTro could not read the eBay inventory locations.",
    }, 502, origin);
  }
}

async function handleDisconnect(request, env, origin) {
  if (!ownerAuthorized(request, env)) {
    return json({ ok: false, error: "SourceTro owner authorization required." }, 401, origin);
  }
  if (env.EBAY_TOKENS) await env.EBAY_TOKENS.delete(TOKEN_RECORD_KEY);
  accessTokenCache = null;
  return json({ ok: true, connected: false }, 200, origin);
}

async function handleMarketplaceAccountDeletion(request, env) {
  // SourceTro Personal Mode currently supports one connected eBay seller account.
  // If eBay sends an account-deletion event, remove the stored eBay authorization
  // immediately so SourceTro no longer retains access to that user's eBay data.
  try {
    const payload = await request.json();
    if (payload?.metadata?.topic === "MARKETPLACE_ACCOUNT_DELETION" && env.EBAY_TOKENS) {
      await env.EBAY_TOKENS.delete(TOKEN_RECORD_KEY);
      accessTokenCache = null;
    }
  } catch {
    // Acknowledge malformed/empty retry payloads without exposing internal details.
  }
  return new Response(null, { status: 204 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === "/oauth/callback" && request.method === "GET") {
      return handleOAuthCallback(url, env);
    }

    if (url.pathname === "/oauth/declined" && request.method === "GET") {
      return redirect(`${SOURCETRO_APP_URL}?ebay=declined#marketplaces`);
    }

    if (origin && origin !== SOURCETRO_ORIGIN) {
      return json({ ok: false, error: "Website not authorized." }, 403, origin);
    }

    if (url.pathname === "/oauth/start" && request.method === "POST") {
      return handleOAuthStart(request, env, origin);
    }

    if (url.pathname === "/status" && request.method === "GET") {
      return handleStatus(request, env, origin);
    }

    if (url.pathname === "/ebay/policies" && request.method === "GET") {
      return handlePolicies(request, env, origin);
    }

    if (url.pathname === "/ebay/locations" && request.method === "GET") {
      return handleLocations(request, env, origin);
    }

    if (url.pathname === "/disconnect" && request.method === "POST") {
      return handleDisconnect(request, env, origin);
    }

    // eBay Marketplace Account Deletion endpoint verification.
    if (request.method === "GET" && url.pathname === "/" && url.searchParams.has("challenge_code")) {
      const challengeCode = url.searchParams.get("challenge_code");
      const verificationToken = env.EBAY_VERIFICATION_TOKEN;
      if (!verificationToken) {
        return json({ error: "Verification token is not configured." }, 500, origin);
      }
      const challengeResponse = await sha256Hex(challengeCode + verificationToken + NOTIFICATION_ENDPOINT);
      return json({ challengeResponse }, 200, origin);
    }

    // eBay Marketplace Account Deletion notifications.
    if (request.method === "POST" && url.pathname === "/") {
      return handleMarketplaceAccountDeletion(request, env);
    }

    if (request.method === "GET" && url.pathname === "/") {
      return new Response("SourceTro eBay gateway is running.", {
        status: 200,
        headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
      });
    }

    return json({ error: "Not found." }, 404, origin);
  },
};
