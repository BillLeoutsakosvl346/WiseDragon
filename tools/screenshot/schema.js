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

BE PROACTIVE: When in doubt, take a screenshot. Visual context dramatically improves your ability to help users. This tool is fast and should be used generously to provide the best possible assistance.
`.trim(),
  parameters: {
    type: "object",
    properties: {},
    required: []
  }
};
