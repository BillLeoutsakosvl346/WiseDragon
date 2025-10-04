const screenshotTool = require('./screenshot');
const overlayTool = require('./overlay');
const websearchTool = require('./websearch');

const tools = {
  [screenshotTool.schema.name]: screenshotTool,
  [overlayTool.schema.name]: overlayTool,
  [websearchTool.schema.name]: websearchTool
};

function getToolSchemas() {
  return [screenshotTool.schema, overlayTool.schema, websearchTool.schema];
}

async function executeTool(name, args) {
  const tool = tools[name];
  if (!tool) {
    throw new Error(`Tool '${name}' not found`);
  }
  
  return await tool.executor(args);
}

module.exports = { getToolSchemas, executeTool };
