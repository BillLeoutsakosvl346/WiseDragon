const { BrowserWindow, screen } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const { getLastScreenshot } = require('../overlay_context');
const { quickCapture } = require('../../utils/fastCapture');
const { adaptiveCompress } = require('../../utils/fastCompress');

// Keep track of overlay windows
let overlays = [];

function createOverlayHTML(dir, x, y, color = 'black', opacity = 0.95) {
  // Fixed size for consistent, visible arrows
  const size = 150;
  const ROT = { right: 0, down: 90, left: 180, up: 270 };
  
  return `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;height:100%;background:transparent}
  #root{position:fixed;inset:0;pointer-events:none}
  .shape{position:absolute;transform:translate(-50%,-50%)}
  svg.arrow{display:block;overflow:visible}
</style>
<div id="root">
  <svg class="shape arrow" width="${size}" height="${size}" 
       style="left:${x}px;top:${y}px;opacity:${opacity};transform:translate(-50%,-50%) rotate(${ROT[dir] || 0}deg)">
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

// Cache for pre-generated coordinate grids
const gridCache = new Map();

// Load pre-generated coordinate grid for a specific resolution
async function loadCoordinateGrid(width, height) {
  const key = `${width}x${height}`;
  
  if (gridCache.has(key)) {
    return gridCache.get(key);
  }
  
  try {
    const gridPath = path.join(__dirname, '..', '..', 'media', `grid_${width}x${height}.png`);
    const gridBuffer = await fs.readFile(gridPath);
    gridCache.set(key, gridBuffer);
    console.log(`📐 Loaded pre-generated grid for ${width}x${height}`);
    return gridBuffer;
  } catch (error) {
    console.log(`⚠️ No pre-generated grid found for ${width}x${height}, will generate on-the-fly`);
    return null;
  }
}

// REMOVED: fastScreenCapture - replaced with ultra-fast methods from research

// Take a fresh screenshot and apply coordinate net overlay for arrow pointing (ULTRA-FAST)
async function takeScreenshotWithCoordinates() {
  const funcStart = Date.now();
  try {
    // Step 1: Fast screen capture
    const captureStart = Date.now();
    const frameData = await quickCapture();
    
    // Step 2: Get display info and handle different formats
    const processStart = Date.now();
    const disp = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    let { width, height } = frameData;
    
    // Use optimized resolution
    if (!width || !height) {
      width = 1366;
      height = 768;
    }
    
    // Convert to PNG if needed
    let screenshotBuffer;
    if (frameData.format === 'BGRA') {
      const compressed = await adaptiveCompress(frameData, 500);
      screenshotBuffer = compressed.buffer;
    } else {
      screenshotBuffer = frameData.buffer;
    }
    
    // Step 3: Load or generate coordinate grid
    const gridStart = Date.now();
    let gridBuffer = await loadCoordinateGrid(width, height);
    
    if (!gridBuffer) {
      // Fallback: generate grid on-the-fly if not pre-generated
      console.log('⚠️ Generating coordinate grid on-the-fly...');
      const { applyCoordinateNet } = require('../../utils/applyCoordinateNet');
      const coordinateOverlayBuffer = await applyCoordinateNet(screenshotBuffer);
      
      // Save result and return early
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
      const filename = `${timestamp}_${width}x${height}_coordinates.png`;
      const outputPath = path.join(__dirname, '..', '..', 'screenshots_seen', filename);
      await fs.writeFile(outputPath, coordinateOverlayBuffer);
      
      return {
        path: outputPath,
        buffer: coordinateOverlayBuffer,
        displayBounds: displayBounds,
        imageW: width,
        imageH: height
      };
    }
    
    
    // Composite grid overlay
    const coordinateOverlayBuffer = await sharp(screenshotBuffer)
      .composite([{ input: gridBuffer, top: 0, left: 0 }])
      .png()
      .toBuffer();
    
    // Save result
    const screenshotsDir = path.join(__dirname, '..', '..', 'screenshots_seen');
    if (!require('fs').existsSync(screenshotsDir)) {
      require('fs').mkdirSync(screenshotsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
    const filename = `${timestamp}_${width}x${height}_coordinates.png`;
    const outputPath = path.join(screenshotsDir, filename);
    await fs.writeFile(outputPath, coordinateOverlayBuffer);
    
    return {
      path: outputPath,
      buffer: coordinateOverlayBuffer,
      displayBounds: disp.bounds,
      imageW: width,
      imageH: height
    };
  } catch (error) {
    console.error('❌ Failed to take screenshot with coordinates:', error);
    throw error;
  }
}

async function execute(args) {
  const startTime = Date.now();
  console.log('🎯 Showing overlay arrow:', args);
  
  try {
    const { direction, color = 'black', opacity = 0.95, duration_ms = 8000 } = args;
    
    cleanupOverlays();

    // Take screenshot with coordinate overlay
    const coordinateScreenshot = await takeScreenshotWithCoordinates();
    const screenshotTime = Date.now() - startTime;
    
    console.log(`📊 Coordinate overlay ready: ${coordinateScreenshot.imageW}×${coordinateScreenshot.imageH}`);

    // Convert coordinates and place arrow
    const { x100, y100 } = args;
    const { x_norm, y_norm } = coordsToNorm(x100, y100);
    const { x: gx, y: gy } = normToScreen(x_norm, y_norm, coordinateScreenshot.displayBounds);

    const target = screen.getDisplayNearestPoint({ x: gx, y: gy });
    const localX = gx - target.bounds.x, localY = gy - target.bounds.y;

    console.log(`🎯 Arrow: ${direction} at (${x100},${y100}) → screen (${gx},${gy})`);

    // Create and display arrow
    const htmlContent = createOverlayHTML(direction, localX, localY, color, opacity);
    const overlay = makeOverlayFor(target, htmlContent);
    overlays.push(overlay);

    // Auto-cleanup
    setTimeout(() => {
      if (overlay && !overlay.isDestroyed()) {
        overlay.destroy();
        overlays = overlays.filter(w => w !== overlay);
      }
    }, duration_ms);

    const totalTime = Date.now() - startTime;
    console.log(`⏱️ Arrow placed in ${totalTime}ms (screenshot: ${screenshotTime}ms)`);

    // Prepare image for model transmission
    const base64Image = coordinateScreenshot.buffer.toString('base64');
    console.log(`📤 Coordinate overlay ready for AI model: ${coordinateScreenshot.imageW}×${coordinateScreenshot.imageH}`);
    
    return {
      success: true,
      message: `Arrow overlay displayed: ${direction} arrow at (${gx}, ${gy})`,
      direction,
      coordinates: { x: gx, y: gy },
      displayBounds: target.bounds,
      coordinateScreenshot: coordinateScreenshot.path,
      image: base64Image,
      imageFormat: 'png',
      width: coordinateScreenshot.imageW,
      height: coordinateScreenshot.imageH,
      duration_ms,
      performanceStats: {
        totalTime: totalTime,
        screenshotTime: screenshotTime,
        arrowTime: Date.now() - arrowStart,
        base64Time: base64Time
      }
    };

  } catch (error) {
    const errorTime = Date.now() - startTime;
    console.error(`❌ Overlay arrow failed after ${errorTime}ms:`, error.message);
    console.error(`📍 Error stack:`, error.stack);
    cleanupOverlays();
    
    return {
      success: false,
      error: error.message,
      failureTime: errorTime
    };
  }
}

// Clean up overlays when app is closing
process.on('exit', cleanupOverlays);
process.on('SIGINT', cleanupOverlays);
process.on('SIGTERM', cleanupOverlays);

module.exports = { execute };
