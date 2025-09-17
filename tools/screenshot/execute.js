const { screen } = require('electron');
const fs = require('fs');
const path = require('path');
const { setLastScreenshot } = require('../overlay_context');
const { quickCapture, getAvailableMethods } = require('./fastCapture');
const { adaptiveCompress } = require('./fastCompress');
const sessionManager = require('../sessionManager');

async function execute(args) {
  console.log('📸 Fast screenshot capture');
  
  try {
    // Step 1: Capture
    const frameData = await quickCapture();
    
    // Step 2: Compress  
    const compressed = await adaptiveCompress(frameData, 150);
    
    // Get metadata and save
    const disp = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const width = compressed.finalWidth || frameData.width || 1366;
    const height = compressed.finalHeight || frameData.height || 768;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
    const filename = `${timestamp}_${width}x${height}_${compressed.colors}colors.png`;
    const filePath = sessionManager.getScreenshotPath(filename);
    
    fs.writeFileSync(filePath, compressed.buffer);
    
    // Store metadata
    setLastScreenshot({
      displayId: disp.id,
      displayBounds: disp.bounds,
      imageW: width,
      imageH: height,
      path: filePath
    });
    
    console.log(`📸 Screenshot: ${width}×${height}, ${(compressed.size/1000).toFixed(0)}KB`);
    console.log(`📤 Ready for model: ${frameData.method} capture`);
    
    return {
      success: true,
      image: compressed.buffer.toString('base64'),
      imageFormat: 'png',
      width,
      height,
      source: frameData.method,
      paletteColors: compressed.colors,
      fileSizeBytes: compressed.size,
      quantized: true,
      lastScreenshotMeta: { imageW: width, imageH: height, displayBounds: disp.bounds, path: filePath }
    };
    
  } catch (error) {
    console.error(`❌ Screenshot failed:`, error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { execute };
