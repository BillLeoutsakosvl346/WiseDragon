const { screen } = require('electron');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { setLastScreenshot } = require('../overlay_context');
const sessionManager = require('../sessionManager');

// Screenshot capture using robotjs
let robotjs;
try {
  robotjs = require('@jitsi/robotjs');
} catch (err) {
  try {
    robotjs = require('robotjs');
  } catch (err2) {
    console.error('RobotJS not available');
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
 * Compress and optimize screenshot
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
 * Take and process screenshot
 */
async function execute(args = {}) {
  const timestamp = () => new Date().toISOString().substring(11, 23);
  
  console.log(`[${timestamp()}] 📸 Taking screenshot...`);
  
  try {
    const frameData = await captureScreenshot();
    const compressed = await compressToUnifiedFormat(frameData);
    const disp = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    
    // Create filename and save
    const baseTimestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
    const filename = `${baseTimestamp}_${compressed.finalWidth}x${compressed.finalHeight}_${compressed.colors}colors.png`;
    const filePath = sessionManager.getScreenshotPath(filename);
    
    fs.writeFileSync(filePath, compressed.buffer);
    
    setLastScreenshot({
      displayId: disp.id,
      displayBounds: disp.bounds,
      imageW: compressed.finalWidth,
      imageH: compressed.finalHeight,
      path: filePath
    });
    
    console.log(`[${timestamp()}] ✅ Screenshot saved: ${path.basename(filePath)}`);
    
    return {
      success: true,
      image: compressed.buffer.toString('base64'),
      width: compressed.finalWidth,
      height: compressed.finalHeight,
      source: 'robotjs',
      path: filePath,
      lastScreenshotMeta: { 
        imageW: compressed.finalWidth, 
        imageH: compressed.finalHeight, 
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