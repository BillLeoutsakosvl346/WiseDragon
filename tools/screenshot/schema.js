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
Take a screenshot to see what's on the user's screen for better assistance. 
Use whenever the user mentions problems, applications, code, or errors.

BE PROACTIVE: Visual context dramatically improves your ability to help.
ANALYZE THOROUGHLY: Read all visible text, describe UI layout, quote specific error messages or labels.
`.trim(),
  parameters: {
    type: "object",
    properties: {},
    required: []
  }
};
