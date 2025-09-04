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
  
  // Get tool schemas for session registration
  const toolSchemas = toolRegistry.getToolSchemas();
  console.log(`Registering ${toolSchemas.length} tools with OpenAI session:`, 
    toolSchemas.map(t => t.name).join(', '));
  
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

  // Contains { client_secret: { value, expires_at, ... }, ... }
  return r.json();
});

// Tool execution IPC handler
ipcMain.handle('tool:execute', async (event, { name, args }) => {
  console.log('🔧 === IPC TOOL EXECUTION REQUEST ===');
  console.log('🛠️ Tool name:', name);
  console.log('📋 Arguments:', JSON.stringify(args, null, 2));
  console.log('🔒 Executing in main process (secure)');
  console.log('⏰ Request time:', new Date().toISOString());
  
  const startTime = Date.now();
  
  try {
    // Validate inputs
    if (typeof name !== 'string') {
      throw new Error('Tool name must be a string');
    }
    if (args && typeof args !== 'object') {
      throw new Error('Tool args must be an object');
    }

    console.log('✅ Input validation passed');
    console.log('🔍 Looking up tool in registry...');

    // Execute tool via registry
    const result = await toolRegistry.executeTool(name, args);
    const executionTime = Date.now() - startTime;
    
    console.log('✅ === IPC TOOL EXECUTION COMPLETED ===');
    console.log('⏱️ Total execution time:', executionTime + 'ms');
    console.log('🎯 Tool:', name);
    console.log('📊 Result summary:', {
      success: result.success,
      hasImage: result.image ? 'yes' : 'no',
      imageSize: result.image ? `${Math.round(result.image.length / 1024)}KB` : 'n/a',
      source: result.source,
      width: result.width,
      height: result.height
    });
    
    if (result.success && name === 'take_screenshot') {
      console.log('📷 Screenshot capture successful!');
      console.log('🖼️ Image details:', {
        dimensions: `${result.width}x${result.height}`,
        base64Length: result.image.length,
        sizeKB: Math.round(result.image.length / 1024),
        timestamp: new Date(result.timestamp).toISOString()
      });
    }
    
    return result;

  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    console.error('❌ === IPC TOOL EXECUTION FAILED ===');
    console.error('⏱️ Failed after:', executionTime + 'ms');
    console.error('🛠️ Tool:', name);
    console.error('💥 Error type:', error.name);
    console.error('📝 Error message:', error.message);
    console.error('🔍 Full error:', error);
    console.error('📋 Stack trace:', error.stack);
    
    // Return error in a consistent format
    const errorResult = {
      success: false,
      error: error.message,
      tool: name,
      executionTime: executionTime,
      timestamp: Date.now()
    };
    
    console.log('📤 Returning error result to renderer:', errorResult);
    return errorResult;
  }
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
