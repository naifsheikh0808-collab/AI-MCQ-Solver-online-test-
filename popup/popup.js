document.addEventListener('DOMContentLoaded', () => {
  const solveBtn = document.getElementById('solveBtn');
  const optionsBtn = document.getElementById('optionsBtn');
  const historyList = document.getElementById('historyList');
  const activationToggle = document.getElementById('activationToggle');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');

  // Load and set initial activation state
  chrome.storage.local.get({ isActive: true }, (res) => {
    activationToggle.checked = res.isActive;
    updateSolveButton(res.isActive);
  });

  // Handle activation toggle
  activationToggle.addEventListener('change', (e) => {
    const isActive = e.target.checked;
    chrome.storage.local.set({ isActive });
    updateSolveButton(isActive);
  });

  function updateSolveButton(isActive) {
    solveBtn.disabled = !isActive;
    if (isActive) {
      solveBtn.style.backgroundColor = '';
      solveBtn.style.cursor = '';
      solveBtn.textContent = 'Press here to solve';
    } else {
      solveBtn.style.backgroundColor = '#94a3b8';
      solveBtn.style.cursor = 'not-allowed';
      solveBtn.textContent = 'Extension is Disabled';
    }
  }

  // Render History — shows onboarding guide for first-time users
  function renderHistory(hist) {
    if (!hist || hist.length === 0) {
      historyList.innerHTML = `
        <div class="onboarding">
          <p class="onboarding-title">👋 Welcome! Get started in 4 steps:</p>
          <div class="onboarding-step">
            <span class="step-num">1</span>
            <span>Make sure the <strong>toggle is ON</strong> (green) at the top.</span>
          </div>
          <div class="onboarding-step">
            <span class="step-num">2</span>
            <span>Click <strong>⚙️ Settings</strong> below and paste your free <strong>Gemini API key</strong>.</span>
          </div>
          <div class="onboarding-step">
            <span class="step-num">3</span>
            <span><strong>Refresh the exam page</strong> (press F5) after saving your key.</span>
          </div>
          <div class="onboarding-step">
            <span class="step-num">4</span>
            <span>Press <strong>Ctrl+Shift+Q</strong> on any MCQ page — enjoy! 🎉</span>
          </div>
          <p class="onboarding-note">This guide disappears after your first solved question.</p>
        </div>
      `;
      return;
    }
    historyList.innerHTML = hist.map(item => `
      <div style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px;">
        <div style="color: #64748b; margin-bottom: 4px;">${new Date(item.time).toLocaleTimeString()}</div>
        <div style="font-weight: 500; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.question}</div>
        <div style="color: #22c55e; font-weight: bold;">Option ${item.answer}</div>
      </div>
    `).join('');
  }

  chrome.storage.local.get({ history: [] }, (res) => renderHistory(res.history));

  // Clear All History
  clearHistoryBtn.addEventListener('click', () => {
    if (!confirm('Clear all history and reset question counter?')) return;
    chrome.storage.local.set({ history: [], sessionCounter: 1 }, () => {
      renderHistory([]);
    });
  });

  solveBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs[0]) return;
      const tabId = tabs[0].id;

      // Helper: send a message and return a promise that resolves on success or rejects on error
      function trySendMessage() {
        return new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(tabId, { action: "TRIGGER_SOLVE" }, (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(response);
            }
          });
        });
      }

      try {
        // First attempt — works if content script is already alive
        await trySendMessage();
      } catch (e) {
        // Content script not loaded (cold start / service worker died). Inject it now.
        console.warn("Content script not found. Injecting now...", e.message);
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content/content.js']
          });
          // Small delay to let the script initialize before messaging
          await new Promise(r => setTimeout(r, 300));
          // Second attempt after injection
          await trySendMessage();
        } catch (injectErr) {
          console.error("Could not inject content script:", injectErr.message);
          // Page is likely a chrome:// or other restricted URL — show a user-friendly message
          alert("⚠️ This page cannot be accessed by the extension.\nPlease navigate to your exam page and try again.");
          return; // Do NOT close popup so user sees the alert
        }
      }

      window.close(); // Close popup only after successfully triggering
    });
  });

  optionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});
