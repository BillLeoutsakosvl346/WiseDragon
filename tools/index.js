const screenshotTool = require('./screenshot');
const overlayTool = require('./overlay');

const tools = {
  [screenshotTool.schema.name]: screenshotTool,
  [overlayTool.schema.name]: overlayTool
};

function getToolSchemas() {
  return [screenshotTool.schema, overlayTool.schema];
}

async function executeTool(name, args) {
  const tool = tools[name];
  if (!tool) {
    throw new Error(`Tool '${name}' not found`);
  }
  
  return await tool.executor(args);
}

module.exports = { getToolSchemas, executeTool };
