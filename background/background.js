// Background Service Worker for MCQ Solver AI

// Load local configuration (API keys) if available
try {
  importScripts('config.js');
} catch (e) {
  console.warn("Local config.js not found. Using internal placeholders.");
}

console.log("MCQ Solver AI: Background service worker initialized.");

// Handle icon activation and grayscale
chrome.storage.local.get({ isActive: true }, (res) => {
  updateIcon(res.isActive);
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.isActive !== undefined) {
    updateIcon(changes.isActive.newValue);
  }
});

async function updateIcon(isActive) {
  try {
    const response = await fetch(chrome.runtime.getURL("icons/logo.png"));
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    const size = 48;
    const offscreen = new OffscreenCanvas(size, size);
    const ctx = offscreen.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, size, size);

    if (!isActive) {
      // Convert to grayscale
      const imageData = ctx.getImageData(0, 0, size, size);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const avg = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        data[i] = avg;
        data[i + 1] = avg;
        data[i + 2] = avg;
      }
      ctx.putImageData(imageData, 0, 0);
    }

    const finalImageData = ctx.getImageData(0, 0, size, size);
    chrome.action.setIcon({ imageData: { "48": finalImageData } });
  } catch (e) {
    // Silently ignore icon errors — non-critical
    console.warn("Could not update icon (non-critical):", e.message);
  }
}


// API Keys - Developer needs to fill these in before distributing
// We prioritize keys from the local config.js file (which is ignored by Git)
const CONFIG = {
  GEMINI_API_KEY: (typeof API_KEYS !== 'undefined') ? API_KEYS.GEMINI_API_KEY : "YOUR_GEMINI_API_KEY",
  GROK_API_KEY: (typeof API_KEYS !== 'undefined') ? API_KEYS.GROK_API_KEY : "YOUR_GROK_API_KEY",
  OPENAI_API_KEY: "YOUR_OPENAI_API_KEY_HERE"
};

// Fetch with a hard timeout to prevent hanging on blocked networks
async function fetchWithTimeout(url, options, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error(`Request timed out after ${timeoutMs}ms`);
    throw e;
  }
}

// Setup Context Menu on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "solve-mcq",
    title: "Solve MCQ with AI",
    contexts: ["selection", "page"]
  });
});

// Handle Context Menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "solve-mcq") {
    chrome.storage.local.get({ isActive: true }, (res) => {
      if (!res.isActive) return;
      chrome.tabs.sendMessage(tab.id, { action: "TRIGGER_SOLVE" }, () => {
        if (chrome.runtime.lastError) {
          console.warn("Could not send message. Target page may be protected or needs a refresh.");
        }
      });
    });
  }
});

// Handle Keyboard Shortcuts
chrome.commands.onCommand.addListener((command) => {
  if (command === "solve_mcq") {
    chrome.storage.local.get({ isActive: true }, (res) => {
      if (!res.isActive) return;
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) return;
        const tabId = tabs[0].id;

        // Capture screenshot NOW while the user-gesture token is still valid
        chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 80 }, (dataUrl) => {
          const screenshot = chrome.runtime.lastError ? null : dataUrl;
          if (chrome.runtime.lastError) {
            console.warn("Screenshot capture failed:", chrome.runtime.lastError.message);
          }
          // Pass screenshot directly to content script
          chrome.tabs.sendMessage(tabId, { action: "TRIGGER_SOLVE", screenshot }, () => {
            if (chrome.runtime.lastError) {
              console.warn("Could not send message. Target page may need a refresh.");
            }
          });
        });
      });
    });
  }
});

// Handle messages from Content Script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "CAPTURE_SCREENSHOT") {
    // Small delay: keyboard shortcut briefly steals tab focus, causing captureVisibleTab to fail.
    // Waiting 200ms lets the browser restore focus before we capture.
    setTimeout(() => {
      chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 80 }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          console.warn("Screenshot failed:", chrome.runtime.lastError.message);
          sendResponse({ dataUrl: null });
          return;
        }
        sendResponse({ dataUrl: dataUrl });
      });
    }, 200);
    return true; // Keep message channel open
  }
  if (request.action === "OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
    return false;
  }

  if (request.action === "PROCESS_QUESTION") {
    console.log("Received question payload:", request.payload);

    chrome.storage.local.get({ isActive: true }, (stateRes) => {
      if (!stateRes.isActive) {
        sendResponse({ success: false, error: "Extension is currently disabled." });
        return;
      }

      // Simple caching mechanism based on payload text or image length
      const cacheKey = payloadToHash(request.payload);

      if (request.forceRecheck) {
        console.log("Force recheck requested, skipping cache.");
        processWithFallback(request.payload)
          .then(data => {
            processAndSaveData(request.payload, data, cacheKey, (finalData) => {
              sendResponse({ success: true, data: finalData, cached: false });
            });
          })
          .catch(error => {
            console.error("AI processing failed:", error);
            sendResponse({ success: false, error: error.message });
          });
      } else {
        chrome.storage.local.get([cacheKey], (result) => {
          if (result[cacheKey]) {
            console.log("Returning cached result.");
            processAndSaveData(request.payload, result[cacheKey], cacheKey, (finalData) => {
              sendResponse({ success: true, data: finalData, cached: true });
            });
          } else {
            processWithFallback(request.payload)
              .then(data => {
                processAndSaveData(request.payload, data, cacheKey, (finalData) => {
                  sendResponse({ success: true, data: finalData, cached: false });
                });
              })
              .catch(error => {
                console.error("AI processing failed:", error);
                sendResponse({ success: false, error: error.message });
              });
          }
        });
      }
    });
    return true; // Keep message channel open for async response
  }
});

// Helper for caching — generates a unique key per question content
function payloadToHash(payload) {
  if (payload.type === "text") {
    // Use 200 chars for better uniqueness across similar questions
    return "txt_" + payload.text.substring(0, 200).replace(/[^a-zA-Z0-9]/g, '').substring(0, 80);
  }
  if (payload.type === "image") {
    // Use actual image pixel data (middle slice of base64) — unique per screenshot, stable on same question
    if (payload.image && payload.image.length > 300) {
      const mid = Math.floor(payload.image.length / 2);
      return "img_" + payload.image.substring(mid, mid + 120).replace(/[^a-zA-Z0-9]/g, '').substring(0, 60);
    }
    return "img_" + payload.image.length;
  }
  if (payload.type === "multimodal") {
    // Text is the best key — use 200 chars. Fall back to image pixel data if text is absent/too short.
    const textKey = payload.text ? payload.text.substring(0, 200).replace(/[^a-zA-Z0-9]/g, '').substring(0, 80) : '';
    if (textKey.length >= 15) return "mm_" + textKey;
    // Fall back to image pixel data
    if (payload.image && payload.image.length > 300) {
      const mid = Math.floor(payload.image.length / 2);
      return "mm_img_" + payload.image.substring(mid, mid + 120).replace(/[^a-zA-Z0-9]/g, '').substring(0, 60);
    }
    return "mm_" + textKey;
  }
  return "unknown";
}

function processAndSaveData(payload, data, cacheKey, callback) {
  chrome.storage.local.get({ history: [], sessionCounter: 1 }, (res) => {
    let hist = res.history;
    let counter = res.sessionCounter;

    // Check if this specific question already has a number
    let existingItem = hist.find(item => item.id === cacheKey);
    let assignedQNumber = existingItem ? existingItem.qNumber : counter;

    if (!existingItem) {
      counter++; // Increment for the NEXT new question
    }

    // Inject Q number into the data object so the popup can display it
    data.qNumber = assignedQNumber;

    // Use AI-generated title if available, fall back to page title or truncated text
    let baseText;
    if (data.title) {
      baseText = data.title;
    } else if (payload.type === "text" || payload.type === "multimodal") {
      baseText = payload.text.substring(0, 50).replace(/\n/g, ' ').trim() + "...";
    } else {
      baseText = payload.pageTitle ? `📸 ${payload.pageTitle}` : '📸 Image MCQ';
    }

    const qText = `Q${assignedQNumber} - ${baseText}`;

    // Remove old entry to prevent duplicates and push to top
    hist = hist.filter(item => item.id !== cacheKey);
    hist.unshift({ id: cacheKey, qNumber: assignedQNumber, question: qText, answer: data.correctOption, time: Date.now() });

    if (hist.length > 20) hist.pop(); // keep last 20

    // Save cache, history, and counter simultaneously
    chrome.storage.local.set({ [cacheKey]: data, history: hist, sessionCounter: counter }, () => {
      callback(data);
    });
  });
}

/**
 * AI Orchestration: Fallback Chain
 * 1. Gemini Flash
 * 2. Grok
 * 3. ChatGPT
 */
async function processWithFallback(payload) {
  const prompt = `You are an expert educational AI. Solve the following multiple-choice question.
Provide ONLY a valid JSON response in the exact format below, with no markdown, no extra text.
{
  "correctOption": "A",
  "confidence": 90,
  "title": "5-word topic title of this question",
  "justification": "Concise explanation in 50-80 words of why this option is correct."
}`;

  // Try Gemini 2.5 Flash first
  try {
    console.log("Attempting Gemini 2.5 Flash...");
    let res = await callGemini(prompt, payload, 'gemini-2.5-flash');
    res.modelUsed = "Gemini 2.5 Flash";
    return res;
  } catch (e) {
    console.warn("Gemini 2.5 Flash failed, trying Groq...", e.message);
  }

  // Try Groq with vision model if image is present, text model otherwise
  try {
    if (payload.type === 'image' || payload.type === 'multimodal') {
      // Llama 4 Scout supports vision — can actually SEE the screenshot
      console.log("Attempting Groq Llama-4-Scout (vision)...");
      let res = await callOpenAICompatible(prompt, payload, 'meta-llama/llama-4-scout-17b-16e-instruct', CONFIG.GROK_API_KEY, 'https://api.groq.com/openai/v1/chat/completions');
      res.modelUsed = "Llama 4 Scout (Vision)";
      return res;
    } else {
      // Text-only question — use strong 70B model
      console.log("Attempting Groq Llama-3.3-70b...");
      let res = await callOpenAICompatible(prompt, payload, 'llama-3.3-70b-versatile', CONFIG.GROK_API_KEY, 'https://api.groq.com/openai/v1/chat/completions');
      res.modelUsed = "Groq Llama-3.3-70B";
      return res;
    }
  } catch (e) {
    console.warn("Groq failed.", e.message);
  }

  // Final retry: Gemini 2.5 Flash only if Groq also failed
  try {
    console.log("Final retry: Gemini 2.5 Flash (after Groq failed)...");
    let res = await callGemini(prompt, payload, 'gemini-2.5-flash');
    res.modelUsed = "Gemini 2.5 Flash (retry)";
    return res;
  } catch (e) {
    console.error("All AI fallbacks failed.", e.message);
    throw new Error("All AI services are busy. Please wait a moment and try again.");
  }
}

// ------------------------------------------------------------------
// API Implementations
// ------------------------------------------------------------------

// Rate limiter: track last Gemini call to enforce minimum gap between requests
// Free tier allows 5 RPM = 1 request per 12s to be safe
let lastGeminiCallTime = 0;
const GEMINI_MIN_GAP_MS = 13000; // 13 seconds = stay safely under 5 RPM

async function callGemini(systemPrompt, payload, modelName = 'gemini-2.5-flash') {
  if (!CONFIG.GEMINI_API_KEY || CONFIG.GEMINI_API_KEY.includes("YOUR_")) {
    throw new Error("Gemini API key missing");
  }

  // Enforce minimum gap between Gemini calls to respect 5 RPM rate limit
  const now = Date.now();
  const timeSinceLast = now - lastGeminiCallTime;
  if (lastGeminiCallTime > 0 && timeSinceLast < GEMINI_MIN_GAP_MS) {
    const waitMs = GEMINI_MIN_GAP_MS - timeSinceLast;
    console.log(`Rate limit guard: waiting ${waitMs}ms before Gemini call...`);
    await new Promise(r => setTimeout(r, waitMs));
  }
  lastGeminiCallTime = Date.now();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;

  let parts = [];
  if (payload.type === "text") {
    parts.push({ text: `Question:\n${payload.text}` });
  } else if (payload.type === "image") {
    const base64Image = payload.image.split(',')[1];
    parts.push({
      inlineData: { mimeType: "image/jpeg", data: base64Image }
    });
    parts.push({ text: "Solve the MCQ shown in this image." });
  } else if (payload.type === "multimodal") {
    const base64Image = payload.image.split(',')[1];
    parts.push({
      inlineData: { mimeType: "image/jpeg", data: base64Image }
    });
    parts.push({ text: `Question Context:\n${payload.text}\n\nPlease use both the provided text context and the attached image to determine the correct answer.` });
  }

  const body = {
    systemInstruction: { role: "user", parts: [{ text: systemPrompt }] },
    contents: [{ parts: parts }],
    generationConfig: { responseMimeType: "application/json" }
  };

  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }, 15000);

  if (!response.ok) {
    const errText = await response.text();
    // Parse retryDelay from 429 responses and log it clearly
    if (response.status === 429) {
      try {
        const errJson = JSON.parse(errText);
        const retryInfo = errJson?.error?.details?.find(d => d['@type']?.includes('RetryInfo'));
        const retryDelay = retryInfo?.retryDelay || '60s';
        console.warn(`Gemini rate limited. Retry in ${retryDelay}. Falling back to Groq.`);
        lastGeminiCallTime = Date.now();
      } catch (_) {}
      throw new Error(`Gemini rate limited (429). Falling back to Groq.`);
    }
    console.warn("Gemini API Error:", response.status);
    throw new Error(`Gemini HTTP Error: ${response.status}`);
  }
  const data = await response.json();

  const jsonText = data.candidates[0].content.parts[0].text;
  const cleanedText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleanedText);
}

async function callOpenAICompatible(systemPrompt, payload, modelName, apiKey, endpoint) {
  if (!apiKey || apiKey.includes("YOUR_")) {
    throw new Error(`API key missing for ${modelName}`);
  }

  let content = [];
  if (payload.type === "text") {
    content.push({ type: "text", text: `Question:\n${payload.text}` });
  } else if (payload.type === "image") {
    if (modelName === 'llama-3.1-8b-instant') throw new Error("Groq does not support image-only inputs.");
    content.push({ type: "image_url", image_url: { url: payload.image } });
    content.push({ type: "text", text: "Solve the MCQ shown in this image." });
  } else if (payload.type === "multimodal") {
    const isGroqVision = modelName === 'llama-3.2-11b-vision-preview';
    content.push({ type: "image_url", image_url: { url: payload.image } });
    const textContext = payload.text
      ? `Question Context:\n${payload.text}\n\nUse both the image and text context to determine the correct answer.`
      : "Solve the MCQ shown in this image.";
    content.push({ type: "text", text: textContext });
  }

  const body = {
    model: modelName,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: content }
    ]
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("OpenAI/Groq API Error:", errText);
    throw new Error(`HTTP Error: ${response.status} - ${errText}`);
  }
  const data = await response.json();

  const jsonText = data.choices[0].message.content;
  const cleanedText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleanedText);
}
