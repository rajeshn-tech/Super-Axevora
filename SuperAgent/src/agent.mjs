/**
 * Super-Axevora - Autonomous Core Agent Engine
 * Direct Developer API caller with BLOCK_NONE safety thresholds and Tool Calling loops.
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
    this.model = this.env.DEFAULT_MODEL || processEnv.DEFAULT_MODEL || MODELS.primary;
  }

  /**
   * Main interaction entrypoint
   * @param {string} userMessage 
   * @param {Array} history 
   * @returns {Promise<string>}
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

    // 3. Fallback: If no API key configured yet
    if (!this.apiKey) {
      return `⚡ Super-Axevora ready hai! Lekin abhi \`GEMINI_API_KEY\` set nahi hai. 
Aap \`https://aistudio.google.com\` se apni 100% Free API key generate karke Cloudflare secrets (\`wrangler secret put GEMINI_API_KEY\`) ya local \`.env\` me paste kar dijiye.`;
    }

    // 4. Direct Google AI Studio API Call with BLOCK_NONE safety thresholds
    try {
      const modelName = this.model || MODELS.primary;
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
      const payload = {
        contents: [
          ...history,
          { role: "user", parts: [{ text: promptToSend }] }
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
        const errText = await response.text();
        return `API Error (${response.status}): ${errText}`;
      }

      const result = await response.json();
      const answer = result?.candidates?.[0]?.content?.parts?.[0]?.text;
      return answer || "No response generated.";
    } catch (err) {
      return `[Super-Axevora Execution Error]: ${err.message}`;
    }
  }
}