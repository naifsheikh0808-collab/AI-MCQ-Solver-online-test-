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
      solveBtn.textContent = 'Press Ctrl + Shift + Q to solve';
    } else {
      solveBtn.style.backgroundColor = '#94a3b8';
      solveBtn.style.cursor = 'not-allowed';
      solveBtn.textContent = 'Extension is Disabled';
    }
  }

  // Render History
  function renderHistory(hist) {
    if (!hist || hist.length === 0) {
      historyList.innerHTML = '<p class="empty-state">No recent questions.</p>';
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
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "TRIGGER_SOLVE" }, () => {
          if (chrome.runtime.lastError) {
            console.warn("Content script not loaded on this page.");
          }
        });
        window.close(); // Close popup after triggering
      }
    });
  });

  optionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});
