/**
 * One-off discovery probe for the Infloww OpenAPI.
 *
 * Hits each documented endpoint with minimal parameters and prints a
 * sanitized summary of the live response shape so we can build types and
 * derivations against reality (not just the spec).
 *
 * Run with:
 *   node --env-file=.env scripts/probe-infloww.mjs
 *
 * The script:
 *   - never prints API keys
 *   - redacts fan / creator personal names
 *   - keeps numeric values, enums, ids (which are useful for shape inference)
 *   - writes a full sanitized dump to scripts/.probe-output.json
 */

import { writeFileSync } from "node:fs";

const BASE = "https://openapi.infloww.com";
const API_KEY = process.env.INFLOW_API_KEY;
const OID = process.env.INFLOW_AGENCY_OID;

if (!API_KEY || !OID) {
  console.error(
    "Missing env. Required: INFLOW_API_KEY and INFLOW_AGENCY_OID. " +
      "Run: node --env-file=.env scripts/probe-infloww.mjs",
  );
  process.exit(1);
}

// Fields whose VALUES are likely PII; we redact them but keep the key.
const PII_KEYS = new Set([
  "fanName",
  "name",
  "nickName",
  "userName",
  "tagName",
  "fanId",
]);

const dump = {};

/**
 * Make a request to the Infloww API. Tries `Bearer <key>` first; on 401,
 * retries with the bare key (some self-serve APIs don't use the prefix).
 */
async function call(path, query = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  const attempts = [`Bearer ${API_KEY}`, API_KEY];
  let lastResp;
  for (const auth of attempts) {
    const resp = await fetch(url, {
      headers: {
        Authorization: auth,
        "x-oid": OID,
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });
    lastResp = resp;
    // Treat 401 as "wrong auth shape, try the other"; everything else returns immediately.
    if (resp.status !== 401) {
      const text = await resp.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        body = { _raw: text.slice(0, 400) };
      }
      return {
        status: resp.status,
        authStyle: auth.startsWith("Bearer ") ? "bearer" : "bare",
        requestId: resp.headers.get("x-request-id"),
        url: url.pathname + url.search,
        headers: Object.fromEntries(resp.headers.entries()),
        body,
      };
    }
  }
  const text = await lastResp.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { _raw: text.slice(0, 400) };
  }
  return {
    status: 401,
    authStyle: "both-failed",
    requestId: lastResp.headers.get("x-request-id"),
    url: url.pathname + url.search,
    headers: Object.fromEntries(lastResp.headers.entries()),
    body,
  };
}

/** Recursive shape summarizer: replaces values with type tokens, redacts PII. */
function shape(value, depth = 0) {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    if (value.length === 0) return "array<empty>";
    return [`array<${value.length}>`, shape(value[0], depth + 1)];
  }
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (PII_KEYS.has(k) && typeof v === "string") {
        out[k] = `string<redacted len=${v.length}>`;
      } else {
        out[k] = shape(v, depth + 1);
      }
    }
    return out;
  }
  if (typeof value === "string") {
    // Keep short strings (likely enums / ids / currencies / timestamps)
    if (value.length <= 32) return `string<"${value}">`;
    return `string<len=${value.length}>`;
  }
  return typeof value;
}

function sanitizeBody(body) {
  if (!body || typeof body !== "object") return body;
  const clone = JSON.parse(JSON.stringify(body));
  const walk = (node) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
    } else if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        if (PII_KEYS.has(k) && typeof v === "string") {
          node[k] = `<redacted:${k}>`;
        } else if (typeof v === "object") {
          walk(v);
        }
      }
    }
  };
  walk(clone);
  return clone;
}

function summarize(label, result) {
  console.log(`\n===== ${label} =====`);
  console.log(`URL:        ${result.url}`);
  console.log(`Status:     ${result.status}`);
  console.log(`Auth used:  ${result.authStyle}`);
  if (result.requestId) console.log(`request-id: ${result.requestId}`);
  if (result.status >= 400) {
    console.log(
      "Response headers (subset):",
      JSON.stringify(
        {
          server: result.headers?.server,
          "content-type": result.headers?.["content-type"],
          "x-amzn-requestid": result.headers?.["x-amzn-requestid"],
          "cf-ray": result.headers?.["cf-ray"],
          "x-akamai": result.headers?.["x-akamai-edgescape"],
        },
        null,
        2,
      ),
    );
    console.log("Error body:", JSON.stringify(result.body, null, 2).slice(0, 800));
    return;
  }
  const data = result.body?.data;
  const list = data?.list;
  console.log(`hasMore:    ${result.body?.hasMore}`);
  console.log(`cursor:     ${result.body?.cursor ?? "(none)"}`);
  if (Array.isArray(list)) {
    console.log(`list.length: ${list.length}`);
    if (list.length > 0) {
      console.log("First item shape:");
      console.log(JSON.stringify(shape(list[0]), null, 2));
    }
  } else {
    console.log("Top-level body shape:");
    console.log(JSON.stringify(shape(result.body), null, 2));
  }
  // Top-level data keys other than `list`
  if (data && typeof data === "object") {
    const meta = Object.fromEntries(
      Object.entries(data).filter(([k]) => k !== "list"),
    );
    if (Object.keys(meta).length > 0) {
      console.log("data.* (non-list):", JSON.stringify(meta, null, 2));
    }
  }
}

async function main() {
  console.log("Infloww API discovery probe");
  console.log("Base:", BASE);
  console.log("OID len:", OID.length, "key prefix:", API_KEY.slice(0, 3) + "***");

  // 1) Creators — required first to get a creatorId for downstream calls.
  const creators = await call("/v1/creators", { limit: 5 });
  summarize("GET /v1/creators?limit=5", creators);
  dump.creators = {
    request: { url: creators.url },
    status: creators.status,
    authStyle: creators.authStyle,
    body: sanitizeBody(creators.body),
  };

  if (creators.status !== 200) {
    console.log("\nCannot continue probes — creators call failed.");
    writeFileSync(
      "scripts/.probe-output.json",
      JSON.stringify(dump, null, 2),
      "utf8",
    );
    process.exit(2);
  }

  const list = creators.body?.data?.list ?? [];
  if (list.length === 0) {
    console.log("\nNo creators returned. Cannot probe creator-scoped endpoints.");
    writeFileSync(
      "scripts/.probe-output.json",
      JSON.stringify(dump, null, 2),
      "utf8",
    );
    return;
  }

  const creatorId = list[0].id;
  console.log(`\nUsing creatorId="${creatorId}" for downstream probes.`);

  // 30-day window in milliseconds.
  const endTime = Date.now();
  const startTime = endTime - 30 * 24 * 60 * 60 * 1000;
  const window = { startTime, endTime };

  // 2) Transactions
  const txns = await call("/v1/transactions", {
    creatorId,
    limit: 5,
    ...window,
  });
  summarize("GET /v1/transactions (last 30d, limit=5)", txns);
  dump.transactions = {
    request: { url: txns.url },
    status: txns.status,
    body: sanitizeBody(txns.body),
  };

  // 3) Refunds
  const refunds = await call("/v1/refunds", {
    creatorId,
    limit: 5,
    ...window,
  });
  summarize("GET /v1/refunds (last 30d, limit=5)", refunds);
  dump.refunds = {
    request: { url: refunds.url },
    status: refunds.status,
    body: sanitizeBody(refunds.body),
  };

  // 4) Links — try all three linkType variants.
  dump.links = {};
  const linkTypeForFanProbe = { type: null, link: null };
  for (const linkType of ["CAMPAIGN", "TRIAL", "TRACKING"]) {
    const links = await call("/v1/links", { creatorId, limit: 5, linkType });
    summarize(`GET /v1/links (linkType=${linkType}, limit=5)`, links);
    dump.links[linkType] = {
      request: { url: links.url },
      status: links.status,
      body: sanitizeBody(links.body),
    };
    if (
      !linkTypeForFanProbe.link &&
      links.status === 200 &&
      Array.isArray(links.body?.data?.list) &&
      links.body.data.list.length > 0
    ) {
      linkTypeForFanProbe.type = linkType;
      linkTypeForFanProbe.link = links.body.data.list[0];
    }
  }

  // 5) Linkfans — needs a real linkId from above.
  if (linkTypeForFanProbe.link) {
    const lf = await call("/v1/linkfans", {
      creatorId,
      linkType: linkTypeForFanProbe.type,
      linkId: linkTypeForFanProbe.link.id,
      limit: 5,
    });
    summarize(
      `GET /v1/linkfans (linkType=${linkTypeForFanProbe.type}, limit=5)`,
      lf,
    );
    dump.linkfans = {
      request: { url: lf.url },
      status: lf.status,
      body: sanitizeBody(lf.body),
    };
  } else {
    console.log("\nNo non-empty links found; skipping /v1/linkfans probe.");
    dump.linkfans = { skipped: "no link to probe" };
  }

  writeFileSync(
    "scripts/.probe-output.json",
    JSON.stringify(dump, null, 2),
    "utf8",
  );
  console.log("\nFull sanitized dump → scripts/.probe-output.json");
}

main().catch((err) => {
  console.error("Probe failed:", err);
  process.exit(1);
});
