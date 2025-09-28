const { contextBridge, ipcRenderer } = require('electron');

// Load prompts safely with error handling
let prompts = {};
try {
  const promptsModule = require('./prompts');
  prompts = {
    AUTO_ANALYSIS_AFTER_CLICK: promptsModule.AUTO_ANALYSIS_AFTER_CLICK,
    MANUAL_SCREENSHOT_ANALYSIS: promptsModule.MANUAL_SCREENSHOT_ANALYSIS,
    ARROW_PLACEMENT_SUCCESS: promptsModule.ARROW_PLACEMENT_SUCCESS
  };
} catch (error) {
  console.error('Failed to load prompts:', error);
  // Fallback prompts
  prompts = {
    AUTO_ANALYSIS_AFTER_CLICK: 'I just clicked where you told me. This is my current screen.',
    MANUAL_SCREENSHOT_ANALYSIS: (width, height) => `Screenshot of my screen (${width}×${height}). Please analyze this image.`,
    ARROW_PLACEMENT_SUCCESS: 'Arrow placed successfully. Continue conversation naturally.'
  };
}

contextBridge.exposeInMainWorld('oai', {
  async getEphemeral() {
    return await ipcRenderer.invoke('oai:getEphemeral');
  },

  async executeTool(name, args) {
    return await ipcRenderer.invoke('tool:execute', { name, args: args || {} });
  },

  async startAutoScreenshot() {
    return await ipcRenderer.invoke('start-auto-screenshot');
  }
});

contextBridge.exposeInMainWorld('electronAPI', {
  receive: (channel, func) => {
    const validChannels = ['auto-analyze-screenshot'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, func);
    }
  }
});

contextBridge.exposeInMainWorld('prompts', prompts);