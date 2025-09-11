const { BrowserWindow, screen } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const { getLastScreenshot } = require('../overlay_context');

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

// Fast screen capture - skip expensive getSources() when possible
async function fastScreenCapture() {
  const { desktopCapturer, screen } = require('electron');
  
  // Get current display info quickly
  const disp = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  
  // Try to get just the primary display source quickly
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: disp.bounds.width, height: disp.bounds.height },
    fetchWindowIcons: false // Skip window icon fetching for speed
  });
  
  // Find matching display or use first available
  const src = sources.find(s => s.display_id === String(disp.id)) || sources[0];
  return {
    thumbnail: src.thumbnail,
    displayBounds: disp.bounds,
    imageSize: src.thumbnail.getSize()
  };
}

// Take a fresh screenshot and apply coordinate net overlay for arrow pointing (OPTIMIZED)
async function takeScreenshotWithCoordinates() {
  const funcStart = Date.now();
  try {
    // Step 1: Fast screen capture
    const captureStart = Date.now();
    console.log('📷 Starting fast screen capture...');
    const { thumbnail, displayBounds, imageSize } = await fastScreenCapture();
    console.log(`📷 Fast screen capture: ${Date.now() - captureStart}ms`);
    
    // Step 2: Convert to PNG buffer
    const processStart = Date.now();
    const screenshotBuffer = thumbnail.toPNG();
    console.log(`🖼️ PNG conversion: ${Date.now() - processStart}ms`);
    
    // Step 3: Load or generate coordinate grid
    const gridStart = Date.now();
    const { width, height } = imageSize;
    let gridBuffer = await loadCoordinateGrid(width, height);
    
    if (!gridBuffer) {
      // Fallback: generate grid on-the-fly if not pre-generated
      console.log('⚠️ Generating coordinate grid on-the-fly...');
      const { applyCoordinateNet } = require('../../utils/applyCoordinateNet');
      const coordinateOverlayBuffer = await applyCoordinateNet(screenshotBuffer);
      console.log(`🎯 On-the-fly grid generation: ${Date.now() - gridStart}ms`);
      
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
    
    console.log(`📐 Grid loading: ${Date.now() - gridStart}ms`);
    
    // Step 4: Fast composite - just overlay the pre-generated grid
    const compositeStart = Date.now();
    console.log('⚡ Fast compositing pre-generated grid...');
    const coordinateOverlayBuffer = await sharp(screenshotBuffer)
      .composite([{
        input: gridBuffer,
        top: 0,
        left: 0
      }])
      .png()
      .toBuffer();
    console.log(`⚡ Grid composite: ${Date.now() - compositeStart}ms`);
    
    // Step 5: Save file
    const saveStart = Date.now();
    const screenshotsDir = path.join(__dirname, '..', '..', 'screenshots_seen');
    if (!require('fs').existsSync(screenshotsDir)) {
      require('fs').mkdirSync(screenshotsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
    const filename = `${timestamp}_${width}x${height}_coordinates.png`;
    const outputPath = path.join(screenshotsDir, filename);
    
    await fs.writeFile(outputPath, coordinateOverlayBuffer);
    console.log(`💾 File save: ${Date.now() - saveStart}ms`);
    
    const totalFuncTime = Date.now() - funcStart;
    console.log(`📊 takeScreenshotWithCoordinates() OPTIMIZED total: ${totalFuncTime}ms`);
    console.log(`📊 Coordinate net screenshot saved: screenshots_seen/${filename}`);
    
    return {
      path: outputPath,
      buffer: coordinateOverlayBuffer,
      displayBounds: displayBounds,
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
  console.log(`⏱️ Arrow process started at: ${new Date().toISOString()}`);
  
  try {
    const { direction, color = 'black', opacity = 0.95, duration_ms = 8000 } = args;
    
    // Clean up any existing overlays
    const cleanupStart = Date.now();
    cleanupOverlays();
    console.log(`🧹 Cleanup completed in: ${Date.now() - cleanupStart}ms`);

    // Step 1: Take fresh screenshot and apply coordinate net for agent viewing
    const screenshotStart = Date.now();
    console.log('📸 Starting screenshot capture and coordinate overlay...');
    const coordinateScreenshot = await takeScreenshotWithCoordinates();
    const screenshotTime = Date.now() - screenshotStart;
    console.log(`📸 Screenshot + coordinate overlay completed in: ${screenshotTime}ms`);
    
    console.log('📊 Screenshot with coordinate net ready for agent viewing');
    console.log(`📍 Agent should now view: ${coordinateScreenshot.path}`);

    // Step 2: Convert coordinates to screen pixels
    const conversionStart = Date.now();
    const { x100, y100 } = args;
    const { x_norm, y_norm } = coordsToNorm(x100, y100);
    
    console.log(`📍 Converting coordinates: (${x100},${y100}) → normalized (${x_norm.toFixed(3)},${y_norm.toFixed(3)})`);
    const { x: gx, y: gy } = normToScreen(x_norm, y_norm, coordinateScreenshot.displayBounds);
    console.log(`🔢 Coordinate conversion completed in: ${Date.now() - conversionStart}ms`);

    // Step 3: Pick target display & localize
    const displayStart = Date.now();
    const target = screen.getDisplayNearestPoint({ x: gx, y: gy });
    const localX = gx - target.bounds.x, localY = gy - target.bounds.y;
    console.log(`🖥️ Display targeting completed in: ${Date.now() - displayStart}ms`);

    console.log(`🎯 Target: ${direction} arrow at global(${gx},${gy}) -> display local(${localX},${localY})`);

    // Step 4: Render arrow overlay
    const arrowStart = Date.now();
    console.log('🏹 Creating arrow overlay...');
    const htmlContent = createOverlayHTML(direction, localX, localY, color, opacity);
    const overlay = makeOverlayFor(target, htmlContent);
    overlays.push(overlay);
    console.log(`🏹 Arrow overlay created and displayed in: ${Date.now() - arrowStart}ms`);

    // Auto-cleanup
    setTimeout(() => {
      if (overlay && !overlay.isDestroyed()) {
        overlay.destroy();
        overlays = overlays.filter(w => w !== overlay);
      }
    }, duration_ms);

    const totalTime = Date.now() - startTime;
    console.log(`⏱️ TOTAL ARROW PROCESS COMPLETED IN: ${totalTime}ms`);
    console.log(`📊 Process breakdown: Screenshot=${screenshotTime}ms, Arrow=${Date.now() - arrowStart}ms, Total=${totalTime}ms`);

    return {
      success: true,
      message: `Arrow overlay displayed: ${direction} arrow at (${gx}, ${gy})`,
      direction,
      coordinates: { x: gx, y: gy },
      displayBounds: target.bounds,
      coordinateScreenshot: coordinateScreenshot.path,
      image: coordinateScreenshot.buffer.toString('base64'),
      imageFormat: 'png',
      width: coordinateScreenshot.imageW,
      height: coordinateScreenshot.imageH,
      duration_ms,
      performanceStats: {
        totalTime: totalTime,
        screenshotTime: screenshotTime,
        arrowTime: Date.now() - arrowStart
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
