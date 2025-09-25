const { screen } = require('electron');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { setLastScreenshot } = require('../overlay_context');
const sessionManager = require('../sessionManager');

// Simple capture using robotjs (remove fallbacks for simplicity)
let robotjs;
try {
  robotjs = require('@jitsi/robotjs');
} catch (err) {
  try {
    robotjs = require('robotjs');
  } catch (err2) {
    console.error('RobotJS not available. Install with: npm install @jitsi/robotjs');
  }
}

/**
 * Capture screenshot using robotjs
 */
async function captureScreenshot() {
  if (!robotjs) {
    throw new Error('RobotJS not available for screenshot capture');
  }
  
  const screenSize = robotjs.getScreenSize();
  const bitmap = robotjs.screen.capture(0, 0, screenSize.width, screenSize.height);
  
  return {
    buffer: bitmap.image,
    width: bitmap.width,
    height: bitmap.height,
    format: 'BGRA'
  };
}

/**
 * Compress screenshot to 1366x768 PNG with 64-color quantization
 */
async function compressToUnifiedFormat(frameData) {
  const { buffer, width, height, format } = frameData;
  
  if (format !== 'BGRA') {
    throw new Error(`Unsupported format: ${format}. Expected BGRA.`);
  }
  
  const result = await sharp(buffer, { raw: { width, height, channels: 4 } })
    .removeAlpha()
    .recomb([
      [0, 0, 1], // B->R  
      [0, 1, 0], // G->G
      [1, 0, 0], // R->B
    ])
    .resize(1366, 768, { fit: 'fill', kernel: 'mitchell' })
    .png({
      palette: true,
      colours: 64,
      dither: 0,
      compressionLevel: 6,
      effort: 3
    })
    .toBuffer();
  
  return {
    buffer: result,
    size: result.length,
    colors: 64,
    finalWidth: 1366,
    finalHeight: 768
  };
}

/**
 * Main screenshot execution function
 */
async function execute(args = {}) {
  const startTime = Date.now();
  const timestamp = () => new Date().toISOString().substring(11, 23);
  
  console.log(`[${timestamp()}] 📸 Taking screenshot...`);
  
  try {
    // Capture raw screenshot
    const frameData = await captureScreenshot();
    
    // Compress to unified format
    const compressed = await compressToUnifiedFormat(frameData);
    
    // Get display info
    const disp = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const width = compressed.finalWidth;
    const height = compressed.finalHeight;
    
    // Create filename with timestamp
    const baseTimestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
    const filename = `${baseTimestamp}_${width}x${height}_${compressed.colors}colors.png`;
    const filePath = sessionManager.getScreenshotPath(filename);
    
    // Save screenshot
    fs.writeFileSync(filePath, compressed.buffer);
    
    // Store metadata
    setLastScreenshot({
      displayId: disp.id,
      displayBounds: disp.bounds,
      imageW: width,
      imageH: height,
      path: filePath
    });
    
    const duration = Date.now() - startTime;
    console.log(`[${timestamp()}] ✅ Screenshot saved: ${path.basename(filePath)} (${duration}ms, ${Math.round(compressed.size/1024)}KB)`);
    
    return {
      success: true,
      image: compressed.buffer.toString('base64'),
      imageFormat: 'png',
      width: width,
      height: height,
      source: 'robotjs',
      colors: compressed.colors,
      fileSizeBytes: compressed.size,
      optimized: true,
      path: filePath,
      lastScreenshotMeta: { 
        imageW: width, 
        imageH: height, 
        displayBounds: disp.bounds, 
        path: filePath
      }
    };
    
  } catch (error) {
    console.error(`[${timestamp()}] ❌ Screenshot failed:`, error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { execute };