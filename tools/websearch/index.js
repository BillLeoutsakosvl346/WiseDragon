/**
 * Web Search Tool
 * 
 * Allows the AI agent to search for UI tutorials and procedural guidance
 * when it needs step-by-step instructions for navigating apps/websites.
 * Does NOT provide real-time information (weather, prices, news, etc.)
 */

const schema = require('./schema');
const { execute } = require('./execute');

module.exports = {
  schema,
  executor: execute
};
