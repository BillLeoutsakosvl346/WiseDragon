// preload.js
// Runs before your web page, in an isolated, privileged context.
// With contextIsolation: true and nodeIntegration: false in main.js,
// this is the safe way to let the renderer call into the main process.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('oai', {
  /**
   * Mint a short-lived Realtime session key via the main process.
   * Returns { value, expires_at, session } (per current API docs).
   *
   * Usage in renderer:
   * const { value: EPHEMERAL_KEY } = await window.oai.getEphemeral();
   */
  async getEphemeral() {
    const data = await ipcRenderer.invoke('oai:getEphemeral');
    // Minimal: assume modern response shape.
    if (!data || typeof data.value !== 'string') {
      throw new Error('Ephemeral key missing or invalid: ' + JSON.stringify(data));
    }
    return {
      value: data.value,
      expires_at: data.expires_at ?? null,
      session: data.session ?? null
    };
  },

  /**
   * Execute a tool in the main process via secure IPC.
   * Tools run with full system access in the main process while 
   * renderer stays sandboxed.
   *
   * Usage in renderer:
   * const result = await window.oai.executeTool('take_screenshot', {});
   *
   * @param {string} name - Tool name to execute
   * @param {Object} args - Tool arguments
   * @returns {Promise<any>} Tool execution result
   */
  async executeTool(name, args) {
    if (typeof name !== 'string') {
      throw new Error('Tool name must be a string');
    }
    if (args && typeof args !== 'object') {
      throw new Error('Tool args must be an object');
    }
    
    return await ipcRenderer.invoke('tool:execute', { name, args: args || {} });
  }
});
