/**
 * Screenshot Tool
 * 
 * Allows the AI agent to capture screenshots of the user's screen
 * for better visual understanding and assistance.
 */

const schema = require('./schema');
const { execute } = require('./execute');

module.exports = {
  schema,
  executor: execute
};
