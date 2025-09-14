const { BrowserWindow, screen } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { getLastScreenshot } = require('../overlay_context');
const { quickCapture } = require('../screenshot/fastCapture');
const { adaptiveCompress } = require('../screenshot/fastCompress');

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
  
  const screenshotsDir = path.join(__dirname, '..', '..', 'screenshots_seen');
  if (!require('fs').existsSync(screenshotsDir)) {
    require('fs').mkdirSync(screenshotsDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
  const filename = `${timestamp}_${width}x${height}_plain.png`;
  const outputPath = path.join(screenshotsDir, filename);
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
  try {
    const { direction, color = 'black', opacity = 0.95, duration_ms = 8000 } = args;
    
    cleanupOverlays();

    const plainScreenshot = await takePlainScreenshot();

    const { x100, y100 } = args;
    const { x_norm, y_norm } = coordsToNorm(x100, y100);
    const { x: gx, y: gy } = normToScreen(x_norm, y_norm, plainScreenshot.displayBounds);

    const target = screen.getDisplayNearestPoint({ x: gx, y: gy });
    const localX = gx - target.bounds.x, localY = gy - target.bounds.y;

    const htmlContent = createOverlayHTML(direction, localX, localY, color, opacity);
    const overlay = makeOverlayFor(target, htmlContent);
    overlays.push(overlay);

    setTimeout(() => {
      if (overlay && !overlay.isDestroyed()) {
        overlay.destroy();
        overlays = overlays.filter(w => w !== overlay);
      }
    }, duration_ms);

    const base64Image = plainScreenshot.buffer.toString('base64');
    
    return {
      success: true,
      message: `Arrow overlay displayed: ${direction} arrow at (${gx}, ${gy})`,
      direction,
      coordinates: { x: gx, y: gy },
      displayBounds: target.bounds,
      screenshotPath: plainScreenshot.path,
      image: base64Image,
      imageFormat: 'png',
      width: plainScreenshot.imageW,
      height: plainScreenshot.imageH,
      duration_ms
    };

  } catch (error) {
    console.error('Overlay arrow failed:', error.message);
    cleanupOverlays();
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Clean up overlays when app is closing
process.on('exit', cleanupOverlays);
process.on('SIGINT', cleanupOverlays);
process.on('SIGTERM', cleanupOverlays);

module.exports = { execute };
