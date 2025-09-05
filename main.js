const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Load tool registry for secure tool execution
const toolRegistry = require('./tools');

// Now this works because .env has been loaded into process.env:
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY not set (put it in .env or set env var)');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

ipcMain.handle('oai:getEphemeral', async () => {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  
  const toolSchemas = toolRegistry.getToolSchemas();
  
  const r = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      session: {
        type: 'realtime',
        model: 'gpt-realtime',
        audio: { output: { voice: 'marin' } },
        tools: toolSchemas,
        tool_choice: 'auto'
      }
    })
  });

  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Mint failed: ${r.status} ${text}`);
  }

  return r.json();
});

// Tool execution IPC handler
ipcMain.handle('tool:execute', async (event, { name, args }) => {
  try {
    if (typeof name !== 'string') {
      throw new Error('Tool name must be a string');
    }
    if (args && typeof args !== 'object') {
      throw new Error('Tool args must be an object');
    }

    const result = await toolRegistry.executeTool(name, args);
    return result;

  } catch (error) {
    return {
      success: false,
      error: error.message,
      tool: name,
      timestamp: Date.now()
    };
  }
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

