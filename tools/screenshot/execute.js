const { screen } = require('electron');
const fs = require('fs');
const path = require('path');
const { setLastScreenshot } = require('../overlay_context');
const { quickCapture, getAvailableMethods } = require('./fastCapture');
const { adaptiveCompress } = require('./fastCompress');

async function execute(args) {
  const start = performance.now();
  console.log('📸 Fast screenshot capture');
  
  try {
    // Step 1: Capture
    const captureStart = performance.now();
    const frameData = await quickCapture();
    const captureTime = performance.now() - captureStart;
    console.log(`📷 Capture step: ${captureTime.toFixed(0)}ms`);
    
    // Step 2: Compress  
    const compressStart = performance.now();
    const compressed = await adaptiveCompress(frameData, 150);
    const compressTime = performance.now() - compressStart;
    console.log(`🎨 Compression step: ${compressTime.toFixed(0)}ms`);
    
    // Get metadata and save
    const disp = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const width = compressed.finalWidth || frameData.width || 1366;
    const height = compressed.finalHeight || frameData.height || 768;
    
    const screenshotsDir = path.join(__dirname, '..', '..', 'screenshots_seen');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
    const filename = `${timestamp}_${width}x${height}_${compressed.colors}colors.png`;
    const filePath = path.join(screenshotsDir, filename);
    
    fs.writeFileSync(filePath, compressed.buffer);
    
    // Store metadata
    setLastScreenshot({
      displayId: disp.id,
      displayBounds: disp.bounds,
      imageW: width,
      imageH: height,
      path: filePath
    });
    
    const totalTime = performance.now() - start;
    console.log(`📸 Screenshot: ${width}×${height}, ${(compressed.size/1000).toFixed(0)}KB, ${totalTime.toFixed(0)}ms`);
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
    const totalTime = performance.now() - start;
    console.error(`❌ Screenshot failed after ${totalTime.toFixed(0)}ms:`, error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { execute };
