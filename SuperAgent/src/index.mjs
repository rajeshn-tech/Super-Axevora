/**
 * SuperAgent - Cloudflare Worker Entrypoint & API Router
 * Runs on Cloudflare Edge with 0ms cold starts, 24/7 reliability, and 100K free requests/day.
 */

import { SuperAgentEngine } from "./agent.mjs";
import { TelegramHandler } from "./telegram.mjs";
import { InstagramAuditor } from "./tools/instagram.mjs";
import { AndroidAssistant } from "./tools/android.mjs";

export default {
  async fetch(request, env = {}, ctx) {
    const url = new URL(request.url);
    const method = request.method;

    // Standard CORS headers for mobile web and PWA access
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Telegram-Bot-Api-Secret-Token"
    };

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const pathname = url.pathname;

    // 1. Telegram Webhook Endpoint
    if (pathname === "/telegram-webhook") {
      if (method !== "POST") {
        return new Response(JSON.stringify({ status: "error", error: "Method Not Allowed" }), {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Secure Telegram webhook verification using Cloudflare secret TELEGRAM_WEBHOOK_SECRET
      const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET;
      if (webhookSecret) {
        const receivedSecret = request.headers.get("x-telegram-bot-api-secret-token") ||
                               request.headers.get("X-Telegram-Bot-Api-Secret-Token");
        if (receivedSecret !== webhookSecret) {
          return new Response(JSON.stringify({ status: "error", error: "Unauthorized" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }

      if (!env.TELEGRAM_BOT_TOKEN) {
        return new Response(JSON.stringify({ status: "error", error: "Telegram bot token not configured" }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      try {
        const update = await request.json();
        const agent = new SuperAgentEngine(env.GEMINI_API_KEY, env);
        const telegram = new TelegramHandler(env.TELEGRAM_BOT_TOKEN, agent);

        if (ctx && typeof ctx.waitUntil === "function") {
          ctx.waitUntil(telegram.handleUpdate(update));
        } else {
          await telegram.handleUpdate(update);
        }

        return new Response("OK", { status: 200 });
      } catch (err) {
        return new Response(JSON.stringify({ status: "error", error: err.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // 2. Health Check Endpoint (/api/health and /api)
    if (pathname === "/api/health" || pathname === "/api") {
      if (method !== "GET" && method !== "HEAD") {
        return new Response(JSON.stringify({ status: "error", error: "Method Not Allowed" }), {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const health = {
        status: "ONLINE",
        name: "SuperAgent",
        version: "1.0.0",
        architecture: "Cloudflare Edge + Telegram + Mobile PWA",
        free_tier: true,
        geminiConfigured: Boolean(env.GEMINI_API_KEY),
        telegramConfigured: Boolean(env.TELEGRAM_BOT_TOKEN),
        endpoints: [
          "/api/chat",
          "/api/audit-reel",
          "/api/android-tools",
          "/api/health",
          "/telegram-webhook"
        ]
      };

      return new Response(JSON.stringify(health, null, 2), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 3. Mobile Web Chat API
    if (pathname === "/api/chat") {
      if (method !== "POST") {
        return new Response(JSON.stringify({ status: "error", error: "Method Not Allowed" }), {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      try {
        const body = await request.json();
        const userMsg = body.message || "";
        const history = body.history || [];
        const agent = new SuperAgentEngine(env.GEMINI_API_KEY, env);
        const reply = await agent.process(userMsg, history);
        return new Response(JSON.stringify({ status: "success", reply }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ status: "error", error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // 4. Instagram Direct Audit Endpoint
    if (pathname === "/api/audit-reel") {
      if (method !== "POST") {
        return new Response(JSON.stringify({ status: "error", error: "Method Not Allowed" }), {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      try {
        const data = await request.json();
        const report = InstagramAuditor.auditReel(data);
        return new Response(JSON.stringify(report), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ status: "error", error: err.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // 5. Android Tools Endpoint
    if (pathname === "/api/android-tools") {
      if (method !== "GET") {
        return new Response(JSON.stringify({ status: "error", error: "Method Not Allowed" }), {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      try {
        const task = url.searchParams.get("task") || "list_all";
        const recipe = AndroidAssistant.getAutomationRecipe(task);
        return new Response(JSON.stringify(recipe), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ status: "error", error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // 6. Unknown /api/* routes should not fall through to static assets
    if (pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ status: "error", error: "Not Found", message: `Unknown API endpoint: ${pathname}` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 7. Static Asset Serving via Cloudflare Assets Binding (ASSETS)
    if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) {
        return assetResponse;
      }
    }

    // 8. Catch-all fallback for missing assets / unhandled routes
    return new Response("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain" }
    });
  }
};
