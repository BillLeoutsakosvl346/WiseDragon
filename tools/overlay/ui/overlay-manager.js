/**
 * Overlay Manager - Handles overlay window creation and lifecycle
 * Manages golden arrow overlays that appear on top of the screen
 */

const { BrowserWindow, screen, app } = require('electron');
const { createArrowHTML } = require('./arrow-renderer');
const { startGlobalInputDetection, stopGlobalInputDetection } = require('./global-input-detector');
const { getTimestamp } = require('../../../utils/logger');

// Keep track of overlay windows
let overlays = [];

// Notify screen-state when arrows appear/disappear
let arrowStateCallback = null;


/**
 * Create an overlay window for a specific display
 */
function createOverlayWindow(display, htmlContent) {
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
  win.setIgnoreMouseEvents(true, { forward: true }); // Make completely click-through

  // Handle window close event
  win.on('closed', () => {
    console.log(`[${getTimestamp()}] 🗯️ Arrow overlay window closed`);
    // Remove from overlays array
    const index = overlays.indexOf(win);
    if (index > -1) {
      overlays.splice(index, 1);
    }
    
    // If no more overlays, stop global input detection
    if (overlays.length === 0) {
      stopGlobalInputDetection();
    }
  });

  // Load HTML content directly
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

  return win;
}

/**
 * Show arrow overlay pointing to target coordinates
 */
function showArrowOverlay(direction, targetX, targetY, displayBounds, options = {}) {
  const { color = '#D4AF37', opacity = 0.7 } = options;
  
  // Calculate local coordinates relative to display
  const targetLocalX = targetX - displayBounds.x;
  const targetLocalY = targetY - displayBounds.y;

  console.log(`[${getTimestamp()}] 🏹 Placing ${direction} arrow pointing to screen (${targetX}, ${targetY}) -> local (${targetLocalX}, ${targetLocalY})`);

  // Create arrow HTML
  const htmlContent = createArrowHTML(direction, targetLocalX, targetLocalY, color, opacity);
  
  // Find the target display
  const targetDisplay = screen.getDisplayNearestPoint({ x: targetX, y: targetY });
  
  // Create and show overlay
  const overlay = createOverlayWindow(targetDisplay, htmlContent);
  overlays.push(overlay);
  
  // Notify that arrows are now visible (enable auto-analysis)
  if (overlays.length === 1 && arrowStateCallback) {
    arrowStateCallback(true); // arrows appeared
  }
  
  // Setup global input detection (only once when first overlay is created)
  if (overlays.length === 1) {
    startGlobalInputDetection(() => {
      if (overlays.length > 0) {
        console.log(`[${getTimestamp()}] 🧹 Cleaning up arrows due to user interaction`);
        
        // Action 1: Schedule screenshot/analysis FIRST (while arrows are still active)
        const { queueAutoScreenshotAndAnalyze } = require('../screen-state');
        queueAutoScreenshotAndAnalyze('user clicked on arrow guidance', true);
        
        // Action 2: Clean up visuals after queuing analysis
        cleanupOverlayVisuals();
      }
    });
  }
  
  return overlay;
}

/**
 * Clean up just the visual overlays (keep input detection active for a moment)
 */
function cleanupOverlayVisuals() {
  console.log(`[${getTimestamp()}] 🧹 Cleaning up arrow visuals...`);
  
  const hadOverlays = overlays.length > 0;
  
  overlays.forEach(win => {
    if (win && !win.isDestroyed()) {
      win.destroy();
    }
  });
  overlays = [];
  
  // Notify that arrows are no longer visible
  if (hadOverlays && arrowStateCallback) {
    arrowStateCallback(false); // arrows disappeared
  }
}

/**
 * Clean up all overlay windows and stop input detection
 */
function cleanupAllOverlays() {
  console.log(`[${getTimestamp()}] 🧹 Cleaning up all arrow overlays...`);
  
  const hadOverlays = overlays.length > 0;
  
  overlays.forEach(win => {
    if (win && !win.isDestroyed()) {
      win.destroy();
    }
  });
  overlays = [];
  
  // Notify that arrows are no longer visible
  if (hadOverlays && arrowStateCallback) {
    arrowStateCallback(false);
  }
  
  stopGlobalInputDetection();
}

/**
 * Get count of active overlays
 */
function getActiveOverlayCount() {
  return overlays.length;
}

/**
 * Set callback to be notified when arrows appear/disappear
 */
function setArrowStateCallback(callback) {
  arrowStateCallback = callback;
}

// Clean up overlays when app is closing
if (app) {
  app.on('before-quit', cleanupAllOverlays);
}

// Process cleanup handlers
process.on('exit', cleanupAllOverlays);
process.on('SIGINT', cleanupAllOverlays);
process.on('SIGTERM', cleanupAllOverlays);

module.exports = {
  showArrowOverlay,
  cleanupAllOverlays,
  cleanupOverlayVisuals,
  getActiveOverlayCount,
  setArrowStateCallback
};
