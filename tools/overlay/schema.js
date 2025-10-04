/**
 * Overlay Arrow Tool Schema
 * 
 * Defines the OpenAI function calling schema for the overlay arrow tool.
 * This allows the AI agent to point at specific locations on screen using different vision models.
 */

module.exports = {
  type: "function",
  name: "show_arrow_overlay",
  description: "Show a golden arrow pointing at screen elements when the user needs visual guidance for non-obvious tasks. DO NOT use for extremely easy/common tasks (opening Start menu, going to YouTube/Settings, clicking taskbar, basic navigation users have done many times). ONLY use when the user genuinely needs help finding something specific or less obvious. The arrow is click-through and stays visible until user interacts. Use for questions like 'where is [specific setting]...', 'help me find [specific feature]...', 'how do I access [specific tool]...'. Choose UGround for UI elements (buttons, menus, text fields), Grounding DINO for real-world objects (animals, buildings, people, etc.).",
  parameters: {
    type: "object",
    properties: {
      description: { 
        type: "string",
        description: "Analytical description of what to point to. Be thorough: describe the object/element, its approximate location (left/right/top/bottom of screen), what it looks like, and what it's near or next to. For UI elements use simple names like 'login button' or 'search field'. For real objects be descriptive like 'brown dog sitting in bottom-left corner near the fence'."
      },
      vision_model: {
        type: "string",
        enum: ["uground", "grounding_dino"],
        description: "Vision model to use. Choose 'uground' for UI elements (buttons, labels, text fields, menus, icons, etc.). Choose 'grounding_dino' for real-world objects, people, animals, buildings, vehicles, food, etc. - anything that's not a user interface element."
      },
      target_area: {
        type: "string",
        enum: ["top-left", "top-right", "bottom-left", "bottom-right", "center"],
        description: "Optional: approximate area where the target is located to improve detection accuracy"
      }
    },
    required: ["description", "vision_model"]
  }
};
