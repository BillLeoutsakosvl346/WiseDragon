/**
 * Screen State Manager - Auto-screenshot and screen context
 */

const { startGlobalInputDetection, stopGlobalInputDetection, isGlobalInputSupported } = require('./ui/global-input-detector');
const { setLastScreenshot, getLastScreenshot } = require('../overlay_context');
const screenshotTool = require('../screenshot');

let isAutoScreenshotEnabled = false;
let lastCaptureTime = 0;
const CAPTURE_DEBOUNCE_MS = 1000; // Don't capture more than once per second
const SCREENSHOT_DELAY_MS = 100;  // Wait 100ms after click for screen to update

/**
 * Start automatic screenshot capture on user interactions
 */
async function startAutoScreenshotCapture() {
  if (isAutoScreenshotEnabled) {
    console.log(`[${new Date().toISOString().replace('T', ' ').replace('Z', '').substring(11, 23)}] 📸 Auto-screenshot already enabled`);
    return;
  }

  console.log(`[${new Date().toISOString().replace('T', ' ').replace('Z', '').substring(11, 23)}] 📸 Starting automatic screenshot capture on clicks...`);
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
      const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', '').substring(11, 23);
      console.log(`[${timestamp}] 📸 User interaction detected - capturing screenshot in ${SCREENSHOT_DELAY_MS}ms...`);
      
      // Wait for screen to update after click
      setTimeout(async () => {
        // Double-check if auto-screenshot is still enabled after timeout
        if (!isAutoScreenshotEnabled) return;
        
        // Use existing screenshot tool - no duplication!
        const screenshotResult = await screenshotTool.executor({});
        
        if (screenshotResult.success) {
          // Store as current screenshot with unified format
          const screenshotMeta = {
            path: screenshotResult.lastScreenshotMeta.path,
            buffer: screenshotResult.image ? Buffer.from(screenshotResult.image, 'base64') : null,
            displayBounds: screenshotResult.lastScreenshotMeta.displayBounds,
            imageW: screenshotResult.width,
            imageH: screenshotResult.height,
            capturedAt: new Date().toISOString()
          };
          
          setLastScreenshot(screenshotMeta);
          const successTimestamp = new Date().toISOString().replace('T', ' ').replace('Z', '').substring(11, 23);
          console.log(`[${successTimestamp}] 📸 ✅ Auto-captured unified screenshot (after ${SCREENSHOT_DELAY_MS}ms delay):`);
          console.log(`[${successTimestamp}]   🎨 Universal: ${require('path').basename(screenshotResult.lastScreenshotMeta.path)} (1366x768 PNG 64-color)`);
          
        } else {
          console.error(`[${new Date().toISOString().replace('T', ' ').replace('Z', '').substring(11, 23)}] 📸 ❌ Auto-screenshot failed:`, screenshotResult.error);
        }
      }, SCREENSHOT_DELAY_MS); // Wait for screen to update after click
      
    } catch (error) {
      console.error(`[${new Date().toISOString().replace('T', ' ').replace('Z', '').substring(11, 23)}] 📸 ❌ Auto-screenshot error:`, error.message);
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
  
  console.log(`[${new Date().toISOString().replace('T', ' ').replace('Z', '').substring(11, 23)}] 📸 Stopping automatic screenshot capture...`);
  isAutoScreenshotEnabled = false;
  stopGlobalInputDetection();
}

/**
 * Get current screen context information for AI
 */
function getCurrentScreenContext() {
  const currentScreenshot = getLastScreenshot();
  
  if (!currentScreenshot) {
    return {
      hasCurrentScreen: false,
      message: "No current screen state available. The user hasn't interacted with their screen recently."
    };
  }

  const timeSinceCapture = Date.now() - new Date(currentScreenshot.capturedAt).getTime();
  const secondsAgo = Math.round(timeSinceCapture / 1000);
  
  return {
    hasCurrentScreen: true,
    screenshotPath: currentScreenshot.path,
    capturedAt: currentScreenshot.capturedAt,
    secondsAgo: secondsAgo,
    dimensions: {
      width: currentScreenshot.imageW,
      height: currentScreenshot.imageH
    },
    displayBounds: currentScreenshot.displayBounds,
    message: `Current screen state available (captured ${secondsAgo}s ago after user interaction). The user is currently viewing this screen and may be referring to elements visible on it.`
  };
}

/**
 * Log system status to console
 */
function logSystemStatus() {
  const screenContext = getCurrentScreenContext();
  const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', '').substring(11, 23);
  
  console.log(`[${timestamp}]\n🔍 WiseDragon Auto-Screenshot Status:`);
  
  if (screenContext.hasCurrentScreen) {
    console.log(`[${timestamp}]   ✅ Auto-screenshot active - current screen available (${screenContext.secondsAgo}s ago)`);
    console.log(`[${timestamp}]   📸 Last screenshot: ${screenContext.screenshotPath}`);
    console.log(`[${timestamp}]   📐 Dimensions: ${screenContext.dimensions.width}x${screenContext.dimensions.height}`);
  } else {
    console.log(`[${timestamp}]   ✅ Auto-screenshot ready - waiting for first user interaction`);
  }
  
  console.log(`[${timestamp}]`);
}

/**
 * Get enhanced AI instructions that include current screen context
 */
function getEnhancedInstructions(baseInstructions) {
  const screenContext = getCurrentScreenContext();
  
  const contextAddition = screenContext.hasCurrentScreen 
    ? `\n\nCurrent screen available (${screenContext.secondsAgo}s ago). Take screenshot when user asks about their screen.`
    : `\n\nTake screenshot when user asks about their screen.`;

  return baseInstructions + contextAddition;
}

module.exports = {
  startAutoScreenshotCapture,
  stopAutoScreenshotCapture,
  getCurrentScreenContext,
  getEnhancedInstructions,
  logSystemStatus
};
