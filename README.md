# WiseDragon

**An AI-powered desktop assistant that sees and interacts with your screen through voice commands.**

WiseDragon is an Electron.js desktop application that combines OpenAI's Realtime API with computer vision to create an intelligent assistant that can see your screen, understand voice commands, and provide visual feedback through overlays. The application uses advanced AI models to identify UI elements and objects on screen, then points to them with precision-placed arrows.

**Features a stunning luxury black and gold interface** with animated logos, mystical background effects, and smooth golden glow animations that create an awe-inspiring user experience befitting an AI-powered assistant.

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v16 or higher)
- **npm** (v7 or higher) 
- **OpenAI API Key** with Realtime API access
- **Google Cloud Storage** account (for vision model image uploads)
- **Windows/macOS/Linux** (cross-platform Electron support)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd WiseDragon
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```bash
   # OpenAI Configuration (Required)
   OPENAI_API_KEY=your_openai_api_key_here

   # Hugging Face Vision Model (Required for UI element detection)
   HF_ENDPOINT=your_hugging_face_endpoint
   HF_TOKEN=your_hf_token
   HF_MODEL=osunlp/UGround-V1-2B

   # Google Cloud Storage (Required for image uploads)
   GCS_BUCKET=your_gcs_bucket_name
   GCS_KEY_BASE64=your_base64_encoded_service_account_key
   # OR alternatively:
   GCS_KEY_PATH=path/to/your/service-account-key.json

   # Replicate API (Optional - for Grounding DINO model)
   REPLICATE_API_TOKEN=your_replicate_token
   ```

4. **Start the application**
   ```bash
   npm start
   ```

### Development Mode
```bash
npm run dev
```

## 🏗️ Architecture

WiseDragon follows the standard **Electron.js architecture** with clear separation between main and renderer processes:

### Main Process (`main.js`)
- **Electron app lifecycle management** - Window creation, app events, session management
- **IPC (Inter-Process Communication) handlers** - Bridges renderer requests to backend tools
- **OpenAI Realtime API integration** - Manages ephemeral tokens and authentication
- **Tool execution orchestration** - Coordinates screenshot capture and overlay placement

### Renderer Process (`renderer/`)
- **WebRTC voice communication** - Real-time audio streaming with OpenAI's voice model
- **Luxury UI interface** - Black and gold themed design with animated logo, sparkle effects, and golden glow
- **User interface controls** - Elegant connect/disconnect buttons, status display, image preview
- **Function call handling** - Processes AI tool requests and displays visual feedback
- **Screen interaction visualization** - Shows screenshots and overlay results to user
- **Visual effects** - Animated dragon logo with orbital rings, pulsing golden glow from screen bottom, mystical background

### Preload Script (`preload.js`)
- **Secure API exposure** - Uses `contextBridge` to safely expose main process functions
- **IPC communication layer** - Handles `oai:getEphemeral` and `tool:execute` calls
- **Security isolation** - Maintains Electron's security model with context isolation

### Tool System (`tools/`)
The application uses a **modular tool architecture** where AI can execute specific functions:

- **Screenshot Tool** - Captures screen images using multiple methods (RobotJS, screenshot-desktop)
- **Overlay Tool** - Places precision arrows on screen using computer vision models
- **Session Management** - Organizes screenshots into timestamped conversation sessions

### Computer Vision Pipeline
1. **Screenshot Capture** - Multi-method fallback system for cross-platform compatibility
2. **Image Upload** - Secure upload to Google Cloud Storage with signed URLs  
3. **Vision Model Processing** - UGround for UI elements, Grounding DINO for real objects
4. **Coordinate Mapping** - Precise pixel coordinate calculation and arrow placement
5. **Overlay Rendering** - SVG-based arrows with automatic positioning and cleanup

## 🎨 User Interface & Visual Design

WiseDragon features a **luxury black and gold themed interface** designed to inspire awe and prestige:

### **Visual Elements**
- **Animated Dragon Logo** - 200px golden logo with intense shine animation that pulses every 4 seconds
- **Orbital Rings** - Two rotating rings around the logo with golden gradients and synchronized glow effects  
- **Sparkle Effects** - Six floating sparkles positioned around the logo with staggered animations
- **Mystical Background** - Blurred dragon imagery with darkening overlay for atmospheric depth
- **Golden Glow Effect** - Uniform golden light emanating from the bottom screen edge with bright corners

### **Interactive Elements**
- **Elegant Buttons** - Golden gradient connect button and outline disconnect button with hover effects
- **Smooth Animations** - Fade-in effects, shimmer text, pulsing status displays, and breathing glow
- **Responsive Layout** - Clean vertical layout with buttons above status, mobile-optimized design
- **Professional Typography** - Cinzel serif for titles, Inter for UI elements with golden color scheme

### **Technical Implementation**
- **CSS Animations** - Hardware-accelerated transforms and opacity changes for 60fps performance
- **Responsive Design** - Adapts to different screen sizes while maintaining visual impact
- **Optimized Rendering** - Efficient CSS with consolidated animations and minimal DOM elements

## 📁 File Structure

### 🟢 Main Process Files

#### `main.js`
**Primary purpose:** Electron main process entry point and application lifecycle manager  
**Process context:** Main process  
**Key responsibilities:** Creates browser windows, handles IPC communication, manages OpenAI API authentication, coordinates tool execution  
**Dependencies:** `tools/index.js`, `tools/sessionManager.js`  
**Contribution notes:** Modify here for new IPC handlers or app-level configuration changes

#### `package.json` 
**Primary purpose:** Project configuration and dependency management  
**Process context:** Build/configuration  
**Key responsibilities:** Defines Electron scripts, manages npm dependencies, sets application metadata  
**Contribution notes:** Add new dependencies here; use `npm run rebuild` after native module changes

#### `preload.js`
**Primary purpose:** Secure bridge between main and renderer processes  
**Process context:** Preload script (runs in renderer with Node.js access)  
**Key responsibilities:** Exposes safe APIs to renderer using contextBridge, handles IPC communication  
**Contribution notes:** Add new main process functions here when expanding renderer capabilities

### 🔵 Renderer Process Files

#### `renderer/index.html`
**Primary purpose:** User interface structure with luxury black and gold theme  
**Process context:** Renderer process  
**Key responsibilities:** Defines semantic HTML structure, loads custom CSS and media assets, implements dragon logo with sparkle effects  
**Contribution notes:** Contains clean HTML5 structure for animated logo, golden glow effects, and responsive layout

#### `renderer/renderer.js`
**Primary purpose:** Frontend application logic and WebRTC voice communication  
**Process context:** Renderer process  
**Key responsibilities:** Manages voice connection to OpenAI, handles function call execution, displays visual feedback  
**Dependencies:** Uses APIs exposed by `preload.js`  
**Contribution notes:** Core file for UI interactions and voice handling; test thoroughly after changes

#### `renderer/styles.css`
**Primary purpose:** Complete visual styling system with luxury animations and effects  
**Process context:** Renderer process  
**Key responsibilities:** Implements black & gold theme, logo shine animations, orbital rings, sparkle effects, golden glow, and responsive design  
**Contribution notes:** Contains optimized CSS animations and visual effects; modify here for UI appearance changes

#### `renderer/media/`
**Primary purpose:** Visual assets for the luxury interface  
**Process context:** Static assets  
**Key responsibilities:** Contains logo.png (golden dragon) and background.png (mystical dragon background)  
**Contribution notes:** Replace images here for visual rebranding; ensure proper sizing for performance

### 🟡 Tool System Files

#### `tools/index.js`
**Primary purpose:** Tool registry and execution coordinator  
**Process context:** Main process  
**Key responsibilities:** Registers available tools, provides schemas to OpenAI, routes tool execution calls  
**Dependencies:** `tools/screenshot/`, `tools/overlay/`  
**Contribution notes:** Add new tools here following the schema + executor pattern

#### `tools/sessionManager.js`
**Primary purpose:** Organizes screenshots into timestamped conversation sessions  
**Process context:** Main process  
**Key responsibilities:** Creates session folders, manages file paths, tracks screenshot counts  
**Contribution notes:** Handles all screenshot storage organization; modify for different storage patterns

### 🟠 Screenshot Tool (`tools/screenshot/`)

#### `tools/screenshot/index.js`
**Primary purpose:** Screenshot tool module entry point  
**Process context:** Main process  
**Key responsibilities:** Exports tool schema and executor for the main tool registry

#### `tools/screenshot/schema.js`
**Primary purpose:** OpenAI function calling schema definition for screenshots  
**Process context:** Configuration  
**Key responsibilities:** Defines how OpenAI can call the screenshot function, including parameters and descriptions  
**Contribution notes:** Modify to change how AI interacts with screenshot functionality

#### `tools/screenshot/execute.js`
**Primary purpose:** Screenshot capture implementation with compression and optimization  
**Process context:** Main process  
**Key responsibilities:** Captures screen using multiple methods, compresses images, saves to session folders  
**Dependencies:** `fastCapture.js`, `fastCompress.js`, `sessionManager.js`  
**Contribution notes:** Core screenshot logic; test on multiple platforms when modifying

#### `tools/screenshot/fastCapture.js`
**Primary purpose:** Cross-platform screen capture with multiple fallback methods  
**Process context:** Main process  
**Key responsibilities:** Tries RobotJS first, falls back to screenshot-desktop, handles different image formats  
**Contribution notes:** Add new capture methods here; ensure proper error handling for missing dependencies

#### `tools/screenshot/fastCompress.js`
**Primary purpose:** Image compression and optimization using Sharp  
**Process context:** Main process  
**Key responsibilities:** Compresses BGRA/PNG images, applies color quantization, resizes for optimal model input  
**Dependencies:** `sharp` library  
**Contribution notes:** Adjust compression settings here for quality vs. speed tradeoffs

### 🔴 Overlay Tool (`tools/overlay/`)

#### `tools/overlay/index.js`
**Primary purpose:** Overlay arrow tool module entry point  
**Process context:** Main process  
**Key responsibilities:** Exports tool schema and executor for placing precision arrows on screen

#### `tools/overlay/schema.js`
**Primary purpose:** OpenAI function calling schema for arrow overlays  
**Process context:** Configuration  
**Key responsibilities:** Defines vision model selection, target descriptions, and positioning parameters  
**Contribution notes:** Modify to add new vision models or overlay options

#### `tools/overlay/execute.js`
**Primary purpose:** Arrow overlay placement with computer vision integration  
**Process context:** Main process  
**Key responsibilities:** Coordinates vision models, calculates arrow positions, creates overlay windows, manages cleanup  
**Dependencies:** `uground_api.js`, `groundingdino_api.js`, `utils.js`  
**Contribution notes:** Core overlay logic; handles both UI and object detection workflows

#### `tools/overlay/utils.js`
**Primary purpose:** Shared utilities for coordinate transformations and arrow direction logic  
**Process context:** Main process (shared)  
**Key responsibilities:** Determines arrow directions, converts coordinate systems, handles screen-to-pixel mapping  
**Contribution notes:** Centralized math functions; test coordinate accuracy when modifying

#### `tools/overlay/uground_api.js`
**Primary purpose:** UGround vision model integration for UI element detection  
**Process context:** Main process  
**Key responsibilities:** Uploads images to GCS, calls Hugging Face API, parses coordinates, handles UI element detection  
**Dependencies:** `gcs_upload_and_sign.js`  
**Contribution notes:** Handles UI element detection; requires HF_ENDPOINT and HF_TOKEN configuration

#### `tools/overlay/groundingdino_api.js`
**Primary purpose:** Grounding DINO model integration for real-world object detection  
**Process context:** Main process  
**Key responsibilities:** Uses Replicate API for object detection, filters results by screen area, returns object centers  
**Dependencies:** `gcs_upload_and_sign.js`, Replicate API  
**Contribution notes:** Handles real-world object detection; requires REPLICATE_API_TOKEN

#### `tools/overlay/gcs_upload_and_sign.js`
**Primary purpose:** Google Cloud Storage integration for secure image uploads  
**Process context:** Main process  
**Key responsibilities:** Uploads screenshots to GCS, generates signed URLs, handles authentication  
**Dependencies:** `@google-cloud/storage`  
**Contribution notes:** Critical for vision model access; requires proper GCS configuration

#### `tools/overlay_context.js`
**Primary purpose:** Simple state management for screenshot metadata  
**Process context:** Main process (shared)  
**Key responsibilities:** Stores and retrieves last screenshot information for overlay calculations  
**Contribution notes:** Lightweight state store; expand carefully to avoid memory leaks

### 📂 Data Directories

#### `screenshots_seen/`
**Primary purpose:** Organized storage of captured screenshots by conversation session  
**Process context:** File system  
**Key responsibilities:** Contains timestamped session folders with PNG screenshot files  
**Contribution notes:** Auto-generated by sessionManager; safe to delete for cleanup

#### `node_modules/`
**Primary purpose:** NPM dependency storage (auto-generated)  
**Process context:** Build/runtime  
**Key responsibilities:** Contains all installed package dependencies  
**Contribution notes:** Never commit to version control; use `npm install` to regenerate

### ⚙️ Configuration Files

#### `.env`
**Primary purpose:** Environment variables and API keys (not tracked in git)  
**Process context:** Configuration  
**Key responsibilities:** Stores sensitive API keys, model endpoints, and configuration options  
**Contribution notes:** Required for application functionality; never commit to version control

#### `.gitignore`
**Primary purpose:** Git ignore patterns for sensitive and generated files  
**Process context:** Version control  
**Key responsibilities:** Excludes node_modules, .env, logs, and screenshot directories from git  
**Contribution notes:** Add new sensitive or generated file patterns here

#### `gcs_key.json`
**Primary purpose:** Google Cloud Service Account credentials (not tracked in git)  
**Process context:** Configuration  
**Key responsibilities:** Contains GCS authentication credentials for image uploads  
**Contribution notes:** Alternative to GCS_KEY_BASE64; never commit to version control

## 🛠️ Development

### Adding New Tools

1. Create a new directory in `tools/`
2. Add `index.js`, `schema.js`, and `execute.js` files
3. Register the tool in `tools/index.js`
4. Define the OpenAI function schema
5. Implement the execution logic

### Vision Model Integration

- **UGround**: Best for UI elements (buttons, menus, text fields)
- **Grounding DINO**: Best for real-world objects (people, animals, objects)
- Add new models by creating new API integration files in `tools/overlay/`

### Testing

- Test on multiple platforms (Windows, macOS, Linux)
- Verify screenshot capture works with different screen configurations
- Test voice connection with various microphone setups
- Validate overlay accuracy with different vision models

## 🤝 Contributing

1. **Fork the repository** and create a feature branch
2. **Test thoroughly** on your platform before submitting
3. **Follow the existing architecture** - separate concerns between main and renderer processes
4. **Update documentation** when adding new features or tools
5. **Ensure security** - never expose sensitive APIs directly to renderer process
6. **Submit pull requests** with clear descriptions and testing notes

### Common Contribution Areas

- **New vision models** - Add integrations for additional computer vision APIs
- **Cross-platform improvements** - Enhance compatibility across operating systems  
- **UI enhancements** - Improve the renderer interface and user experience
- **Performance optimizations** - Reduce screenshot capture time or overlay placement latency
- **Tool extensions** - Add new capabilities like mouse control or text recognition

## 📋 Troubleshooting

### Common Issues

- **"No capture methods available"** - Install RobotJS or screenshot-desktop: `npm install robotjs screenshot-desktop`
- **Vision model errors** - Check your HF_ENDPOINT and GCS_BUCKET configuration in `.env`
- **Voice connection fails** - Verify your OPENAI_API_KEY has Realtime API access
- **Overlay arrows don't appear** - Ensure proper screen permissions on macOS/Linux

### Platform-Specific Notes

- **macOS**: May require Screen Recording permissions in System Preferences
- **Linux**: RobotJS might need additional system dependencies
- **Windows**: Should work out of the box with proper Node.js installation

---

**Built with ❤️ using Electron.js, OpenAI Realtime API, and advanced computer vision models.**
