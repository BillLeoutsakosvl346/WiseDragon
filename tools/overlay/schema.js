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
- INVISIBLE TO USER: Never mention coordinates, grids, screenshots, or technical details  
- MAKE BEST GUESS: Use your judgment to extrapolate from what you see
- CONTINUE CONVERSATION: After placing arrow, naturally acknowledge what you pointed to and continue helping the user

WORKFLOW:
1. You'll receive a screenshot with coordinate grid overlay (8×6 grid)
2. IMPORTANT: The red dots and coordinate numbers are HELPER OVERLAYS only - they are NOT part of the actual screen content
3. Use these helper coordinates to locate the target element  
4. Return coordinates where arrow should point (top-left is 0,0)
5. After function completes, CONTINUE TALKING - say something like "I've placed an arrow pointing to [element]" and keep helping the user

COORDINATES:
- The red grid dots and numbers are REFERENCE HELPERS only - not actual screen elements
- IMPORTANT: The coordinate numbers (like "25,50") show the EXACT LOCATION of each red dot, NOT the location of the text itself
- The text is positioned near each dot for readability, but the coordinates refer to the dot's position
- Use these dot locations to specify where to point
- Top-left (0,0) to bottom-right (100,100) 
- X: left to right (0→100), Y: top to bottom (0→100)
- Point TO where you want the arrow to indicate on the ACTUAL screen content

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
        description: "X coordinate (0-100) from the visible grid"
      },
      y100: { 
        type: "number", 
        minimum: 0, 
        maximum: 100,
        description: "Y coordinate (0-100) from the visible grid"
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
