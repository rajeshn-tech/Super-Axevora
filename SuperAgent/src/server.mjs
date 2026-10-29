/**
 * SuperAgent - Standalone Local Node.js Server & Mobile LAN Gateway
 * Allows running SuperAgent on your PC or Termux with zero Cloudflare setup.
 * Serves the Mobile Web Dashboard and starts Telegram Bot Long-Polling.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { SuperAgentEngine } from "./agent.mjs";
import { TelegramHandler } from "./telegram.mjs";
import { InstagramAuditor } from "./tools/instagram.mjs";
import { AndroidAssistant } from "./tools/android.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, "..", "public");

// Load .env file if present
function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const PORT = parseInt(process.env.PORT || "8787", 10);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

const agent = new SuperAgentEngine(GEMINI_API_KEY, {
  GEMINI_API_KEY,
  TELEGRAM_BOT_TOKEN,
  DEFAULT_MODEL: process.env.DEFAULT_MODEL || "gemini-2.5-flash"
});

const telegram = new TelegramHandler(TELEGRAM_BOT_TOKEN, agent);

// Get local network IP for mobile phone testing
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

// MIME types for static assets
const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;

  // Helper to read JSON request body
  const readJsonBody = () => new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => { data += chunk; });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });

  try {
    // 1. API: Chat
    if (pathname === "/api/chat" && req.method === "POST") {
      const body = await readJsonBody();
      const userMsg = body.message || "";
      const history = body.history || [];
      const reply = await agent.process(userMsg, history);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "success", reply }));
      return;
    }

    // 2. API: Instagram Reel Audit
    if (pathname === "/api/audit-reel" && req.method === "POST") {
      const data = await readJsonBody();
      const report = InstagramAuditor.auditReel(data);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(report));
      return;
    }

    // 3. API: Android Tools
    if (pathname === "/api/android-tools" && req.method === "GET") {
      const task = parsedUrl.searchParams.get("task") || "list_all";
      const recipe = AndroidAssistant.getAutomationRecipe(task);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(recipe));
      return;
    }

    // 4. API: Health Check
    if (pathname === "/api/health" || (pathname === "/api" && req.method === "GET")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ONLINE",
        name: "SuperAgent",
        version: "1.0.0",
        geminiConfigured: !!GEMINI_API_KEY,
        telegramConfigured: !!TELEGRAM_BOT_TOKEN
      }));
      return;
    }

    // 5. Static File Serving from /public
    let relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    let safePath = path.normalize(path.join(PUBLIC_DIR, relativePath));

    if (!safePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
      const ext = path.extname(safePath).toLowerCase();
      const mime = MIME_TYPES[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": mime });
      fs.createReadStream(safePath).pipe(res);
      return;
    }

    // Fallback to index.html for SPA/PWA routing
    const indexPath = path.join(PUBLIC_DIR, "index.html");
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { "Content-Type": "text/html" });
      fs.createReadStream(indexPath).pipe(res);
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 Not Found");

  } catch (err) {
    console.error("[Server Error]:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "error", error: err.message }));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  const localIp = getLocalIp();
  console.log(`\n======================================================`);
  console.log(`🚀 SuperAgent Standalone Server is Running!`);
  console.log(`======================================================`);
  console.log(`🖥️  Local Access:      http://localhost:${PORT}`);
  console.log(`📱 Mobile LAN Access:  http://${localIp}:${PORT}`);
  console.log(`⚡ Gemini API Status:  ${GEMINI_API_KEY ? "CONFIGURED (AI Studio)" : "OFFLINE / FALLBACK MODE"}`);
  console.log(`🤖 Telegram Bot:       ${TELEGRAM_BOT_TOKEN ? "STARTING POLLING..." : "NOT CONFIGURED (Optional)"}`);
  console.log(`======================================================\n`);

  if (TELEGRAM_BOT_TOKEN) {
    telegram.startPolling().catch(e => console.error("[Telegram Polling Failed]:", e));
  }
});
