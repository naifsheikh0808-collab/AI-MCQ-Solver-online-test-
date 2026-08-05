# MCQ Solver AI - Browser Extension (Chrome & Edge)

A clean, professional, stealthy, and highly educational Browser Extension (fully compatible with Google Chrome and Microsoft Edge) designed to help students solve online MCQs. It automatically reads questions from the screen, processes them using state-of-the-art AI (Gemini Flash, Groq, ChatGPT), and displays the answer with a clear, educational justification in a camouflaged floating popup.

## 🌟 Special Thanks & Credits

Special thanks to **Mohana Dhar Chowdhury** for her key design, feature, and stealth concept contributions that shaped this extension:

- 🥷 **Stealth Mode Idea**: Concept for blending the popup into pages with low opacity and floating controls.
- 🎨 **UI/UX Design**: Clean visual layout, shadow DOM floating card, and interactive mini-bubble.
- 📊 **Confidence Indicator**: Color-coded reliability meter (`🟢 High` / `🟡 Medium` / `🔴 Low`) for AI answers.
- 💡 **"Why This Option?" Feature**: Concept for providing step-by-step educational justifications for every MCQ.

🔗 **Connect with Mohana:**
- **GitHub:** [Mohana1008](https://github.com/Mohana1008)
- **LinkedIn:** [Mohana Dhar Chowdhury](https://www.linkedin.com/in/mohana-dhar-chowdhury-bb011b38b/)

---

### 🤖 AI & Solving
- **Multimodal AI Fallback Engine**: Solves questions using a resilient chain — `Gemini 2.5 Flash` → `Groq Llama 4 Scout (Vision)` → `Groq Llama 3.3 70B`. If one service is busy or down, it automatically tries the next.
- **Multimodal Extraction**: Combines DOM text extraction + live screenshot for the most accurate context. Falls back to image-only or text-only if needed.
- **Intelligent DOM Parsing**: Detects question text and answer options directly from the page structure (supports Google Forms, Canvas, Moodle, Sarthaks, Selfstudys, and more).
- **Educational Justifications**: Every answer comes with a concise 50–80 word explanation of *why* the option is correct to support actual learning.
- **Confidence Indicator**: Displays an AI confidence score (color-coded: 🟢 High / 🟡 Medium / 🔴 Low) so you know when to double-check manually.
- **Auto-Solve on Page Load**: Optionally detects and solves a question automatically when you open a quiz page (disabled by default, can be turned on in Settings).

### 🔄 Answer Management
- **Recheck Button**: Re-queries the AI for the same question to get a second opinion or resolve a low-confidence answer.
- **Check Current Question Button**: Triggers a fresh solve of whatever is currently visible on screen, without needing to close and reopen.
- **Answer History**: Tracks the last 20 solved questions in the popup with timestamps, question titles, and answers. Includes a **Clear All** button to wipe history and reset the question counter.
- **Question Numbering**: Assigns a sequential `Q1, Q2, Q3...` number to each unique question across a session for easy tracking.
- **Smart Caching**: Saves AI answers locally per question to avoid duplicate API calls and save time/quota.

### 🪟 Floating Popup UI
- **Draggable Floating Popup**: The answer panel can be freely dragged anywhere on the screen and stays out of your way.
- **Minimize to Bubble**: Click the `−` button to collapse the popup into a small floating logo bubble. Click the bubble to restore the full panel.
- **Shadow DOM Isolation**: The popup is injected inside a Shadow DOM so the host page's CSS can never break or interfere with it.
- **Stealth Mode**: Makes the popup smaller and semi-transparent so it blends in with the page. It fully appears on hover.

### 🛡️ Anti-Cheat Bypass (Always Active when Extension is ON)
- **Always Copy**: Re-enables right-click, copy, cut, and paste on pages that block them — so you can always copy question text, regardless of how strict the platform is.
- **Always Active Tab**: Hides tab-switch and window-blur events from exam platforms. The page never "knows" you switched tabs or focused another window.
- **Text Selection Unlocked**: Forces CSS `user-select` back to enabled on all elements, so you can highlight and select any text on the page.

### ⚙️ Controls & Settings
- **On/Off Toggle**: Instantly enables or disables the entire extension from the popup. When OFF — the AI solver, anti-cheat bypass, and auto-solve are all completely deactivated.
- **Grayscale Icon**: The toolbar icon turns gray when the extension is disabled, giving a clear visual status at a glance.
- **Bring-Your-Own-Key (BYOK)**: Users enter their own free Gemini and/or Groq API keys in the Settings page. This means zero API costs for the developer, no shared rate limits, and full speed for every user.
- **Keyboard Shortcut**: Press `Ctrl+Shift+Q` (or `Cmd+Shift+Q` on Mac) from any quiz page to instantly trigger the solver.
- **Right-Click Context Menu**: Right-click anywhere on a page and select **"Solve MCQ with AI"** as an alternative trigger.
- **Settings Page**: Dedicated options page for managing API keys and extension behavior preferences.

## Setup & Configuration (Adding API Keys)

To bypass global rate limits and support unlimited students, the extension uses a Bring-Your-Own-Key (BYOK) approach:

### Student Setup (How to add your API Key)
To use this extension, you need a free API key from Google Gemini. Follow these exact steps:

1. **Get your free Gemini API Key:**
   - Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
   - Sign in with your Google Account.
   - Click the **"Create API key"** button.
   - Copy the generated API key (it starts with `AIza...`).
2. **Add the key to the extension:**
   - Click the **MCQ Solver AI** extension icon in your Chrome toolbar.
   - Click the **⚙️ Settings** button at the bottom of the popup.
   - Paste your copied key into the **Google Gemini API Key** field.
   - Click **Save Settings**.
   - *Note: Your key is stored securely in your own browser's synced storage.*

### Developer Fallback Setup (Optional for testing)
If you wish to bundle a default fallback key for local testing, keys are prioritized from a local file ignored by Git:
1. Navigate to the `background/` folder.
2. Rename `config.sample.js` to `config.js`.
3. Insert your API keys inside `config.js`.

## Installation

### For Google Chrome (Unpacked)
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Turn on **"Developer mode"** using the toggle switch in the top right corner.
3. Click the **"Load unpacked"** button in the top left.
4. Select the `chrome extension` folder.
5. The **MCQ Solver AI** extension will now appear in your list of extensions. Pin it to your toolbar for easy access!

### For Microsoft Edge (Unpacked)
1. Open Microsoft Edge and navigate to `edge://extensions/`.
2. Turn on the **"Developer mode"** toggle switch on the bottom left corner.
3. Click the **"Load unpacked"** button in the top right / main screen.
4. Select the `edge extension` folder.
5. Pin the extension to your toolbar.

*Note: For the official Microsoft Edge store version, you can zip the contents of the `edge extension` folder and submit it to the Microsoft Partner Center.*

## How to Use

1. Navigate to a page containing a Multiple Choice Question (e.g., Google Forms, Canvas, Moodle).
2. You can trigger the AI solver in three ways:
   - Click the **Extension Icon** in the toolbar and click **"Press here to solve"**.
   - Press the keyboard shortcut: **`Ctrl+Shift+Q`**.
   - Right-click anywhere on the page and select **"Solve MCQ with AI"**.
3. *If the DOM extraction fails*, you can highlight the text of the question with your mouse and trigger the solver again.
4. The AI will process the question and a floating, draggable popup will appear in the top right corner of the page containing the answer and justification.

## Disclaimer

**Educational Purposes Only**: This extension is meant to be used as a study aide. It provides justifications to help you learn why an option is correct. Please use responsibly and abide by your institution's academic integrity policies.
