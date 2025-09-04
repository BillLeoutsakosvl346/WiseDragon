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
      
      // Validate tool exports
      if (!tool.schema || !tool.executor) {
        console.warn(`Tool ${displayName} missing required exports (schema, executor)`);
        return;
      }
      
      // Register tool
      const toolName = tool.schema.name;
      this.tools.set(toolName, tool);
      console.log(`Registered tool: ${toolName} (${displayName})`);
      
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
    console.log('🔧 === TOOL REGISTRY EXECUTION ===');
    console.log('🛠️ Requested tool:', name);
    console.log('📋 Tool arguments:', args);
    console.log('📊 Registry has', this.tools.size, 'registered tools');
    console.log('🔧 Available tools:', Array.from(this.tools.keys()));
    
    const executor = this.getToolExecutor(name);
    if (!executor) {
      console.error('❌ === TOOL NOT FOUND ===');
      console.error('🔍 Requested tool:', name);
      console.error('📋 Available tools:', Array.from(this.tools.keys()));
      throw new Error(`Tool '${name}' not found`);
    }
    
    console.log('✅ Tool executor found for:', name);
    console.log('🚀 Executing tool...');
    
    const startTime = Date.now();
    
    try {
      const result = await executor(args);
      const executionTime = Date.now() - startTime;
      
      console.log('✅ === TOOL REGISTRY EXECUTION COMPLETED ===');
      console.log('🛠️ Tool:', name);
      console.log('⏱️ Registry execution time:', executionTime + 'ms');
      console.log('📊 Result type:', typeof result);
      console.log('✅ Success:', result?.success);
      
      return result;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      console.error('❌ === TOOL REGISTRY EXECUTION FAILED ===');
      console.error('🛠️ Tool:', name);
      console.error('⏱️ Failed after:', executionTime + 'ms');
      console.error('💥 Error from tool:', error.message);
      console.error('🔍 Full error:', error);
      
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
