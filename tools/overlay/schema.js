/**
 * Overlay Arrow Tool Schema
 * 
 * Defines the OpenAI function calling schema for the overlay arrow tool.
 * This allows the AI agent to point at specific locations on screen.
 */

module.exports = {
  type: "function",
  name: "show_arrow_overlay",
  description: "Point an arrow at a UI element on screen. Describe the element clearly.",
  parameters: {
    type: "object",
    properties: {
      description: { 
        type: "string",
        description: "UI element to point to"
      }
    },
    required: ["description"]
  }
};
