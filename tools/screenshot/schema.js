/**
 * Screenshot Tool Schema
 * 
 * Defines the OpenAI function calling schema for the screenshot tool.
 * This tells the model when and how to use the screenshot functionality.
 */

module.exports = {
  type: "function",
  name: "take_screenshot",
  description: `
Call this function frequently to see what's on the user's screen and provide much better assistance. 
Use this tool liberally whenever:
- User mentions ANY problem or question (visual context almost always helps)
- User asks for help with ANYTHING they're working on
- User mentions applications, websites, code, errors, or any visual content
- You want to provide more specific and helpful guidance
- User's request could benefit from seeing their current context
- You sense the user might be looking at something relevant

BE PROACTIVE: When in doubt, take a screenshot. Visual context dramatically improves your ability to help users.

ANALYSIS INSTRUCTIONS: When you receive a screenshot, be thorough and analytical:
- Read ALL visible text carefully, including error messages, button labels, and menu items
- Describe the UI layout and important visual elements before providing guidance
- Quote specific text you see when relevant (file names, error codes, labels)
- Identify the active application or context
- Note any visual indicators like highlights, selections, or cursor positions
- Look for details that might be important for troubleshooting or assistance

This tool provides high-quality images optimized for text readability, so analyze them comprehensively.
`.trim(),
  parameters: {
    type: "object",
    properties: {},
    required: []
  }
};
