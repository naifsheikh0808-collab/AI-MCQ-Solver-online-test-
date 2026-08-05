// Content Script for MCQ Solver AI (Isolated World)
// Anti-cheat bypass is handled by content/bypass.js running in world: "MAIN"
// This script handles all MCQ solving logic using chrome.* APIs.

if (typeof window.mcqSolverInitialized === 'undefined') {
window.mcqSolverInitialized = true;
console.log("MCQ Solver AI: Content script loaded.");


// Listener for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "TRIGGER_SOLVE") {
    // Guard: do nothing if extension is disabled
    chrome.storage.local.get({ isActive: true }, (res) => {
      if (!res.isActive) {
        console.log("MCQ Solver AI: Extension is OFF. Ignoring trigger.");
        sendResponse({ success: false });
        return;
      }
      console.log("Trigger received. Starting extraction...");
      extractAndSolve(false, false, request.screenshot || null);
      sendResponse({ success: true });
    });
    return true; // Keep the messaging channel open for async response
  }
});

// Hide floating popup and bubble immediately when extension is toggled OFF
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.isActive && changes.isActive.newValue === false) {
    const container = document.getElementById('mcq-solver-container');
    if (container) container.remove();
    const bubble = document.getElementById('mcq-mini-bubble');
    if (bubble) bubble.remove();
    const loader = document.getElementById('mcq-solver-loader');
    if (loader) loader.remove();
  }
});

// Helper to prevent orphaned script crashes when extension is reloaded
function isContextValid() {
  try {
    if (chrome && chrome.runtime && chrome.runtime.id) return true;
  } catch (e) {}
  alert("MCQ Solver AI: Extension was updated. Please refresh this page (F5) to continue using it.");
  return false;
}

// Only activate bypass and auto-solve if extension is ON
chrome.storage.local.get({ isActive: true }, (localRes) => {
  if (localRes.isActive) {
    enableAntiCheatBypass();

    // Load settings and initialize auto-solve if enabled
    chrome.storage.sync.get({ disclaimerShown: false, stealthMode: true, autoSolve: false }, (syncStorage) => {
      if (syncStorage.autoSolve) {
        setTimeout(() => {
          // Only auto-solve if a question is actually found in the DOM to avoid spamming alerts
          if (parseDOMForMCQ()) {
            console.log("Auto-Detect & Solve triggered.");
            extractAndSolve(false, true); // true for silent fallback
          }
        }, 1500); // Small delay to let page fully load
      }
    });
  } else {
    console.log("MCQ Solver AI: Extension is OFF. Bypass and auto-solve are disabled.");
  }
});

var lastPayload = null;

// Main function to extract question and call background for processing
// providedScreenshot: base64 dataUrl passed directly from background (captured at shortcut time)
async function extractAndSolve(forceRecheck = false, silentIfFail = false, providedScreenshot = null) {
  if (!isContextValid()) return;

  // Educational Disclaimer
  const syncStorage = await new Promise(resolve => chrome.storage.sync.get({ disclaimerShown: false, stealthMode: true, autoSolve: false }, resolve));
  if (!syncStorage.disclaimerShown) {
    const agreed = confirm("MCQ Solver AI - Educational Disclaimer\\n\\nThis tool is designed to assist your learning by providing explanations for MCQs. It should NOT be used for cheating.\\n\\nDo you agree to use this responsibly?");
    if (!agreed) return;
    chrome.storage.sync.set({ disclaimerShown: true });
  }

  showLoadingIndicator(syncStorage.stealthMode);

  // Try text selection first
  let selectedText = window.getSelection().toString().trim();
  let domText = null;

  if (selectedText.length > 10) {
    console.log("Using selected text as primary question.");
    domText = selectedText;
  } else {
    const domExtracted = parseDOMForMCQ();
    if (domExtracted) {
      console.log("Using DOM extracted content:", domExtracted.substring(0, 80));
      domText = domExtracted;
    }
  }

  // Use the screenshot passed from background (captured at shortcut time, token still valid)
  // Only fall back to captureScreenshot() if not provided (e.g. auto-solve, button click)
  let screenshotData = null;
  if (providedScreenshot) {
    console.log("Using pre-captured screenshot from background ✅");
    screenshotData = providedScreenshot;
  } else {
    console.log("Requesting screenshot via message (fallback)...");
    const result = await captureScreenshot();
    screenshotData = result ? result.image : null;
  }

  let payload = null;
  const pageTitle = document.title.substring(0, 40) || 'MCQ';
  const pageUrl = window.location.href;
  if (domText && screenshotData) {
    payload = { text: domText, image: screenshotData, type: "multimodal", pageTitle, pageUrl };
    console.log("Payload: multimodal (text + image) → Llama 4 Scout / Gemini will be used ✅");
  } else if (domText) {
    payload = { text: domText, type: "text", pageTitle, pageUrl };
    console.log("Payload: text only → screenshot failed");
  } else if (screenshotData) {
    payload = { image: screenshotData, type: "image", pageTitle, pageUrl };
    console.log("Payload: image only");
  }

  if (payload) {
    lastPayload = payload;
    await processPayload(payload, syncStorage.stealthMode, forceRecheck);
  } else {
    removeLoadingIndicator();
    if (!silentIfFail) {
      alert("MCQ Solver AI: Could not find any question on the screen. Please select the question text and try again.");
    }
  }
}

async function processPayload(payload, isStealth, forceRecheck) {
  if (!isContextValid()) return;
  showLoadingIndicator(isStealth);
  try {
    chrome.runtime.sendMessage({ action: "PROCESS_QUESTION", payload: payload, forceRecheck: forceRecheck }, (response) => {
      removeLoadingIndicator();
      if (chrome.runtime.lastError) {
        console.error("Context error:", chrome.runtime.lastError);
        alert("MCQ Solver AI: Please refresh the page. (Connection lost)");
        return;
      }
      if (response && response.success) {
        console.log("Received answer:", response.data);
        showPopup(response.data, isStealth, response.cached);
      } else {
        console.error("Error processing question", response?.error);
        alert("MCQ Solver AI: Failed to process the question.\n" + (response?.error || "Unknown error"));
      }
    });
  } catch (e) {
    removeLoadingIndicator();
    alert("MCQ Solver AI: Extension was reloaded. Please refresh the page.");
  }
}

// Function to neutralize anti-cheat protections on the page
function enableAntiCheatBypass() {
  console.log("MCQ Solver AI: Neutralizing anti-cheat scripts (enabling right-click, selection, and hiding tab-switches)...");

  // ─── PHASE 1: Spoof Page Visibility API at the property level ────────────
  // This defeats POLLING-based detection (setInterval checking document.hidden)
  // which stopPropagation() alone cannot block. MAKAUT uses this technique.
  try {
    Object.defineProperty(document, 'hidden', {
      get: () => false,
      configurable: true
    });
    Object.defineProperty(document, 'visibilityState', {
      get: () => 'visible',
      configurable: true
    });
    Object.defineProperty(document, 'webkitVisibilityState', {
      get: () => 'visible',
      configurable: true
    });
    Object.defineProperty(document, 'webkitHidden', {
      get: () => false,
      configurable: true
    });
    console.log("MCQ Solver AI: Page Visibility API spoofed ✅");
  } catch (e) {
    console.warn("MCQ Solver AI: Could not spoof visibility API (non-critical):", e.message);
  }

  // ─── PHASE 2: Intercept addEventListener to silently swallow visibility/blur handlers ─
  // This defeats sites that attach handlers BEFORE our content script runs
  // by monkey-patching addEventListener so those handlers never fire.
  const _origDocAdd = document.addEventListener.bind(document);
  const _origWinAdd = window.addEventListener.bind(window);
  const BLOCKED_EVENTS = new Set([
    'visibilitychange', 'webkitvisibilitychange', 'blur', 'focus',
    'mouseleave', 'mouseout', 'pagehide', 'freeze'
  ]);

  const makeInterceptor = (origFn, scope) => function(type, listener, options) {
    if (typeof type === 'string' && BLOCKED_EVENTS.has(type.toLowerCase())) {
      // Wrap the listener: call it with a fake "visible" event so any
      // internal state the site tracks still thinks the page is visible.
      const fakeListener = function(e) {
        // For visibilitychange: let site think page is still visible
        if (type === 'visibilitychange' || type === 'webkitvisibilitychange') {
          // Don't call the real listener — swallow entirely
          return;
        }
        // For blur/focus/mouseleave: also swallow
        return;
      };
      return origFn.call(scope, type, fakeListener, options);
    }
    return origFn.call(scope, type, listener, options);
  };

  try {
    document.addEventListener = makeInterceptor(_origDocAdd, document);
    window.addEventListener = makeInterceptor(_origWinAdd, window);
    console.log("MCQ Solver AI: addEventListener interceptor active ✅");
  } catch (e) {
    console.warn("MCQ Solver AI: addEventListener interception failed (non-critical):", e.message);
  }

  // ─── PHASE 3: Dispatch fake 'focus' event to reset any existing tab-switch counter ─
  // Some portals (like MAKAUT) store switch count in a variable updated on
  // visibilitychange. Firing a focus event resets their internal state.
  try {
    setTimeout(() => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('focus'));
    }, 500);
  } catch (e) {}

  // ─── PHASE 4: stopPropagation fallback for event-based listeners ──────────
  const preventBlock = (e) => e.stopPropagation();
  _origDocAdd('contextmenu', preventBlock, true);
  _origDocAdd('copy', preventBlock, true);
  _origDocAdd('cut', preventBlock, true);
  _origDocAdd('paste', preventBlock, true);
  _origDocAdd('keydown', preventBlock, true);
  _origDocAdd('visibilitychange', preventBlock, true);
  _origDocAdd('mouseleave', preventBlock, true);
  _origDocAdd('selectstart', preventBlock, true);
  _origWinAdd('blur', preventBlock, true);
  _origWinAdd('focus', preventBlock, true);

  // ─── PHASE 5: Nullify document.onvisibilitychange property ───────────────
  try {
    Object.defineProperty(document, 'onvisibilitychange', {
      get: () => null,
      set: (fn) => { /* swallow any assignment */ },
      configurable: true
    });
    Object.defineProperty(document, 'onblur', {
      get: () => null,
      set: (fn) => { /* swallow */ },
      configurable: true
    });
    Object.defineProperty(window, 'onblur', {
      get: () => null,
      set: (fn) => { /* swallow */ },
      configurable: true
    });
  } catch (e) {}

  // ─── PHASE 6: Force CSS to allow user text selection ─────────────────────
  const style = document.createElement('style');
  style.innerHTML = `
    * {
      user-select: auto !important;
      -webkit-user-select: auto !important;
      -moz-user-select: auto !important;
      -ms-user-select: auto !important;
    }
  `;
  document.documentElement.appendChild(style);

  console.log("MCQ Solver AI: Full anti-cheat bypass activated ✅");
}

function parseDOMForMCQ() {
  // 1. Try to find explicit question and options containers first (cleanest extraction, catches Sarthaks)
  let questionEl = document.querySelector('.question, .qtext, .QuestionText');
  let optionsEl = document.querySelector('.options, .answers, .mcq-options');

  if (questionEl && questionEl.innerText.trim().length > 5) {
    let qText = questionEl.innerText.trim();
    let optText = optionsEl ? optionsEl.innerText.trim() : "";
    return qText + "\n\n" + optText;
  }

  // 2. Fallback heuristic: Look for form groups, fieldsets, or divs containing radio/checkbox buttons
  const radioButtons = document.querySelectorAll('input[type="radio"], input[type="checkbox"]');
  if (radioButtons.length > 0) {
    let container = radioButtons[0].closest('fieldset') || radioButtons[0].closest('form') || radioButtons[0].parentElement.parentElement.parentElement;
    
    if (container) {
       let clone = container.cloneNode(true);
       // Remove warning banners, navigation buttons, and other junk
       const distractors = clone.querySelectorAll('.warning-banner, .alert, .navigation, .nav-btn, button, header');
       distractors.forEach(el => el.remove());
       
       return clone.innerText.replace(/\n+/g, '\n').trim();
    }
  }
  
  // Fallback heuristics could be added here for specific LMS (Moodle, Canvas, etc.)
  // If no obvious form is found, return null to trigger screenshot fallback.
  return null;
}

function captureScreenshot() {
  if (!isContextValid()) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ action: "CAPTURE_SCREENSHOT" }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn("Screenshot failed:", chrome.runtime.lastError);
          resolve(null);
          return;
        }
        if (response && response.dataUrl) {
          resolve({ image: response.dataUrl, type: "image" });
        } else {
          resolve(null);
        }
      });
    } catch (e) {
      resolve(null);
    }
  });
}

// Temporary Loading Indicator
function showLoadingIndicator(isStealth) {
  let loader = document.getElementById('mcq-solver-loader');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'mcq-solver-loader';

    const logoUrl = chrome.runtime.getURL('icons/logo.png');

    // Inject keyframe animations once
    if (!document.getElementById('mcq-solver-styles')) {
      const style = document.createElement('style');
      style.id = 'mcq-solver-styles';
      style.innerText = `
        @keyframes mcq-pulse {
          0%   { transform: scale(1);    opacity: 0.9; }
          50%  { transform: scale(1.15); opacity: 0.5; }
          100% { transform: scale(1);    opacity: 0.9; }
        }
        @keyframes mcq-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes mcq-glow {
          0%   { box-shadow: 0 0 8px 2px rgba(59,130,246,0.4); }
          50%  { box-shadow: 0 0 18px 6px rgba(59,130,246,0.8); }
          100% { box-shadow: 0 0 8px 2px rgba(59,130,246,0.4); }
        }
      `;
      document.head.appendChild(style);
    }

    if (isStealth) {
      // Stealth: tiny logo with subtle pulse, low opacity
      loader.style.cssText = `
        position: fixed; bottom: 12px; right: 12px;
        width: 32px; height: 32px;
        z-index: 2147483647;
        animation: mcq-pulse 1.2s ease-in-out infinite;
        opacity: 0.7; border-radius: 50%;
      `;
      const img = document.createElement('img');
      img.src = logoUrl;
      img.style.cssText = 'width:32px; height:32px; border-radius:50%; display:block;';
      loader.appendChild(img);

    } else {
      // Normal mode: logo with spinning ring + glow
      loader.style.cssText = `
        position: fixed; bottom: 20px; right: 20px;
        width: 60px; height: 60px;
        z-index: 2147483647;
        display: flex; align-items: center; justify-content: center;
      `;

      // Spinning gradient ring
      const ring = document.createElement('div');
      ring.style.cssText = `
        position: absolute; width: 60px; height: 60px;
        border-radius: 50%;
        border: 3px solid transparent;
        border-top-color: #3b82f6;
        border-right-color: #6366f1;
        animation: mcq-spin 0.9s linear infinite;
        box-sizing: border-box;
      `;

      // Logo inside the ring with glow
      const img = document.createElement('img');
      img.src = logoUrl;
      img.style.cssText = `
        width: 46px; height: 46px; border-radius: 50%;
        display: block; position: relative; z-index: 1;
        animation: mcq-glow 1.5s ease-in-out infinite;
      `;

      loader.appendChild(ring);
      loader.appendChild(img);
    }

    document.body.appendChild(loader);
  }
}

function removeLoadingIndicator() {
  const loader = document.getElementById('mcq-solver-loader');
  if (loader) loader.remove();
}

// Function to inject and show the floating popup UI
function showPopup(data, isStealth, isCached) {
  let container = document.getElementById('mcq-solver-container');
  if (container) {
    container.remove(); // Remove existing popup
  }
  // Also clean up any minimized bubble from a previous popup
  const oldBubble = document.getElementById('mcq-mini-bubble');
  if (oldBubble) oldBubble.remove();

  container = document.createElement('div');
  container.id = 'mcq-solver-container';
  container.style.cssText = 'position:fixed; top:20px; right:20px; z-index:2147483647;';
  
  const shadow = container.attachShadow({ mode: 'closed' });
  
  // Cap confidence for text-only Groq model (unreliable for image MCQs)
  const displayConfidence = (data.modelUsed === 'Groq Llama-3.3-70B')
    ? Math.min(Number(data.confidence), 55)
    : Number(data.confidence);

  // Determine color based on confidence
  let color = '#ef4444'; // Red
  if (displayConfidence >= 80) color = '#22c55e'; // Green
  else if (displayConfidence >= 60) color = '#eab308'; // Yellow

  const styles = `
    .mcq-popup {
      font-family: 'Inter', system-ui, sans-serif;
      width: ${isStealth ? '240px' : '320px'};
      background: ${isStealth ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.95)'};
      backdrop-filter: blur(10px);
      border-radius: 12px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      border: 1px solid rgba(0,0,0,0.05);
      overflow: hidden;
      color: #1e293b;
      transition: opacity 0.3s ease;
      opacity: ${isStealth ? '0.35' : '1'};
    }
    .mcq-popup:hover {
      opacity: 1;
      background: rgba(255, 255, 255, 0.95);
    }
    .mcq-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid #f1f5f9;
      cursor: grab;
      user-select: none;
    }
    .mcq-header:active {
      cursor: grabbing;
    }
    .mcq-title {
      font-weight: 600;
      font-size: 14px;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .mcq-close {
      background: none;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 16px;
      padding: 4px;
    }
    .mcq-close:hover {
      color: #0f172a;
    }
    .mcq-body {
      padding: 16px;
    }
    .mcq-answer {
      font-size: 24px;
      font-weight: 700;
      text-align: center;
      margin-bottom: 8px;
    }
    .mcq-confidence {
      text-align: center;
      font-size: 12px;
      font-weight: 500;
      padding: 4px 10px;
      border-radius: 12px;
      display: inline-block;
      margin: 0 auto 16px;
      background: ${color}22;
      color: ${color};
    }
    .mcq-flex-center {
      display: flex;
      justify-content: center;
    }
    .mcq-details {
      margin-top: 12px;
    }
    .mcq-details summary {
      font-size: 13px;
      font-weight: 500;
      color: #3b82f6;
      cursor: pointer;
      user-select: none;
      outline: none;
    }
    .mcq-justification {
      margin-top: 8px;
      font-size: 13px;
      line-height: 1.5;
      color: #475569;
      background: #f8fafc;
      padding: 10px;
      border-radius: 6px;
      max-height: 150px;
      overflow-y: auto;
    }
    .mcq-recheck-btn {
      background: none;
      border: 1px solid #cbd5e1;
      color: #475569;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      cursor: pointer;
      margin-left: 8px;
    }
    .mcq-recheck-btn:hover {
      background: #f1f5f9;
      color: #0f172a;
    }
    .mcq-newq-btn {
      width: 100%;
      margin-top: 10px;
      padding: 7px 12px;
      background: white;
      color: #3b82f6;
      border: 1.5px solid #3b82f6;
      border-radius: 7px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      letter-spacing: 0.3px;
      transition: background 0.2s ease, color 0.2s ease, transform 0.1s ease;
    }
    .mcq-newq-btn:hover {
      background: #eff6ff;
      transform: translateY(-1px);
    }
    .mcq-newq-btn:active {
      transform: translateY(0);
    }
    .mcq-footer-btn {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      color: #475569;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      width: 100%;
      margin-top: 10px;
      text-align: center;
      transition: all 0.2s ease;
    }
    .mcq-footer-btn:hover {
      background: #f1f5f9;
      border-color: #cbd5e1;
      color: #0f172a;
    }
    .mcq-settings-link {
      display: block;
      text-align: center;
      font-size: 11px;
      color: #64748b;
      margin-top: 8px;
      text-decoration: underline;
      cursor: pointer;
    }
    .mcq-settings-link:hover {
      color: #3b82f6;
    }
    #history-container {
      margin-top: 8px;
      max-height: 150px;
      overflow-y: auto;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 4px;
    }
    .mcq-minimize-btn {
      background: none;
      border: none;
      color: #94a3b8;
      font-size: 22px;
      line-height: 1;
      cursor: pointer;
      padding: 2px 10px;
      min-width: 32px;
      min-height: 28px;
      border-radius: 6px;
      transition: color 0.2s, background 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .mcq-minimize-btn:hover {
      color: #1e293b;
      background: #e2e8f0;
    }
    .mcq-mini-bubble {
      display: none;
      position: fixed;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      cursor: pointer;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
      transition: transform 0.2s ease;
    }
    .mcq-mini-bubble:hover {
      transform: scale(1.12);
    }
    .mcq-mini-ring {
      position: absolute;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      border: 2.5px solid transparent;
      border-top-color: ${color};
      border-right-color: #6366f1;
      box-sizing: border-box;
      animation: mcq-spin 2.5s linear infinite;
    }
    .mcq-mini-img {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      position: relative;
      z-index: 1;
      box-shadow: 0 0 10px 2px ${color}55;
    }
  `;

  const logoUrl = chrome.runtime.getURL('icons/logo.png');

  const wrapper = document.createElement('div');
  wrapper.className = 'mcq-popup';
  wrapper.innerHTML = `
    <style>${styles}</style>
    <div class="mcq-header" id="drag-handle">
      <div class="mcq-title" title="Drag to move">${isStealth ? '≡' : '✨ MCQ Solver AI'} ${isCached ? '<span style="font-size:10px;color:#3b82f6">(Cached)</span>' : ''}</div>
      <button class="mcq-minimize-btn" id="minimize-btn" title="Minimize">−</button>
    </div>
    <div class="mcq-body">
      <div class="mcq-answer">
        Option ${data.correctOption}
        ${data.qNumber ? `<span style="font-size:14px; color:#64748b; margin-left:8px;">(Q${data.qNumber})</span>` : ''}
      </div>
      <div class="mcq-flex-center" style="align-items:center; margin-bottom:4px;">
        <div class="mcq-confidence">Confidence: ${displayConfidence}% • ${data.modelUsed || 'AI'}</div>
        <button class="mcq-recheck-btn" id="recheck-btn">Recheck</button>
      </div>
      <button class="mcq-newq-btn" id="newq-btn">🔍 Check Current Question</button>
      <details class="mcq-details">
        <summary>Why this option?</summary>
        <div class="mcq-justification">
          <div style="font-weight:700; margin-bottom:6px; color:${displayConfidence < 60 ? '#d97706' : '#16a34a'}; font-size:12px;">
            ⚠️ CAUTION: AI can make mistakes. ${displayConfidence < 60 ? 'Confidence is low — please cross-check manually!' : 'Cross-check if unsure.'}
          </div>
          <div style="font-weight:600; color:#475569; margin-bottom:4px; font-size:12px;">Explanation:</div>
          ${data.justification}
        </div>
      </details>
      <details class="mcq-details" id="history-details">
        <summary id="history-summary">History</summary>
        <div id="history-container"></div>
      </details>
      <a class="mcq-settings-link" id="settings-link">Settings</a>
    </div>
  `;

  // Ensure pulse keyframe exists for the bubble animation
  if (!document.getElementById('mcq-solver-styles')) {
    const kf = document.createElement('style');
    kf.id = 'mcq-solver-styles';
    kf.innerText = '@keyframes mcq-pulse{0%{transform:scale(1);opacity:.9}50%{transform:scale(1.12);opacity:.55}100%{transform:scale(1);opacity:.9}}@keyframes mcq-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';
    document.head.appendChild(kf);
  }

  // Build minimized logo bubble — plain logo, draggable, defaults to bottom-right
  const bubble = document.createElement('div');
  bubble.id = 'mcq-mini-bubble';
  bubble.title = 'Click to restore answer';
  bubble.style.cssText = [
    'display:none',
    'position:fixed',
    'bottom:20px',
    'right:20px',
    'width:38px',
    'height:38px',
    'border-radius:50%',
    'cursor:grab',
    'z-index:2147483647',
    'transition:transform 0.15s ease',
    'user-select:none',
  ].join(';');

  const bubbleImg = document.createElement('img');
  bubbleImg.src = logoUrl;
  bubbleImg.draggable = false;
  bubbleImg.style.cssText = 'width:38px; height:38px; border-radius:50%; display:block; pointer-events:none;';
  bubble.appendChild(bubbleImg);
  document.body.appendChild(bubble);

  // Attach popup to DOM
  shadow.appendChild(wrapper);
  document.body.appendChild(container);

  // Drag logic for the bubble
  let bubbleDragging = false;
  let bubbleOffX = 0, bubbleOffY = 0, bubbleMoved = false;

  bubble.addEventListener('mousedown', (e) => {
    bubbleDragging = true;
    bubbleMoved = false;
    bubble.style.cursor = 'grabbing';
    bubble.style.animation = 'none';
    const rect = bubble.getBoundingClientRect();
    bubbleOffX = e.clientX - rect.left;
    bubbleOffY = e.clientY - rect.top;
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!bubbleDragging) return;
    bubbleMoved = true;
    const x = e.clientX - bubbleOffX;
    const y = e.clientY - bubbleOffY;
    bubble.style.left = `${x}px`;
    bubble.style.top = `${y}px`;
    bubble.style.right = 'auto';
    bubble.style.bottom = 'auto';
  });

  document.addEventListener('mouseup', () => {
    if (!bubbleDragging) return;
    bubbleDragging = false;
    bubble.style.cursor = 'grab';
  });


  // Implement Draggable Logic
  const header = shadow.getElementById('drag-handle');
  let isDragging = false;
  let offsetX, offsetY;

  header.addEventListener('mousedown', (e) => {
    isDragging = true;
    const rect = container.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    container.style.left = `${e.clientX - offsetX}px`;
    container.style.top = `${e.clientY - offsetY}px`;
    container.style.right = 'auto'; // Disable initial right alignment
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // Minimize Logic — collapse popup into static floating logo bubble
  shadow.getElementById('minimize-btn').addEventListener('click', () => {
    // Reset to bottom-right default every time
    bubble.style.left = 'auto';
    bubble.style.top = 'auto';
    bubble.style.right = '20px';
    bubble.style.bottom = '20px';
    wrapper.style.display = 'none';
    bubble.style.display = 'block';
  });

  // Restore Logic — click bubble (only if not dragged) to expand back
  bubble.addEventListener('click', () => {
    if (bubbleMoved) return; // was a drag, not a click
    bubble.style.display = 'none';
    wrapper.style.display = '';
  });

  // Recheck Logic — re-queries AI for the SAME question
  shadow.getElementById('recheck-btn').addEventListener('click', () => {
    container.remove();
    if (lastPayload) {
      processPayload(lastPayload, isStealth, true);
    } else {
      extractAndSolve(true);
    }
  });

  // New Question Logic — fresh solve of whatever is currently on screen
  shadow.getElementById('newq-btn').addEventListener('click', () => {
    container.remove();
    extractAndSolve(false); // fresh extraction, no forceRecheck
  });

  // History Logic — load data when <details> is expanded
  shadow.getElementById('history-summary').addEventListener('click', () => {
    if (!isContextValid()) return;
    const details = shadow.getElementById('history-details');
    if (details.open) return; // already open, user is closing it — nothing to do
    const histContainer = shadow.getElementById('history-container');
    histContainer.innerHTML = '<div style="font-size:11px; text-align:center; padding:10px; color:#64748b;">Loading...</div>';
    try {
      chrome.storage.local.get({ history: [] }, (res) => {
        if (chrome.runtime.lastError) return;
        const hist = res.history;
        if (hist.length === 0) {
          histContainer.innerHTML = '<div style="font-size:11px; text-align:center; padding:10px; color:#64748b;">No history yet.</div>';
          return;
        }
        let headerHtml = `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px; border-bottom: 1px solid #e2e8f0; margin-bottom: 4px;">
            <span style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">Recent</span>
            <a id="clear-history-link" style="font-size: 10px; color: #ef4444; cursor: pointer; text-decoration: underline;">Clear All</a>
          </div>
        `;
        let listHtml = hist.slice(0, 5).map(item => `
          <div style="padding: 6px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">
            <div style="color: #64748b; margin-bottom: 2px;">${new Date(item.time).toLocaleTimeString()}</div>
            <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.question}</div>
            <div style="color: #22c55e; font-weight: bold;">Option ${item.answer}</div>
          </div>
        `).join('');
        let footerHtml = '';
        if (hist.length > 5) {
          footerHtml = `
            <div style="font-size: 10px; text-align: center; color: #475569; padding: 6px 0 2px 0; font-weight: 600; font-style: italic;">
              Complete history is in the main popup
            </div>
          `;
        }
        histContainer.innerHTML = headerHtml + listHtml + footerHtml;
        const clearLink = shadow.getElementById('clear-history-link');
        if (clearLink) {
          clearLink.addEventListener('click', () => {
            chrome.storage.local.set({ history: [], sessionCounter: 1 }, () => {
              histContainer.innerHTML = '<div style="font-size:11px; text-align:center; padding:10px; color:#64748b;">History cleared. Counter reset.</div>';
            });
          });
        }
      });
    } catch (e) {
      histContainer.innerHTML = '<div style="font-size:11px; text-align:center; padding:10px; color:#ef4444;">Error loading history.</div>';
    }
  });

  // Settings Logic
  shadow.getElementById('settings-link').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: "OPEN_OPTIONS" });
  });
}

} // End of initialization guard
