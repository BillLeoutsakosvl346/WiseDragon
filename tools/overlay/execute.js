const { BrowserWindow, screen } = require('electron');
const path = require('path');
const { getLastScreenshot } = require('../overlay_context');

// Keep track of overlay windows
let overlays = [];

function centerOf(box) {
  return { xn: (box.x0 + box.x1) / 2, yn: (box.y0 + box.y1) / 2 };
}

function normToScreen(xn, yn, displayBounds) {
  return {
    x: Math.round(displayBounds.x + xn * displayBounds.width),
    y: Math.round(displayBounds.y + yn * displayBounds.height)
  };
}

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

// Validation helper functions
function validateDirection(direction) {
  if (!direction || !['up', 'down', 'left', 'right'].includes(direction)) {
    throw new Error('Invalid direction. Must be: up, down, left, or right');
  }
}

function validateBasis(basis) {
  if (!basis || !['image_norm', 'box_norm', 'screen_px'].includes(basis)) {
    throw new Error('Invalid basis. Must be: image_norm, box_norm, or screen_px');
  }
}

function getGlobalCoordinates(args) {
  const { basis } = args;
  
  if (basis === 'image_norm') {
    const meta = getLastScreenshot();
    if (!meta) throw new Error('No screenshot context available: take a screenshot first.');
    if (typeof args.x_norm !== 'number' || typeof args.y_norm !== 'number') {
      throw new Error('image_norm basis requires x_norm and y_norm parameters');
    }
    return normToScreen(args.x_norm, args.y_norm, meta.displayBounds);
  } 
  
  if (basis === 'box_norm') {
    const meta = getLastScreenshot();
    if (!meta) throw new Error('No screenshot context available: take a screenshot first.');
    if (!args.box || typeof args.box !== 'object') {
      throw new Error('box_norm basis requires box parameter with x0, y0, x1, y1');
    }
    const center = centerOf(args.box);
    return normToScreen(center.xn, center.yn, meta.displayBounds);
  }
  
  if (basis === 'screen_px') {
    if (typeof args.x !== 'number' || typeof args.y !== 'number') {
      throw new Error('screen_px basis requires x and y parameters');
    }
    return { x: args.x, y: args.y };
  }
  
  throw new Error(`Unsupported basis: ${basis}`);
}

async function execute(args) {
  console.log('🎯 Showing overlay arrow:', args);
  
  try {
    const { direction, basis, color = 'black', opacity = 0.95, duration_ms = 10000 } = args;
    
    // Validate inputs
    validateDirection(direction);
    validateBasis(basis);

    // Clean up any existing overlays
    cleanupOverlays();

    // Get global coordinates based on basis
    const { x: gx, y: gy } = getGlobalCoordinates(args);

    // Find target display and convert to local coordinates
    const targetDisplay = screen.getDisplayNearestPoint({ x: gx, y: gy });
    const localX = gx - targetDisplay.bounds.x;
    const localY = gy - targetDisplay.bounds.y;

    console.log(`🎯 Target: ${direction} arrow (${basis}) at global(${gx},${gy}) -> display local(${localX},${localY})`);

    // Create overlay on target display with custom styling
    const htmlContent = createOverlayHTML(direction, localX, localY, color, opacity);
    const overlay = makeOverlayFor(targetDisplay, htmlContent);
    overlays.push(overlay);

    // Auto-cleanup with custom duration
    setTimeout(() => {
      if (overlay && !overlay.isDestroyed()) {
        overlay.destroy();
        overlays = overlays.filter(w => w !== overlay);
      }
    }, duration_ms);

    return {
      success: true,
      message: `Arrow overlay displayed: ${direction} arrow (${basis}) at (${gx}, ${gy})`,
      direction,
      basis,
      coordinates: { x: gx, y: gy },
      displayBounds: targetDisplay.bounds,
      duration_ms
    };

  } catch (error) {
    console.error('❌ Overlay arrow failed:', error.message);
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
