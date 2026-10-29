/**
 * SuperAgent - Cloudflare Worker Entrypoint & API Router
 * Runs on Cloudflare Edge with 0ms cold starts, 24/7 reliability, and 100K free requests/day.
 */

import { SuperAgentEngine } from "./agent.mjs";
import { TelegramHandler } from "./telegram.mjs";
import { InstagramAuditor } from "./tools/instagram.mjs";
import { AndroidAssistant } from "./tools/android.mjs";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;

    // CORS headers for mobile web access
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };

    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const agent = new SuperAgentEngine(env.GEMINI_API_KEY, env);

    // 1. Telegram Webhook Endpoint
    if (url.pathname === "/telegram-webhook" && method === "POST") {
      const telegram = new TelegramHandler(env.TELEGRAM_BOT_TOKEN, agent);
      try {
        const update = await request.json();
        ctx.waitUntil(telegram.handleUpdate(update));
        return new Response("OK", { status: 200 });
      } catch (err) {
        return new Response("Error: " + err.message, { status: 400 });
      }
    }

    // 2. Mobile Web Chat API
    if (url.pathname === "/api/chat" && method === "POST") {
      try {
        const body = await request.json();
        const userMsg = body.message || "";
        const history = body.history || [];
        const reply = await agent.process(userMsg, history);
        return new Response(JSON.stringify({ status: "success", reply }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ status: "error", error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // 3. Instagram Direct Audit Endpoint
    if (url.pathname === "/api/audit-reel" && method === "POST") {
      try {
        const data = await request.json();
        const report = InstagramAuditor.auditReel(data);
        return new Response(JSON.stringify(report), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ status: "error", error: err.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // 4. Android Tools Endpoint
    if (url.pathname === "/api/android-tools" && method === "GET") {
      const recipe = AndroidAssistant.getAutomationRecipe("list_all");
      return new Response(JSON.stringify(recipe), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 5. Default Status Health Check
    return new Response(JSON.stringify({
      name: "SuperAgent",
      status: "ONLINE",
      version: "1.0.0",
      architecture: "Cloudflare Edge + Telegram + Mobile PWA",
      free_tier: true,
      endpoints: ["/api/chat", "/api/audit-reel", "/api/android-tools", "/telegram-webhook"]
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
};
