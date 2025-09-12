# WiseDragon - Real-Time Voice AI Assistant

**WiseDragon** is a desktop application that creates real-time voice conversations with OpenAI's GPT model, enhanced with visual capabilities including screen capture and precision arrow overlays. Think of it as having a phone call with ChatGPT, but ChatGPT can also see your screen and point at specific elements to provide contextual assistance.

## ✨ Features

- **Real-Time Voice Conversations**: Direct audio streaming with OpenAI's voice model using WebRTC
- **Visual Context Awareness**: AI can capture and analyze high-quality screenshots of your screen
- **Precision Arrow Overlays**: AI can point at specific UI elements using transparent, click-through arrows
- **Intelligent Coordinate System**: AI uses a 0-100 coordinate grid overlay with smart positioning (top-left origin)
- **Pre-Generated Grid Overlays**: High-performance coordinate grids cached for instant arrow placement
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
4. **ChatGPT can take screenshots** → When needed, it captures your screen with coordinate grid overlay
5. **ChatGPT analyzes images** → It reads text, understands UI elements, and uses visible grid coordinates
6. **ChatGPT can point at elements** → Uses simple 0-100 coordinates from the visible grid to place arrows
7. **Process is invisible** → User sees instant arrow placement without technical details

## 📁 File Structure

```
WiseDragon/
├── README.md                    ← This file
├── package.json                 ← Dependencies and scripts (ultra-fast capture + auto-rebuild)
├── .env                         ← OpenAI API key (create this)
├── main.js                      ← Main process - app manager and security  
├── preload.js                   ← Security bridge between processes
├── renderer/
│   ├── index.html              ← UI with agent image display and controls
│   └── renderer.js             ← WebRTC connection and coordinate image handling
├── media/                       ← Pre-generated coordinate grid overlays
│   ├── grid_1920x1200.png      ← Common resolution coordinate grids
│   ├── grid_1920x1080.png      ← (8×6 grid, transparent background)
│   └── ... (more resolutions)
├── scripts/
│   └── generateGrids.js        ← Script to pre-generate coordinate grids
├── utils/
│   ├── applyCoordinateNet.js   ← Coordinate grid generation utility
│   ├── fastCapture.js          ← Ultra-fast screenshot capture (@jitsi/robotjs + fallbacks)
│   └── fastCompress.js         ← Optimized BGRA→PNG compression pipeline
└── tools/
    ├── index.js                ← Tool registry - auto-discovers and manages tools
    ├── overlay_context.js      ← Screenshot metadata storage for coordinate mapping
    ├── screenshot/
    │   ├── index.js            ← Screenshot tool entry point
    │   ├── execute.js          ← Fast screenshot capture with PNG optimization
    │   └── schema.js           ← OpenAI function calling schema
    └── overlay/
        ├── index.js            ← Overlay arrow tool entry point
        ├── execute.js          ← Optimized arrow overlay with pre-generated grids
        └── schema.js           ← Simplified coordinate system schema
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

#### `renderer/renderer.js` (390+ lines) - Voice & Function Call Handler
- Manages WebRTC peer connection with OpenAI
- Handles microphone input and speaker output
- Processes function call requests from ChatGPT
- Executes tools and sends results back to AI
- **Agent image display**: Shows exactly what the AI sees (screenshots/coordinate grids)
- Special handling for coordinate-overlaid screenshots
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

#### `tools/screenshot/execute.js` (75 lines) - **ULTRA-FAST** Screenshot Capture
- **Ultra-fast capture**: Uses @jitsi/robotjs (~45ms) with screenshot-desktop fallback
- **Full screen capture**: Captures entire screen, then resizes to optimized 1366×768
- **Advanced compression**: BGRA→RGB conversion with 64-color palette compression
- **Size-optimized**: ≤150KB for real-time WebRTC transmission
- **Professional logging**: Complete timeline from capture to model transmission
- **Automatic native module rebuilds**: Handles Electron ABI compatibility automatically

#### `tools/screenshot/schema.js` (24 lines) - OpenAI Function Schema
- Defines how ChatGPT should use the screenshot tool
- Encourages proactive screenshot usage for better assistance
- Instructs AI to analyze images thoroughly and systematically

### Overlay Arrow Tool

#### `tools/overlay/execute.js` (240+ lines) - **OPTIMIZED** Arrow Overlay Implementation
- **High-performance**: Uses pre-generated coordinate grids for ~200ms total placement time
- **Simple coordinate system**: AI uses visible 0-100 grid coordinates (top-left origin)
- **One-shot operation**: Agent makes single decision, no adjustment attempts
- **Invisible process**: User sees instant arrow placement without technical details
- **Smart grid loading**: Loads pre-generated grids from `/media/` with fallback generation
- **Fast compositing**: Direct image overlay using cached transparent grids
- **Detailed performance logging**: Monitors each step for bottleneck identification
- Multi-monitor support with automatic display detection
- Auto-cleanup to prevent permanent overlays

#### `tools/overlay/schema.js` (68 lines) - **SIMPLIFIED** OpenAI Function Schema
- **Streamlined parameters**: Just `x100`, `y100`, `direction` (removed complex legacy systems)
- **Clear instructions**: Explains that coordinate overlays are helper references only
- **Smart arrow directions**: Points away from screen edges toward targets
- **One-shot guidance**: Emphasizes single attempt with best judgment
- **Invisible operation**: Instructs AI to never mention technical details to user

## 🚀 Setup & Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd WiseDragon
   ```

2. **Install dependencies** (includes ultra-fast capture libraries)
   ```bash
   npm install
   ```
   
   **Key Dependencies:**
   - `@jitsi/robotjs`: Ultra-fast native screenshot capture (~45ms)
   - `screenshot-desktop`: Reliable fallback capture method (~200ms)  
   - `sharp`: High-performance image processing and compression
   - `@electron/rebuild`: Automated native module compatibility for Electron
   - `electron ^38.0.0`: Latest Electron with Node.js v22.16.0 (ABI 139)

3. **Create `.env` file**
   ```bash
   echo "OPENAI_API_KEY=your_openai_api_key_here" > .env
   ```

4. **Generate coordinate grids** (for optimal performance)
   ```bash
   npm run generate-grids
   ```

5. **Start the application**
   ```bash
   npm start
   ```

### **Available Scripts:**
```bash
npm start           # Start the application
npm run rebuild     # Manually rebuild native modules for Electron
npm run generate-grids  # Pre-generate coordinate grid overlays
```

**Note**: The postinstall script automatically rebuilds native modules (@jitsi/robotjs) for Electron ABI compatibility. This ensures ultra-fast capture works across Electron updates.

## 🎯 Key Technical Features

### Voice Processing
- **Direct WebRTC streaming** to OpenAI (no intermediate servers)
- **Low-latency audio** optimized for real-time conversation
- **Asynchronous function calls** don't interrupt voice flow
- **Backchannel audio feedback** for immediate AI responsiveness

### Visual Intelligence
- **Ultra-fast capture**: @jitsi/robotjs provides ~45ms full-screen capture (vs 700-1400ms Electron)
- **Smart compression**: Full screen → 1366×768 resize with BGRA→RGB conversion
- **Coordinate grid overlays**: 8×6 grid with visible 0-100 coordinates for precise targeting
- **Pre-generated grids**: Cached transparent overlays for common resolutions (instant loading)
- **Agent image display**: UI shows exactly what the AI sees (screenshots + coordinate grids)
- **Complete timeline logging**: Track entire screenshot→model→reply pipeline
- **Automated compatibility**: electron-rebuild ensures native modules work across updates

### Precision Overlays
- **Simple 0-100 coordinate system**: AI reads coordinates directly from visible grid overlay
- **Top-left origin**: Standard screen coordinate system (0,0) → (100,100)
- **One-shot precision**: AI makes single targeting decision with visible coordinate helpers
- **Transparent, click-through arrows** that don't interfere with usage
- **Smart arrow directions**: Automatically points away from screen edges toward targets
- **High performance**: ~200ms total arrow placement time using pre-generated grids
- **Multi-monitor support** with automatic display targeting
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
1. **Takes coordinate-overlaid screenshot** when pointing is needed
2. **Analyzes the image** including visible coordinate grid references
3. **Uses visible coordinate numbers** to specify precise arrow placement locations
4. **Makes one-shot targeting decisions** with best judgment from visible grid
5. **Continues conversation naturally** after arrow placement (invisible technical process)

### Simple Coordinate System
```javascript
// AI sees coordinate grid overlay and uses visible numbers:

// Point at center of screen (50,50)
{
  "x100": 50,
  "y100": 50, 
  "direction": "down"
}

// Point at top-right area (85,15)  
{
  "x100": 85,
  "y100": 15,
  "direction": "left"
}

// Point at bottom-left area (20,90)
{
  "x100": 20,
  "y100": 90,
  "direction": "up"
}
```

**How it works:**
1. AI calls `show_arrow_overlay` function
2. System takes screenshot + applies coordinate grid overlay
3. AI sees image with red dots and coordinate labels (0-100)
4. AI reads coordinates from visible grid and responds with simple JSON
5. Arrow appears instantly at specified location

## 🔄 How It All Works Together

### **Screenshot Analysis Flow:**
1. **User speaks** → "Can you see my screen?" → Voice streams to OpenAI via WebRTC
2. **AI decides to screenshot** → Calls `take_screenshot` function  
3. **Ultra-fast capture** → @jitsi/robotjs captures full screen in ~45ms
4. **Smart compression** → Full screen resized to 1366×768, compressed to ~75KB
5. **WebRTC transmission** → Screenshot sent to AI model in ~60ms
6. **AI processes image** → Model analyzes screenshot (2-15 seconds)
7. **AI responds naturally** → Starts speaking within 2-3 seconds with analysis

### **Arrow Pointing Flow:**
1. **User asks for pointing** → "Point to the Save button" 
2. **AI calls arrow function** → `show_arrow_overlay` initiated
3. **Coordinate screenshot** → Screenshot + 8×6 grid overlay applied (~200ms)
4. **AI sees coordinate grid** → Red dots with 0-100 coordinate labels
5. **AI responds with coordinates** → `{x100: 75, y100: 25, direction: "left"}`
6. **Arrow appears instantly** → Transparent overlay precisely targets the element
7. **AI continues conversation** → Acknowledges pointing and continues helping

## 📊 Performance Optimizations

### **BREAKTHROUGH Performance Achievements**
- **Screenshot capture**: 3,200ms → **~165ms** (95% improvement!)
- **Ultra-fast methods**: @jitsi/robotjs ~45ms + screenshot-desktop ~200ms fallback
- **Full screen capture**: Complete screen coverage with 1366×768 optimization
- **Native module compatibility**: Automated electron-rebuild for seamless updates
- **Complete pipeline visibility**: End-to-end timeline logging for optimization

### **Current Performance (Live Testing)**
```
🤖 AI Screenshot Decision:     ~270ms  (normal OpenAI processing)
📷 Screenshot Capture:        ~45ms   (@jitsi/robotjs)
🎨 Compression + Resize:      ~120ms  (full screen → 1366×768)
📡 WebRTC Transmission:       ~60ms   (to OpenAI model)
🧠 AI Image Analysis:        ~2-15s  (OpenAI vision processing)
🗣️ AI Response (starts):     ~2-3s   (excellent user experience)
```

### **Technical Implementation**
- **@jitsi/robotjs**: Native GPU-accelerated screen capture for Windows/Mac/Linux
- **BGRA→RGB conversion**: Optimized pixel format processing with Sharp
- **Adaptive compression**: Smart 64→32→16→8 color palette selection
- **Electron compatibility**: Automated native module ABI handling
- **Fallback system**: screenshot-desktop ensures reliability if RobotJS fails
- **Memory optimization**: Efficient buffer handling for 4MB→75KB compression (53x)

### **Eliminated Bottlenecks**
- ✅ **Slow Electron desktopCapturer**: 700-1400ms → 45ms (96% improvement)
- ✅ **Partial screen capture**: Fixed to capture full screen properly
- ✅ **Complex coordinate generation**: Pre-generated grids reduce overlay time
- ✅ **Excessive logging**: Cleaned professional output with timeline visibility

## 📝 Development Notes

### **Performance Engineering**
- **Native module integration**: @jitsi/robotjs with automated Electron ABI compatibility
- **Memory-efficient pipelines**: 4MB raw → 75KB optimized (53x compression)
- **Full-screen capture**: Proper screen coverage with intelligent resizing
- **Timeline observability**: Complete performance monitoring from capture to AI response

### **Code Quality**
- **Clean, minimal codebase**: Removed overengineering while maintaining functionality
- **Secure by design**: Proper sandboxing and IPC boundaries
- **Production ready**: Comprehensive error handling and professional logging
- **Extensible architecture**: Easy to add new tools and capabilities
- **Performance optimized**: 95% improvement in screenshot capture performance

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