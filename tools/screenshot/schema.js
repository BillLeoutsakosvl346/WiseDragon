/**
 * Screenshot Tool Schema
 * 
 * Defines the OpenAI function calling schema for the screenshot tool.
 * This tells the model when and how to use the screenshot functionality.
 */

module.exports = {
  type: "function",
  name: "take_screenshot", 
  description: "IMMEDIATELY take a FRESH screenshot to see what's currently on the user's screen. Users change screens constantly - NEVER rely on previous screenshots. Use this proactively for ANY screen-related question and whenever you suspect the screen might have changed. If user asks 'do you see my screen now?' multiple times, take a new screenshot each time. Be extremely willing to use this tool liberally - essential for accurate guidance.",
  parameters: {
    type: "object",
    properties: {},
    required: []
  }
};
