const { screen } = require('electron');
const fs = require('fs');
const path = require('path');
const { setLastScreenshot } = require('../overlay_context');
const { quickCapture, getAvailableMethods } = require('./fastCapture');
const { compressScreenshot } = require('./compress');
const sessionManager = require('../sessionManager');

async function execute(args = {}) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', '').substring(11, 23);
  console.log(`[${timestamp}] 📸 Starting unified screenshot capture (1366x768 PNG 64-color)`);
  
  try {
    // Step 1: Capture raw screenshot
    const frameData = await quickCapture();
    
    // Step 2: Compress to unified format
    const compressionStartTime = Date.now();
    const compressed = await compressScreenshot(frameData);
    const compressionDuration = Date.now() - compressionStartTime;
    
    // Get metadata 
    const disp = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const width = compressed.finalWidth;
    const height = compressed.finalHeight;
    
    // Create timestamp and filename
    const baseTimestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
    
    // Save single unified format (1366x768 for WebRTC compatibility)
    const filename = `${baseTimestamp}_${width}x${height}_${compressed.colors}colors.png`;
    const filePath = sessionManager.getScreenshotPath(filename);
    fs.writeFileSync(filePath, compressed.buffer);
    
    // Store metadata with single path
    setLastScreenshot({
      displayId: disp.id,
      displayBounds: disp.bounds,
      imageW: width,
      imageH: height,
      path: filePath
    });
    
    const duration = Date.now() - startTime;
    const endTimestamp = new Date().toISOString().replace('T', ' ').replace('Z', '').substring(11, 23);
    
    console.log(`[${endTimestamp}] 📸 Unified screenshot complete (${duration}ms):`);
    console.log(`[${endTimestamp}]   ⚡ Compression: ${compressionDuration}ms (BGRA→PNG 64-color)`);
    console.log(`[${endTimestamp}]   🎨 Universal: ${width}×${height}, ${(compressed.size/1000).toFixed(0)}KB, ${compressed.colors} colors PNG`);
    console.log(`[${endTimestamp}]   📡 WebRTC-friendly: Optimized for realtime API transmission`);
    console.log(`[${endTimestamp}]   📤 Ready for: Realtime GPT + UGround (Modal) + DINO (Replicate)`);
    console.log(`[${endTimestamp}] 📤 Capture method: ${frameData.method}`);
    
    return {
      success: true,
      // Universal data (works for everything)
      image: compressed.buffer.toString('base64'),
      imageFormat: 'png',
      width: width,
      height: height,
      source: frameData.method,
      colors: compressed.colors,
      fileSizeBytes: compressed.size,
      optimized: true,
      path: filePath,
      
      // Simplified metadata
      lastScreenshotMeta: { 
        imageW: width, 
        imageH: height, 
        displayBounds: disp.bounds, 
        path: filePath
      }
    };
    
  } catch (error) {
    console.error(`❌ Screenshot failed:`, error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { execute };
