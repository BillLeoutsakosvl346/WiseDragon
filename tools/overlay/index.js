/**
 * Overlay Arrow Tool
 * 
 * Allows the AI agent to show directional arrows on screen overlays
 * to point at specific UI elements and guide user attention.
 */

const schema = require('./schema');
const { execute, cleanupOverlays } = require('./execute');

module.exports = {
  schema,
  executor: execute,
  cleanupOverlays
};
