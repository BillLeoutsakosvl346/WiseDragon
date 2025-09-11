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

### 2. `show_arrow_overlay` (Coordinate-Based Pointing)
- **Purpose**: Point at specific UI elements using a coordinate system
- **Location**: `tools/overlay/`
- **Behavior**:
  - Automatically takes a fresh screenshot
  - Applies 8×6 coordinate grid overlay (0-100 scale, red dots/numbers)
  - Sends coordinate-overlaid image to agent via WebRTC
  - Agent uses helper grid overlay to locate target elements
  - Agent makes ONE-SHOT decision using visible grid numbers
  - Places arrow at specified coordinates and task is complete
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
→ Fresh screenshot taken + 8×6 coordinate grid applied
→ Coordinate-overlaid image sent to agent
→ Agent sees helper grid overlay and locates Save button
→ Agent responds once: {"x100":75,"y100":25,"direction":"left"}
→ Arrow appears on screen pointing to Save button
→ Agent continues normal conversation (no mention of technical process)
```

## Key Differences

| Feature | take_screenshot | show_arrow_overlay |
|---------|----------------|-------------------|
| Coordinates | None | 0-100 grid overlay |
| Purpose | Description | One-shot pointing |
| Output | Clean image | Grid-overlaid image |
| Agent Input | None required | x100, y100, direction |
| Screen Effect | None | Arrow overlay |
| User Awareness | Visible process | Invisible technical process |
| Iterations | N/A | Single attempt only |

## Coordinate System (Overlay Only)

- **Origin**: Top-left corner (0,0)  
- **Scale**: 0-100 for both X and Y axes
- **X-axis**: Left (0) → Right (100)
- **Y-axis**: Top (0) → Bottom (100)
- **Standard**: Matches typical screen/computer vision coordinate systems
- **Visible**: Red dots and coordinate labels
- **Agent Task**: Read coordinate numbers from image and specify location
