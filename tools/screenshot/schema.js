/**
 * Screenshot Tool Schema
 * 
 * Defines the OpenAI function calling schema for the screenshot tool.
 * This tells the model when and how to use the screenshot functionality.
 */

module.exports = {
  type: "function",
  name: "take_screenshot", 
  description: "Take a screenshot to see the user's screen",
  parameters: {
    type: "object",
    properties: {},
    required: []
  }
};
