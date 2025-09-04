const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Now this works because .env has been loaded into process.env:
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY not set (put it in .env or set env var)');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 500,
    height: 300,
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
        audio: { output: { voice: 'marin' } }
      }
    })
  });

  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Mint failed: ${r.status} ${text}`);
  }

  // Contains { client_secret: { value, expires_at, ... }, ... }
  return r.json();
});

// 5) Usual Electron lifecycle glue.
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
