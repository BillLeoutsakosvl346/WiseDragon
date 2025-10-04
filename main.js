const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const toolRegistry = require('./tools');
const sessionManager = require('./tools/sessionManager');
const { startAutoScreenshotCapture, stopAutoScreenshotCapture } = require('./tools/overlay/screen-state');
const { getCurrentScreenContext, logSystemStatus } = require('./tools/overlay/screen-state');
const { SYSTEM_INSTRUCTIONS, getEnhancedInstructions } = require('./prompts');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY not set (put it in .env or set env var)');
}

let mainWindow = null; // Reference to main window for IPC communication

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

  mainWindow = win; // Store reference for IPC communication
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

ipcMain.handle('oai:getEphemeral', async () => {
  const toolSchemas = toolRegistry.getToolSchemas();
  
  // Get enhanced instructions with current screen context
  const screenContext = getCurrentScreenContext();
  const enhancedInstructions = getEnhancedInstructions(SYSTEM_INSTRUCTIONS, screenContext);
  
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
        audio: { 
          output: { 
            voice: 'ash',
            speed: 1.15  // 15% faster than default
          } 
        },
        tools: toolSchemas,
        tool_choice: 'auto',
        instructions: enhancedInstructions
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
    console.error(`[${new Date().toISOString().replace('T', ' ').replace('Z', '').substring(11, 23)}] Tool execution failed:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

// Start auto-screenshot system when user connects
ipcMain.handle('start-auto-screenshot', async () => {
  try {
    await startAutoScreenshotCapture((screenshotResult) => {
      // Send screenshot to renderer for automatic analysis
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('auto-analyze-screenshot', screenshotResult);
      }
    });
    
    console.log(`[${new Date().toISOString().replace('T', ' ').replace('Z', '').substring(11, 23)}] 📸 Auto-screenshot system started after connection`);
    return { success: true };
  } catch (error) {
    console.error(`[${new Date().toISOString().replace('T', ' ').replace('Z', '').substring(11, 23)}] Failed to start auto-screenshot:`, error.message);
    return { success: false, error: error.message };
  }
});


app.whenReady().then(async () => {
  // Start a new screenshot session when the app launches
  sessionManager.startNewSession();
  
  console.log(`[${new Date().toISOString().replace('T', ' ').replace('Z', '').substring(11, 23)}] 🚀 WiseDragon ready - click Connect to start`);
  
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // Stop automatic screenshot capture
  stopAutoScreenshotCapture();
  
  // End the current session and log statistics
  sessionManager.endSession();
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

