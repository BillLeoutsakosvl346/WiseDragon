const { contextBridge, ipcRenderer } = require('electron');

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