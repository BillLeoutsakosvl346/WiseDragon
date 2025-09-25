# WiseDragon 🐉

**AI-Powered Desktop Assistant with Visual Screen Guidance**

WiseDragon is an intelligent desktop companion that provides real-time visual guidance by taking screenshots, analyzing your screen, and placing precise arrows to help you navigate any application or website. It combines OpenAI's GPT Realtime API with advanced computer vision to deliver intuitive, voice-activated assistance.

## ✨ Key Features

### 🎯 **Visual Screen Guidance**
- **Smart Arrow Overlays**: Places golden arrows pointing to UI elements with pixel-perfect accuracy
- **Real-time Screenshots**: Automatically captures your screen on interactions
- **Dual Vision Models**: 
  - UGround for UI elements (buttons, menus, forms)
  - Grounding DINO for real-world objects (people, animals, items)

### 🎤 **Voice-Activated Assistant**
- **Natural Conversations**: Speak naturally and get immediate visual guidance
- **Proactive Screenshot Capture**: Automatically takes fresh screenshots when you mention your screen
- **Brief, Actionable Responses**: Focused on immediate next steps, not lengthy tutorials

### 🖥️ **Screen Interaction**
- **Auto-Screenshot on Clicks**: Captures screen state after user interactions
- **Session Management**: Organizes screenshots by timestamped sessions
- **Click-Through Arrows**: Arrows don't interfere with normal screen interactions

### 🚀 **High Performance**
- **Optimized Image Processing**: 1366x768 PNG with 64-color compression for WebRTC compatibility
- **Fast Vision Processing**: Modal GPU deployment for UI detection, Replicate for object detection
- **Global Input Detection**: Monitors system-wide interactions for contextual assistance

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- Windows, macOS, or Linux
- Microphone for voice interaction
- OpenAI API key
- Replicate API token (for object detection)

### 1. Clone and Install
```bash
git clone <repository-url>
cd WiseDragon
npm install
```

### 2. Environment Configuration
Create a `.env` file in the project root:
```env
OPENAI_API_KEY=your_openai_api_key_here
REPLICATE_API_TOKEN=your_replicate_api_token_here
MODAL_ENDPOINT=your_modal_endpoint_url
MODAL_KEY=your_modal_key
MODAL_SECRET=your_modal_secret
```

### 3. Optional: Warm Up Vision Services
```bash
# Pre-warm Modal container to avoid cold starts
node warm_modal.js

# Keep container warm during extended use
node warm_modal.js --keep-warm
```

### 4. Launch Application
```bash
npm start
```

## 🎮 Usage Guide

### Getting Started
1. **Launch WiseDragon**: Run `npm start`
2. **Connect**: Click the "Connect" button in the UI
3. **Start Speaking**: The assistant listens when you speak and responds with voice + visual guidance

### Voice Commands Examples

**Screen Analysis:**
- "Do you see my screen?"
- "What's on my screen?"
- "Look at this page"

**Finding Elements:**
- "Where is the login button?"
- "Help me find the search bar"
- "Show me the settings menu"
- "How do I click on submit?"

**Navigation Help:**
- "Help me with this form"
- "Guide me through this website"
- "What should I click next?"

### How It Works
1. **You speak** → Assistant immediately takes a screenshot
2. **Vision analysis** → AI identifies the element you're looking for
3. **Arrow placement** → Golden arrow points exactly where to click
4. **Voice response** → Brief, actionable guidance

## 🏗️ Technical Architecture

### Core Components

**Electron Application**
- Main process handles API connections and tool orchestration
- Renderer process provides the user interface
- Secure IPC communication between processes

**Vision Processing Pipeline**
- **Screenshot Capture**: Multi-method capture (desktopCapturer, robotjs, screenshot-desktop)
- **Image Optimization**: Sharp-based compression to 1366x768 PNG 64-color
- **Vision Models**: 
  - Modal UGround (2B) for UI element detection
  - Replicate Grounding DINO for object detection

**AI Integration**
- **OpenAI GPT Realtime API**: Voice conversation with function calling
- **WebRTC**: Real-time audio streaming and data channels
- **Tool System**: Modular screenshot and overlay tools

**Visual Overlay System**
- **Cross-platform overlays**: Native window management
- **Arrow rendering**: Dynamic SVG-based directional arrows
- **Global input detection**: System-wide click/scroll monitoring

### Key Technologies
- **Electron 38.0**: Cross-platform desktop framework
- **OpenAI Realtime API**: Voice conversation with vision
- **Sharp**: High-performance image processing
- **WebRTC**: Real-time communication
- **RobotJS**: System automation and input detection
- **Modal**: GPU-accelerated vision model hosting
- **Replicate**: Cloud-based AI model inference

### File Structure
```
WiseDragon/
├── main.js                 # Electron main process
├── preload.js             # Secure IPC bridge
├── renderer/              # UI components
│   ├── index.html         # Main interface
│   ├── renderer.js        # Frontend logic
│   └── styles.css         # UI styling
├── tools/                 # AI tools system
│   ├── screenshot/        # Screen capture
│   ├── overlay/           # Visual guidance
│   └── sessionManager.js  # Screenshot organization
├── utils/                 # Utilities
└── screenshots_seen/      # Organized screenshot sessions
```

## 📸 Screenshot Management

WiseDragon automatically organizes screenshots into timestamped sessions:

```
screenshots_seen/
├── session_2025-09-25_10-30-45/
│   ├── 2025-09-25_10-30-47_1366x768_64colors.png
│   ├── 2025-09-25_10-31-15_1366x768_64colors.png
│   └── ...
└── session_2025-09-25_14-22-10/
    └── ...
```

- **Session-based**: Each app launch creates a new timestamped folder
- **Unified format**: All screenshots standardized to 1366x768 PNG 64-color
- **WebRTC optimized**: Perfect size for real-time transmission
- **Auto-cleanup**: Sessions are self-contained for easy management

## 🎯 Vision Model Selection

**Use UGround for:**
- Buttons, links, text fields
- Menus, dropdowns, tabs
- UI controls, icons
- Form elements

**Use Grounding DINO for:**
- People, animals, objects
- Real-world items in photos
- Non-UI elements
- Physical objects

The AI automatically selects the appropriate model based on your description.

## 🔧 Development

### Available Scripts
- `npm start` - Launch the application
- `npm run dev` - Development mode with debugging
- `npm run rebuild` - Rebuild native dependencies
- `node warm_modal.js` - Warm up vision services

### Adding New Tools
1. Create tool folder in `tools/`
2. Implement `schema.js` (OpenAI function schema)
3. Implement `execute.js` (tool logic)
4. Create `index.js` exporting schema and executor
5. Register in `tools/index.js`

### Environment Variables
```env
OPENAI_API_KEY=         # Required: OpenAI API access
REPLICATE_API_TOKEN=    # Required: Replicate API for object detection
MODAL_ENDPOINT=         # Optional: Custom Modal endpoint
MODAL_KEY=              # Optional: Modal authentication
MODAL_SECRET=           # Optional: Modal authentication
```

## 🤝 Contributing

This project focuses on delivering the minimum viable functionality for AI-powered desktop assistance. Contributions should maintain simplicity and directness.

**Core Principles:**
- Build exactly what's needed to make features work
- Prefer simple, direct solutions over complex architectures
- Ship working functionality first, iterate when requested
- Focus on user experience over technical complexity

## 📝 License

ISC License

---

**WiseDragon** - Where AI meets desktop productivity. Ask anything, see everything, get guided instantly. 🐉✨
