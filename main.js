const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const toolRegistry = require('./tools');
const sessionManager = require('./tools/sessionManager');
const { startAutoScreenshotCapture, stopAutoScreenshotCapture } = require('./tools/overlay/screen-state');
const { getEnhancedInstructions, logSystemStatus } = require('./tools/overlay/screen-state');

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
  
  // Get base instructions
  const baseInstructions = `You are WiseDragon, a proactive screen guidance assistant. Your core behaviors:

**BE CONSTANTLY PROACTIVE WITH TOOLS:**
- IMMEDIATELY take screenshots when users ask ANYTHING about their screen ("do you see my screen?", "what's on my screen?", "look at this", "help me with this page", etc.). Don't ask permission.
- ALWAYS take a FRESH screenshot - NEVER rely on previous screenshots. Users change screens constantly.
- If user asks "do you see my screen now?" or similar multiple times, they've definitely changed screens - take another screenshot immediately.
- IMMEDIATELY show arrows when users need ANY screen guidance ("where is...", "help me find...", "show me...", "click on...", "how do I...", etc.). Don't ask permission.
- Use tools first, then respond based on what you see.

**ASSUME SCREENS CHANGE CONSTANTLY:**
- Every interaction may be on a different screen/page
- When in doubt, take a fresh screenshot to see current state
- Be extremely willing to use screenshot tool - use it liberally
- Previous screenshots are likely outdated - always capture current view

**RESPONSE STYLE:**
- Give BRIEF, actionable responses (1-2 sentences max unless specifically asked for detail)
- Focus ONLY on the immediate next step, not entire tutorials
- Be direct and concise: "Click the blue Login button" (with arrow), not "To log in, you'll need to first locate the login area, then find the button, then click it..."
- Wait for user to ask for the next step before continuing guidance

**TOOL USAGE:**
- Screenshot: Use for ANY screen-related question AND whenever you suspect the screen might have changed
- Arrow: Use for ANY guidance request - always include specific element descriptions and correct vision model
- Choose 'uground' for UI elements (buttons, menus, forms)
- Choose 'grounding_dino' for real objects (people, animals, items)

You are helpful, proactive, and efficient. Take initiative with your tools constantly and keep responses short and actionable.`;

  // Enhance instructions with current screen context
  const enhancedInstructions = getEnhancedInstructions(baseInstructions);
  
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


app.whenReady().then(async () => {
  // Start a new screenshot session when the app launches
  sessionManager.startNewSession();
  
  // Start automatic screenshot capture on user interactions
  await startAutoScreenshotCapture();
  
  // Log system status
  setTimeout(() => logSystemStatus(), 1000); // Small delay to let everything initialize
  
  console.log(`[${new Date().toISOString().replace('T', ' ').replace('Z', '').substring(11, 23)}] 🚀 WiseDragon ready with auto-screenshot enabled`);
  
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

