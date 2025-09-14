# Tools Documentation

## Screenshot vs Overlay Functions

This system has two separate screenshot-related functions that serve different purposes:

### 1. `take_screenshot` (Regular Screenshots)
- **Purpose**: Take screenshots for general description and analysis
- **Location**: `tools/screenshot/`
- **Behavior**: 
  - Takes clean screenshots without any overlays
  - Optimized for WebRTC with palette compression (8-64 colors)
  - Used when agent needs to see and describe what's on screen
  - No coordinate grid applied

### 2. `show_arrow_overlay` (AI-Powered Element Detection)
- **Purpose**: Point at specific UI elements using advanced computer vision
- **Location**: `tools/overlay/` + `tools/vision/`
- **Behavior**:
  - Agent provides text description of target element (e.g., "YouTube Like button")
  - Automatically takes a fresh screenshot
  - Sends screenshot and description to Modal-hosted UGround vision model
  - Vision model returns precise coordinates (0-1000 scale)
  - Automatically determines optimal arrow direction based on position
  - Places arrow at detected coordinates with high accuracy
  - Process is invisible to user - no technical details mentioned

## Workflow Examples

### Regular Description
```
User: "What's on my screen?"
Agent: calls take_screenshot()
→ Clean screenshot sent to agent
→ Agent describes what it sees
```

### Pointing at Elements
```
User: "Point to the Save button"
Agent: calls show_arrow_overlay()
→ Fresh screenshot taken for vision analysis
→ Agent provides description: {"description": "Save button in the toolbar"}
→ Vision model (UGround-V1-2B) analyzes screenshot and locates element
→ Returns precise coordinates: (750, 120) on 0-1000 scale
→ System determines direction: "left" (based on position)
→ Arrow appears on screen pointing accurately to Save button
→ Agent continues normal conversation (no mention of technical process)
```

## Key Differences

| Feature | take_screenshot | show_arrow_overlay |
|---------|----------------|-------------------|
| Coordinates | None | AI vision detection |
| Purpose | Description | One-shot pointing |
| Output | Clean image | Element-specific targeting |
| Agent Input | None required | Element description |
| Screen Effect | None | Arrow overlay |
| User Awareness | Visible process | Invisible technical process |
| Iterations | N/A | Single attempt only |
| Accuracy | N/A | Vision model precision |

## Coordinate System (Overlay Only)

- **Origin**: Top-left corner (0,0)  
- **Scale**: 0-100 for both X and Y axes
- **X-axis**: Left (0) → Right (100)
- **Y-axis**: Top (0) → Bottom (100)
- **Standard**: Matches typical screen/computer vision coordinate systems
- **Visible**: Red dots and coordinate labels
- **Agent Task**: Read coordinate numbers from image and specify location
