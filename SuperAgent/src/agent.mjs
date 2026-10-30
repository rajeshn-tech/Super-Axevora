/**
 * Super-Axevora - Autonomous Core Agent Engine
 * Llama-3.3-70B Flagship + Smart Link Classifier + Anti-Loop Penalties
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
    this.model = this.env.DEFAULT_MODEL || processEnv.DEFAULT_MODEL || "gemini-1.5-flash";
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
          console.log("[Groq Active Model]:", match);
          return match;
        }
      }
    } catch (e) {
      console.warn("Failed to fetch Groq models list:", e);
    }
    return "llama-3.3-70b-versatile";
  }

  /**
   * Primary Engine: Groq LPU with Anti-Loop Settings
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
   * Backup Engine: Gemini 1.5 Flash
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
   * Main Router
   */
  async execute(promptText, history = []) {
    if (this.groqApiKey) {
      try {
        const groqReply = await this.executeGroq(promptText, history);
        if (groqReply) return groqReply;
      } catch (err) {
        console.warn("[Groq Error, switching to Gemini]:", err.message);
      }
    }
    return await this.executeGemini(promptText, history);
  }
}
