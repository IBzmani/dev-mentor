# Dev-Mentor IDE

<div align="center">
  <img src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f9d1_200d_1f4bb/512.gif" width="100" />
</div>

**Dev-Mentor** is an experimental AI-powered pair programming environment designed to teach, not just solve. It uses the **Gemini Live API** to act as a Socratic mentor—watching you code in real-time and asking guiding questions instead of giving you the answer.

## ✨ Features

- **🎙️ Real-Time Socratic Mentor**: Talk naturally with an AI that understands your voice and tone.
- **👀 Screen "Vision"**: The AI sees your screen via browser screen-sharing, referencing specific lines of code and errors.
- **⚡ In-Browser Execution**: Run Python code securely in your browser using **Pyodide** (WebAssembly).
- **🧪 Real Unit Tests**: Run actual test suites against your code with immediate feedback.
- **📝 Professional Editor**: Powered by **Monaco Editor** (VS Code engine) for a premium coding experience.

## 🚀 Getting Started

1.  **Clone the repository**
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Configure API Key**:
    -   Create a `.env` file in the root.
    -   Add your Gemini API key:
        ```
        VITE_GEMINI_API_KEY=your_api_key_here
        ```
4.  **Run the application**:
    ```bash
    npm run dev
    ```

## 🛠️ Usage

1.  Open the app in your browser (usually `http://localhost:5173`).
2.  Click the **Mic** icon in the "AI Mentor" panel to start a session.
3.  **Grant Permissions**: Allow microphone access and select your screen/window to share.
4.  **Start Coding**: Try solving the "Two Sum" problem in `two_sum.py`.
5.  **Talk to the AI**: explain your thought process. If you get stuck, ask for a hint!
6.  **Run Code**: Click **Run** to execute your script or **Test** to run the validation suite.

## 🏗️ Tech Stack

-   **Frontend**: React, Vite, TypeScript
-   **AI**: Gemini Live API (Multimodal WebSockets) & Google GenAI SDK
-   **Runtime**: Pyodide (Python in WASM)
-   **Editor**: Monaco Editor

---
*Built with Gemini.*
