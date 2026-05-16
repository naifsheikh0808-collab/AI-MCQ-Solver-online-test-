# MCQ Solver AI - Chrome Extension

A clean, professional, stealthy, and highly educational Chrome Extension designed to help students solve online MCQs. It automatically reads questions from the screen, processes them using state-of-the-art AI (Gemini Flash, Groq, ChatGPT), and displays the answer with a clear, educational justification in a camouflaged floating popup.

## Features

- **Intelligent Extraction**: Uses smart DOM parsing to find question text and options on common quiz platforms. Falls back to screenshot vision processing if text cannot be extracted.
- **Online AI Fallback Engine**: Attempts to solve the question using a resilient fallback chain: `Gemini 1.5 Flash` > `Groq (xAI/Grok)` > `ChatGPT`.
- **Educational Justifications**: Always provides a clear explanation of *why* an option is correct to aid in learning.
- **Stealthy UI**: Injects a clean, draggable floating popup within a Shadow DOM so it cannot be affected by the host page's CSS. Includes a "Stealth Mode" option for a smaller, transparent footprint.
- **Caching Mechanism**: Saves previous answers locally to prevent duplicate AI API calls and save money/time.
- **Bring-Your-Own-Key (BYOK) Architecture**: Highly scalable setup where users provide their own free Gemini or Groq API keys in the extension settings. This ensures zero API costs for the developer, eliminates shared rate limit bottlenecks, and provides unthrottled fast performance for every student.
- **Keyboard Shortcuts**: Quickly solve the MCQ on screen by pressing `Ctrl+Shift+Q` (or `Cmd+Shift+Q` on Mac).

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

## Installation (Unpacked for Chrome)

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Turn on **"Developer mode"** using the toggle switch in the top right corner.
3. Click the **"Load unpacked"** button in the top left.
4. Select the folder containing this extension (`chrome extension` folder).
5. The **MCQ Solver AI** extension will now appear in your list of extensions. Pin it to your toolbar for easy access!

## How to Use

1. Navigate to a page containing a Multiple Choice Question (e.g., Google Forms, Canvas, Moodle).
2. You can trigger the AI solver in three ways:
   - Click the **Extension Icon** in the toolbar and click "Solve MCQ on Page".
   - Press the keyboard shortcut: **`Ctrl+Shift+Q`**.
   - Right-click anywhere on the page and select **"Solve MCQ with AI"**.
3. *If the DOM extraction fails*, you can highlight the text of the question with your mouse and trigger the solver again.
4. The AI will process the question and a floating, draggable popup will appear in the top right corner of the page containing the answer and justification.

## Disclaimer

**Educational Purposes Only**: This extension is meant to be used as a study aide. It provides justifications to help you learn why an option is correct. Please use responsibly and abide by your institution's academic integrity policies.
