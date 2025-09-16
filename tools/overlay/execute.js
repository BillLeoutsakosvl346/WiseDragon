const { BrowserWindow, screen } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { getLastScreenshot } = require('../overlay_context');
const { quickCapture } = require('../screenshot/fastCapture');
const { adaptiveCompress } = require('../screenshot/fastCompress');
const { locateElement } = require('./hfVisionService');
const sessionManager = require('../sessionManager');

// Keep track of overlay windows
let overlays = [];

/**
 * Calculate offset so arrow tip points to target coordinates instead of arrow center
 */
function getArrowTipOffset(direction, size = 150) {
  // Arrow tip is at 85% from left edge in base (right-pointing) orientation
  // Center is at 50%, so tip is 35% of size away from center
  const tipOffset = size * 0.35;
  
  switch (direction) {
    case 'right': return { x: -tipOffset, y: 0 };      // Move arrow left so tip points to target
    case 'down':  return { x: 0, y: -tipOffset };      // Move arrow up so tip points to target  
    case 'left':  return { x: tipOffset, y: 0 };       // Move arrow right so tip points to target
    case 'up':    return { x: 0, y: tipOffset };       // Move arrow down so tip points to target
    default:      return { x: 0, y: 0 };
  }
}

function createOverlayHTML(dir, targetX, targetY, color = 'black', opacity = 0.95) {
  // Fixed size for consistent, visible arrows
  const size = 150;
  const ROT = { right: 0, down: 90, left: 180, up: 270 };
  
  // Calculate offset so arrow tip points to target coordinates
  const offset = getArrowTipOffset(dir, size);
  const arrowCenterX = targetX + offset.x;
  const arrowCenterY = targetY + offset.y;
  
  return `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;height:100%;background:transparent}
  #root{position:fixed;inset:0;pointer-events:none}
  .shape{position:absolute;transform:translate(-50%,-50%)}
  svg.arrow{display:block;overflow:visible}
</style>
<div id="root">
  <svg class="shape arrow" width="${size}" height="${size}" 
       style="left:${arrowCenterX}px;top:${arrowCenterY}px;opacity:${opacity};transform:translate(-50%,-50%) rotate(${ROT[dir] || 0}deg)">
    <g stroke="${color}" stroke-width="${Math.max(4, size * 0.08)}" fill="${color}">
      <!-- Create longer right-pointing arrow (extended shaft + arrowhead) -->
      <line x1="${size * 0.15}" y1="${size * 0.5}" x2="${size * 0.75}" y2="${size * 0.5}"/>
      <polygon points="${size * 0.85},${size * 0.5} ${size * 0.65},${size * 0.3} ${size * 0.65},${size * 0.7}"/>
    </g>
  </svg>
</div>`;
}

function makeOverlayFor(display, htmlContent) {
  const win = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    focusable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });

  // Load HTML content directly
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

  return win;
}

function cleanupOverlays() {
  overlays.forEach(win => {
    if (win && !win.isDestroyed()) {
      win.destroy();
    }
  });
  overlays = [];
}

// Deterministic, O(1), no extra I/O - this is the only math we need
function normToScreen(xn, yn, b) {
  return { x: Math.round(b.x + xn * b.width), y: Math.round(b.y + yn * b.height) };
}

// Convert 0-100 coordinates to normalized 0-1 coordinates
function coordsToNorm(x100, y100) {
  const x_norm = x100 / 100;
  const y_norm = y100 / 100; // Direct mapping - top-left (0,0) to bottom-right (100,100)
  return { x_norm, y_norm };
}

// Removed coordinate grid functionality - now using plain screenshots

async function takePlainScreenshot() {
  const frameData = await quickCapture();
  const disp = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  let { width, height } = frameData;
  
  if (!width || !height) {
    width = 1366;
    height = 768;
  }
  
  let screenshotBuffer;
  if (frameData.format === 'BGRA') {
    const compressed = await adaptiveCompress(frameData, 500);
    screenshotBuffer = compressed.buffer;
  } else {
    screenshotBuffer = frameData.buffer;
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
  const filename = `${timestamp}_${width}x${height}_plain.png`;
  const outputPath = sessionManager.getScreenshotPath(filename);
  await fs.writeFile(outputPath, screenshotBuffer);
  
  return {
    path: outputPath,
    buffer: screenshotBuffer,
    displayBounds: disp.bounds,
    imageW: width,
    imageH: height
  };
}

async function execute(args) {
  const startTime = performance.now();
  try {
    const { description, color = 'black', opacity = 0.95, duration_ms = 8000 } = args;
    
    console.log(`🎯 Arrow overlay requested: "${description}"`);
    console.log(`⏱️  [TIMING] Overlay request started at ${startTime.toFixed(2)}ms`);
    cleanupOverlays();

    // Take a fresh screenshot for vision analysis
    const screenshotStart = performance.now();
    const plainScreenshot = await takePlainScreenshot();
    const screenshotEnd = performance.now();
    console.log(`📷 Screenshot taken: ${plainScreenshot.path}`);
    console.log(`⏱️  [TIMING] Screenshot capture took ${(screenshotEnd - screenshotStart).toFixed(2)}ms`);

    // Use vision service to locate the element
    const visionStart = performance.now();
    console.log(`⏱️  [TIMING] Starting vision service at ${(visionStart - startTime).toFixed(2)}ms from start`);
    const visionResult = await locateElement(plainScreenshot.path, description);
    const visionEnd = performance.now();
    console.log(`⏱️  [TIMING] Vision service completed in ${(visionEnd - visionStart).toFixed(2)}ms`);
    
    if (!visionResult.success) {
      console.error('🔴 Vision service failed:', visionResult.error);
      return {
        success: false,
        error: `Vision service failed: ${visionResult.error}`,
        description
      };
    }

    // Extract coordinates and direction from vision result
    const overlayStart = performance.now();
    const { coordinates, direction } = visionResult;
    const { x_norm, y_norm } = coordsToNorm(coordinates.percent.x, coordinates.percent.y);
    const { x: gx, y: gy } = normToScreen(x_norm, y_norm, plainScreenshot.displayBounds);

    // Create overlay on the correct display
    const target = screen.getDisplayNearestPoint({ x: gx, y: gy });
    const targetLocalX = gx - target.bounds.x;
    const targetLocalY = gy - target.bounds.y;

    console.log(`🏹 Placing ${direction} arrow pointing to screen (${gx}, ${gy}) -> local (${targetLocalX}, ${targetLocalY})`);

    const htmlContent = createOverlayHTML(direction, targetLocalX, targetLocalY, color, opacity);
    const overlay = makeOverlayFor(target, htmlContent);
    overlays.push(overlay);
    const overlayEnd = performance.now();
    console.log(`⏱️  [TIMING] Overlay creation took ${(overlayEnd - overlayStart).toFixed(2)}ms`);

    // Auto-cleanup after duration
    setTimeout(() => {
      if (overlay && !overlay.isDestroyed()) {
        overlay.destroy();
        overlays = overlays.filter(w => w !== overlay);
      }
    }, duration_ms);

    const base64Image = plainScreenshot.buffer.toString('base64');
    
    const totalTime = performance.now() - startTime;
    console.log(`✅ Arrow overlay successful: ${direction} arrow pointing to "${description}"`);
    console.log(`⏱️  [TIMING] ✨ TOTAL TIME: ${totalTime.toFixed(2)}ms (${(totalTime/1000).toFixed(1)}s)`);
    
    return {
      success: true,
      message: `Arrow overlay displayed: ${direction} arrow pointing to "${description}"`,
      description,
      direction,
      coordinates: { 
        screen: { x: gx, y: gy },
        pixel: coordinates.pixel,
        normalized: coordinates.normalized,
        percent: coordinates.percent
      },
      displayBounds: target.bounds,
      screenshotPath: plainScreenshot.path,
      image: base64Image,
      imageFormat: 'png',
      width: plainScreenshot.imageW,
      height: plainScreenshot.imageH,
      duration_ms,
      visionModel: {
        response: visionResult.modelResponse,
        accuracy: 'AI-powered location detection'
      }
    };

  } catch (error) {
    console.error('🔴 Overlay arrow failed:', error.message);
    cleanupOverlays();
    
    return {
      success: false,
      error: error.message,
      description: args.description || 'unknown'
    };
  }
}

// Clean up overlays when app is closing
process.on('exit', cleanupOverlays);
process.on('SIGINT', cleanupOverlays);
process.on('SIGTERM', cleanupOverlays);

module.exports = { execute };
