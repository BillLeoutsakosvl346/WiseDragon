/**
 * Web Search Tool Schema
 * 
 * Defines the OpenAI function calling schema for the web search tool.
 * This allows the AI agent to search the internet for current information.
 */

module.exports = {
  type: "function",
  name: "search_web",
  description: "Search for HOW TO do something on screen - find tutorials, procedures, and step-by-step guides for using apps/websites. Use ONLY for procedural information when uncertain about UI navigation steps. DO NOT use for real-time information (weather, prices, news, current data). Make queries analytical and procedure-focused: 'how to configure X in Y', 'steps to enable Z feature'. Before calling, briefly say you're looking up instructions. Use SPARINGLY - only when truly needed for accurate screen guidance.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Analytical search query focused on procedures and tutorials. Format like 'how to [action] in [app/website]' or 'steps to [accomplish task] on [platform]'. Be specific about the app/website and the desired action. DO NOT search for real-time data."
      },
      reason: {
        type: "string", 
        description: "Brief explanation of what UI procedure/tutorial you need - what specific navigation steps you're uncertain about."
      }
    },
    required: ["query", "reason"]
  }
};
