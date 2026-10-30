/**
 * SuperAgent Web Client & PWA Logic
 * Connects to Cloudflare Worker or Local Node.js server.
 */

// Clean up any legacy secrets previously stored in browser localStorage
try {
  localStorage.removeItem("superagent_gemini_key");
  localStorage.removeItem("superagent_telegram_token");
} catch (e) {}

// Same-origin backend URL by default, with support for custom origin override
function getBackendOrigin() {
  const origin = window.location.origin;
  if (origin && origin !== "null" && !origin.startsWith("file:")) {
    return origin.replace(/\/+$/, "");
  }
  return localStorage.getItem("superagent_backend") || "";
}

let backendUrl = getBackendOrigin();
let conversationHistory = [];

const RECIPES = {
  termux_cron: `# 1. Install cronie in Termux:
pkg install cronie termux-api -y

# 2. Create the automation script (audit_battery.sh):
cat << 'EOF' > ~/audit_battery.sh
#!/data/data/com.termux/files/usr/bin/bash
BATTERY=$(termux-battery-status | jq .percentage)
if [ "$BATTERY" -lt 20 ]; then
  termux-notification --title "SuperAgent Alert" --content "Battery Low ($BATTERY%)! Plug in now."
fi
EOF
chmod +x ~/audit_battery.sh

# 3. Schedule crontab (Runs every 15 minutes in background):
(crontab -l 2>/dev/null; echo "*/15 * * * * ~/audit_battery.sh") | crontab -
crond
termux-wake-lock`,

  battery_alert: `# Background Power Optimization via ADB / Termux:
# Disable battery throttling for your essential agent scripts:
dumpsys deviceidle whitelist +com.termux

# Run persistent background listener:
nohup termux-wake-lock &
echo "SuperAgent local daemon active in background!"`
};

function getRecipeCode(key) {
  if (key === "macrodroid_webhook") {
    const origin = backendUrl || window.location.origin || "https://super-axevora.<your-subdomain>.workers.dev";
    return `// MacroDroid Trigger:
1. Trigger: Regular Interval (Every 1 Hour) OR SMS Received OR Wi-Fi Disconnected
2. Action: HTTP Request
   - Method: POST
   - URL: ${origin}/api/chat
   - Content Type: application/json
   - Request Body:
     {
       "message": "Phone event triggered: battery={battery} wifi={wifi_ssid}"
     }
3. Action: Notification
   - Show SuperAgent response from [http_response]`;
  }
  return RECIPES[key] || "# Recipe not found";
}

// DOM Elements
document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initSettings();
  loadRecipe("termux_cron");
  checkHealth();
});

// Navigation Tabs
function initNavigation() {
  const navBtns = document.querySelectorAll(".nav-btn");
  navBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const tabName = btn.getAttribute("data-tab");
      navBtns.forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(tc => tc.classList.remove("active"));

      btn.classList.add("active");
      const targetContent = document.getElementById(`tab-${tabName}`);
      if (targetContent) targetContent.classList.add("active");
    });
  });
}

// Health Check
async function checkHealth() {
  const statusEl = document.getElementById("connectionStatus");
  const indEl = document.querySelector(".status-indicator");
  const geminiStatusEl = document.getElementById("backendGeminiStatus");
  const telegramStatusEl = document.getElementById("backendTelegramStatus");

  try {
    const res = await fetch(`${backendUrl}/api/health`);
    if (res.ok) {
      const data = await res.json();
      if (statusEl) {
        statusEl.textContent = "ONLINE";
        statusEl.style.color = "var(--accent-green)";
      }
      if (indEl) {
        indEl.style.backgroundColor = "var(--accent-green)";
      }
      if (geminiStatusEl) {
        geminiStatusEl.textContent = data.geminiConfigured ? "Configured (Server-Side Secret)" : "Not Configured";
        geminiStatusEl.style.color = data.geminiConfigured ? "var(--accent-green)" : "var(--accent-orange)";
      }
      if (telegramStatusEl) {
        telegramStatusEl.textContent = data.telegramConfigured ? "Configured (Server-Side Secret)" : "Not Configured";
        telegramStatusEl.style.color = data.telegramConfigured ? "var(--accent-green)" : "var(--accent-orange)";
      }
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (e) {
    if (statusEl) {
      statusEl.textContent = "OFFLINE";
      statusEl.style.color = "var(--accent-orange)";
    }
    if (indEl) {
      indEl.style.backgroundColor = "var(--accent-orange)";
    }
    if (geminiStatusEl) {
      geminiStatusEl.textContent = "Unknown (Backend unreachable)";
      geminiStatusEl.style.color = "var(--text-muted)";
    }
    if (telegramStatusEl) {
      telegramStatusEl.textContent = "Unknown (Backend unreachable)";
      telegramStatusEl.style.color = "var(--text-muted)";
    }
  }
}

// Send Message in Chat
async function sendMessage() {
  const input = document.getElementById("userInput");
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  input.style.height = "auto";
  appendMessage("user", text);

  // Assistant typing indicator
  const typingId = appendTypingIndicator();

  try {
    const res = await fetch(`${backendUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        history: conversationHistory
      })
    });

    const data = await res.json();
    removeMessage(typingId);

    if (res.ok && data.status === "success" && data.reply) {
      appendMessage("assistant", data.reply);
      conversationHistory.push({ role: "user", parts: [{ text }] });
      conversationHistory.push({ role: "model", parts: [{ text: data.reply }] });
    } else {
      appendMessage("assistant", `⚠️ Error: ${data.error || "Could not fetch response."}`);
    }
  } catch (err) {
    removeMessage(typingId);
    appendMessage("assistant", `⚡ [Local Fallback Response]: Server se connection me thodi rukawat hai. Agar aapne local server chalaya hai ya Cloudflare Worker deploy kiya hai to settings me URL check karein.\n\nAapka sawal: "${text}" note kar liya hai!`);
  }
}

function handleChatKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function sendQuickPrompt(promptText) {
  document.getElementById("userInput").value = promptText;
  sendMessage();
}

function appendMessage(role, text) {
  const container = document.getElementById("chatMessages");
  const msgDiv = document.createElement("div");
  msgDiv.className = `msg ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = role === "user" ? "👤" : "⚡";

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";

  // Simple Markdown formatting (bold, code blocks, bullet points)
  let formatted = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n• /g, '<br>• ')
    .replace(/\n/g, '<br>');

  bubble.innerHTML = `<p>${formatted}</p>`;

  msgDiv.appendChild(avatar);
  msgDiv.appendChild(bubble);
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

function appendTypingIndicator() {
  const container = document.getElementById("chatMessages");
  const id = "typing-" + Date.now();
  const div = document.createElement("div");
  div.id = id;
  div.className = "msg assistant";
  div.innerHTML = `
    <div class="msg-avatar">⚡</div>
    <div class="msg-bubble" style="color: var(--text-muted); font-style: italic;">
      SuperAgent thinking...
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return id;
}

function removeMessage(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// Instagram Reel Auditor
async function runReelAudit() {
  const views = parseFloat(document.getElementById("reelViews").value) || 0;
  const shares = parseFloat(document.getElementById("reelShares").value) || 0;
  const likes = parseFloat(document.getElementById("reelLikes").value) || 0;
  const comments = parseFloat(document.getElementById("reelComments").value) || 0;
  const saves = parseFloat(document.getElementById("reelSaves").value) || 0;
  const duration = parseFloat(document.getElementById("reelDuration").value) || 30;
  const hookDuration = parseFloat(document.getElementById("reelHook").value) || 2.5;
  const audioType = document.getElementById("reelAudio").value;

  const payload = {
    views, shares, likes, comments, saves,
    durationSeconds: duration,
    hookDurationSeconds: hookDuration,
    audioType
  };

  try {
    const res = await fetch(`${backendUrl}/api/audit-reel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const report = await res.json();
    renderAuditResult(report);
  } catch (err) {
    // Fallback Client-side audit calculation if server offline
    const shareRatio = views > 0 ? (shares / views) * 100 : 0;
    const engagement = views > 0 ? ((likes + comments + shares + saves) / views) * 100 : 0;
    const score = Math.min(100, Math.round(shareRatio * 20 + engagement * 2));
    renderAuditResult({
      score,
      grade: score > 75 ? "A" : score > 50 ? "B" : "C",
      viralityProbability: score > 75 ? "High (70-90%)" : "Medium (30-50%)",
      metrics: {
        shareToViewRatio: shareRatio.toFixed(2) + "%",
        engagementRate: engagement.toFixed(2) + "%",
        hookScore: hookDuration <= 3 ? "85%" : "40%"
      },
      diagnostics: [
        "Share-to-view ratio: " + shareRatio.toFixed(2) + "%",
        duration > 45 ? "Duration is too long; attention drops off after 30s" : "Duration is healthy (< 35s)"
      ],
      actionPlan: [
        "Next Reel hook must appear within the first 1.5 seconds.",
        "Add an explicit prompt to share (e.g. 'Share this with your editor friend').",
        "Keep total duration between 12-22 seconds for maximum loop count."
      ]
    });
  }
}

function renderAuditResult(report) {
  const card = document.getElementById("auditResultCard");
  card.classList.remove("hidden");

  document.getElementById("scoreVal").textContent = report.score || 0;
  document.getElementById("gradeBadge").textContent = report.grade || "B";
  document.getElementById("viralityStatus").textContent = report.viralityProbability || "Moderate";

  document.getElementById("metricShareRatio").textContent = report.metrics?.shareToViewRatio || "0%";
  document.getElementById("metricEngagement").textContent = report.metrics?.engagementRate || "0%";
  document.getElementById("metricHook").textContent = report.metrics?.hookScore || "Normal";

  const leaksList = document.getElementById("leaksList");
  leaksList.innerHTML = "";
  (report.diagnostics || []).forEach(d => {
    const li = document.createElement("li");
    li.textContent = d;
    leaksList.appendChild(li);
  });

  const fixesList = document.getElementById("fixesList");
  fixesList.innerHTML = "";
  (report.actionPlan || []).forEach(f => {
    const li = document.createElement("li");
    li.textContent = f;
    fixesList.appendChild(li);
  });

  card.scrollIntoView({ behavior: "smooth" });
}

// Android Recipe Switcher
function loadRecipe(key) {
  const buttons = document.querySelectorAll(".recipe-btn");
  buttons.forEach(b => b.classList.remove("active"));
  if (event && event.target && event.target.classList) {
    event.target.classList.add("active");
  }

  const codeEl = document.getElementById("recipeCode");
  if (codeEl) {
    codeEl.textContent = getRecipeCode(key);
  }
}

function copyRecipeCode() {
  const code = document.getElementById("recipeCode").textContent;
  navigator.clipboard.writeText(code).then(() => {
    alert("Recipe code copied to clipboard!");
  });
}

// Settings
function initSettings() {
  const urlInput = document.getElementById("settingBackendUrl");
  if (urlInput) {
    urlInput.value = backendUrl || window.location.origin;
  }
}

function saveSettings() {
  const urlInput = document.getElementById("settingBackendUrl");
  if (urlInput) {
    const customUrl = urlInput.value.trim().replace(/\/+$/, "");
    if (customUrl) {
      backendUrl = customUrl;
      localStorage.setItem("superagent_backend", backendUrl);
    } else {
      backendUrl = getBackendOrigin();
      localStorage.removeItem("superagent_backend");
    }
  }

  alert("Settings updated successfully!");
  checkHealth();
}
