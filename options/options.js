document.addEventListener('DOMContentLoaded', () => {
  const geminiApiKeyEl = document.getElementById('geminiApiKey');
  const grokApiKeyEl = document.getElementById('grokApiKey');
  const stealthModeEl = document.getElementById('stealthMode');
  const autoSolveEl = document.getElementById('autoSolve');
  const saveBtn = document.getElementById('saveBtn');
  const statusMessage = document.getElementById('statusMessage');

  // Load current settings
  chrome.storage.sync.get(['geminiApiKey', 'grokApiKey', 'stealthMode', 'autoSolve'], (items) => {
    if (items.geminiApiKey) geminiApiKeyEl.value = items.geminiApiKey;
    if (items.grokApiKey) grokApiKeyEl.value = items.grokApiKey;
    stealthModeEl.checked = items.stealthMode !== false; // Default true
    autoSolveEl.checked = items.autoSolve === true; // Default false
  });

  // Save settings
  saveBtn.addEventListener('click', () => {
    const geminiApiKey = geminiApiKeyEl.value.trim();
    const grokApiKey = grokApiKeyEl.value.trim();

    chrome.storage.sync.set({
      geminiApiKey,
      grokApiKey,
      stealthMode: stealthModeEl.checked,
      autoSolve: autoSolveEl.checked
    }, () => {
      // Show saved status
      statusMessage.classList.remove('hidden');
      setTimeout(() => {
        statusMessage.classList.add('hidden');
      }, 2500);
    });
  });
});
