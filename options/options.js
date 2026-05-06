document.addEventListener('DOMContentLoaded', () => {
  const stealthModeEl = document.getElementById('stealthMode');
  const autoSolveEl = document.getElementById('autoSolve');
  const saveBtn = document.getElementById('saveBtn');
  const statusMessage = document.getElementById('statusMessage');

  // Load current settings
  chrome.storage.sync.get(['stealthMode', 'autoSolve'], (items) => {
    stealthModeEl.checked = items.stealthMode !== false; // Default true
    autoSolveEl.checked = items.autoSolve !== false; // Default true
  });

  // Save settings
  saveBtn.addEventListener('click', () => {
    chrome.storage.sync.set({
      stealthMode: stealthModeEl.checked,
      autoSolve: autoSolveEl.checked
    }, () => {
      // Show saved status
      statusMessage.classList.remove('hidden');
      setTimeout(() => {
        statusMessage.classList.add('hidden');
      }, 2000);
    });
  });
});
