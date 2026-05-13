#!/usr/bin/env node
/**
 * openclaw-watchdog.mjs
 * ----------------------------------------------------------------------------
 * Tails OpenClaw gateway logs for FailoverError / 401 events, deduplicates,
 * and triggers a configurable response.
 *
 * Behavior by default:
 *   - FailoverError (non-auth, non-quota): retry the failing run via the
 *     gateway control API with exponential backoff.
 *   - HTTP 401 / "Incorrect API key" / auth failures: ALERT ONLY.
 *     Rationale: retrying an auth failure with the same key just loops; you
 *     want a human to rotate the key. Override with --retry-401 if you really
 *     want to retry (e.g., you have a key-rotation hook elsewhere).
 *   - Quota errors: ALERT ONLY. Same logic.
 *
 * Usage:
 *   node scripts/openclaw-watchdog.mjs                # dry-run, alert only
 *   node scripts/openclaw-watchdog.mjs --retry        # enable retry behavior
 *   node scripts/openclaw-watchdog.mjs --retry --retry-401   # also retry 401s
 *   node scripts/openclaw-watchdog.mjs --backfill 200 # process last 200 lines first
 *
 * Env:
 *   OPENCLAW_LOG_DIR     default ~/.openclaw/logs
 *   OPENCLAW_GATEWAY_URL default http://127.0.0.1:18789
 *   OPENCLAW_GATEWAY_TOKEN  required for retry mode (read from openclaw.json
 *                           gateway.auth.token if not set)
 *   WATCHDOG_INCIDENT_LOG default <log_dir>/watchdog-incidents.jsonl
 *
 * Notes:
 *   - This script intentionally does not parse the live arg `--retry` from
 *     openclaw itself; it only reads logs and re-issues runs through the
 *     documented gateway HTTP control surface.
 *   - The exact retry endpoint depends on your gateway version. The default
 *     `POST /v1/agent/runs/:runId/retry` is a placeholder — verify against
 *     your gateway's OpenAPI before enabling --retry in production. If your
 *     version uses a different shape, set OPENCLAW_RETRY_PATH to override.
 * ----------------------------------------------------------------------------
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

// ---------- config ----------
const args = new Set(process.argv.slice(2));
const flag = (name) => args.has(name);
const argValue = (name, fallback) => {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
};

const LOG_DIR = process.env.OPENCLAW_LOG_DIR
  || path.join(os.homedir(), ".openclaw", "logs");
const FILES = ["gateway.log", "gateway.err.log"]
  .map((f) => path.join(LOG_DIR, f))
  .filter((p) => fs.existsSync(p));

if (FILES.length === 0) {
  console.error(`[watchdog] no log files found under ${LOG_DIR}`);
  process.exit(2);
}

const INCIDENT_LOG = process.env.WATCHDOG_INCIDENT_LOG
  || path.join(LOG_DIR, "watchdog-incidents.jsonl");

const GATEWAY_URL = (process.env.OPENCLAW_GATEWAY_URL || "http://127.0.0.1:18789").replace(/\/+$/, "");
const RETRY_PATH = process.env.OPENCLAW_RETRY_PATH || "/v1/agent/runs/{runId}/retry";

const RETRY_MODE = flag("--retry");
const RETRY_401 = flag("--retry-401");
const BACKFILL = Number(argValue("--backfill", "0")) || 0;

const MAX_ATTEMPTS = Number(process.env.WATCHDOG_MAX_ATTEMPTS || "4");
const BASE_DELAY_MS = Number(process.env.WATCHDOG_BASE_DELAY_MS || "2000");
const DEDUP_WINDOW_MS = Number(process.env.WATCHDOG_DEDUP_WINDOW_MS || "60000");

// ---------- token (only needed in retry mode) ----------
function loadGatewayToken() {
  if (process.env.OPENCLAW_GATEWAY_TOKEN) return process.env.OPENCLAW_GATEWAY_TOKEN;
  const cfgPath = path.join(os.homedir(), ".openclaw", "openclaw.json");
  if (!fs.existsSync(cfgPath)) return null;
  try {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    return cfg?.gateway?.auth?.token ?? null;
  } catch (err) {
    console.error(`[watchdog] could not read ${cfgPath}: ${err.message}`);
    return null;
  }
}

// ---------- classification ----------
const PATTERNS = [
  { name: "auth_401", regex: /\b401\b|Incorrect API key|Unauthorized/i, retryable: false },
  { name: "quota_exceeded", regex: /exceeded your current quota|insufficient_quota/i, retryable: false },
  { name: "failover_other", regex: /FailoverError/i, retryable: true },
  { name: "context_overflow", regex: /Context overflow/i, retryable: false },
  { name: "llm_timeout", regex: /LLM request timed out|network connection error/i, retryable: true },
];

function classify(line) {
  for (const p of PATTERNS) if (p.regex.test(line)) return p;
  return null;
}

function extractRunId(line) {
  const m = line.match(/runId=([0-9a-f-]{36})/i);
  return m ? m[1] : null;
}

function extractLane(line) {
  const m = line.match(/lane=([^\s"]+)/);
  return m ? m[1] : null;
}

function extractModel(line) {
  const m = line.match(/from=([^\s,"]+)|model=([^\s,"]+)/);
  return m ? (m[1] || m[2]) : null;
}

// ---------- side effects ----------
function appendIncident(rec) {
  fs.appendFileSync(INCIDENT_LOG, JSON.stringify(rec) + "\n");
}

function notify(title, body) {
  // macOS desktop notification, best-effort. No-op on other platforms.
  if (process.platform !== "darwin") return;
  const safe = (s) => String(s).replace(/"/g, '\\"');
  spawn("osascript", ["-e", `display notification "${safe(body)}" with title "${safe(title)}"`], {
    stdio: "ignore",
    detached: true,
  }).unref();
}

async function retryRun(runId, token) {
  const url = GATEWAY_URL + RETRY_PATH.replace("{runId}", encodeURIComponent(runId));
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ source: "openclaw-watchdog" }),
  });
  return { status: res.status, ok: res.ok, body: await res.text().catch(() => "") };
}

// ---------- dedup + retry orchestration ----------
const recentRuns = new Map(); // runId -> { firstSeenMs, attempts }

async function handleEvent({ file, line, classification }) {
  const runId = extractRunId(line);
  const lane = extractLane(line);
  const model = extractModel(line);
  const tsMatch = line.match(/^\S+/);
  const ts = tsMatch ? tsMatch[0] : new Date().toISOString();

  const incident = {
    seenAt: new Date().toISOString(),
    sourceFile: path.basename(file),
    logTimestamp: ts,
    classification: classification.name,
    retryable: classification.retryable,
    runId,
    lane,
    model,
    line: line.length > 500 ? line.slice(0, 500) + "…(truncated)" : line,
  };
  appendIncident(incident);

  const summary = `[${classification.name}] ${runId || lane || "no-id"} ${model || ""}`.trim();
  console.log(`[watchdog] ${summary}`);

  // dedup by runId within window
  if (runId) {
    const entry = recentRuns.get(runId);
    if (entry && (Date.now() - entry.firstSeenMs) < DEDUP_WINDOW_MS) {
      console.log(`[watchdog]   skip: already handled runId=${runId} ${entry.attempts}x`);
      return;
    }
    recentRuns.set(runId, { firstSeenMs: Date.now(), attempts: 0 });
  }

  // policy gate
  const shouldRetry = RETRY_MODE
    && (classification.retryable || (classification.name === "auth_401" && RETRY_401));

  if (!shouldRetry) {
    notify("OpenClaw watchdog", `${classification.name} — alert only (no retry). ${runId ?? lane ?? ""}`);
    return;
  }

  if (!runId) {
    console.log("[watchdog]   no runId in line; cannot target retry. Alerting only.");
    notify("OpenClaw watchdog", `${classification.name} with no runId. Manual intervention.`);
    return;
  }

  const token = loadGatewayToken();
  if (!token) {
    console.error("[watchdog]   no gateway token (OPENCLAW_GATEWAY_TOKEN or openclaw.json gateway.auth.token). Cannot retry.");
    notify("OpenClaw watchdog", `Cannot retry runId=${runId}: no gateway token`);
    return;
  }

  // exponential backoff retry loop
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
    console.log(`[watchdog]   attempt ${attempt}/${MAX_ATTEMPTS} for runId=${runId} after ${delay}ms`);
    await sleep(delay);
    try {
      const r = await retryRun(runId, token);
      recentRuns.get(runId).attempts = attempt;
      console.log(`[watchdog]   retry HTTP ${r.status} ok=${r.ok}`);
      appendIncident({ seenAt: new Date().toISOString(), kind: "retry_attempt", runId, attempt, status: r.status, ok: r.ok, body: r.body.slice(0, 200) });
      if (r.ok) {
        notify("OpenClaw watchdog", `Retry succeeded for runId=${runId} (attempt ${attempt})`);
        return;
      }
      // hard auth/billing/4xx not worth retrying further
      if (r.status === 401 || r.status === 403 || r.status === 402) {
        notify("OpenClaw watchdog", `Retry hit ${r.status} for runId=${runId}; giving up`);
        return;
      }
    } catch (err) {
      console.error(`[watchdog]   retry error: ${err.message}`);
      appendIncident({ seenAt: new Date().toISOString(), kind: "retry_error", runId, attempt, error: err.message });
    }
  }
  notify("OpenClaw watchdog", `Exhausted ${MAX_ATTEMPTS} retries for runId=${runId}`);
}

// ---------- tailing ----------
function tailFile(file, { backfillLines = 0 } = {}) {
  let position = 0;
  try {
    position = fs.statSync(file).size;
  } catch { /* file might rotate */ }

  if (backfillLines > 0) {
    const stream = fs.createReadStream(file, { encoding: "utf8" });
    const rl = readline.createInterface({ input: stream });
    const buf = [];
    rl.on("line", (line) => {
      buf.push(line);
      if (buf.length > backfillLines) buf.shift();
    });
    rl.on("close", () => {
      for (const line of buf) {
        const c = classify(line);
        if (c) handleEvent({ file, line, classification: c });
      }
    });
  }

  let pending = "";
  fs.watchFile(file, { interval: 500 }, (curr, prev) => {
    if (curr.size < prev.size) position = 0; // rotation
    if (curr.size <= position) return;
    const stream = fs.createReadStream(file, {
      encoding: "utf8",
      start: position,
      end: curr.size,
    });
    position = curr.size;
    stream.on("data", (chunk) => {
      pending += chunk;
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const c = classify(line);
        if (c) handleEvent({ file, line, classification: c });
      }
    });
  });
}

// ---------- entry ----------
console.log(`[watchdog] tailing ${FILES.length} log file(s) under ${LOG_DIR}`);
console.log(`[watchdog] retry mode: ${RETRY_MODE ? "ON" : "OFF (alert only)"}${RETRY_401 ? " (incl. 401)" : ""}`);
console.log(`[watchdog] incidents -> ${INCIDENT_LOG}`);
for (const f of FILES) tailFile(f, { backfillLines: BACKFILL });

process.on("SIGINT", () => { console.log("\n[watchdog] bye"); process.exit(0); });
