# WiseDragon - Real-Time Voice AI Assistant

**WiseDragon** is a desktop application that creates real-time voice conversations with OpenAI's GPT model, enhanced with the ability to see and understand your screen. Think of it as having a phone call with ChatGPT, but ChatGPT can also take screenshots to provide visual context for better assistance.

## ✨ Features

- **Real-Time Voice Conversations**: Direct audio streaming with OpenAI's voice model using WebRTC
- **Visual Context Awareness**: AI can capture and analyze high-quality screenshots of your screen
- **Secure Architecture**: Sandboxed renderer with secure tool execution in the main process
- **Extensible Tool System**: Easy to add new capabilities through the plugin-like tool system
- **High-Quality Screenshots**: Adaptive PNG/JPEG selection optimized for text readability

## 🏗️ How It Works

### Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Main Process  │◄──►│  Renderer Process │◄──►│  OpenAI Realtime │
│  (Node.js/Tools)│    │   (WebRTC/UI)    │    │      API        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         ▲                       ▲
         │                       │
    ┌────▼────┐             ┌────▼────┐
    │  Tools  │             │ Preload │
    │ System  │             │ Bridge  │
    └─────────┘             └─────────┘
```

### User Flow

1. **You click "Connect"** → App establishes WebRTC voice connection with OpenAI
2. **You speak** → Your voice streams directly to ChatGPT
3. **ChatGPT responds** → You hear its voice through your speakers
4. **ChatGPT can take screenshots** → When needed, it captures your screen for visual context
5. **ChatGPT analyzes images** → It reads text, understands UI elements, and provides contextual help

## 📁 File Structure

```
WiseDragon/
├── README.md                    ← This file
├── package.json                 ← Dependencies and scripts
├── .env                         ← OpenAI API key (create this)
├── main.js                      ← Main process - app manager and security
├── preload.js                   ← Security bridge between processes
├── renderer/
│   ├── index.html              ← Simple UI with Connect/Disconnect buttons
│   └── renderer.js             ← WebRTC connection and screenshot handling
└── tools/
    ├── index.js                ← Tool registry - auto-discovers and manages tools
    └── screenshot/
        ├── index.js            ← Screenshot tool entry point
        ├── execute.js          ← Screenshot capture implementation
        └── schema.js           ← OpenAI function calling schema
```

## 🔧 File Details

### Core Application Files

#### `main.js` (63 lines) - The App Manager
- Loads OpenAI API key from `.env` file
- Creates the Electron application window
- Initializes the tool registry system
- Provides secure IPC handlers for:
  - Getting OpenAI session credentials
  - Executing tools (like screenshots) safely

#### `preload.js` (11 lines) - Security Bridge
- Creates secure communication bridge between frontend and backend
- Exposes safe APIs to the renderer:
  - `window.oai.getEphemeral()` - Get OpenAI session key
  - `window.oai.executeTool()` - Execute tools securely

#### `renderer/index.html` (11 lines) - Simple UI
- Minimalist voice-first interface
- Connect/Disconnect buttons
- Status display
- Audio element for AI voice output

#### `renderer/renderer.js` (249 lines) - Voice & Screenshot Handler
- Manages WebRTC peer connection with OpenAI
- Handles microphone input and speaker output
- Processes function call requests from ChatGPT
- Executes tools and sends results back to AI
- Special handling for screenshot base64 transmission

### Tool System

#### `tools/index.js` (45 lines) - Tool Manager
- Auto-discovers all tools in the `tools/` directory
- Registers tools and provides schemas to OpenAI
- Executes tools securely when requested by ChatGPT
- Simplified from original complex registry system

#### `tools/screenshot/execute.js` (70 lines) - Screenshot Capture
- Captures screen using Electron's `desktopCapturer`
- Resizes to 1080px max dimension for optimal text clarity
- Adaptive format selection: PNG for text-heavy screens, JPEG for photos
- Optimized file size (≤75KB) for real-time WebRTC transmission
- Returns high-quality base64 images to ChatGPT

#### `tools/screenshot/schema.js` - OpenAI Function Schema
- Defines how ChatGPT should use the screenshot tool
- Encourages proactive screenshot usage for better assistance
- Instructs AI to analyze images thoroughly and systematically

## 🚀 Setup & Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd WiseDragon
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create `.env` file**
   ```bash
   echo "OPENAI_API_KEY=your_openai_api_key_here" > .env
   ```

4. **Start the application**
   ```bash
   npm start
   ```

## 🔧 Adding New Tools

The tool system is designed for easy extensibility. Here's how to add new capabilities:

### Tool Structure

Each tool should be in its own directory under `tools/` with an `index.js` file that exports:

```javascript
module.exports = {
  // OpenAI function calling schema
  schema: {
    type: "function",
    name: "your_tool_name",
    description: "What this tool does - be descriptive for ChatGPT",
    parameters: {
      type: "object",
      properties: {
        // Parameter definitions
        param1: {
          type: "string",
          description: "Description of parameter"
        }
      },
      required: ["param1"]
    }
  },
  
  // Implementation function
  executor: async (args) => {
    // Your tool implementation here
    // Must return an object with 'success' field
    return {
      success: true,
      data: "your result"
    };
  }
};
```

### Adding a New Tool

1. **Create tool directory**: `tools/your_tool_name/`
2. **Create `index.js`** with the structure above
3. **Implement your functionality** in the `executor` function
4. **Restart the application** - tools are auto-discovered on startup
5. **Test with voice** - ChatGPT can now use your tool!

### Tool Integration

Tools automatically integrate with:
- **OpenAI Realtime API** function calling
- **Electron main process** (secure execution with full system access)
- **WebRTC data channel** events
- **Conversation context** injection

## 🛡️ Security Model

```
Frontend (renderer.js) - SANDBOXED
    ↕️ (secure IPC bridge)
Backend (main.js) - FULL SYSTEM ACCESS
    ↕️ 
Tools (screenshot, etc.) - SYSTEM OPERATIONS
```

- **Frontend is sandboxed**: Cannot directly access system resources
- **Secure IPC bridge**: All system operations go through validated channels
- **Tool isolation**: Tools run in main process with proper error handling
- **No node integration**: Renderer process has no direct Node.js access

## 🎯 Key Technical Features

### Voice Processing
- **Direct WebRTC streaming** to OpenAI (no intermediate servers)
- **Low-latency audio** optimized for real-time conversation
- **Asynchronous function calls** don't interrupt voice flow

### Image Processing
- **1080px high resolution** screenshots for text clarity
- **Adaptive format selection** (PNG for UI, JPEG for photos)
- **Optimized file sizes** (≤75KB) for WebRTC data channel limits
- **Base64 encoding** for seamless transmission

### Tool System
- **Auto-discovery** of tools on startup
- **Plugin-like architecture** for easy extensibility  
- **Secure execution** in main process context
- **Error handling** and graceful failures

## 📝 Development Notes

- **Simplified codebase**: Removed overengineering while maintaining functionality
- **Clean architecture**: Easy to understand and extend
- **Production ready**: Robust error handling and security practices
- **Minimal dependencies**: Just Electron and dotenv for environment variables

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Add your tool following the tool structure above
4. Test thoroughly with voice interactions
5. Submit a pull request

## 📄 License

[Add your license information here]

---

**WiseDragon** - Where voice meets vision for intelligent assistance.
