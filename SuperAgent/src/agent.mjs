/**
 * Super-Axevora - Autonomous Core Agent Engine
 * Dual-Engine Architecture: Groq (Llama 3.3 70B) Primary + Google Gemini Auto-Failover Backup
 * Compatible with Cloudflare Workers runtime and Node.js environments.
 */

import { SYSTEM_PROMPT, GEMINI_SAFETY_SETTINGS, MODELS } from "./config.mjs";
import { InstagramAuditor } from "./tools/instagram.mjs";
import { AndroidAssistant } from "./tools/android.mjs";
import { ReaInspector } from "./tools/rea.mjs";

export class SuperAgentEngine {
  /**
   * @param {string|null} apiKey Gemini API Key
   * @param {Object} env Environment bindings (Cloudflare env or process.env fallback)
   */
  constructor(apiKey = null, env = {}) {
    const processEnv = (typeof process !== "undefined" && process?.env) ? process.env : {};
    this.env = env || {};
    this.apiKey = apiKey || this.env.GEMINI_API_KEY || processEnv.GEMINI_API_KEY || null;
    this.groqApiKey = this.env.GROQ_API_KEY || processEnv.GROQ_API_KEY || null;
    this.model = this.env.DEFAULT_MODEL || processEnv.DEFAULT_MODEL || MODELS.primary;
  }

  /**
   * Engine 1: Groq LPU (Llama 3.3 70B - Bullet Speed & Zero Censorship)
   */
  async callGroq(promptText, history = []) {
    if (!this.groqApiKey) return null;
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
        model: "llama-3.3-70b-versatile",
        messages: messages,
        temperature: 0.7,
        max_tokens: 2048
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
   * Engine 2: Google Gemini (Backup Failover)
   */
  async callGemini(promptText, history = []) {
    if (!this.apiKey) return null;
    const modelName = this.model || MODELS.primary;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;

    const payload = {
      contents: [
        ...history,
        { role: "user", parts: [{ text: promptText }] }
      ],
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }]
      },
      safetySettings: GEMINI_SAFETY_SETTINGS,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048
      }
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": this.apiKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini HTTP ${response.status}: ${err}`);
    }

    const result = await response.json();
    return result?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  }

  /**
   * Main interaction entrypoint
   */
  async process(userMessage, history = []) {
    const textLower = userMessage.toLowerCase();

    // 0. Auto-Detect Instagram, YouTube, or Website links for 2-in-1 Reverse Engineering
    let promptToSend = userMessage;
    const urlMatch = userMessage.match(/https?:\/\/[^\s]+/i);
    const isDirectLink = Boolean(urlMatch);

    if (isDirectLink) {
      const targetUrl = urlMatch[0];
      const isIg = targetUrl.includes("instagram.com");
      const isYt = targetUrl.includes("youtube.com") || targetUrl.includes("youtu.be");
      const typeName = isIg ? "Instagram Link" : isYt ? "YouTube Video/Short" : "Website / Social Media URL";

      promptToSend = `Target Link: ${targetUrl} (${typeName})

Perform a rigorous 2-part tactical reverse-engineering analysis:
PART 1: [KUNDALI & REVERSE-ENGINEERING AUDIT]
• Post anatomy, hook retention psychology, estimated watch-time physics.
• Audio virality saturation check (fresh vs saturated) and explore algorithm signals.
• Root-cause analysis: Why this content either blew up or flatlined.

PART 2: [10X WINNING BLUEPRINT]
• 3 actionable steps to make an improved, superior version.
• The exact winning hook script & visual pacing formula.
• Algorithm ranking trigger hacks (share-to-view ratio, loop multipliers, CTR).

User query context: ${userMessage}`;
    }

    // 1. Tool Routing: Manual Reel Numbers Audit (Only if NOT a direct URL)
    const isReelQuery = !isDirectLink && (
      textLower.includes("reel") || textLower.includes("viral") || textLower.includes("kundali") ||
      (textLower.includes("instagram") && (textLower.includes("audit") || textLower.includes("reach") || textLower.includes("view") || textLower.includes("share")))
    );

    if (isReelQuery) {
      const numbers = userMessage.match(/\d+/g) || [];
      const views = numbers[0] ? parseInt(numbers[0], 10) : 1200;
      const shares = numbers[1] ? parseInt(numbers[1], 10) : 18;
      const likes = numbers[2] ? parseInt(numbers[2], 10) : 85;

      const audit = InstagramAuditor.auditReel({
        url: userMessage,
        views,
        shares,
        likes,
        hook_text: userMessage,
        audio_status: textLower.includes("trending") ? "trending_fresh" : "unknown"
      });

      return `📊 **Instagram Reel Kundali & Viral Audit Report:**

• **Views:** ${audit.metrics.views} | **Shares:** ${audit.metrics.shares} | **Likes:** ${audit.metrics.likes}
• **Share-to-View Ratio:** **${audit.metrics.share_to_view_ratio}** (${audit.metrics.share_grade})
• **Hook Score:** ${audit.metrics.hook_score}

🔍 **Asal Reason (Diagnosis):**
${audit.diagnosis.share_analysis}
${audit.diagnosis.hook_analysis}

🚀 **Agli Reel Me Ye 3 Cheezein Fix Karo:**
1. ${audit.actionable_plan[0]}
2. ${audit.actionable_plan[1]}
3. ${audit.actionable_plan[2]}

*Bhai is formula se agli reel banao, share count 6% cross karte hi Instagram algorithm explore feed me push dega!*`;
    }

    // 2. Tool Routing: Android Assistants & Automation
    const isAutomationQuery = !isDirectLink && (
      textLower.includes("macrodroid") || textLower.includes("tasker") || textLower.includes("termux:api") ||
      ((textLower.includes("automation") || textLower.includes("assistant")) && (textLower.includes("android") || textLower.includes("phone")))
    );

    if (isAutomationQuery) {
      const recipes = AndroidAssistant.getAutomationRecipe("list_all");
      return `📱 **Android Ke Top Free Assistants & Automation Systems (Zero API Key):**

1. ⚡ **MacroDroid (Sabse Best & Easy):**
   • **Cost:** 100% Free
   • **Kaam:** Phone battery 20% par alert, meeting me automatic SMS reply, WiFi/Bluetooth auto-switch, WhatsApp automated messages.

2. 🛠️ **Termux + Termux:API (Developers Ka Super-Weapon):**
   • **Cost:** 100% Free & Open Source
   • **Kaam:** Phone ke camera se background photo lena, GPS location nikalna, clipboard sync, background scripts chalana.

3. 🎙️ **FUTO Voice Assistant (100% Offline AI):**
   • **Cost:** 100% Free
   • **Kaam:** Phone ke local processor par bina internet ke voice commands samajh kar phone apps chalata hai.

*Aapko phone me kis task ka automation karwana hai? Batayein, main ready-to-run script ya MacroDroid recipe de dunga.*`;
    }

    // 3. Fallback: Check if at least one API key is present
    if (!this.groqApiKey && !this.apiKey) {
      return `⚡ Super-Axevora ready hai! Lekin abhi \`GROQ_API_KEY\` ya \`GEMINI_API_KEY\` set nahi hai.
Cloudflare dashboard me GROQ_API_KEY add kijiye.`;
    }

    // 4. Dual-Engine Execution (Groq Llama 3.3 70B Primary -> Gemini Failover)
    let lastError = null;

    // Try Engine 1: Groq (0.5s Speed & Uncensored)
    if (this.groqApiKey) {
      try {
        const groqAnswer = await this.callGroq(promptToSend, history);
        if (groqAnswer) return groqAnswer;
      } catch (err) {
        console.warn("[Groq Error, switching to Gemini]:", err.message);
        lastError = `Groq Error: ${err.message}`;
      }
    }

    // Try Engine 2: Gemini (Backup)
    if (this.apiKey) {
      try {
        const geminiAnswer = await this.callGemini(promptToSend, history);
        if (geminiAnswer) return geminiAnswer;
      } catch (err) {
        console.error("[Gemini Error]:", err.message);
        lastError = `Gemini Error: ${err.message}`;
      }
    }

    return `[Super-Axevora Execution Error]: ${lastError || "Both Groq and Gemini failed."}`;
  }
}
