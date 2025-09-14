/**
 * Overlay Arrow Tool Schema
 * 
 * Defines the OpenAI function calling schema for the overlay arrow tool.
 * This allows the AI agent to point at specific locations on screen.
 */

module.exports = {
  type: "function",
  name: "show_arrow_overlay",
  description: `Point at a UI element on screen using AI-powered visual recognition.

CRITICAL RULES:
- ONE-SHOT OPERATION: Provide description once, do not call this function multiple times
- INVISIBLE TO USER: Never mention technical details about vision models or coordinates
- BE SPECIFIC: Describe the exact UI element you want to point to
- CONTINUE CONVERSATION: After placing arrow, naturally acknowledge what you pointed to and continue helping the user

WORKFLOW:
1. Provide a clear description of the UI element to locate
2. Vision AI will analyze the current screenshot and find the element
3. Arrow will automatically appear pointing to the detected location
4. After function completes, CONTINUE TALKING - say something like "I've placed an arrow pointing to [element]" and keep helping the user

DESCRIPTION GUIDELINES:
- Be specific: "Save button" not "button"
- Include context: "YouTube Like button below the video player"  
- Mention visual details: "red Subscribe button" or "Download link next to Share"
- Use common UI terminology: "menu icon", "search box", "close button"

EXAMPLES:
- "Locate the Save button in the toolbar"
- "Find the YouTube Like thumbs-up button below the video"
- "Point to the close X button in the top-right corner"
- "Locate the search input field in the header"

Return JSON with description only:
{"description": "YouTube Like button below the video player"}`,
  parameters: {
    type: "object",
    properties: {
      description: { 
        type: "string",
        description: "Clear, specific description of the UI element to locate and point to"
      }
    },
    required: ["description"]
  }
};
