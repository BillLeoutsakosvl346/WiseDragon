# WiseDragon - Real-Time Voice AI Assistant

**WiseDragon** is a desktop application that creates real-time voice conversations with OpenAI's GPT model, enhanced with visual capabilities including screen capture and precision arrow overlays. Think of it as having a phone call with ChatGPT, but ChatGPT can also see your screen and point at specific elements to provide contextual assistance.

## ✨ Features

- **Real-Time Voice Conversations**: Direct audio streaming with OpenAI's voice model using WebRTC
- **Visual Context Awareness**: AI can capture and analyze high-quality screenshots of your screen
- **Precision Arrow Overlays**: AI can point at specific UI elements using transparent, click-through arrows
- **Normalized Coordinate System**: AI uses screenshot-relative coordinates for accurate element targeting
- **Secure Architecture**: Sandboxed renderer with secure tool execution in the main process
- **Extensible Tool System**: Easy to add new capabilities through the plugin-like tool system
- **Multi-Monitor Support**: Works seamlessly across multiple displays
- **Optimized Performance**: Adaptive image compression and efficient overlay rendering

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
         │
    ┌────▼────┐
    │ Context │
    │ Storage │
    └─────────┘
```

### User Flow

1. **You click "Connect"** → App establishes WebRTC voice connection with OpenAI
2. **You speak** → Your voice streams directly to ChatGPT
3. **ChatGPT responds** → You hear its voice through your speakers
4. **ChatGPT can take screenshots** → When needed, it captures your screen for visual context
5. **ChatGPT analyzes images** → It reads text, understands UI elements, and provides contextual help
6. **ChatGPT can point at elements** → Uses arrow overlays to highlight specific screen areas
7. **Overlays are contextual** → Arrows use normalized coordinates relative to the screenshot

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
│   └── renderer.js             ← WebRTC connection and function call handling
└── tools/
    ├── index.js                ← Tool registry - auto-discovers and manages tools
    ├── overlay_context.js      ← Screenshot metadata storage for coordinate mapping
    ├── screenshot/
    │   ├── index.js            ← Screenshot tool entry point
    │   ├── execute.js          ← Screenshot capture with PNG optimization
    │   └── schema.js           ← OpenAI function calling schema
    └── overlay/
        ├── index.js            ← Overlay arrow tool entry point
        ├── execute.js          ← Arrow overlay implementation
        └── schema.js           ← OpenAI function calling schema
```

## 🔧 File Details

### Core Application Files

#### `main.js` (80 lines) - The App Manager
- Loads OpenAI API key from `.env` file
- Creates the Electron application window
- Initializes the tool registry system
- Provides secure IPC handlers for:
  - Getting OpenAI session credentials with tool schemas
  - Executing tools (screenshots, overlays) safely

#### `preload.js` (12 lines) - Security Bridge
- Creates secure communication bridge between frontend and backend
- Exposes safe APIs to the renderer:
  - `window.oai.getEphemeral()` - Get OpenAI session key with tools
  - `window.oai.executeTool()` - Execute tools securely

#### `renderer/index.html` (11 lines) - Simple UI
- Minimalist voice-first interface
- Connect/Disconnect buttons
- Status display
- Audio element for AI voice output

#### `renderer/renderer.js` (290 lines) - Voice & Function Call Handler
- Manages WebRTC peer connection with OpenAI
- Handles microphone input and speaker output
- Processes function call requests from ChatGPT
- Executes tools and sends results back to AI
- Special handling for screenshot base64 transmission
- Backchannel audio feedback for immediate responsiveness

### Tool System

#### `tools/index.js` (47 lines) - Tool Registry
- Auto-discovers all tools in the `tools/` directory
- Registers tools and provides schemas to OpenAI
- Executes tools securely when requested by ChatGPT
- Handles errors gracefully with proper isolation

#### `tools/overlay_context.js` (8 lines) - Context Storage
- Simple in-memory storage for last screenshot metadata
- Enables normalized coordinate mapping from screenshot to screen
- Stores image dimensions, display bounds, and capture timestamp

### Screenshot Tool

#### `tools/screenshot/execute.js` (116 lines) - Screenshot Capture
- Captures screen using Electron's `desktopCapturer`
- Optimized for OpenAI vision: 1365×768 resolution
- Adaptive PNG color quantization (64→32→16→8 colors)
- Size-optimized (≤150KB) for real-time WebRTC transmission
- Records metadata for overlay coordinate mapping
- Saves screenshots locally for debugging

#### `tools/screenshot/schema.js` (24 lines) - OpenAI Function Schema
- Defines how ChatGPT should use the screenshot tool
- Encourages proactive screenshot usage for better assistance
- Instructs AI to analyze images thoroughly and systematically

### Overlay Arrow Tool

#### `tools/overlay/execute.js` (174 lines) - Arrow Overlay Implementation
- Creates transparent, click-through arrow overlays
- Supports three coordinate systems:
  - `image_norm`: Normalized coordinates (0-1) relative to last screenshot
  - `box_norm`: Normalized bounding box - arrow points at center
  - `screen_px`: Legacy absolute screen coordinates
- Multi-monitor support with automatic display detection
- Customizable arrow styling (color, opacity, duration)
- Auto-cleanup to prevent permanent overlays

#### `tools/overlay/schema.js` (59 lines) - OpenAI Function Schema
- Defines the arrow overlay function for ChatGPT
- Explains coordinate systems and when to use each
- Guides AI to prefer normalized coordinates after screenshots
- Supports optional styling parameters

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

## 🎯 Key Technical Features

### Voice Processing
- **Direct WebRTC streaming** to OpenAI (no intermediate servers)
- **Low-latency audio** optimized for real-time conversation
- **Asynchronous function calls** don't interrupt voice flow
- **Backchannel audio feedback** for immediate AI responsiveness

### Visual Intelligence
- **High-resolution screenshots** (1365×768) optimized for text clarity
- **Adaptive PNG compression** with color quantization for optimal file size
- **Multi-monitor detection** using cursor position heuristics
- **Contextual metadata storage** for coordinate mapping

### Precision Overlays
- **Three coordinate systems** for maximum flexibility:
  - Normalized image coordinates for screenshot-relative pointing
  - Bounding box targeting for UI element centers
  - Legacy absolute coordinates for direct screen positioning
- **Transparent, click-through arrows** that don't interfere with usage
- **Multi-monitor support** with automatic display targeting
- **Customizable styling** (color, opacity, duration)
- **Auto-cleanup** prevents permanent overlay pollution

### Tool Architecture
- **Auto-discovery** of tools on startup
- **Plugin-like architecture** for easy extensibility  
- **Secure execution** in main process context
- **Isolated error handling** and graceful failures
- **Schema-driven** OpenAI function calling integration

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
4. **Add `execute.js`** for complex implementations (optional)
5. **Create `schema.js`** for better organization (optional)
6. **Restart the application** - tools are auto-discovered on startup
7. **Test with voice** - ChatGPT can now use your tool!

### Tool Integration

Tools automatically integrate with:
- **OpenAI Realtime API** function calling
- **Electron main process** (secure execution with full system access)
- **WebRTC data channel** events and responses
- **Conversation context** injection and state management

## 🛡️ Security Model

```
Frontend (renderer.js) - SANDBOXED
    ↕️ (secure IPC bridge)
Backend (main.js) - FULL SYSTEM ACCESS
    ↕️ 
Tools (screenshot, overlay, etc.) - SYSTEM OPERATIONS
    ↕️
Context Storage - IN-MEMORY STATE
```

- **Frontend is sandboxed**: Cannot directly access system resources
- **Secure IPC bridge**: All system operations go through validated channels
- **Tool isolation**: Tools run in main process with proper error handling
- **No node integration**: Renderer process has no direct Node.js access
- **Context isolation**: Screenshot metadata stored securely in main process

## 💡 Usage Examples

### Voice Commands
- *"Can you take a screenshot and help me understand this interface?"*
- *"Point to the save button"* (after screenshot)
- *"Show me where the error message is"* (after screenshot)

### AI Behavior
1. **Takes screenshot** when visual context is needed
2. **Analyzes the image** thoroughly reading all text and UI elements
3. **Points with arrows** using normalized coordinates for precise targeting
4. **Provides contextual help** based on what it sees

### Coordinate Systems
```javascript
// After screenshot, AI can use:

// Point at center of screen
show_arrow_overlay({
  basis: "image_norm", 
  direction: "down", 
  x_norm: 0.5, 
  y_norm: 0.5
})

// Point at a UI element (e.g., button bounds)
show_arrow_overlay({
  basis: "box_norm",
  direction: "up", 
  box: {x0: 0.7, y0: 0.8, x1: 0.9, y1: 0.9}
})

// Legacy absolute coordinates
show_arrow_overlay({
  basis: "screen_px",
  direction: "right",
  x: 800,
  y: 400
})
```

## 🔄 How It All Works Together

1. **User speaks** → Voice streams to OpenAI via WebRTC
2. **AI needs visual context** → Calls `take_screenshot` function
3. **Screenshot captured** → Optimized PNG sent to AI, metadata stored locally
4. **AI analyzes image** → Understands UI layout, reads text, identifies elements
5. **AI wants to point** → Calls `show_arrow_overlay` with normalized coordinates
6. **Arrow appears** → Transparent overlay precisely targets the element
7. **AI continues helping** → With full visual and spatial context

## 📊 Performance Optimizations

- **Screenshot compression**: Adaptive color quantization (64-8 colors)
- **File size limits**: ≤150KB for WebRTC compatibility
- **Memory management**: Overlay cleanup and context storage limits
- **Multi-monitor efficiency**: Cursor-based display detection
- **Event deduplication**: Helper functions reduce code repetition

## 📝 Development Notes

- **Clean, minimal codebase**: Focused on core functionality
- **Secure by design**: Proper sandboxing and IPC boundaries
- **Production ready**: Comprehensive error handling and logging
- **Extensible architecture**: Easy to add new tools and capabilities
- **Well-documented**: Clear code structure and inline comments

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Add your tool following the tool structure above
4. Test thoroughly with voice interactions and visual features
5. Ensure proper coordinate handling for overlays
6. Submit a pull request

## 📄 License

[Add your license information here]

---

**WiseDragon** - Where voice meets vision for intelligent, contextual assistance.