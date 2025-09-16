const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const toolRegistry = require('./tools');
const sessionManager = require('./tools/sessionManager');

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

ipcMain.handle('tool:execute', async (event, { name, args }) => {
  try {
    return await toolRegistry.executeTool(name, args);
  } catch (error) {
    console.error('Tool execution failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

app.whenReady().then(() => {
  // Start a new screenshot session when the app launches
  sessionManager.startNewSession();
  
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // End the current session and log statistics
  sessionManager.endSession();
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

