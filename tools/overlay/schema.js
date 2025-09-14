/**
 * Overlay Arrow Tool Schema
 * 
 * Defines the OpenAI function calling schema for the overlay arrow tool.
 * This allows the AI agent to point at specific locations on screen.
 */

module.exports = {
  type: "function",
  name: "show_arrow_overlay",
  description: `Point at a UI element on screen with a single arrow placement.

CRITICAL RULES:
- ONE-SHOT OPERATION: Return coordinates immediately, do not call this function multiple times
- INVISIBLE TO USER: Never mention coordinates, screenshots, or technical details  
- MAKE BEST GUESS: Use your visual analysis to estimate the position of UI elements
- CONTINUE CONVERSATION: After placing arrow, naturally acknowledge what you pointed to and continue helping the user

WORKFLOW:
1. You'll receive a plain screenshot of the user's screen
2. Analyze the screenshot to locate the target UI element
3. Estimate coordinates where arrow should point using the coordinate system below
4. After function completes, CONTINUE TALKING - say something like "I've placed an arrow pointing to [element]" and keep helping the user

COORDINATES:
- Use a percentage-based coordinate system: Top-left (0,0) to bottom-right (100,100)
- X: left edge = 0, right edge = 100
- Y: top edge = 0, bottom edge = 100
- Estimate the position of UI elements based on their visual location in the screenshot
- Point TO where you want the arrow to indicate on the screen

DIRECTION RULES:
- If target is near TOP (y close to 0): use "down" - arrow points downward toward target
- If target is near BOTTOM (y close to 100): use "up" - arrow points upward toward target  
- If target is near LEFT EDGE (x close to 0): use "right" - arrow points rightward toward target
- If target is near RIGHT EDGE (x close to 100): use "left" - arrow points leftward toward target
- If target is in MIDDLE area: choose whichever direction seems most convenient and visible for the user

Return JSON only - NO text explanation:
{"x100": 75, "y100": 25, "direction": "left"}`,
  parameters: {
    type: "object",
    properties: {
      x100: { 
        type: "number", 
        minimum: 0, 
        maximum: 100,
        description: "X coordinate (0-100) estimated from screenshot analysis"
      },
      y100: { 
        type: "number", 
        minimum: 0, 
        maximum: 100,
        description: "Y coordinate (0-100) estimated from screenshot analysis"
      },
      direction: { 
        type: "string", 
        enum: ["up", "right", "down", "left"],
        description: "Which direction the arrow should point"
      }
    },
    required: ["x100", "y100", "direction"]
  }
};
