const SOURCETRO_ORIGIN = "https://selltro.github.io";
const SYNC_RECORD_KEY = "sourcetro-personal-sync-v1";
const MAX_SYNC_BYTES = 1_500_000;

function headers(origin = "") {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin === SOURCETRO_ORIGIN ? origin : SOURCETRO_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type, X-SourceTro-Key",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

function reply(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data), { status, headers: headers(origin) });
}

function outputText(result) {
  return result?.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text || "";
}

function ownerAuthorized(request, env, body = null) {
  const headerKey = request.headers.get("X-SourceTro-Key") || "";
  const bodyKey = body && typeof body === "object" ? String(body.ownerKey || "") : "";
  const supplied = headerKey || bodyKey;
  return Boolean(env.SOURCETRO_OWNER_KEY && supplied && supplied === env.SOURCETRO_OWNER_KEY);
}

async function callOpenAI(env, body) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  return { response, result };
}

async function readSyncRecord(env) {
  if (!env.SYNC_KV) return null;
  const raw = await env.SYNC_KV.get(SYNC_RECORD_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function handleSyncGet(request, env, origin) {
  if (!env.SOURCETRO_OWNER_KEY || !env.SYNC_KV) return reply({ error: "SourceTro cloud sync is not configured yet." }, 503, origin);
  if (!ownerAuthorized(request, env)) return reply({ error: "Owner authorization required." }, 401, origin);
  const record = await readSyncRecord(env);
  if (!record) return reply({ ok: true, found: false, revision: 0, updatedAt: null, data: {} }, 200, origin);
  return reply({ ok: true, found: true, revision: Number(record.revision || 0), updatedAt: record.updatedAt || null, deviceUpdatedAt: record.deviceUpdatedAt || null, data: record.data || {} }, 200, origin);
}

async function handleSyncPost(request, env, origin) {
  if (!env.SOURCETRO_OWNER_KEY || !env.SYNC_KV) return reply({ error: "SourceTro cloud sync is not configured yet." }, 503, origin);
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_SYNC_BYTES) return reply({ error: "SourceTro sync data is too large." }, 413, origin);
  let body = {};
  try { body = JSON.parse(text || "{}"); } catch { return reply({ error: "SourceTro could not read the sync data." }, 400, origin); }
  if (!ownerAuthorized(request, env, body)) return reply({ error: "Owner authorization required." }, 401, origin);
  const data = body?.data && typeof body.data === "object" && !Array.isArray(body.data) ? body.data : null;
  if (!data) return reply({ error: "Sync data is required." }, 400, origin);
  const previous = await readSyncRecord(env);
  const revision = Number(previous?.revision || 0) + 1;
  const updatedAt = new Date().toISOString();
  await env.SYNC_KV.put(SYNC_RECORD_KEY, JSON.stringify({ revision, updatedAt, deviceUpdatedAt: String(body.deviceUpdatedAt || updatedAt).slice(0, 80), data }));
  return reply({ ok: true, saved: true, revision, updatedAt }, 200, origin);
}

function compactHistory(history) {
  if (!Array.isArray(history)) return "None";
  return history.slice(-12).filter((entry) => entry && ["user", "assistant"].includes(entry.role)).map((entry) => `${entry.role === "user" ? "Seller" : "Tro"}: ${String(entry.content || "").slice(0, 1800)}`).join("\n") || "None";
}

async function handleChat(body, env, origin) {
  const message = String(body.message || "").trim().slice(0, 4000);
  if (!message) return reply({ error: "Ask Tro a question first." }, 400, origin);
  let context = "{}";
  try { context = JSON.stringify(body.context && typeof body.context === "object" ? body.context : {}).slice(0, 9000); } catch {}
  const { response, result } = await callOpenAI(env, {
    model: "gpt-5-mini",
    store: false,
    max_output_tokens: 1000,
    input: [
      { role: "developer", content: [{ type: "input_text", text: "You are Tro, SourceTro's resale co-pilot. Answer directly and practically. Use supplied SourceTro context. Never invent live prices or claim actions occurred unless context confirms them. Never guarantee authenticity from a photo." }] },
      { role: "user", content: [{ type: "input_text", text: `Current SourceTro context:\n${context}\n\nRecent conversation:\n${compactHistory(body.history)}\n\nSeller question:\n${message}` }] },
    ],
  });
  if (!response.ok) return reply({ error: "Tro could not answer right now. Please try again." }, 502, origin);
  const answer = String(outputText(result)).trim();
  if (!answer) return reply({ error: "Tro did not return an answer. Please try again." }, 502, origin);
  return reply({ ok: true, answer, usage: result.usage || null }, 200, origin);
}

async function identifyFast(body, env, origin) {
  const image = String(body.image || body.images?.[0] || "").trim();
  const notes = String(body.notes || "").slice(0, 1000);
  if (!image) return reply({ error: "Please include one item photograph." }, 400, origin);

  const { response, result } = await callOpenAI(env, {
    model: "gpt-4.1-mini",
    store: false,
    max_output_tokens: 700,
    input: [
      { role: "developer", content: [{ type: "input_text", text: "You are SourceTro Fast Identify. Identify a resale item conservatively from one photo. Return only details visible or strongly supported. Do not invent brand, model, size, authenticity, or price. Build a short search phrase for current marketplace comparisons." }] },
      { role: "user", content: [
        { type: "input_text", text: `Identify this resale item quickly. Seller notes: ${notes || "None"}. The search phrase should emphasize brand if visible, item type, distinctive style/model words, and useful color/material clues.` },
        { type: "input_image", image_url: image, detail: "low" },
      ] },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "sourcetro_fast_identify",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            identification: {
              type: "object",
              additionalProperties: false,
              properties: {
                brand: { type: "string" },
                item_type: { type: "string" },
                category: { type: "string" },
                color: { type: "string" },
                size: { type: "string" },
                style: { type: "string" },
                condition: { type: "string" },
                confidence: { type: "string", enum: ["high", "medium", "low"] },
              },
              required: ["brand", "item_type", "category", "color", "size", "style", "condition", "confidence"],
            },
            search_query: { type: "string" },
          },
          required: ["identification", "search_query"],
        },
      },
    },
  });
  if (!response.ok) return reply({ error: "Tro could not identify that photo right now." }, 502, origin);
  const text = outputText(result);
  if (!text) return reply({ error: "Tro did not return an identification." }, 502, origin);
  const parsed = JSON.parse(text);
  return reply({ ok: true, identification: parsed.identification, searchQuery: parsed.search_query, fast: true, usage: result.usage || null }, 200, origin);
}

async function analyzeItem(body, env, origin) {
  const images = Array.isArray(body.images) ? body.images.slice(0, 4) : [];
  const notes = String(body.notes || "").slice(0, 4000);
  const mode = body.mode === "sourcing" ? "Thinking of buying" : "Already owned";
  if (!images.length && !notes.trim()) return reply({ error: "Please include an item photograph or details." }, 400, origin);

  const content = [{ type: "input_text", text: `Analyze this resale item for SourceTro. Seller mode: ${mode}. Purchase cost: ${body.purchaseCost ?? "Not provided"}. Desired profit: ${body.targetProfit ?? "Not provided"}. Seller notes: ${notes || "None"}. Identify only supported details. Do not invent brand, size, material, condition, sold price, authenticity, or live demand. Create an eBay SEO title <=80 characters, description, item specifics, and comparison search words.` }, ...images.map((image) => ({ type: "input_image", image_url: image, detail: "high" }))];

  const { response, result } = await callOpenAI(env, {
    model: "gpt-5-mini",
    store: false,
    max_output_tokens: 1800,
    input: [
      { role: "developer", content: [{ type: "input_text", text: "You are Tro, SourceTro's careful resale assistant. Produce accurate listing help and never claim live sold comparisons unless supplied by the seller." }] },
      { role: "user", content },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "sourcetro_item_analysis",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            identification: {
              type: "object",
              additionalProperties: false,
              properties: {
                brand: { type: "string" }, item_type: { type: "string" }, category: { type: "string" }, color: { type: "string" }, size: { type: "string" }, style: { type: "string" }, condition: { type: "string" }, visible_flaws: { type: "array", items: { type: "string" } }, confidence: { type: "string" },
              },
              required: ["brand", "item_type", "category", "color", "size", "style", "condition", "visible_flaws", "confidence"],
            },
            research: {
              type: "object", additionalProperties: false,
              properties: { ebay_sold_search: { type: "string" }, search_keywords: { type: "array", items: { type: "string" } }, details_to_verify: { type: "array", items: { type: "string" } } },
              required: ["ebay_sold_search", "search_keywords", "details_to_verify"],
            },
            evaluation: {
              type: "object", additionalProperties: false,
              properties: { demand: { type: "string" }, sourcing_decision: { type: "string" }, explanation: { type: "string" } },
              required: ["demand", "sourcing_decision", "explanation"],
            },
            listing: {
              type: "object", additionalProperties: false,
              properties: {
                seo_title: { type: "string" }, description: { type: "string" },
                item_specifics: { type: "array", items: { type: "object", additionalProperties: false, properties: { name: { type: "string" }, value: { type: "string" } }, required: ["name", "value"] } },
                photo_checklist: { type: "array", items: { type: "string" } },
              },
              required: ["seo_title", "description", "item_specifics", "photo_checklist"],
            },
            warnings: { type: "array", items: { type: "string" } },
          },
          required: ["identification", "research", "evaluation", "listing", "warnings"],
        },
      },
    },
  });
  if (!response.ok) return reply({ error: "Tro could not analyze the item. Please try again." }, 502, origin);
  const text = outputText(result);
  if (!text) return reply({ error: "Tro did not return a completed analysis." }, 502, origin);
  return reply({ ok: true, analysis: JSON.parse(text), usage: result.usage || null }, 200, origin);
}

async function measureClothing(body, env, origin) {
  const images = Array.isArray(body.images) ? body.images.slice(0, 2) : [];
  if (!images.length) return reply({ error: "Please include a clothing measurement photograph." }, 400, origin);
  const content = [{ type: "input_text", text: `Read only clothing measurements visibly supported by these photos. Category: ${String(body.category || "Clothing").slice(0,120)}. Item: ${String(body.itemType || "clothing item").slice(0,120)}. A measuring tape or ruler must be readable. Never infer from size tags or body size. Return inches to nearest quarter inch; leave unreadable fields empty.` }, ...images.map((image) => ({ type: "input_image", image_url: image, detail: "high" }))];
  const { response, result } = await callOpenAI(env, {
    model: "gpt-5-mini", store: false, max_output_tokens: 800,
    input: [{ role: "developer", content: [{ type: "input_text", text: "You are Tro Measure. Accuracy is more important than filling every field. Never guess." }] }, { role: "user", content }],
    text: { format: { type: "json_schema", name: "sourcetro_measurements", strict: true, schema: {
      type: "object", additionalProperties: false,
      properties: { garment_type: { type: "string" }, unit: { type: "string", enum: ["inches"] }, chest: { type: "string" }, waist: { type: "string" }, hips: { type: "string" }, length: { type: "string" }, inseam: { type: "string" }, sleeve: { type: "string" }, rise: { type: "string" }, confidence: { type: "string", enum: ["high", "medium", "low"] }, visible_reference: { type: "boolean" }, photo_quality: { type: "string" }, review_message: { type: "string" }, warnings: { type: "array", items: { type: "string" } } },
      required: ["garment_type", "unit", "chest", "waist", "hips", "length", "inseam", "sleeve", "rise", "confidence", "visible_reference", "photo_quality", "review_message", "warnings"]
    } } },
  });
  if (!response.ok) return reply({ error: "Tro Measure could not read that photograph. Please try again." }, 502, origin);
  const text = outputText(result);
  if (!text) return reply({ error: "Tro Measure did not return completed measurements." }, 502, origin);
  const measurements = JSON.parse(text);
  if (!measurements.visible_reference) return reply({ error: "Tro could not see a readable measuring tape. Place the tape on the garment with the zero mark and numbers showing, then photograph straight down." }, 422, origin);
  return reply({ ok: true, measurements, usage: result.usage || null }, 200, origin);
}

function extractWebSources(result) {
  const urls = [];
  for (const item of result?.output || []) {
    if (item?.type !== "web_search_call") continue;
    for (const source of item?.action?.sources || []) if (/^https?:\/\//i.test(String(source?.url || ""))) urls.push(String(source.url));
    if (/^https?:\/\//i.test(String(item?.action?.url || ""))) urls.push(String(item.action.url));
  }
  return [...new Set(urls)].slice(0, 40);
}

function hostOf(value) {
  try { return new URL(String(value)).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
}

async function discoverWeb(body, env, origin) {
  const image = String(body.image || "").trim();
  const query = String(body.query || "").trim().slice(0, 300);
  let identification = "{}";
  try { identification = JSON.stringify(body.identification && typeof body.identification === "object" ? body.identification : {}).slice(0, 3000); } catch {}
  if (!image && !query) return reply({ error: "A photo or search phrase is required for discovery." }, 400, origin);
  const userContent = [{ type: "input_text", text: `Find current public web pages offering this resale item or close comparables. Search phrase: ${query || "Use photo"}. Identification hints: ${identification}. Seller country: ${String(body.sellerCountry || "US").slice(0,20)}. Search accessible marketplaces, retailers, resale/vintage shops, brand and specialty sites. Prioritize current visible USD prices. Do not invent price, URL, brand, availability, or sold status. Classify each match exact, likely, or similar. Return at most 10 useful priced matches.` }];
  if (image) userContent.push({ type: "input_image", image_url: image, detail: "low" });
  const { response, result } = await callOpenAI(env, {
    model: "gpt-5-mini", store: false, max_output_tokens: 1500, tools: [{ type: "web_search" }],
    input: [{ role: "developer", content: [{ type: "input_text", text: "You are SourceTro Discovery. Use web search for real current pages and prices. Be conservative and never fabricate." }] }, { role: "user", content: userContent }],
    text: { format: { type: "json_schema", name: "sourcetro_web_discovery", strict: true, schema: {
      type: "object", additionalProperties: false,
      properties: {
        query: { type: "string" }, summary: { type: "string" },
        matches: { type: "array", items: { type: "object", additionalProperties: false, properties: { source: { type: "string" }, title: { type: "string" }, url: { type: "string" }, price: { type: "number" }, currency: { type: "string" }, match_type: { type: "string", enum: ["exact", "likely", "similar"] }, price_type: { type: "string", enum: ["active_asking", "retail", "unknown"] }, confidence: { type: "string", enum: ["high", "medium", "low"] }, why_match: { type: "string" } }, required: ["source", "title", "url", "price", "currency", "match_type", "price_type", "confidence", "why_match"] } },
      }, required: ["query", "summary", "matches"]
    } } },
  });
  if (!response.ok) return reply({ error: "Tro could not complete broad web discovery right now." }, 502, origin);
  const text = outputText(result);
  if (!text) return reply({ error: "Tro did not return web discovery results." }, 502, origin);
  const parsed = JSON.parse(text);
  const sources = extractWebSources(result);
  const sourceHosts = new Set(sources.map(hostOf).filter(Boolean));
  const matches = (Array.isArray(parsed.matches) ? parsed.matches : []).filter((x) => Number(x?.price) > 0).filter((x) => String(x.currency || "").toUpperCase() === "USD").filter((x) => /^https?:\/\//i.test(String(x.url || ""))).slice(0,10).map((x) => ({ ...x, price: Number(Number(x.price).toFixed(2)), currency: "USD", source_verified: sourceHosts.size ? sourceHosts.has(hostOf(x.url)) : false }));
  return reply({ ok: true, query: String(parsed.query || query), summary: String(parsed.summary || ""), matches, sources, searchedPublicWeb: true, priceMeaning: "current asking/retail prices unless source explicitly states otherwise", usage: result.usage || null }, 200, origin);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(origin) });
    if (origin && origin !== SOURCETRO_ORIGIN) return reply({ error: "Website not authorized." }, 403, origin);
    if (url.pathname === "/sync" && request.method === "GET") return handleSyncGet(request, env, origin);
    if (url.pathname === "/sync" && request.method === "POST") return handleSyncPost(request, env, origin);

    if (request.method === "GET") {
      return reply({ ok: true, service: "SourceTro Personal API", openaiConnected: Boolean(env.OPENAI_API_KEY), ownerProtection: Boolean(env.SOURCETRO_OWNER_KEY), cloudSyncReady: Boolean(env.SYNC_KV), troChatReady: Boolean(env.OPENAI_API_KEY && env.SOURCETRO_OWNER_KEY), smartDiscoveryReady: Boolean(env.OPENAI_API_KEY && env.SOURCETRO_OWNER_KEY), fastIdentifyReady: Boolean(env.OPENAI_API_KEY && env.SOURCETRO_OWNER_KEY), transport: "secure-body-v18-fast-identify-discovery", message: "SourceTro secure AI, Tro chat, fast identification, and Smart Discovery are ready." }, 200, origin);
    }

    const allowed = ["/identify-fast", "/analyze", "/measure", "/chat", "/discover-web"];
    if (request.method !== "POST" || !allowed.includes(url.pathname)) return reply({ error: "Not found." }, 404, origin);
    if (!env.OPENAI_API_KEY || !env.SOURCETRO_OWNER_KEY) return reply({ error: "SourceTro security setup is not complete." }, 503, origin);

    try {
      const body = await request.json();
      if (!ownerAuthorized(request, env, body)) return reply({ error: "Owner authorization required." }, 401, origin);
      if (url.pathname === "/identify-fast") return await identifyFast(body, env, origin);
      if (url.pathname === "/chat") return await handleChat(body, env, origin);
      if (url.pathname === "/measure") return await measureClothing(body, env, origin);
      if (url.pathname === "/discover-web") return await discoverWeb(body, env, origin);
      return await analyzeItem(body, env, origin);
    } catch (error) {
      console.error("SourceTro error:", error);
      return reply({ error: "SourceTro encountered an unexpected error." }, 500, origin);
    }
  },
};
