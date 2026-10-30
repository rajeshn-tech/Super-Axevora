/**
 * Super-Axevora - Autonomous Core Agent Engine
 * Features:
 *  - Llama-3.3-70B Flagship Priority + Anti-Loop Penalties
 *  - Live Website Telemetry & WAF Scanner (Real Reverse Engineering)
 *  - Kaalvan_REA Private Repo Integration (GitHub PAT)
 *  - Social Media Auditor & Android Assistant Tools
 *  - Dual-Engine Failover (Groq -> Gemini 1.5 Flash)
 */

import { SYSTEM_PROMPT, GEMINI_SAFETY_SETTINGS, MODELS } from "./config.mjs";
import { InstagramAuditor } from "./tools/instagram.mjs";
import { AndroidAssistant } from "./tools/android.mjs";
import { ReaInspector } from "./tools/rea.mjs";

export class SuperAgentEngine {
  constructor(apiKey = null, env = {}) {
    const processEnv = (typeof process !== "undefined" && process?.env) ? process.env : {};
    this.env = env || {};
    this.apiKey = apiKey || this.env.GEMINI_API_KEY || processEnv.GEMINI_API_KEY || null;
    this.groqApiKey = this.env.GROQ_API_KEY || processEnv.GROQ_API_KEY || null;
    this.githubToken = this.env.GITHUB_TOKEN || processEnv.GITHUB_TOKEN || null;
    this.model = this.env.DEFAULT_MODEL || processEnv.DEFAULT_MODEL || "gemini-1.5-flash";

    // Initialize Subsystem Tools
    this.instagram = new InstagramAuditor();
    this.android = new AndroidAssistant();
    this.rea = new ReaInspector(this.githubToken);
  }

  /**
   * Live Target Scanner: Fetches live headers, WAF, CDN, and security flags
   */
  async inspectTargetUrl(url) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        },
        signal: controller.signal
      });
      clearTimeout(timeout);

      const headers = {};
      res.headers.forEach((val, key) => { headers[key] = val; });

      const server = headers["server"] || "Hidden / Obfuscated";
      const cfRay = headers["cf-ray"] ? "Protected by Cloudflare WAF" : "Direct / No Cloudflare Proxy Detected";
      const hsts = headers["strict-transport-security"] ? "HSTS Present" : "Missing HSTS (Vulnerable to SSL Strip)";
      const csp = headers["content-security-policy"] ? "CSP Present" : "Missing CSP (XSS Attack Surface)";
      const cookies = headers["set-cookie"] || "No direct cookies in header";

      return `\n[LIVE REVERSE-ENGINEERING SCAN FOR ${url}]:
- HTTP Status: ${res.status} ${res.statusText}
- Web Server Banner: ${server}
- CDN/WAF Protection: ${cfRay}
- SSL/Transport Security: ${hsts}
- Content Security Policy: ${csp}
- Set-Cookie Flags: ${cookies.slice(0, 180)}
`;
    } catch (e) {
      return `\n[LIVE REVERSE-ENGINEERING SCAN FOR ${url}]:
- Note: Live request timed out or was blocked by target firewall (${e.message}). Performing deep architectural threat analysis based on known domain blueprints.
`;
    }
  }

  /**
   * Auto-selects the flagship 70B model to ensure fluent Hinglish
   */
  async getActiveGroqModel() {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { "Authorization": `Bearer ${this.groqApiKey}` }
      });
      if (res.ok) {
        const json = await res.json();
        const models = (json?.data || []).map(m => m.id);

        const textModels = models.filter(m =>
          !m.includes("whisper") &&
          !m.includes("orpheus") &&
          !m.includes("canopylabs") &&
          !m.includes("tts") &&
          !m.includes("embed") &&
          !m.includes("guard")
        );

        const preferred = [
          "llama-3.3-70b-versatile",
          "llama-3.1-70b-versatile",
          "mixtral-8x7b-32768",
          "llama-3.1-8b-instant"
        ];

        const match = preferred.find(p => textModels.includes(p)) ||
                      textModels.find(m => m.includes("70b")) ||
                      textModels[0];

        if (match) {
          console.log("[Groq Active Model Selected]:", match);
          return match;
        }
      }
    } catch (e) {
      console.warn("Failed to fetch Groq models list:", e);
    }
    return "llama-3.3-70b-versatile";
  }

  /**
   * Primary Engine: Groq LPU with Anti-Loop Repetition Penalties
   */
  async executeGroq(promptText, history = []) {
    if (!this.groqApiKey) throw new Error("GROQ_API_KEY is not configured");

    const modelToUse = await this.getActiveGroqModel();
    const endpoint = "https://api.groq.com/openai/v1/chat/completions";

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map(h => ({
        role: h.role === "model" ? "assistant" : h.role,
        content: h.parts?.[0]?.text || h.content || ""
      })),
      { role: "user", content: promptText }
    ];

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.groqApiKey}`
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: messages,
        temperature: 0.6,
        presence_penalty: 0.4,
        frequency_penalty: 0.4
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Groq HTTP ${response.status}: ${err}`);
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content || null;
  }

  /**
   * Backup Engine: Google Gemini Fallback
   */
  async executeGemini(promptText, history = []) {
    if (!this.apiKey) {
      throw new Error("Neither Groq nor Gemini API Keys are available.");
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const contents = [
      ...history.map(h => ({
        role: h.role || "user",
        parts: h.parts || [{ text: h.content || "" }]
      })),
      {
        role: "user",
        parts: [{ text: `${SYSTEM_PROMPT}\n\nUser Message: ${promptText}` }]
      }
    ];

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: contents,
        safetySettings: GEMINI_SAFETY_SETTINGS,
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 2048
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "Bhai, process ho gaya par output empty aaya.";
  }

  /**
   * Main Router with Live URL Discovery & Context Injection
   */
  async execute(promptText, history = []) {
    let enrichedPrompt = promptText;

    // 1. Detect if prompt contains a Website or API link
    const urlMatch = promptText.match(/https?:\/\/[^\s]+/i);
    if (urlMatch) {
      const detectedUrl = urlMatch[0];
      const isSocialMedia = detectedUrl.includes("instagram.com") || detectedUrl.includes("youtube.com") || detectedUrl.includes("youtu.be");

      if (!isSocialMedia) {
        // Run live reverse engineering scan on the website
        console.log("[Live Reverse Engineering Target]:", detectedUrl);
        const liveTelemetry = await this.inspectTargetUrl(detectedUrl);
        enrichedPrompt = `${promptText}\n\n${liveTelemetry}\n(Bhai, use these real live scan findings in your reverse engineering breakdown!)`;
      }
    }

    // 2. Detect if private REA algorithms are requested
    if (promptText.toLowerCase().includes("kaalvan") || promptText.toLowerCase().includes("algorithm")) {
      try {
        const repoData = await this.rea.inspectRepository();
        if (repoData) {
          enrichedPrompt = `${enrichedPrompt}\n\n[KAALVAN_REA CONTEXT]: ${JSON.stringify(repoData).slice(0, 500)}`;
        }
      } catch (e) {
        console.warn("[REA Context Fetch Skipped]:", e.message);
      }
    }

    // 3. Execute Primary (Groq LPU) -> Secondary (Gemini)
    if (this.groqApiKey) {
      try {
        const groqReply = await this.executeGroq(enrichedPrompt, history);
        if (groqReply) return groqReply;
      } catch (err) {
        console.warn("[Groq Error, switching to Gemini]:", err.message);
      }
    }

    return await this.executeGemini(enrichedPrompt, history);
  }
}
