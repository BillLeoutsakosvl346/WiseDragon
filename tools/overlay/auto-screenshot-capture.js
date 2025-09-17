/**
 * Auto Screenshot Capture - Automatically takes screenshots on user clicks
 * to keep the AI updated with current screen state
 */

const { startGlobalInputDetection, stopGlobalInputDetection } = require('./global-input-detector');
const { setLastScreenshot } = require('../overlay_context');
const screenshotTool = require('../screenshot');

let isAutoScreenshotEnabled = false;
let lastCaptureTime = 0;
const CAPTURE_DEBOUNCE_MS = 1000; // Don't capture more than once per second

/**
 * Start automatic screenshot capture on user interactions
 */
async function startAutoScreenshotCapture() {
  if (isAutoScreenshotEnabled) {
    console.log('📸 Auto-screenshot already enabled');
    return;
  }

  console.log('📸 Starting automatic screenshot capture on clicks...');
  isAutoScreenshotEnabled = true;

  // Use existing global input detection to capture clicks
  startGlobalInputDetection(async () => {
    if (!isAutoScreenshotEnabled) return;

    const now = Date.now();
    if (now - lastCaptureTime < CAPTURE_DEBOUNCE_MS) {
      return; // Skip if we just captured recently
    }
    lastCaptureTime = now;

    try {
      console.log('📸 User interaction detected - capturing screenshot...');
      
      // Use existing screenshot tool
      const screenshotResult = await screenshotTool.executor({});
      
      if (screenshotResult.success) {
        // Store as current screenshot using existing overlay context
        const screenshotMeta = {
          path: screenshotResult.path,
          buffer: screenshotResult.buffer,
          displayBounds: screenshotResult.displayBounds,
          imageW: screenshotResult.width,
          imageH: screenshotResult.height,
          capturedAt: new Date().toISOString()
        };
        
        setLastScreenshot(screenshotMeta);
        console.log(`📸 ✅ Auto-captured screenshot: ${screenshotResult.path}`);
        
        // Notify main process that we have a new current screenshot
        notifyMainProcessOfNewScreenshot(screenshotMeta);
        
      } else {
        console.error('📸 ❌ Auto-screenshot failed:', screenshotResult.error);
      }
    } catch (error) {
      console.error('📸 ❌ Auto-screenshot error:', error.message);
    }
  });
}

/**
 * Stop automatic screenshot capture
 */
function stopAutoScreenshotCapture() {
  if (!isAutoScreenshotEnabled) {
    return;
  }
  
  console.log('📸 Stopping automatic screenshot capture...');
  isAutoScreenshotEnabled = false;
  stopGlobalInputDetection();
}

/**
 * Check if auto-screenshot is currently enabled
 */
function isAutoScreenshotActive() {
  return isAutoScreenshotEnabled;
}

/**
 * Notify main process about new screenshot for AI context
 */
function notifyMainProcessOfNewScreenshot(screenshotMeta) {
  // This could be extended to send IPC messages to main process
  // For now, just log that we have a new current state
  console.log('🤖 New screen state available for AI context');
  
  // Future: Could send IPC to main process to update AI context
  // ipcRenderer?.send('current-screen-updated', screenshotMeta);
}

/**
 * Get debounce status for testing/debugging
 */
function getLastCaptureInfo() {
  return {
    lastCaptureTime,
    debounceMs: CAPTURE_DEBOUNCE_MS,
    timeSinceLastCapture: Date.now() - lastCaptureTime
  };
}

module.exports = {
  startAutoScreenshotCapture,
  stopAutoScreenshotCapture,
  isAutoScreenshotActive,
  getLastCaptureInfo
};
