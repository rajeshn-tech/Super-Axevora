/**
 * SuperAgent - Telegram Bot Interface (Webhook & Polling Supported)
 * Connects mobile Telegram directly to Cloudflare Edge / Local Agent.
 */

export class TelegramHandler {
  constructor(botToken, agentEngine) {
    this.token = botToken;
    this.agent = agentEngine;
    this.apiUrl = `https://api.telegram.org/bot${botToken}`;
  }

  async handleUpdate(update) {
    const message = update.message;
    if (!message || !message.text) return;

    const chatId = message.chat.id;
    const text = message.text.trim();

    if (text === "/start") {
      await this.sendMessage(chatId, `⚡ **SuperAgent Online!**

Bhai main aapka personal 24/7 SuperAgent hoon jo Cloudflare aur Mobile se connected hai.

🎯 **Direct Commands:**
• \`Bhai is reel ka audit kar: [Reel details/numbers]\`
• \`Phone ke liye free assistant list do\`
• \`Kisi bhi topic ya code par seedha sawaal pucho (Zero refusal)\`

Aap voice note ya text message bhejo, main turant action lunga!`);
      return;
    }

    // Process via SuperAgent Engine
    const reply = await this.agent.process(text);
    await this.sendMessage(chatId, reply);
  }

  async sendMessage(chatId, text) {
    if (!this.token) return;
    try {
      await fetch(`${this.apiUrl}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: "Markdown"
        })
      });
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

