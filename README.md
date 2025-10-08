# WiseDragon 🐲

An open-source realtime AI assistant that guides you through your computer screen with visual arrows and voice instructions. WiseDragon watches your screen, understands what you're trying to do, and provides contextual guidance by pointing to UI elements with precise arrows.

## Architecture

WiseDragon combines multiple technologies to create an intelligent screen guide:

- **Electron App**: Cross-platform desktop application with WebRTC integration
- **OpenAI Realtime API**: Real-time voice conversation with GPT models
- **Computer Vision**: Multiple AI models for precise UI element detection
  - **UGround-V1-2B**: Specialized UI element detection (via Modal deployment)
  - **Grounding DINO**: General object detection (via Replicate)
- **Overlay System**: Real-time arrow placement on screen elements
- **Screenshot Automation**: Continuous screen monitoring and analysis
- **Web Search Integration**: Contextual help via Exa API

### How It Works

1. **Connect**: Start a voice conversation with WiseDragon
2. **Screen Monitoring**: Automatically captures screenshots as you navigate
3. **AI Analysis**: Processes screenshots to understand current context
4. **Visual Guidance**: Places arrows on UI elements and provides voice instructions
5. **Contextual Help**: Searches web for tutorials when needed

## Getting Started

### Prerequisites

- Node.js (latest version)
- Python 3.8+ (for Modal deployment)
- Modal account (for GPU deployment)

### 1. Environment Configuration

Create a `.env` file in the project root with the following variables:

```bash
# OpenAI API (Required)
OPENAI_API_KEY=sk-proj-your-openai-api-key-here

# Modal Configuration (Required for UGround)
MODAL_ENDPOINT=https://your-modal-endpoint.modal.run/v1
MODAL_KEY=wk-your-modal-key-here  
MODAL_SECRET=ws-your-modal-secret-here

# Replicate API (Optional - for Grounding DINO object detection)
REPLICATE_API_TOKEN=r8_your-replicate-token-here

# Exa API (Optional - for web search functionality)
EXA_API_KEY=d31649ff-your-exa-api-key-here
```

### 2. Deploy UGround Model

Deploy the UGround-V1-2B model to Modal for UI element detection:

```bash
# Install Modal CLI
pip install modal

# Deploy the UGround model
modal deploy modal/modal_uground_deploy.py
```

Copy the endpoint URL from the deployment output and add it to your `.env` file as `MODAL_ENDPOINT`.

### 3. Warm Up GPU

Pre-warm the Modal GPU container to avoid cold start delays:

```bash
# Single warmup (recommended before each session)
node modal/warm_modal.js

# Extended warmup (keeps GPU warm for 15+ minutes)
node modal/warm_modal.js --keep-warm
```

### 4. Install Dependencies

Install all required Node.js dependencies:

```bash
npm install
```

Key dependencies include:
- `electron` - Desktop app framework
- `sharp` - Image processing for screenshots
- `screenshot-desktop` - Cross-platform screenshot capture
- `@jitsi/robotjs` - Screen automation and input detection
- `uiohook-napi` - Global input monitoring
- `replicate` - Grounding DINO API client
- `openai` - OpenAI API integration

### 5. Start the Application

Launch WiseDragon:

```bash
npm start
```

## Usage

1. **Launch**: Run `npm start` to open WiseDragon
2. **Connect**: Click "Connect" and allow microphone access
3. **Speak**: Tell WiseDragon what you want to do (e.g., "Help me open Chrome and search for something")
4. **Follow**: WiseDragon will take screenshots, analyze your screen, and guide you with arrows and voice instructions
5. **Interact**: Continue the conversation naturally - WiseDragon adapts to your screen changes

### Example Interactions

- **"Open Chrome"** → WiseDragon guides you to the Chrome icon
- **"Help me log into Gmail"** → Points to login fields and buttons
- **"How do I change my Windows theme?"** → Searches for instructions and guides you through Settings
- **"Find the save button"** → Identifies and points to save buttons in your current app

## Features

### 🎯 Precise Arrow Placement
- Real-time arrow overlays pointing to exact UI elements
- Multiple arrow directions (up, down, left, right, diagonal)
- Customizable colors and opacity

### 📸 Automatic Screenshot Analysis  
- Continuous screen monitoring
- Context-aware screenshot timing
- Efficient image processing and analysis

### 🎤 Natural Voice Conversation
- Real-time voice interaction with OpenAI's GPT
- Context-aware responses based on screen content
- Adaptive conversation flow

### 🔍 Intelligent Web Search
- Contextual tutorial searches via Exa API
- Procedural guidance for complex tasks
- Integration with screen analysis

### 🖥️ Cross-Platform Support
- Windows, macOS, and Linux compatibility
- Multiple display support
- Adaptive to different screen resolutions

## Tools & APIs

### Screenshot Tool
Captures high-quality screenshots using `screenshot-desktop` with automatic display detection and efficient image processing.

### Overlay Tool  
Places precise arrows on screen elements using:
- **UGround API**: For UI elements (buttons, fields, menus)
- **Grounding DINO**: For general objects (images, icons, content)

### Web Search Tool
Searches for step-by-step tutorials using Exa API and processes results with GPT-4o-mini for concise, actionable guidance.

## Configuration

### Modal Settings
The UGround model is configured for optimal performance:
- **GPU**: L4 (faster than T4)
- **Region**: Europe West 2 (London) for low latency
- **Scaling**: 1 minimum container, auto-scaling enabled
- **Context**: 4096 tokens for complex UI analysis

### Screenshot Settings
Automatic screenshot capture is optimized for:
- Click detection and automatic analysis
- Context-aware timing to avoid loading screens
- Efficient base64 encoding for real-time transmission

## Development

### Project Structure
```
├── main.js              # Electron main process
├── renderer/            # Frontend UI
├── tools/               # Tool implementations
│   ├── screenshot/      # Screenshot capture
│   ├── overlay/         # Arrow overlay system
│   └── websearch/       # Web search integration
├── prompts/             # AI prompt templates
├── modal/               # Modal deployment scripts
└── utils/               # Utility functions
```

### Adding New Tools
1. Create tool directory in `tools/`
2. Implement `schema.js`, `execute.js`, and `index.js`
3. Register in `tools/index.js`
4. Add to OpenAI tool schemas

## Troubleshooting

### Common Issues

**"Modal endpoint not responding"**
- Ensure `MODAL_ENDPOINT` is correct in `.env`
- Run `node modal/warm_modal.js` to wake up the GPU
- Check Modal deployment status

**"Screenshot tool failed"**
- On Linux: Install required screenshot dependencies
- On Windows: Ensure no security software is blocking screen capture
- Check display permissions in system settings

**"Arrow placement inaccurate"** 
- Verify UGround model is properly deployed
- Check screenshot quality and resolution
- Try warming up Modal GPU: `node modal/warm_modal.js --keep-warm`

### Performance Tips

- Run `node modal/warm_modal.js` before each session to avoid cold starts
- Keep WiseDragon window visible for optimal WebRTC performance
- Use `--keep-warm` flag for extended sessions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with various screen scenarios
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- OpenAI for the realtime API
- Modal for GPU infrastructure
- UGround team for the UI detection model
- Grounding DINO for object detection
- Exa for semantic search capabilities
