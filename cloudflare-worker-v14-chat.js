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
  return result.output
    ?.flatMap((item) => item.content || [])
    .find((item) => item.type === "output_text")?.text;
}

function ownerAuthorized(request, env, body = null) {
  const headerKey = request.headers.get("X-SourceTro-Key") || "";
  const bodyKey = body && typeof body === "object" ? String(body.ownerKey || "") : "";
  const supplied = headerKey || bodyKey;
  return Boolean(env.SOURCETRO_OWNER_KEY && supplied && supplied === env.SOURCETRO_OWNER_KEY);
}

async function readSyncRecord(env) {
  if (!env.SYNC_KV) return null;
  const raw = await env.SYNC_KV.get(SYNC_RECORD_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function handleSyncGet(request, env, origin) {
  if (!env.SOURCETRO_OWNER_KEY || !env.SYNC_KV) {
    return reply({ error: "SourceTro cloud sync is not configured yet." }, 503, origin);
  }
  if (!ownerAuthorized(request, env)) {
    return reply({ error: "Owner authorization required." }, 401, origin);
  }
  const record = await readSyncRecord(env);
  if (!record) {
    return reply({ ok: true, found: false, revision: 0, updatedAt: null, data: {} }, 200, origin);
  }
  return reply({
    ok: true,
    found: true,
    revision: Number(record.revision || 0),
    updatedAt: record.updatedAt || null,
    deviceUpdatedAt: record.deviceUpdatedAt || null,
    data: record.data && typeof record.data === "object" ? record.data : {},
  }, 200, origin);
}

async function handleSyncPost(request, env, origin) {
  if (!env.SOURCETRO_OWNER_KEY || !env.SYNC_KV) {
    return reply({ error: "SourceTro cloud sync is not configured yet." }, 503, origin);
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_SYNC_BYTES) {
    return reply({ error: "SourceTro sync data is too large. Photos will be moved to dedicated cloud photo storage separately." }, 413, origin);
  }

  let body = {};
  try { body = JSON.parse(text || "{}"); } catch {
    return reply({ error: "SourceTro could not read the sync data." }, 400, origin);
  }

  if (!ownerAuthorized(request, env, body)) {
    return reply({ error: "Owner authorization required." }, 401, origin);
  }

  const data = body?.data && typeof body.data === "object" && !Array.isArray(body.data) ? body.data : null;
  if (!data) return reply({ error: "Sync data is required." }, 400, origin);

  const previous = await readSyncRecord(env);
  const revision = Number(previous?.revision || 0) + 1;
  const updatedAt = new Date().toISOString();
  const record = {
    revision,
    updatedAt,
    deviceUpdatedAt: String(body.deviceUpdatedAt || updatedAt).slice(0, 80),
    data,
  };

  await env.SYNC_KV.put(SYNC_RECORD_KEY, JSON.stringify(record));
  return reply({ ok: true, saved: true, revision, updatedAt }, 200, origin);
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

function compactHistory(history) {
  if (!Array.isArray(history)) return "None";
  return history
    .slice(-12)
    .filter((entry) => entry && (entry.role === "user" || entry.role === "assistant"))
    .map((entry) => `${entry.role === "user" ? "Seller" : "Tro"}: ${String(entry.content || "").slice(0, 1800)}`)
    .join("\n") || "None";
}

async function handleChat(body, env, origin) {
  const message = String(body.message || "").trim().slice(0, 4000);
  if (!message) return reply({ error: "Ask Tro a question first." }, 400, origin);

  const history = compactHistory(body.history);
  let context = "{}";
  try { context = JSON.stringify(body.context && typeof body.context === "object" ? body.context : {}).slice(0, 9000); } catch {}

  const developerPrompt = `
You are Tro, the conversational AI inside SourceTro, a resale workflow app.
You are the seller's Trusted Resale Operator: practical, warm, concise, and focused on helping the seller source, price, photograph, measure, list, organize, ship, and improve resale inventory.

Rules:
- Answer the seller's actual question directly. Do not fall back to canned keyword replies.
- Use SourceTro context when it is relevant, especially the current listing, inventory, TroFit, or sourcing scan.
- If the seller asks for a title, description, category suggestion, price strategy, item specifics, listing improvements, sourcing advice, or workflow help, provide a usable answer.
- Never invent live sold prices, current eBay demand, marketplace availability, or facts that require live data if that data was not supplied. Say what live information is needed.
- Never claim you changed, published, ended, bought, sold, or edited anything unless the app context confirms that action already happened.
- Do not guarantee authenticity from a photo or description.
- When information is uncertain, say what to verify.
- Keep normal answers easy to read on a phone. Use short paragraphs or a short list only when useful.
- SourceTro is the product name and Tro is the assistant name.
`.trim();

  const userPrompt = `
Current SourceTro context:
${context}

Recent conversation:
${history}

Seller's current question:
${message}
`.trim();

  const { response, result } = await callOpenAI(env, {
    model: "gpt-5-mini",
    store: false,
    max_output_tokens: 1000,
    input: [
      { role: "developer", content: [{ type: "input_text", text: developerPrompt }] },
      { role: "user", content: [{ type: "input_text", text: userPrompt }] },
    ],
  });

  if (!response.ok) {
    console.error("OpenAI Tro chat request failed:", result);
    return reply({ error: "Tro could not answer right now. Please try again." }, 502, origin);
  }

  const answer = String(outputText(result) || "").trim();
  if (!answer) return reply({ error: "Tro did not return an answer. Please try again." }, 502, origin);
  return reply({ ok: true, answer, usage: result.usage || null }, 200, origin);
}

async function measureClothing(body, env, origin) {
  const images = Array.isArray(body.images) ? body.images.slice(0, 2) : [];
  if (!images.length) {
    return reply({ error: "Please include a clothing measurement photograph." }, 400, origin);
  }

  const itemType = String(body.itemType || "clothing item").slice(0, 120);
  const category = String(body.category || "Clothing").slice(0, 120);
  const content = [
    {
      type: "input_text",
      text: `
Read only clothing measurements that are visibly supported by these photographs.

Seller category: ${category}
Seller item type: ${itemType}

Safety and accuracy rules:
- A real measuring tape or ruler must be visible in the photograph.
- The relevant zero mark, numbers, garment edge, and measurement endpoint must be readable.
- Never infer measurements from a size tag, a person's body, or a typical garment size.
- If a measurement cannot be read reliably, return an empty string for it.
- Return inches to the nearest quarter inch. Convert visible centimeters to inches if necessary.
- Chest means flat pit-to-pit, not doubled.
- Waist and hips mean flat measurements across, not doubled.
- Length means high shoulder to hem for tops/dresses or waistband to hem for bottoms.
- Inseam means crotch seam to inside hem. Rise means crotch seam to waistband.
- Sleeve means shoulder seam to cuff, unless the photo clearly uses another standard and explains it.
- Treat every result as approximate and tell the seller what to verify.
      `.trim(),
    },
    ...images.map((image) => ({ type: "input_image", image_url: image, detail: "high" })),
  ];

  const { response: openAIResponse, result } = await callOpenAI(env, {
    model: "gpt-5-mini",
    store: false,
    max_output_tokens: 900,
    input: [
      {
        role: "developer",
        content: [{
          type: "input_text",
          text: "You are Tro Measure, a cautious clothing-measurement reader. Accuracy is more important than completing every field. Never guess a number that is not visibly supported by a tape or ruler.",
        }],
      },
      { role: "user", content },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "sourcetro_clothing_measurements",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            garment_type: { type: "string" },
            unit: { type: "string", enum: ["inches"] },
            chest: { type: "string" },
            waist: { type: "string" },
            hips: { type: "string" },
            length: { type: "string" },
            inseam: { type: "string" },
            sleeve: { type: "string" },
            rise: { type: "string" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            visible_reference: { type: "boolean" },
            photo_quality: { type: "string" },
            review_message: { type: "string" },
            warnings: { type: "array", items: { type: "string" } },
          },
          required: ["garment_type", "unit", "chest", "waist", "hips", "length", "inseam", "sleeve", "rise", "confidence", "visible_reference", "photo_quality", "review_message", "warnings"],
        },
      },
    },
  });

  if (!openAIResponse.ok) {
    console.error("OpenAI measurement request failed:", result);
    return reply({ error: "Tro Measure could not read that photograph. Please try again." }, 502, origin);
  }

  const text = outputText(result);
  if (!text) return reply({ error: "Tro Measure did not return completed measurements." }, 502, origin);

  const measurements = JSON.parse(text);
  if (!measurements.visible_reference) {
    return reply({
      error: "Tro could not see a readable measuring tape. Place the tape on the garment with the zero mark and numbers showing, then take the photo straight down.",
    }, 422, origin);
  }

  return reply({ ok: true, measurements, usage: result.usage || null }, 200, origin);
}

async function analyzeItem(body, env, origin) {
  const images = Array.isArray(body.images) ? body.images.slice(0, 4) : [];
  const notes = String(body.notes || "").slice(0, 4000);
  const mode = body.mode === "sourcing" ? "Thinking of buying" : "Already owned";

  if (!images.length && !notes.trim()) {
    return reply({ error: "Please include an item photograph or details." }, 400, origin);
  }

  const content = [
    {
      type: "input_text",
      text: `
Analyze this resale item for SourceTro Personal Mode.

Seller mode: ${mode}
Purchase cost: ${body.purchaseCost ?? "Not provided"}
Desired profit: ${body.targetProfit ?? "Not provided"}
Seller notes: ${notes || "None"}

Identify only details supported by the photographs or seller notes.
Do not invent a brand, size, material, condition, sold price, or authenticity.
Do not guarantee authenticity.
Create an eBay SEO title of no more than 80 characters.
Create accurate search words for finding comparable sold listings.
Clearly explain when more information or photographs are needed.
      `.trim(),
    },
    ...images.map((image) => ({ type: "input_image", image_url: image, detail: "high" })),
  ];

  const { response: openAIResponse, result } = await callOpenAI(env, {
    model: "gpt-5-mini",
    store: false,
    max_output_tokens: 2000,
    input: [
      {
        role: "developer",
        content: [{
          type: "input_text",
          text: "You are Tro, SourceTro's careful resale assistant. Produce accurate, practical listing help. Never claim live sold comparisons unless the seller supplied them.",
        }],
      },
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
                brand: { type: "string" },
                item_type: { type: "string" },
                category: { type: "string" },
                color: { type: "string" },
                size: { type: "string" },
                style: { type: "string" },
                condition: { type: "string" },
                visible_flaws: { type: "array", items: { type: "string" } },
                confidence: { type: "string" },
              },
              required: ["brand", "item_type", "category", "color", "size", "style", "condition", "visible_flaws", "confidence"],
            },
            research: {
              type: "object",
              additionalProperties: false,
              properties: {
                ebay_sold_search: { type: "string" },
                search_keywords: { type: "array", items: { type: "string" } },
                details_to_verify: { type: "array", items: { type: "string" } },
              },
              required: ["ebay_sold_search", "search_keywords", "details_to_verify"],
            },
            evaluation: {
              type: "object",
              additionalProperties: false,
              properties: {
                demand: { type: "string" },
                sourcing_decision: { type: "string" },
                explanation: { type: "string" },
              },
              required: ["demand", "sourcing_decision", "explanation"],
            },
            listing: {
              type: "object",
              additionalProperties: false,
              properties: {
                seo_title: { type: "string" },
                description: { type: "string" },
                item_specifics: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: { name: { type: "string" }, value: { type: "string" } },
                    required: ["name", "value"],
                  },
                },
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

  if (!openAIResponse.ok) {
    console.error("OpenAI request failed:", result);
    return reply({ error: "Tro could not analyze the item. Please try again." }, 502, origin);
  }

  const completedText = outputText(result);
  if (!completedText) return reply({ error: "Tro did not return a completed analysis." }, 502, origin);
  return reply({ ok: true, analysis: JSON.parse(completedText), usage: result.usage || null }, 200, origin);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: headers(origin) });
    }

    if (origin && origin !== SOURCETRO_ORIGIN) {
      return reply({ error: "Website not authorized." }, 403, origin);
    }

    if (url.pathname === "/sync" && request.method === "GET") {
      return handleSyncGet(request, env, origin);
    }

    if (url.pathname === "/sync" && request.method === "POST") {
      return handleSyncPost(request, env, origin);
    }

    if (request.method === "GET") {
      return reply({
        ok: true,
        service: "SourceTro Personal API",
        openaiConnected: Boolean(env.OPENAI_API_KEY),
        ownerProtection: Boolean(env.SOURCETRO_OWNER_KEY),
        cloudSyncReady: Boolean(env.SYNC_KV),
        troChatReady: Boolean(env.OPENAI_API_KEY && env.SOURCETRO_OWNER_KEY),
        transport: "secure-body-v16-cloud-sync-live-chat",
        message: "SourceTro secure AI connection and live Tro chat are ready.",
      }, 200, origin);
    }

    if (request.method !== "POST" || !["/analyze", "/measure", "/chat"].includes(url.pathname)) {
      return reply({ error: "Not found." }, 404, origin);
    }

    if (!env.OPENAI_API_KEY || !env.SOURCETRO_OWNER_KEY) {
      return reply({ error: "SourceTro security setup is not complete." }, 503, origin);
    }

    try {
      const body = await request.json();
      if (!ownerAuthorized(request, env, body)) {
        return reply({ error: "Owner authorization required." }, 401, origin);
      }

      if (url.pathname === "/chat") return await handleChat(body, env, origin);
      if (url.pathname === "/measure") return await measureClothing(body, env, origin);
      return await analyzeItem(body, env, origin);
    } catch (error) {
      console.error("SourceTro error:", error);
      return reply({ error: "SourceTro encountered an unexpected error." }, 500, origin);
    }
  },
};
