/**
 * Screenshot Tool Schema
 * 
 * Defines the OpenAI function calling schema for the screenshot tool.
 * This tells the model when and how to use the screenshot functionality.
 */

module.exports = {
  type: "function",
  name: "take_screenshot", 
  description: "Take a fresh screenshot to see current screen state. Use when: user asks about their screen, you need to guide them, OR you see loading indicators (spinners, 'Loading...', blank screens). If you see ANY loading state, stay SILENT and immediately call this again - repeat silently until fully loaded. Also use proactively when screen might have changed.",
  parameters: {
    type: "object",
    properties: {},
    required: []
  }
};
