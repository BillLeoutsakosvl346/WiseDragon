const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('oai', {
  async getEphemeral() {
    return await ipcRenderer.invoke('oai:getEphemeral');
  },

  async executeTool(name, args) {
    return await ipcRenderer.invoke('tool:execute', { name, args: args || {} });
  }
});
