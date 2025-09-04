# Tools Directory

This directory contains all tools available to the voice agent. Tools are automatically discovered and registered by the central registry.

## Tool Structure

Each tool should be a separate `.js` file that exports:

```javascript
module.exports = {
  // OpenAI function calling schema
  schema: {
    type: "function",
    name: "tool_name",
    description: "What this tool does",
    parameters: {
      type: "object",
      properties: {
        // Parameter definitions
      },
      required: ["param1", "param2"]
    }
  },
  
  // Implementation function
  executor: async (args) => {
    // Tool implementation
    return result;
  }
};
```

## Adding New Tools

1. Create a new `.js` file in this directory
2. Follow the structure above
3. The tool will be automatically discovered and registered
4. Tool becomes available in voice conversations immediately

## Available Tools

Tools are auto-discovered. Check console output during startup to see registered tools.

## Integration

Tools integrate with:
- OpenAI Realtime API function calling
- Electron main process (secure execution)
- WebRTC data channel events
- Conversation context injection
