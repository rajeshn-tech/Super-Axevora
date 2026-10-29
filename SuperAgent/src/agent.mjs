/**
 * SuperAgent - Autonomous Core Agent Engine
 * Direct Developer API caller with BLOCK_NONE safety thresholds and Tool Calling loops.
 */

import { SYSTEM_PROMPT, GEMINI_SAFETY_SETTINGS, MODELS } from "./config.mjs";
import { InstagramAuditor } from "./tools/instagram.mjs";
import { AndroidAssistant } from "./tools/android.mjs";

export class SuperAgentEngine {
  constructor(apiKey = null, env = {}) {
    this.apiKey = apiKey || env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || null;
    this.env = env;
  }

  /**
   * Main interaction entrypoint
   * @param {string} userMessage 
   * @param {Array} history 
   * @returns {Promise<string>}
   */
  async process(userMessage, history = []) {
    const textLower = userMessage.toLowerCase();

    // 1. Tool Routing: Instagram Reel & Growth Diagnosis
    if (textLower.includes("instagram") || textLower.includes("reel") || textLower.includes("viral") || textLower.includes("kundali")) {
      const numbers = userMessage.match(/\d+/g) || [];
      const views = numbers[0] ? parseInt(numbers[0]) : 1200;
      const shares = numbers[1] ? parseInt(numbers[1]) : 18;
      const likes = numbers[2] ? parseInt(numbers[2]) : 85;

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
    if (textLower.includes("android") || textLower.includes("assistant") || textLower.includes("phone") || textLower.includes("automation") || textLower.includes("macrodroid") || textLower.includes("tasker")) {
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

    // 3. Fallback: If no API key configured yet, provide crisp built-in intelligence
    if (!this.apiKey) {
      return `Bhai SuperAgent ready hai! Lekin abhi \`GEMINI_API_KEY\` set nahi hai. 
Aap \`https://aistudio.google.com\` se apni 100% Free API key generate karke \`.env\` me paste kar dijiye taaki general deep thinking enable ho jaye!

Tab tak Instagram Reel Audit aur Android Automation tools bilkul live chal rahe hain!`;
    }

    // 4. Direct Google AI Studio API Call with BLOCK_NONE safety thresholds
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.primary}:generateContent?key=${this.apiKey}`;
      const payload = {
        contents: [
          ...history,
          { role: "user", parts: [{ text: userMessage }] }
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
        headers: { "Content-Type": "application/json" },
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
      return `[SuperAgent Execution Error]: ${err.message}`;
    }
  }
}
