const fs = require('fs');
const path = require('path');

/**
 * Tool Registry - Central system for managing and executing tools
 * 
 * Each tool should export:
 * - schema: OpenAI function calling schema
 * - executor: async function that implements the tool
 */
class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.loadTools();
  }

  /**
   * Auto-discover and load all tools from the tools directory
   */
  loadTools() {
    const toolsDir = __dirname;
    this._scanDirectory(toolsDir);
  }

  /**
   * Recursively scan directory for tools
   */
  _scanDirectory(directory) {
    const items = fs.readdirSync(directory);
    
    for (const item of items) {
      const itemPath = path.join(directory, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        // Look for index.js in subdirectories
        const indexPath = path.join(itemPath, 'index.js');
        if (fs.existsSync(indexPath)) {
          this._loadTool(indexPath, `${item}/index.js`);
        }
      } else if (item.endsWith('.js') && item !== 'index.js') {
        // Load direct .js files (skip main index.js)
        this._loadTool(itemPath, item);
      }
    }
  }

  /**
   * Load a single tool file
   */
  _loadTool(toolPath, displayName) {
    try {
      const tool = require(toolPath);
      
      if (!tool.schema || !tool.executor) {
        console.warn(`Tool ${displayName} missing required exports`);
        return;
      }
      
      const toolName = tool.schema.name;
      this.tools.set(toolName, tool);
      console.log(`Registered tool: ${toolName}`);
      
    } catch (error) {
      console.error(`Failed to load tool ${displayName}:`, error.message);
    }
  }

  /**
   * Get all tool schemas for session configuration
   * @returns {Array} Array of OpenAI function schemas
   */
  getToolSchemas() {
    const schemas = [];
    for (const tool of this.tools.values()) {
      schemas.push(tool.schema);
    }
    return schemas;
  }

  /**
   * Get tool executor by name
   * @param {string} name - Tool name
   * @returns {Function|null} Tool executor function
   */
  getToolExecutor(name) {
    const tool = this.tools.get(name);
    return tool ? tool.executor : null;
  }

  /**
   * Execute a tool by name with given arguments
   * @param {string} name - Tool name
   * @param {Object} args - Tool arguments
   * @returns {Promise<any>} Tool execution result
   */
  async executeTool(name, args) {
    const executor = this.getToolExecutor(name);
    if (!executor) {
      throw new Error(`Tool '${name}' not found`);
    }
    
    try {
      const result = await executor(args);
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get list of registered tool names
   * @returns {Array<string>} Tool names
   */
  getToolNames() {
    return Array.from(this.tools.keys());
  }
}

// Create singleton instance
const toolRegistry = new ToolRegistry();

// Export convenience functions
module.exports = {
  getToolSchemas: () => toolRegistry.getToolSchemas(),
  getToolExecutor: (name) => toolRegistry.getToolExecutor(name),
  executeTool: (name, args) => toolRegistry.executeTool(name, args),
  getToolNames: () => toolRegistry.getToolNames(),
  registry: toolRegistry
};
