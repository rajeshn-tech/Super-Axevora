/**
 * SuperAgent - Telegram Bot Interface (Webhook & Polling Supported)
 * Connects mobile Telegram directly to Cloudflare Edge / Local Agent.
 * Compatible with Cloudflare Workers runtime and Node.js environments.
 */

/**
 * Isolated Node.js filesystem logger.
 * Never executed in Cloudflare Workers environment.
 * Uses asynchronous file operations only.
 */
async function appendLocalLog(sender, userMsg, replyMsg) {
  // Only execute in pure Node.js environments where filesystem is accessible
  if (typeof process !== "undefined" && process?.versions?.node && !globalThis.WebSocketPair) {
    try {
      const fsMod = "node:fs";
      const pathMod = "node:path";
      const fs = await import(/* webpackIgnore: true */ fsMod);
      const path = await import(/* webpackIgnore: true */ pathMod);
      const historyFile = path.resolve(process.cwd(), "chat_history.log");
      const time = new Date().toISOString();
      const entry = `[${time}] ${sender}: "${userMsg}"\n[${time}] SuperAgent: "${replyMsg}"\n---\n`;
      await fs.promises.appendFile(historyFile, entry, "utf-8");
    } catch {
      // Ignore local filesystem logging errors silently
    }
  }
}

export class TelegramHandler {
  /**
   * @param {string} botToken Telegram Bot Token
   * @param {Object} agentEngine SuperAgentEngine instance
   * @param {Function} [logger] Optional custom logger function (sender, userMsg, replyMsg)
   */
  constructor(botToken, agentEngine, logger = null) {
    this.token = botToken || "";
    this.agent = agentEngine;
    this.apiUrl = `https://api.telegram.org/bot${this.token}`;
    this.logger = logger;
  }

  async logInteraction(sender, userMsg, replyMsg) {
    if (typeof this.logger === "function") {
      try {
        await this.logger(sender, userMsg, replyMsg);
      } catch {
        // Silently handle custom logger exceptions
      }
    } else {
      await appendLocalLog(sender, userMsg, replyMsg);
    }
  }

  async handleUpdate(update) {
    const message = update?.message || update?.edited_message;
    if (!message || !message.text) return;

    const chatId = message.chat?.id;
    if (!chatId) return;

    const text = message.text.trim();
    const sender = message.from?.first_name || message.from?.username || "User";

    console.log(`\n📩 [Telegram Message From ${sender}]: ${text}`);

    if (text === "/start") {
      const welcome = `⚡ **SuperAgent Online!**

Bhai main aapka personal 24/7 SuperAgent hoon jo Cloudflare aur Mobile se connected hai.

🎯 **Direct Commands:**
• \`Bhai is reel ka audit kar: [Reel details/numbers]\`
• \`Phone ke liye free assistant list do\`
• \`Kisi bhi topic ya code par seedha sawaal pucho (Zero refusal)\`

Aap voice note ya text message bhejo, main turant action lunga!`;
      await this.sendMessage(chatId, welcome);
      await this.logInteraction(sender, text, welcome);
      return;
    }

    // Process via SuperAgent Engine
    const reply = await this.agent.process(text);
    console.log(`⚡ [SuperAgent Reply to ${sender}]:\n${reply}\n`);
    await this.logInteraction(sender, text, reply);

    await this.sendMessage(chatId, reply);
  }

  async sendMessage(chatId, text) {
    if (!this.token) return;
    try {
      // First try sending formatted markdown
      const res = await fetch(`${this.apiUrl}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: "Markdown"
        })
      });

      // If Telegram rejects due to markdown formatting, retry as clean text
      if (!res.ok) {
        await fetch(`${this.apiUrl}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: text
          })
        });
      }
    } catch (err) {
      console.error("[Telegram Send Error]:", err);
    }
  }

  /**
   * Start long polling for local testing without webhooks
   */
  async startPolling() {
    if (!this.token) {
      console.log("[Telegram] No TELEGRAM_BOT_TOKEN provided. Skipping polling.");
      return;
    }

    console.log("[Telegram] Bot long-polling started. Send a message to your bot on Telegram!");
    let offset = 0;

    while (true) {
      try {
        const res = await fetch(`${this.apiUrl}/getUpdates?offset=${offset}&timeout=30`);
        const data = await res.json();
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            offset = update.update_id + 1;
            await this.handleUpdate(update);
          }
        }
      } catch (err) {
        // Sleep 3 seconds on error
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }
}
