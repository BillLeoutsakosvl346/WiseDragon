const fs = require('fs');
const path = require('path');

class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.loadTools();
  }

  loadTools() {
    const items = fs.readdirSync(__dirname);
    
    for (const item of items) {
      const itemPath = path.join(__dirname, item);
      if (fs.statSync(itemPath).isDirectory()) {
        const indexPath = path.join(itemPath, 'index.js');
        if (fs.existsSync(indexPath)) {
          try {
            const tool = require(indexPath);
            if (tool.schema && tool.executor) {
              this.tools.set(tool.schema.name, tool);
              console.log(`Registered tool: ${tool.schema.name}`);
            }
          } catch (error) {
            console.error(`Failed to load tool ${item}:`, error.message);
          }
        }
      }
    }
  }

  getToolSchemas() {
    return Array.from(this.tools.values()).map(tool => tool.schema);
  }

  async executeTool(name, args) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool '${name}' not found`);
    }
    return await tool.executor(args);
  }
}

module.exports = new ToolRegistry();
