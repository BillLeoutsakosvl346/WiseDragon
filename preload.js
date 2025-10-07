const { contextBridge, ipcRenderer } = require('electron');

// Load prompts safely with error handling
let prompts = {};
try {
  const promptsModule = require('./prompts');
  prompts = {
    AUTO_ANALYSIS_AFTER_CLICK: promptsModule.AUTO_ANALYSIS_AFTER_CLICK,
    INITIAL_GREETING_PROMPT: promptsModule.INITIAL_GREETING_PROMPT,
    MANUAL_SCREENSHOT_ANALYSIS: promptsModule.MANUAL_SCREENSHOT_ANALYSIS
  };
} catch (error) {
  console.error('Failed to load prompts:', error);
  // Fallback prompts
  prompts = {
    AUTO_ANALYSIS_AFTER_CLICK: 'I just clicked where you told me. This is my current screen.',
    INITIAL_GREETING_PROMPT: 'The user just connected. Introduce yourself.',
    MANUAL_SCREENSHOT_ANALYSIS: (width, height) => `Screenshot of my screen (${width}×${height}). Please analyze this image.`
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