# MCQ Solver AI - Chrome Extension

A clean, professional, stealthy, and highly educational Chrome Extension designed to help students solve online MCQs. It automatically reads questions from the screen, processes them using state-of-the-art AI (Gemini Flash, Groq, ChatGPT), and displays the answer with a clear, educational justification in a camouflaged floating popup.

## Features

- **Intelligent Extraction**: Uses smart DOM parsing to find question text and options on common quiz platforms. Falls back to screenshot vision processing if text cannot be extracted.
- **Online AI Fallback Engine**: Attempts to solve the question using a resilient fallback chain: `Gemini 1.5 Flash` > `Groq (xAI/Grok)` > `ChatGPT`.
- **Educational Justifications**: Always provides a clear explanation of *why* an option is correct to aid in learning.
- **Stealthy UI**: Injects a clean, draggable floating popup within a Shadow DOM so it cannot be affected by the host page's CSS. Includes a "Stealth Mode" option for a smaller, transparent footprint.
- **Caching Mechanism**: Saves previous answers locally to prevent duplicate AI API calls and save money/time.
- **Zero User Setup**: Students do not need to configure API keys. The keys are managed by the developer securely (see Developer Setup).
- **Keyboard Shortcuts**: Quickly solve the MCQ on screen by pressing `Ctrl+Shift+Q` (or `Cmd+Shift+Q` on Mac).

## Developer Setup (Adding API Keys)

As requested, this extension is fully online and does not ask the user for API keys. **Before building or distributing**, you (the developer) must insert your API keys in the background script.

1. Open `background/background.js`.
2. Locate the `CONFIG` object at the top of the file:
   ```javascript
   const CONFIG = {
     GEMINI_API_KEY: "YOUR_GEMINI_API_KEY_HERE",
     GROK_API_KEY: "YOUR_GROK_API_KEY_HERE",
     OPENAI_API_KEY: "YOUR_OPENAI_API_KEY_HERE"
   };
   ```
3. Replace the placeholder strings with your actual API keys.
   - *Note: To keep this free, you can just use the Gemini API key and leave the others blank. The system will try Gemini first, and if it succeeds, it will not use the others.*

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
