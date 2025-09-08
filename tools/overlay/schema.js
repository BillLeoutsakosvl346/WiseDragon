/**
 * Overlay Arrow Tool Schema
 * 
 * Defines the OpenAI function calling schema for the overlay arrow tool.
 * This allows the AI agent to point at specific locations on screen.
 */

module.exports = {
  type: "function",
  name: "show_arrow_overlay",
  description: `
Show a transparent click-through arrow overlay at a screen location.

When you've just requested a screenshot, you must use basis='box_norm' with the bounding box of the target UI element; otherwise use basis='image_norm' with a point. Only use screen_px if normalized output is impossible.

Preferred usage:
- If you just looked at a screenshot, return normalized coordinates relative
  to THAT image: either a point {x_norm,y_norm} or a box {x0,y0,x1,y1}, with basis 'image_norm' or 'box_norm'.
- Only fall back to absolute screen pixels {x,y} with basis 'screen_px' when normalized is impossible.
`.trim(),
  parameters: {
    type: "object",
    properties: {
      basis: {
        type: "string",
        enum: ["image_norm", "box_norm", "screen_px"],
        description: "How the target is specified."
      },
      direction: {
        type: "string",
        enum: ["up", "down", "left", "right"],
        description: "Direction the arrow should point."
      },
      // Preferred: normalized point in the last screenshot
      x_norm: { type: "number", minimum: 0, maximum: 1 },
      y_norm: { type: "number", minimum: 0, maximum: 1 },
      // Or a normalized box in the last screenshot; arrow will aim at its center
      box: {
        type: "object",
        properties: {
          x0: { type: "number", minimum: 0, maximum: 1 },
          y0: { type: "number", minimum: 0, maximum: 1 },
          x1: { type: "number", minimum: 0, maximum: 1 },
          y1: { type: "number", minimum: 0, maximum: 1 }
        },
        required: ["x0", "y0", "x1", "y1"]
      },
      // Legacy/optional absolute screen coordinates (DIPs)
      x: { type: "number" },
      y: { type: "number" },
      // Optional cosmetics
      color: { type: "string", default: "black" },
      opacity: { type: "number", minimum: 0, maximum: 1, default: 0.95 },
      duration_ms: { type: "number", default: 10000 }
    },
    required: ["basis", "direction"]
  }
};
