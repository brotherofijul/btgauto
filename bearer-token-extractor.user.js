// ==UserScript==
// @name         Bearer Token Extractor
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Bearer token extraction script for Diplomacia
// @author       Brother of Ijul
// @match        *diplomacia.com.tr/*
// @run-at       document-end
// @grant        none
// @downloadURL  https://github.com/brotherofijul/btgauto/raw/main/bearer-token-extractor.user.js
// @updateURL    https://github.com/brotherofijul/btgauto/raw/main/bearer-token-extractor.user.js
// ==/UserScript==

(function () {
  "use strict";

  const CONFIG = {
    targetEndpoint: "/api/players/profile",
    copyResetDelay: 1800,
  };

  const injectStyles = () => {
    const style = document.createElement("style");
    style.textContent = `
            #tex-sidebar {
                position: fixed;
                top: 50%;
                left: -320px;
                transform: translateY(-50%);
                width: 320px;
                background: linear-gradient(165deg, rgba(26,27,34,0.97), rgba(15,16,20,0.97));
                backdrop-filter: blur(14px);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 0 18px 18px 0;
                box-shadow: 8px 0 30px rgba(0,0,0,0.5);
                z-index: 999999;
                padding: 24px;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                gap: 16px;
                font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
                transition: left 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            #tex-sidebar.open { left: 0; }
            #tex-toggle {
                position: absolute;
                top: 50%;
                right: -46px;
                transform: translateY(-50%);
                width: 46px;
                height: 46px;
                border: none;
                border-radius: 0 14px 14px 0;
                background: linear-gradient(135deg, #6366f1, #8b5cf6);
                color: #fff;
                font-size: 18px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                box-shadow: 4px 0 14px rgba(99,102,241,0.45);
                transition: background 0.2s, transform 0.2s;
            }
            #tex-toggle:hover { background: linear-gradient(135deg, #7c7ff5, #9d6cf7); }
            #tex-toggle svg { transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
            #tex-sidebar.open #tex-toggle svg { transform: rotate(180deg); }
            .tex-header { display: flex; align-items: center; gap: 10px; }
            .tex-header h3 { margin: 0; font-size: 15px; font-weight: 600; color: #f1f1f3; letter-spacing: 0.2px; }
            .tex-dot { width: 9px; height: 9px; border-radius: 50%; background: #f59e0b; flex-shrink: 0; }
            .tex-dot.pulse { animation: tex-pulse 1.4s ease-in-out infinite; }
            .tex-dot.captured { background: #22c55e; animation: none; }
            @keyframes tex-pulse {
                0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.55); }
                50% { box-shadow: 0 0 0 6px rgba(245,158,11,0); }
            }
            #tex-status { margin: 0; font-size: 12.5px; color: #9b9ca5; line-height: 1.4; }
            #tex-token {
                width: 100%;
                height: 110px;
                background: rgba(255,255,255,0.04);
                color: #d4d4d8;
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 10px;
                padding: 10px;
                resize: none;
                font-family: 'SF Mono', Consolas, monospace;
                font-size: 11px;
                line-height: 1.5;
                word-break: break-all;
                box-sizing: border-box;
            }
            #tex-token:focus { outline: none; border-color: rgba(99,102,241,0.5); }
            #tex-copy {
                padding: 12px;
                background: rgba(255,255,255,0.06);
                color: #8a8b93;
                border: none;
                border-radius: 10px;
                font-weight: 600;
                font-size: 13px;
                cursor: not-allowed;
                transition: background 0.2s, color 0.2s, transform 0.15s;
            }
            #tex-copy.ready {
                background: linear-gradient(135deg, #22c55e, #16a34a);
                color: #fff;
                cursor: pointer;
            }
            #tex-copy.ready:hover { transform: translateY(-1px); }
            #tex-copy.ready:active { transform: translateY(0); }
        `;
    document.head.appendChild(style);
  };

  const buildSidebar = () => {
    const sidebar = document.createElement("div");
    sidebar.id = "tex-sidebar";
    sidebar.innerHTML = `
            <button id="tex-toggle" aria-label="Toggle panel">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <div class="tex-header">
                <span class="tex-dot pulse" id="tex-dot"></span>
                <h3>Bearer Token</h3>
            </div>
            <p id="tex-status">Menunggu request profile...</p>
            <textarea id="tex-token" readonly placeholder="Token akan muncul di sini"></textarea>
            <button id="tex-copy" disabled>Salin Token</button>
        `;
    document.body.appendChild(sidebar);
    return {
      sidebar,
      toggle: sidebar.querySelector("#tex-toggle"),
      dot: sidebar.querySelector("#tex-dot"),
      status: sidebar.querySelector("#tex-status"),
      tokenField: sidebar.querySelector("#tex-token"),
      copyBtn: sidebar.querySelector("#tex-copy"),
    };
  };

  const createUIController = () => {
    const ui = buildSidebar();
    let token = null;

    ui.toggle.addEventListener("click", () => {
      ui.sidebar.classList.toggle("open");
    });

    ui.copyBtn.addEventListener("click", async () => {
      if (!token) return;
      const original = ui.copyBtn.textContent;
      try {
        await navigator.clipboard.writeText(token);
        ui.copyBtn.textContent = "Tersalin ✓";
      } catch {
        ui.copyBtn.textContent = "Gagal menyalin";
      }
      setTimeout(() => {
        ui.copyBtn.textContent = original;
      }, CONFIG.copyResetDelay);
    });

    return {
      setToken(value) {
        token = value;
        ui.dot.classList.remove("pulse");
        ui.dot.classList.add("captured");
        ui.status.textContent = "Token berhasil ditangkap";
        ui.tokenField.value = value;
        ui.copyBtn.disabled = false;
        ui.copyBtn.classList.add("ready");
      },
    };
  };

  const extractAuthHeader = (headers) => {
    if (!headers) return null;
    if (headers instanceof Headers) return headers.get("Authorization");
    const key = Object.keys(headers).find(
      (k) => k.toLowerCase() === "authorization",
    );
    return key ? headers[key] : null;
  };

  const patchFetch = (onToken) => {
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      const [resource, config] = args;
      const url = typeof resource === "string" ? resource : resource?.url;
      if (url && url.includes(CONFIG.targetEndpoint)) {
        const authHeader = extractAuthHeader(config?.headers);
        if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
          onToken(authHeader.slice(7));
        }
      }
      return originalFetch.apply(this, args);
    };
  };

  injectStyles();
  const ui = createUIController();
  patchFetch((token) => ui.setToken(token));
})();
