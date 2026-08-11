const NOTIFICATION_ENDPOINT = "https://sourcetro-ebay-test.nydia-burgos.workers.dev/";
const SOURCETRO_ORIGIN = "https://selltro.github.io";
const SOURCETRO_APP_URL = "https://selltro.github.io/Sourcetro/";
const EBAY_AUTH_URL = "https://auth.ebay.com/oauth2/authorize";
const EBAY_TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const EBAY_API_URL = "https://api.ebay.com";
const EBAY_MEDIA_URL = "https://apim.ebay.com/commerce/media/v1_beta";
const EBAY_TRADING_URL = "https://api.ebay.com/ws/api.dll";
const EBAY_TRADING_VERSION = "1455";
const EBAY_SCOPES = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
];
const TOKEN_RECORD_KEY = "primary-ebay-connection";
const STATE_MAX_AGE_MS = 10 * 60 * 1000;
const MARKETPLACE_ID = "EBAY_US";
const CATEGORY_TREE_ID = "0";
const SHIP_FROM_KEY = "budget-basket-01108";
const SHIP_FROM_POSTAL = "01108";

let accessTokenCache = null;
let applicationTokenCache = null;

function corsHeaders(origin = "") {
  return {
    "Access-Control-Allow-Origin": origin === SOURCETRO_ORIGIN ? origin : SOURCETRO_ORIGIN,
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
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hashBuffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacKey(secret, usage) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usage);
}

async function createSignedState(secret, returnRoute = "marketplaces") {
  const payload = JSON.stringify({
    issuedAt: Date.now(),
    nonce: crypto.randomUUID(),
    returnRoute: returnRoute === "inventory" ? "inventory" : "marketplaces",
  });
  const payloadPart = bytesToBase64Url(new TextEncoder().encode(payload));
  const key = await hmacKey(secret, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadPart));
  return `${payloadPart}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

async function verifySignedState(value, secret) {
  if (!value || !secret) return null;
  const [payloadPart, signaturePart, extra] = value.split(".");
  if (!payloadPart || !signaturePart || extra) return null;
  try {
    const key = await hmacKey(secret, ["verify"]);
    const valid = await crypto.subtle.verify("HMAC", key, base64UrlToBytes(signaturePart), new TextEncoder().encode(payloadPart));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadPart)));
    const fresh = Number.isFinite(payload.issuedAt)
      && payload.issuedAt <= Date.now() + 60_000
      && Date.now() - payload.issuedAt <= STATE_MAX_AGE_MS;
    return fresh ? payload : null;
  } catch {
    return null;
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
  if (!response.ok) throw new Error(result.error_description || result.error || `eBay token request failed (${response.status}).`);
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
  try { return JSON.parse(raw); } catch { return null; }
}

async function getUserAccessToken(env) {
  if (accessTokenCache?.token && accessTokenCache.expiresAt > Date.now() + 60_000) return accessTokenCache.token;
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

async function getApplicationAccessToken(env) {
  if (applicationTokenCache?.token && applicationTokenCache.expiresAt > Date.now() + 60_000) return applicationTokenCache.token;
  const result = await tokenRequest(env, {
    grant_type: "client_credentials",
    scope: "https://api.ebay.com/oauth/api_scope",
  });
  applicationTokenCache = {
    token: result.access_token,
    expiresAt: Date.now() + Number(result.expires_in || 7200) * 1000,
  };
  return result.access_token;
}

function ebayError(result, fallback) {
  const candidates = [
    result?.errors?.[0]?.longMessage,
    result?.errors?.[0]?.message,
    result?.warnings?.[0]?.longMessage,
    result?.error_description,
    result?.error,
    result?.message,
  ];
  return candidates.find(Boolean) || fallback;
}

async function ebayJson(accessToken, path, options = {}) {
  const response = await fetch(`${EBAY_API_URL}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json",
      ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(ebayError(result, `eBay API request failed (${response.status}).`));
  return result;
}

async function ebayGet(accessToken, path, headers = {}) {
  return ebayJson(accessToken, path, { method: "GET", headers });
}

function decodeXml(value = "") {
  const text = String(value).replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1");
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

function xmlEscape(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlTag(xml, tag) {
  const match = String(xml || "").match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function xmlBlocks(xml, tag) {
  return [...String(xml || "").matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "gi"))]
    .map((match) => match[1]);
}

function xmlValues(xml, tag) {
  return xmlBlocks(xml, tag).map((value) => decodeXml(value)).filter(Boolean);
}

function htmlToText(value = "") {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function parseItemSpecifics(itemXml) {
  const block = xmlBlocks(itemXml, "ItemSpecifics")[0] || "";
  const result = {};
  for (const entry of xmlBlocks(block, "NameValueList")) {
    const name = xmlTag(entry, "Name");
    const values = xmlValues(entry, "Value");
    if (name) result[name] = values.length > 1 ? values : (values[0] || "");
  }
  return result;
}

function tradingMessage(xml, status) {
  const first = xmlBlocks(xml, "Errors")[0] || xml;
  return xmlTag(first, "LongMessage") || xmlTag(first, "ShortMessage") || `eBay Trading API request failed (${status}).`;
}

function tradingWarnings(xml) {
  return xmlBlocks(xml, "Errors")
    .filter((block) => /warning/i.test(xmlTag(block, "SeverityCode")))
    .map((block) => xmlTag(block, "LongMessage") || xmlTag(block, "ShortMessage"))
    .filter(Boolean);
}

async function tradingCall(accessToken, callName, requestXml) {
  const response = await fetch(EBAY_TRADING_URL, {
    method: "POST",
    headers: {
      "X-EBAY-API-CALL-NAME": callName,
      "X-EBAY-API-COMPATIBILITY-LEVEL": EBAY_TRADING_VERSION,
      "X-EBAY-API-SITEID": "0",
      "X-EBAY-API-IAF-TOKEN": accessToken,
      "Content-Type": "text/xml",
    },
    body: requestXml,
  });
  const xml = await response.text();
  const ack = xmlTag(xml, "Ack");
  if (!response.ok || /failure/i.test(ack)) throw new Error(tradingMessage(xml, response.status));
  return xml;
}

async function getActiveSellingPage(accessToken, pageNumber) {
  return tradingCall(accessToken, "GetMyeBaySelling", `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <DetailLevel>ReturnAll</DetailLevel>
  <ActiveList><Include>true</Include><Pagination><EntriesPerPage>100</EntriesPerPage><PageNumber>${pageNumber}</PageNumber></Pagination></ActiveList>
</GetMyeBaySellingRequest>`);
}

function normalizeActiveItem(itemXml) {
  const itemId = xmlTag(itemXml, "ItemID");
  if (!itemId) return null;
  const primaryCategory = xmlBlocks(itemXml, "PrimaryCategory")[0] || "";
  const listingDetails = xmlBlocks(itemXml, "ListingDetails")[0] || "";
  const sellingStatus = xmlBlocks(itemXml, "SellingStatus")[0] || "";
  const pictureDetails = xmlBlocks(itemXml, "PictureDetails")[0] || "";
  const pictureUrls = xmlValues(pictureDetails, "PictureURL");
  const galleryUrl = xmlTag(pictureDetails, "GalleryURL") || xmlTag(pictureDetails, "ExternalPictureURL");
  return {
    itemId,
    title: xmlTag(itemXml, "Title"),
    sku: xmlTag(itemXml, "SKU"),
    price: xmlTag(sellingStatus, "CurrentPrice") || xmlTag(itemXml, "BuyItNowPrice") || xmlTag(itemXml, "StartPrice"),
    currency: "USD",
    condition: xmlTag(itemXml, "ConditionDisplayName"),
    categoryId: xmlTag(primaryCategory, "CategoryID"),
    categoryName: xmlTag(primaryCategory, "CategoryName"),
    listingType: xmlTag(itemXml, "ListingType"),
    quantityAvailable: Number(xmlTag(itemXml, "QuantityAvailable") || xmlTag(itemXml, "Quantity") || 0),
    watchCount: Number(xmlTag(itemXml, "WatchCount") || 0),
    pictureUrl: pictureUrls[0] || galleryUrl || "",
    pictureUrls: pictureUrls.length ? pictureUrls : (galleryUrl ? [galleryUrl] : []),
    itemSpecifics: parseItemSpecifics(itemXml),
    startTime: xmlTag(listingDetails, "StartTime"),
    endTime: xmlTag(listingDetails, "EndTime"),
    viewItemUrl: xmlTag(listingDetails, "ViewItemURLForNaturalSearch") || xmlTag(listingDetails, "ViewItemURL") || `https://www.ebay.com/itm/${itemId}`,
  };
}

async function getFullItem(accessToken, itemId) {
  const xml = await tradingCall(accessToken, "GetItem", `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <DetailLevel>ReturnAll</DetailLevel><IncludeItemSpecifics>true</IncludeItemSpecifics><IncludeWatchCount>true</IncludeWatchCount><ItemID>${xmlEscape(itemId)}</ItemID>
</GetItemRequest>`);
  const itemXml = xmlBlocks(xml, "Item")[0] || "";
  if (!itemXml) throw new Error("eBay did not return the listing details.");
  const primaryCategory = xmlBlocks(itemXml, "PrimaryCategory")[0] || "";
  const listingDetails = xmlBlocks(itemXml, "ListingDetails")[0] || "";
  const sellingStatus = xmlBlocks(itemXml, "SellingStatus")[0] || "";
  const pictureDetails = xmlBlocks(itemXml, "PictureDetails")[0] || "";
  const pictureUrls = xmlValues(pictureDetails, "PictureURL");
  const galleryUrl = xmlTag(pictureDetails, "GalleryURL") || xmlTag(pictureDetails, "ExternalPictureURL");
  const descriptionHtml = xmlTag(itemXml, "Description");
  return {
    itemId,
    title: xmlTag(itemXml, "Title"),
    description: htmlToText(descriptionHtml),
    descriptionHtml,
    sku: xmlTag(itemXml, "SKU"),
    price: xmlTag(sellingStatus, "CurrentPrice") || xmlTag(itemXml, "BuyItNowPrice") || xmlTag(itemXml, "StartPrice"),
    currency: "USD",
    condition: xmlTag(itemXml, "ConditionDisplayName"),
    conditionId: xmlTag(itemXml, "ConditionID"),
    categoryId: xmlTag(primaryCategory, "CategoryID"),
    categoryName: xmlTag(primaryCategory, "CategoryName"),
    listingType: xmlTag(itemXml, "ListingType"),
    quantityAvailable: Number(xmlTag(itemXml, "QuantityAvailable") || xmlTag(itemXml, "Quantity") || 0),
    watchCount: Number(xmlTag(itemXml, "WatchCount") || 0),
    pictureUrls: pictureUrls.length ? pictureUrls : (galleryUrl ? [galleryUrl] : []),
    itemSpecifics: parseItemSpecifics(itemXml),
    hasVariations: Boolean(xmlBlocks(itemXml, "Variations")[0]),
    startTime: xmlTag(listingDetails, "StartTime"),
    endTime: xmlTag(listingDetails, "EndTime"),
    viewItemUrl: xmlTag(listingDetails, "ViewItemURLForNaturalSearch") || xmlTag(listingDetails, "ViewItemURL") || `https://www.ebay.com/itm/${itemId}`,
  };
}

function needsReconnect(error) {
  return /token|oauth|auth|scope|permission|iaf|authorization/i.test(error?.message || "");
}

async function handleActiveListings(request, env, origin) {
  const missing = missingOAuthSetup(env);
  if (missing.length) return json({ ok: false, error: "eBay OAuth setup is incomplete.", missing }, 503, origin);
  if (!ownerAuthorized(request, env)) return json({ ok: false, error: "SourceTro owner authorization required." }, 401, origin);
  const connection = await getConnection(env);
  if (!connection?.scopes?.includes("https://api.ebay.com/oauth/api_scope")) {
    return json({ ok: false, needsReconnect: true, error: "Reconnect eBay once to enable active listing access." }, 403, origin);
  }
  try {
    const accessToken = await getUserAccessToken(env);
    const listingsById = new Map();
    let pageNumber = 1;
    let totalPages = 1;
    let reportedTotal = 0;
    while (pageNumber <= totalPages && pageNumber <= 125) {
      const xml = await getActiveSellingPage(accessToken, pageNumber);
      const activeList = xmlBlocks(xml, "ActiveList")[0] || "";
      const pagination = xmlBlocks(activeList, "PaginationResult")[0] || "";
      totalPages = Math.max(1, Number(xmlTag(pagination, "TotalNumberOfPages") || 1));
      reportedTotal = Number(xmlTag(pagination, "TotalNumberOfEntries") || reportedTotal || 0);
      const itemArray = xmlBlocks(activeList, "ItemArray")[0] || "";
      for (const block of xmlBlocks(itemArray, "Item")) {
        const item = normalizeActiveItem(block);
        if (item) listingsById.set(item.itemId, item);
      }
      pageNumber += 1;
    }
    const listings = [...listingsById.values()];
    return json({ ok: true, readOnly: true, marketplaceId: MARKETPLACE_ID, total: reportedTotal || listings.length, importedCount: listings.length, listings }, 200, origin);
  } catch (error) {
    return json({ ok: false, needsReconnect: needsReconnect(error), error: error.message || "SourceTro could not read your active eBay listings." }, needsReconnect(error) ? 403 : 502, origin);
  }
}

async function handleListingItem(request, env, origin, url) {
  const missing = missingOAuthSetup(env);
  if (missing.length) return json({ ok: false, error: "eBay OAuth setup is incomplete.", missing }, 503, origin);
  if (!ownerAuthorized(request, env)) return json({ ok: false, error: "SourceTro owner authorization required." }, 401, origin);
  const itemId = String(url.searchParams.get("item_id") || "").trim();
  if (!/^\d{9,20}$/.test(itemId)) return json({ ok: false, error: "A valid eBay item number is required." }, 400, origin);
  try {
    const accessToken = await getUserAccessToken(env);
    const item = await getFullItem(accessToken, itemId);
    return json({ ok: true, readOnly: true, item }, 200, origin);
  } catch (error) {
    return json({ ok: false, needsReconnect: needsReconnect(error), error: error.message || "SourceTro could not read that eBay listing." }, needsReconnect(error) ? 403 : 502, origin);
  }
}

async function handleReviseListing(request, env, origin) {
  const missing = missingOAuthSetup(env);
  if (missing.length) return json({ ok: false, error: "eBay OAuth setup is incomplete.", missing }, 503, origin);
  if (!ownerAuthorized(request, env)) return json({ ok: false, error: "SourceTro owner authorization required." }, 401, origin);
  const body = await request.json().catch(() => ({}));
  const itemId = String(body?.itemId || "").trim();
  const changes = body?.changes && typeof body.changes === "object" ? body.changes : {};
  if (!/^\d{9,20}$/.test(itemId)) return json({ ok: false, error: "A valid eBay item number is required." }, 400, origin);
  const requested = {};
  if (Object.prototype.hasOwnProperty.call(changes, "title")) {
    requested.title = String(changes.title || "").trim();
    if (!requested.title || requested.title.length > 80) return json({ ok: false, error: "eBay titles must be between 1 and 80 characters." }, 400, origin);
  }
  if (Object.prototype.hasOwnProperty.call(changes, "description")) {
    requested.description = String(changes.description || "").trim();
    if (!requested.description) return json({ ok: false, error: "The eBay description cannot be blank." }, 400, origin);
  }
  if (Object.prototype.hasOwnProperty.call(changes, "price")) {
    requested.price = Number(changes.price);
    if (!Number.isFinite(requested.price) || requested.price <= 0) return json({ ok: false, error: "Enter a valid eBay price greater than zero." }, 400, origin);
  }
  if (!Object.keys(requested).length) return json({ ok: false, error: "No eBay changes were selected." }, 400, origin);
  try {
    const accessToken = await getUserAccessToken(env);
    const current = await getFullItem(accessToken, itemId);
    if (Object.prototype.hasOwnProperty.call(requested, "price") && current.hasVariations) {
      return json({ ok: false, error: "Price changes for eBay variation listings are not enabled yet. Title or description changes can still be updated safely." }, 400, origin);
    }
    const isFixedPrice = /fixedprice|storeinventory/i.test(current.listingType || "");
    const callName = isFixedPrice ? "ReviseFixedPriceItem" : "ReviseItem";
    const requestName = `${callName}Request`;
    const fields = [
      `<ItemID>${xmlEscape(itemId)}</ItemID>`,
      Object.prototype.hasOwnProperty.call(requested, "title") ? `<Title>${xmlEscape(requested.title)}</Title>` : "",
      Object.prototype.hasOwnProperty.call(requested, "description") ? `<Description>${xmlEscape(requested.description)}</Description>` : "",
      Object.prototype.hasOwnProperty.call(requested, "price") ? `<StartPrice currencyID="USD">${requested.price.toFixed(2)}</StartPrice>` : "",
    ].filter(Boolean).join("\n    ");
    const reviseXml = `<?xml version="1.0" encoding="utf-8"?>
<${requestName} xmlns="urn:ebay:apis:eBLBaseComponents"><WarningLevel>High</WarningLevel><Item>${fields}</Item></${requestName}>`;
    const resultXml = await tradingCall(accessToken, callName, reviseXml);
    const warnings = tradingWarnings(resultXml);
    const updatedItem = await getFullItem(accessToken, itemId);
    return json({ ok: true, updated: true, itemId, callName, changedFields: Object.keys(requested), warnings, item: updatedItem }, 200, origin);
  } catch (error) {
    return json({ ok: false, needsReconnect: needsReconnect(error), error: error.message || "SourceTro could not update that eBay listing." }, needsReconnect(error) ? 403 : 502, origin);
  }
}

function policyMatch(policies, expectedName, idField) {
  const match = policies.find((policy) => policy?.name === expectedName);
  return match ? { found: true, name: match.name, id: match[idField] || null } : { found: false, name: expectedName, id: null };
}

async function getExpectedPolicies(accessToken) {
  const [paymentResult, returnResult, fulfillmentResult] = await Promise.all([
    ebayGet(accessToken, `/sell/account/v1/payment_policy?marketplace_id=${MARKETPLACE_ID}`),
    ebayGet(accessToken, `/sell/account/v1/return_policy?marketplace_id=${MARKETPLACE_ID}`),
    ebayGet(accessToken, `/sell/account/v1/fulfillment_policy?marketplace_id=${MARKETPLACE_ID}`),
  ]);
  const paymentPolicies = Array.isArray(paymentResult.paymentPolicies) ? paymentResult.paymentPolicies : [];
  const returnPolicies = Array.isArray(returnResult.returnPolicies) ? returnResult.returnPolicies : [];
  const fulfillmentPolicies = Array.isArray(fulfillmentResult.fulfillmentPolicies) ? fulfillmentResult.fulfillmentPolicies : [];
  const expected = {
    payment: policyMatch(paymentPolicies, "Budget Basket - Payment", "paymentPolicyId"),
    returns: policyMatch(returnPolicies, "Budget Basket - Returns", "returnPolicyId"),
    shipping: policyMatch(fulfillmentPolicies, "Budget Basket - Shipping", "fulfillmentPolicyId"),
  };
  return {
    ready: expected.payment.found && expected.returns.found && expected.shipping.found,
    expected,
    counts: { payment: paymentPolicies.length, returns: returnPolicies.length, shipping: fulfillmentPolicies.length },
    policies: { payment: paymentPolicies, returns: returnPolicies, shipping: fulfillmentPolicies },
  };
}

async function getLocations(accessToken) {
  const result = await ebayGet(accessToken, "/sell/inventory/v1/location?limit=100");
  const locations = Array.isArray(result.locations) ? result.locations : [];
  const enabledLocations = locations.filter((item) => item?.merchantLocationStatus === "ENABLED");
  const preferred = enabledLocations.find((item) => item?.merchantLocationKey === SHIP_FROM_KEY) || null;
  return { ready: Boolean(preferred || enabledLocations.length), preferred, enabledLocations, locations, total: Number(result.total || locations.length || 0) };
}

async function handlePolicies(request, env, origin) {
  const missing = missingOAuthSetup(env);
  if (missing.length) return json({ ok: false, error: "eBay OAuth setup is incomplete.", missing }, 503, origin);
  if (!ownerAuthorized(request, env)) return json({ ok: false, error: "SourceTro owner authorization required." }, 401, origin);
  try {
    const accessToken = await getUserAccessToken(env);
    const result = await getExpectedPolicies(accessToken);
    return json({ ok: true, marketplaceId: MARKETPLACE_ID, ...result }, 200, origin);
  } catch (error) {
    return json({ ok: false, error: error.message || "SourceTro could not read the eBay business policies." }, 502, origin);
  }
}

async function handleLocations(request, env, origin) {
  const missing = missingOAuthSetup(env);
  if (missing.length) return json({ ok: false, error: "eBay OAuth setup is incomplete.", missing }, 503, origin);
  if (!ownerAuthorized(request, env)) return json({ ok: false, error: "SourceTro owner authorization required." }, 401, origin);
  try {
    const accessToken = await getUserAccessToken(env);
    const result = await getLocations(accessToken);
    return json({ ok: true, ready: result.ready, total: result.total, enabledCount: result.enabledLocations.length, locations: result.locations }, 200, origin);
  } catch (error) {
    return json({ ok: false, error: error.message || "SourceTro could not read the eBay inventory locations." }, 502, origin);
  }
}

async function handleCreateLocation(request, env, origin) {
  if (!ownerAuthorized(request, env)) return json({ ok: false, error: "SourceTro owner authorization required." }, 401, origin);
  try {
    const accessToken = await getUserAccessToken(env);
    const locationPath = `/sell/inventory/v1/location/${SHIP_FROM_KEY}`;
    const existingResponse = await fetch(`${EBAY_API_URL}${locationPath}`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${accessToken}`, "Accept": "application/json" },
    });
    if (existingResponse.ok) {
      const existing = await existingResponse.json().catch(() => ({}));
      return json({ ok: true, created: false, alreadyExists: true, merchantLocationKey: SHIP_FROM_KEY, name: existing.name || "Budget Basket Ship From" }, 200, origin);
    }
    if (existingResponse.status !== 404) {
      const result = await existingResponse.json().catch(() => ({}));
      throw new Error(ebayError(result, `eBay location check failed (${existingResponse.status}).`));
    }
    const response = await fetch(`${EBAY_API_URL}${locationPath}`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${accessToken}`, "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Budget Basket Ship From",
        merchantLocationStatus: "ENABLED",
        locationTypes: ["WAREHOUSE"],
        location: { address: { postalCode: SHIP_FROM_POSTAL, country: "US" } },
      }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(ebayError(result, `eBay location creation failed (${response.status}).`));
    }
    return json({ ok: true, created: true, alreadyExists: false, merchantLocationKey: SHIP_FROM_KEY, name: "Budget Basket Ship From" }, 200, origin);
  } catch (error) {
    return json({ ok: false, error: error.message || "SourceTro could not create the eBay ship-from location." }, 502, origin);
  }
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  if (sorted.length === 1) return sorted[0];
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

async function handleResearch(request, env, origin, url) {
  const missing = missingOAuthSetup(env);
  if (missing.length) return json({ ok: true, available: false, error: "eBay app credentials are not ready yet." }, 200, origin);
  if (!ownerAuthorized(request, env)) return json({ ok: false, error: "SourceTro owner authorization required." }, 401, origin);
  const query = String(url.searchParams.get("q") || "").trim().slice(0, 200);
  if (!query) return json({ ok: false, error: "Enter an item title or search phrase first." }, 400, origin);
  try {
    const token = await getApplicationAccessToken(env);
    const path = `/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&limit=30&filter=${encodeURIComponent("buyingOptions:{FIXED_PRICE}")}`;
    const result = await ebayGet(token, path, { "X-EBAY-C-MARKETPLACE-ID": MARKETPLACE_ID });
    const items = Array.isArray(result.itemSummaries) ? result.itemSummaries : [];
    const priced = items.map((item) => ({
      title: String(item?.title || ""),
      price: Number(item?.price?.value || 0),
      currency: item?.price?.currency || "USD",
      condition: String(item?.condition || ""),
      url: String(item?.itemWebUrl || item?.itemAffiliateWebUrl || ""),
      image: String(item?.image?.imageUrl || ""),
    })).filter((item) => Number.isFinite(item.price) && item.price > 0 && item.currency === "USD");
    const prices = priced.map((item) => item.price).sort((a, b) => a - b);
    if (!prices.length) {
      return json({ ok: true, available: true, query, count: 0, sold: false, priceType: "active_asking", stats: null, samples: [] }, 200, origin);
    }
    const stats = {
      low: Number(percentile(prices, 0.25).toFixed(2)),
      median: Number(percentile(prices, 0.5).toFixed(2)),
      high: Number(percentile(prices, 0.75).toFixed(2)),
    };
    return json({ ok: true, available: true, query, count: priced.length, sold: false, priceType: "active_asking", source: "eBay active fixed-price listings", stats, samples: priced.slice(0, 8) }, 200, origin);
  } catch (error) {
    return json({
      ok: true,
      available: false,
      query,
      sold: false,
      priceType: "active_asking",
      error: "Live eBay marketplace research is not enabled for this app yet. SourceTro can still prepare and publish the listing.",
      detail: String(error?.message || "").slice(0, 240),
    }, 200, origin);
  }
}

function categorySearchText(listing = {}) {
  return String(listing.title || [listing.brand, listing.itemType, listing.category, listing.styleModel].filter(Boolean).join(" ")).trim().slice(0, 200);
}

async function categorySuggestions(appToken, listing = {}) {
  const provided = String(listing.ebayCategoryId || "").trim();
  const query = categorySearchText(listing);
  let suggestions = [];
  if (query) {
    try {
      const result = await ebayGet(appToken, `/commerce/taxonomy/v1/category_tree/${CATEGORY_TREE_ID}/get_category_suggestions?q=${encodeURIComponent(query)}`);
      suggestions = (Array.isArray(result.categorySuggestions) ? result.categorySuggestions : [])
        .map((entry) => ({ id: String(entry?.category?.categoryId || ""), name: String(entry?.category?.categoryName || "") }))
        .filter((entry) => entry.id && entry.name)
        .slice(0, 5);
    } catch {}
  }
  if (provided && !suggestions.some((item) => item.id === provided)) {
    suggestions.unshift({ id: provided, name: String(listing.ebayCategoryName || `eBay category ${provided}`) });
  }
  const selected = provided
    ? suggestions.find((item) => item.id === provided) || { id: provided, name: String(listing.ebayCategoryName || `eBay category ${provided}`) }
    : suggestions[0] || null;
  return { selected, suggestions };
}

function aspectListingValue(name, listing = {}) {
  const custom = listing.ebayAspects && typeof listing.ebayAspects === "object" ? listing.ebayAspects[name] : "";
  if (custom) return String(custom);
  const lower = String(name).toLowerCase();
  if (lower === "brand") return String(listing.brand || "");
  if (lower === "size" || lower === "us size") return String(listing.size || "");
  if (lower === "color" || lower === "colour") return String(listing.color || "");
  if (lower === "material" || lower === "fabric type") return String(listing.material || "");
  if (lower === "style" || lower === "model" || lower === "model number") return String(listing.styleModel || "");
  if (lower === "type" || lower === "product") return String(listing.itemType || "");
  if (lower === "department") {
    const category = String(listing.category || "").toLowerCase();
    if (category.includes("women")) return "Women";
    if (category.includes("men")) return "Men";
    if (category.includes("kid")) return "Unisex Kids";
  }
  return "";
}

async function categoryAspects(appToken, categoryId, listing = {}) {
  if (!categoryId) return [];
  try {
    const result = await ebayGet(appToken, `/commerce/taxonomy/v1/category_tree/${CATEGORY_TREE_ID}/get_item_aspects_for_category?category_id=${encodeURIComponent(categoryId)}`);
    const aspects = Array.isArray(result.aspects) ? result.aspects : [];
    return aspects.map((item) => {
      const constraint = item.aspectConstraint || {};
      const values = (Array.isArray(item.aspectValues) ? item.aspectValues : []).map((value) => String(value.localizedValue || "")).filter(Boolean).slice(0, 100);
      return {
        name: String(item.localizedAspectName || ""),
        required: Boolean(constraint.aspectRequired),
        mode: String(constraint.aspectMode || ""),
        values,
        value: aspectListingValue(item.localizedAspectName, listing),
      };
    }).filter((item) => item.name);
  } catch {
    return [];
  }
}

const CONDITION_ENUM_BY_ID = {
  "1000": "NEW",
  "1500": "NEW_OTHER",
  "1750": "NEW_WITH_DEFECTS",
  "2000": "CERTIFIED_REFURBISHED",
  "2010": "EXCELLENT_REFURBISHED",
  "2020": "VERY_GOOD_REFURBISHED",
  "2030": "GOOD_REFURBISHED",
  "2500": "SELLER_REFURBISHED",
  "2750": "LIKE_NEW",
  "2990": "PRE_OWNED_EXCELLENT",
  "3000": "USED_EXCELLENT",
  "3010": "PRE_OWNED_FAIR",
  "4000": "USED_VERY_GOOD",
  "5000": "USED_GOOD",
  "6000": "USED_ACCEPTABLE",
  "7000": "FOR_PARTS_OR_NOT_WORKING",
};

const CONDITION_ID_BY_ENUM = Object.fromEntries(Object.entries(CONDITION_ENUM_BY_ID).map(([id, value]) => [value, id]));

function desiredConditionEnum(sourceTroCondition = "") {
  const text = String(sourceTroCondition).toLowerCase();
  if (/new with tag|new in box|brand new/.test(text)) return "NEW";
  if (/new without tag|new other/.test(text)) return "NEW_OTHER";
  if (/excellent|like new/.test(text)) return "PRE_OWNED_EXCELLENT";
  if (/fair|acceptable/.test(text)) return "PRE_OWNED_FAIR";
  return "USED_EXCELLENT";
}

async function conditionOptions(userToken, categoryId, listing = {}) {
  if (!categoryId) return { selected: null, options: [] };
  let raw = [];
  try {
    const filter = `categoryIds:{${categoryId}}`;
    const result = await ebayGet(userToken, `/sell/metadata/v1/marketplace/${MARKETPLACE_ID}/get_item_condition_policies?filter=${encodeURIComponent(filter)}`);
    const policies = Array.isArray(result.itemConditionPolicies) ? result.itemConditionPolicies : [];
    const exact = policies.find((policy) => String(policy.categoryId) === String(categoryId)) || policies[0];
    raw = Array.isArray(exact?.itemConditions) ? exact.itemConditions : [];
  } catch {}
  const options = raw.map((item) => {
    const id = String(item.conditionId || "");
    return { id, enum: CONDITION_ENUM_BY_ID[id] || `CONDITION_${id}`, name: String(item.conditionDescription || item.conditionDisplayName || item.localizedConditionName || `Condition ${id}`) };
  }).filter((item) => item.id);
  const desired = String(listing.ebayCondition || desiredConditionEnum(listing.condition));
  let selected = options.find((item) => item.enum === desired) || null;
  if (!selected && options.length === 1) selected = options[0];
  return { selected, options };
}

async function handlePreflight(request, env, origin) {
  const missing = missingOAuthSetup(env);
  if (missing.length) return json({ ok: false, error: "eBay OAuth setup is incomplete.", missing }, 503, origin);
  if (!ownerAuthorized(request, env)) return json({ ok: false, error: "SourceTro owner authorization required." }, 401, origin);
  const body = await request.json().catch(() => ({}));
  const listing = body?.listing && typeof body.listing === "object" ? body.listing : {};
  try {
    const [userToken, appToken] = await Promise.all([getUserAccessToken(env), getApplicationAccessToken(env)]);
    const categoryResult = await categorySuggestions(appToken, listing);
    const category = categoryResult.selected;
    const categoryId = category?.id || "";
    const [aspects, conditionResult, policies, locations] = await Promise.all([
      categoryAspects(appToken, categoryId, listing),
      conditionOptions(userToken, categoryId, listing),
      getExpectedPolicies(userToken),
      getLocations(userToken),
    ]);
    const requiredMissing = aspects.filter((item) => item.required && !String(item.value || listing.ebayAspects?.[item.name] || "").trim()).map((item) => item.name);
    const publishReady = Boolean(categoryId && conditionResult.selected && policies.ready && locations.ready && !requiredMissing.length);
    return json({
      ok: true,
      marketplaceId: MARKETPLACE_ID,
      category,
      categorySuggestions: categoryResult.suggestions,
      aspects,
      requiredMissing,
      condition: conditionResult.selected,
      conditionOptions: conditionResult.options,
      policiesReady: policies.ready,
      policies: policies.expected,
      locationReady: locations.ready,
      shipFrom: locations.preferred || locations.enabledLocations[0] || null,
      publishReady,
      publishMethod: "Trading AddFixedPriceItem",
    }, 200, origin);
  } catch (error) {
    return json({ ok: false, needsReconnect: needsReconnect(error), error: error.message || "SourceTro could not complete the eBay readiness check." }, needsReconnect(error) ? 403 : 502, origin);
  }
}

async function handleImageUpload(request, env, origin) {
  const missing = missingOAuthSetup(env);
  if (missing.length) return json({ ok: false, error: "eBay OAuth setup is incomplete.", missing }, 503, origin);
  if (!ownerAuthorized(request, env)) return json({ ok: false, error: "SourceTro owner authorization required." }, 401, origin);
  try {
    const form = await request.formData();
    const image = form.get("image");
    if (!image || typeof image.arrayBuffer !== "function") return json({ ok: false, error: "Choose an image file first." }, 400, origin);
    const type = String(image.type || "").toLowerCase();
    if (!type.startsWith("image/")) return json({ ok: false, error: "Only image files can be uploaded to eBay." }, 400, origin);
    if (Number(image.size || 0) > 15 * 1024 * 1024) return json({ ok: false, error: "That photo is too large. Use an image under 15 MB." }, 413, origin);
    const userToken = await getUserAccessToken(env);
    const outbound = new FormData();
    outbound.append("image", image, image.name || "sourcetro-photo.jpg");
    const response = await fetch(`${EBAY_MEDIA_URL}/image/create_image_from_file`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${userToken}`, "Accept": "application/json" },
      body: outbound,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(ebayError(result, `eBay photo upload failed (${response.status}).`));
    const location = response.headers.get("Location") || response.headers.get("location") || "";
    const imageId = location ? location.split("/").filter(Boolean).pop() : "";
    let details = result;
    if (!details.imageUrl && imageId) {
      const detailResponse = await fetch(`${EBAY_MEDIA_URL}/image/${encodeURIComponent(imageId)}`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${userToken}`, "Accept": "application/json" },
      });
      details = await detailResponse.json().catch(() => details);
    }
    const imageUrl = String(details.imageUrl || details.maxDimensionImageUrl || "");
    if (!imageUrl) throw new Error("eBay accepted the photo but did not return an EPS image URL.");
    return json({ ok: true, imageId, imageUrl, maxDimensionImageUrl: details.maxDimensionImageUrl || null, expirationDate: details.expirationDate || null }, 200, origin);
  } catch (error) {
    return json({ ok: false, needsReconnect: needsReconnect(error), error: error.message || "SourceTro could not upload that photo to eBay." }, needsReconnect(error) ? 403 : 502, origin);
  }
}

function cleanSku(value = "") {
  const clean = String(value).trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
  return clean || `ST-${Date.now()}`;
}

function normalizedAspectObject(listing = {}) {
  const source = listing.ebayAspects && typeof listing.ebayAspects === "object" ? listing.ebayAspects : {};
  const merged = { ...source };
  const fallback = {
    Brand: listing.brand,
    Size: listing.size,
    Color: listing.color,
    Material: listing.material,
    Style: listing.styleModel,
    Type: listing.itemType,
  };
  for (const [name, value] of Object.entries(fallback)) {
    if (value && !merged[name]) merged[name] = value;
  }
  return Object.fromEntries(Object.entries(merged)
    .map(([name, value]) => [String(name).trim(), Array.isArray(value) ? value : [value]])
    .map(([name, values]) => [name, values.map((value) => String(value || "").trim()).filter(Boolean)])
    .filter(([name, values]) => name && values.length));
}

function itemSpecificsXml(aspects = {}) {
  const entries = Object.entries(aspects).slice(0, 45);
  if (!entries.length) return "";
  return `<ItemSpecifics>${entries.map(([name, values]) => `<NameValueList><Name>${xmlEscape(name)}</Name>${values.map((value) => `<Value>${xmlEscape(value)}</Value>`).join("")}</NameValueList>`).join("")}</ItemSpecifics>`;
}

function pictureDetailsXml(imageUrls = []) {
  const urls = imageUrls.filter((url) => /^https:\/\//i.test(String(url))).slice(0, 24);
  if (!urls.length) return "";
  return `<PictureDetails><PictureSource>EPS</PictureSource>${urls.map((url) => `<PictureURL>${xmlEscape(url)}</PictureURL>`).join("")}</PictureDetails>`;
}

function conditionDescription(listing = {}, conditionId = "") {
  const id = Number(conditionId || 0);
  if (id >= 1000 && id < 1500) return "";
  const details = [listing.flaws, listing.notes].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  return details.slice(0, 1000);
}

function buildAddFixedPriceXml({ listing, categoryId, conditionId, imageUrls, policies, sku, verify = false }) {
  const title = String(listing.title || "").trim().slice(0, 80);
  const description = String(listing.description || "").trim();
  const price = Number(listing.listPrice || 0);
  const aspects = normalizedAspectObject(listing);
  const conditionText = conditionDescription(listing, conditionId);
  const root = verify ? "VerifyAddFixedPriceItemRequest" : "AddFixedPriceItemRequest";
  return `<?xml version="1.0" encoding="utf-8"?>
<${root} xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <Item>
    <Title>${xmlEscape(title)}</Title>
    <Description>${xmlEscape(description)}</Description>
    <PrimaryCategory><CategoryID>${xmlEscape(categoryId)}</CategoryID></PrimaryCategory>
    <StartPrice currencyID="USD">${price.toFixed(2)}</StartPrice>
    <ConditionID>${xmlEscape(conditionId)}</ConditionID>
    ${conditionText ? `<ConditionDescription>${xmlEscape(conditionText)}</ConditionDescription>` : ""}
    <Country>US</Country>
    <Currency>USD</Currency>
    <PostalCode>${SHIP_FROM_POSTAL}</PostalCode>
    <ListingDuration>GTC</ListingDuration>
    <ListingType>FixedPriceItem</ListingType>
    <Quantity>1</Quantity>
    <SKU>${xmlEscape(sku)}</SKU>
    <InventoryTrackingMethod>SKU</InventoryTrackingMethod>
    <CategoryMappingAllowed>true</CategoryMappingAllowed>
    ${itemSpecificsXml(aspects)}
    ${pictureDetailsXml(imageUrls)}
    <SellerProfiles>
      <SellerPaymentProfile><PaymentProfileID>${xmlEscape(policies.payment.id)}</PaymentProfileID></SellerPaymentProfile>
      <SellerReturnProfile><ReturnProfileID>${xmlEscape(policies.returns.id)}</ReturnProfileID></SellerReturnProfile>
      <SellerShippingProfile><ShippingProfileID>${xmlEscape(policies.shipping.id)}</ShippingProfileID></SellerShippingProfile>
    </SellerProfiles>
  </Item>
</${root}>`;
}

async function handlePublishListing(request, env, origin) {
  const missingSetup = missingOAuthSetup(env);
  if (missingSetup.length) return json({ ok: false, error: "eBay OAuth setup is incomplete.", missing: missingSetup }, 503, origin);
  if (!ownerAuthorized(request, env)) return json({ ok: false, error: "SourceTro owner authorization required." }, 401, origin);
  const body = await request.json().catch(() => ({}));
  const listing = body?.listing && typeof body.listing === "object" ? body.listing : {};
  const imageUrls = Array.isArray(body?.imageUrls) ? body.imageUrls.map(String).filter((url) => /^https:\/\//i.test(url)).slice(0, 24) : [];
  const title = String(listing.title || "").trim();
  const description = String(listing.description || "").trim();
  const price = Number(listing.listPrice || 0);
  const categoryId = String(listing.ebayCategoryId || "").trim();
  const conditionEnum = String(listing.ebayCondition || "").trim();
  const conditionId = CONDITION_ID_BY_ENUM[conditionEnum] || (/^CONDITION_\d+$/.test(conditionEnum) ? conditionEnum.replace("CONDITION_", "") : "");
  if (!title || title.length > 80) return json({ ok: false, error: "Your eBay title must be 1 to 80 characters." }, 400, origin);
  if (!description) return json({ ok: false, error: "Add an eBay description before publishing." }, 400, origin);
  if (!Number.isFinite(price) || price <= 0) return json({ ok: false, error: "Add an eBay list price greater than zero." }, 400, origin);
  if (!/^\d+$/.test(categoryId)) return json({ ok: false, error: "Choose an eBay category before publishing." }, 400, origin);
  if (!conditionId) return json({ ok: false, error: "Choose an eBay condition before publishing." }, 400, origin);
  if (!imageUrls.length) return json({ ok: false, error: "Add at least one eBay photo before publishing." }, 400, origin);
  try {
    const accessToken = await getUserAccessToken(env);
    const [policies, locations] = await Promise.all([getExpectedPolicies(accessToken), getLocations(accessToken)]);
    if (!policies.ready) return json({ ok: false, error: "Budget Basket's eBay payment, return, or shipping policy is missing." }, 400, origin);
    if (!locations.ready) return json({ ok: false, error: "Budget Basket's eBay ship-from location is not ready." }, 400, origin);
    const sku = cleanSku(listing.sku || listing.id || `ST-${Date.now()}`);
    const verifyXml = buildAddFixedPriceXml({ listing, categoryId, conditionId, imageUrls, policies: policies.expected, sku, verify: true });
    const verifyResult = await tradingCall(accessToken, "VerifyAddFixedPriceItem", verifyXml);
    const verifyWarnings = tradingWarnings(verifyResult);
    const addXml = buildAddFixedPriceXml({ listing, categoryId, conditionId, imageUrls, policies: policies.expected, sku, verify: false });
    const resultXml = await tradingCall(accessToken, "AddFixedPriceItem", addXml);
    const itemId = xmlTag(resultXml, "ItemID");
    if (!itemId) throw new Error("eBay accepted the listing request but did not return an item number.");
    const warnings = [...verifyWarnings, ...tradingWarnings(resultXml)];
    let item = null;
    try { item = await getFullItem(accessToken, itemId); } catch {}
    return json({
      ok: true,
      published: true,
      publishMethod: "Trading AddFixedPriceItem",
      itemId,
      listingId: itemId,
      offerId: null,
      sku,
      categoryId,
      warnings,
      viewItemUrl: item?.viewItemUrl || `https://www.ebay.com/itm/${itemId}`,
      item,
    }, 200, origin);
  } catch (error) {
    return json({ ok: false, needsReconnect: needsReconnect(error), error: error.message || "SourceTro could not publish that eBay listing." }, needsReconnect(error) ? 403 : 502, origin);
  }
}

async function handleOAuthStart(request, env, origin) {
  const missing = missingOAuthSetup(env);
  if (missing.length) return json({ ok: false, error: "eBay OAuth setup is incomplete.", missing }, 503, origin);
  if (!ownerAuthorized(request, env)) return json({ ok: false, error: "SourceTro owner authorization required." }, 401, origin);
  const body = await request.json().catch(() => ({}));
  const state = await createSignedState(env.EBAY_STATE_SECRET, body?.returnRoute);
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
  if (missing.length) return htmlPage("SourceTro eBay setup is incomplete", `Missing: ${missing.join(", ")}.`, 503);
  const code = url.searchParams.get("code") || "";
  const statePayload = await verifySignedState(url.searchParams.get("state") || "", env.EBAY_STATE_SECRET);
  if (!code) return htmlPage("eBay connection did not complete", "No authorization code was returned by eBay.");
  if (!statePayload) return htmlPage("eBay connection blocked", "The authorization state could not be verified. Please start the connection again from SourceTro.", 403);
  try {
    const tokenResult = await tokenRequest(env, { grant_type: "authorization_code", code, redirect_uri: env.EBAY_RUNAME });
    await storeConnection(env, tokenResult);
    return redirect(`${SOURCETRO_APP_URL}?ebay=connected#${statePayload.returnRoute === "inventory" ? "inventory" : "marketplaces"}`);
  } catch (error) {
    return htmlPage("eBay connection failed", error.message || "SourceTro could not finish the eBay connection.", 502);
  }
}

async function handleStatus(request, env, origin) {
  const missing = missingOAuthSetup(env);
  if (missing.length) return json({ ok: true, connected: false, setupReady: false, missing }, 200, origin);
  if (!ownerAuthorized(request, env)) return json({ ok: false, error: "SourceTro owner authorization required." }, 401, origin);
  const connection = await getConnection(env);
  if (!connection?.refreshToken) return json({ ok: true, connected: false, setupReady: true, environment: "production" }, 200, origin);
  try {
    await getUserAccessToken(env);
    return json({ ok: true, connected: true, setupReady: true, environment: "production", connectedAt: connection.connectedAt || null, refreshTokenExpiresAt: connection.refreshTokenExpiresAt || null, scopes: connection.scopes || [], sellerWorkflowReady: true }, 200, origin);
  } catch {
    return json({ ok: true, connected: false, setupReady: true, needsReconnect: true, error: "The saved eBay authorization needs to be renewed." }, 200, origin);
  }
}

async function handleDisconnect(request, env, origin) {
  if (!ownerAuthorized(request, env)) return json({ ok: false, error: "SourceTro owner authorization required." }, 401, origin);
  if (env.EBAY_TOKENS) await env.EBAY_TOKENS.delete(TOKEN_RECORD_KEY);
  accessTokenCache = null;
  return json({ ok: true, connected: false }, 200, origin);
}

async function handleMarketplaceAccountDeletion(request, env) {
  try {
    const payload = await request.json();
    if (payload?.metadata?.topic === "MARKETPLACE_ACCOUNT_DELETION" && env.EBAY_TOKENS) {
      await env.EBAY_TOKENS.delete(TOKEN_RECORD_KEY);
      accessTokenCache = null;
    }
  } catch {}
  return new Response(null, { status: 204 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (url.pathname === "/oauth/callback" && request.method === "GET") return handleOAuthCallback(url, env);
    if (url.pathname === "/oauth/declined" && request.method === "GET") return redirect(`${SOURCETRO_APP_URL}?ebay=declined#marketplaces`);
    if (origin && origin !== SOURCETRO_ORIGIN) return json({ ok: false, error: "Website not authorized." }, 403, origin);

    if (url.pathname === "/oauth/start" && request.method === "POST") return handleOAuthStart(request, env, origin);
    if (url.pathname === "/status" && request.method === "GET") return handleStatus(request, env, origin);
    if (url.pathname === "/ebay/policies" && request.method === "GET") return handlePolicies(request, env, origin);
    if (url.pathname === "/ebay/locations" && request.method === "GET") return handleLocations(request, env, origin);
    if (url.pathname === "/ebay/locations/create" && request.method === "POST") return handleCreateLocation(request, env, origin);
    if (url.pathname === "/ebay/listings/active" && request.method === "GET") return handleActiveListings(request, env, origin);
    if (url.pathname === "/ebay/listings/item" && request.method === "GET") return handleListingItem(request, env, origin, url);
    if (url.pathname === "/ebay/listings/revise" && request.method === "POST") return handleReviseListing(request, env, origin);
    if (url.pathname === "/ebay/research" && request.method === "GET") return handleResearch(request, env, origin, url);
    if (url.pathname === "/ebay/listings/preflight" && request.method === "POST") return handlePreflight(request, env, origin);
    if (url.pathname === "/ebay/images/upload" && request.method === "POST") return handleImageUpload(request, env, origin);
    if (url.pathname === "/ebay/listings/publish" && request.method === "POST") return handlePublishListing(request, env, origin);
    if (url.pathname === "/disconnect" && request.method === "POST") return handleDisconnect(request, env, origin);

    if (request.method === "GET" && url.pathname === "/" && url.searchParams.has("challenge_code")) {
      const challengeCode = url.searchParams.get("challenge_code");
      const verificationToken = env.EBAY_VERIFICATION_TOKEN;
      if (!verificationToken) return json({ error: "Verification token is not configured." }, 500, origin);
      return json({ challengeResponse: await sha256Hex(challengeCode + verificationToken + NOTIFICATION_ENDPOINT) }, 200, origin);
    }
    if (request.method === "POST" && url.pathname === "/") return handleMarketplaceAccountDeletion(request, env);
    if (request.method === "GET" && url.pathname === "/") {
      return json({ ok: true, service: "SourceTro eBay gateway", environment: "production", sellerWorkflowReady: true, publishMethod: "Trading AddFixedPriceItem", research: "active eBay asking prices when Browse API access is available" }, 200, origin);
    }
    return json({ error: "Not found." }, 404, origin);
  },
};
