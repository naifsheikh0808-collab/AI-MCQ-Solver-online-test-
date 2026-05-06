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

This extension uses a fallback chain of AI models. To keep the project secure and prevent API key leaks, keys are stored in a local file that is ignored by Git.

1.  Navigate to the `background/` folder.
2.  Find the file named `config.sample.js`.
3.  **Rename** it to `config.js`.
4.  Open `config.js` and insert your API keys:
    ```javascript
    const API_KEYS = {
      GEMINI_API_KEY: "AIza...", // Your Gemini API Key
      GROK_API_KEY: "gsk_..."    // Your Groq API Key
    };
    ```
5.  Save the file. The extension will now automatically use these keys.

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
