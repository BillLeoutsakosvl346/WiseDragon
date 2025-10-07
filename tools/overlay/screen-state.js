/**
 * Screen State Manager - Auto-screenshot and screen context
 */

const { startGlobalInputDetection, stopGlobalInputDetection, isGlobalInputSupported } = require('./ui/global-input-detector');
const { setLastScreenshot, getLastScreenshot } = require('../overlay_context');
const screenshotTool = require('../screenshot');

let isAutoScreenshotEnabled = false;
let lastCaptureTime = 0;
let autoAnalysisCallback = null; // Callback to send screenshots for automatic analysis
let arrowsActive = false; // Simple arrow state tracking
let analysisInFlight = false; // Guard against duplicate analysis triggers
const CAPTURE_DEBOUNCE_MS = 1000; // Don't capture more than once per second
const SCREENSHOT_DELAY_MS = 1000;  // Wait 1 second after click before screenshot

/**
 * Start automatic screenshot capture on user interactions
 */
async function startAutoScreenshotCapture(analysisCallback = null) {
  autoAnalysisCallback = analysisCallback;
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
      console.log(`[${timestamp}] 📸 User interaction detected - capturing screenshot in ${SCREENSHOT_DELAY_MS}ms for auto-analysis...`);
      
      // Quick screenshot after click to check loading state
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
          console.log(`[${successTimestamp}] 📸 ✅ Screenshot captured (${SCREENSHOT_DELAY_MS}ms delay) - agent will check for loading`);
          
          // Note: Auto-analysis is now handled by explicit queueAutoScreenshotAndAnalyze() calls
          // This path is only for regular screenshot capture without analysis
          if (autoAnalysisCallback) {
            console.log(`[${successTimestamp}] 📸 Screenshot captured but skipping analysis (no arrows visible or recently visible)`);
          }
          
        } else {
          console.error(`[${new Date().toISOString().replace('T', ' ').replace('Z', '').substring(11, 23)}] 📸 ❌ Auto-screenshot failed:`, screenshotResult.error);
        }
      }, SCREENSHOT_DELAY_MS); // Wait for screen to settle after click
      
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
  arrowsActive = false;
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

// getEnhancedInstructions moved to prompts/index.js for centralization

/**
 * Update arrow visibility state (called by overlay manager)
 */
function setArrowVisibility(visible) {
  arrowsActive = visible;
  const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', '').substring(11, 23);
  console.log(`[${timestamp}] 🏹 Arrows ${visible ? 'ENABLED' : 'DISABLED'} - auto-analysis ${visible ? 'active' : 'inactive'}`);
}

/**
 * Trigger screenshot and analysis when arrows were active
 */
async function queueAutoScreenshotAndAnalyze(reason = 'interaction', forceAnalysis = false) {
  if (!forceAnalysis && !arrowsActive) {
    console.log('⚪ Skipped analysis: no arrows active');
    return;
  }
  
  if (analysisInFlight) {
    console.log('⚪ Skipped analysis: analysis already in flight');
    return;
  }
  
  analysisInFlight = true;
  const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', '').substring(11, 23);
  console.log(`[${timestamp}] 📸 Queuing screenshot and analysis (${reason}) in ${SCREENSHOT_DELAY_MS}ms...`);

  setTimeout(async () => {
    try {
      const screenshotResult = await screenshotTool.executor({});
      
      if (autoAnalysisCallback) {
        const successTimestamp = new Date().toISOString().replace('T', ' ').replace('Z', '').substring(11, 23);
        console.log(`[${successTimestamp}] 🤖 Sending screenshot for automatic analysis (${reason})...`);
        await autoAnalysisCallback(screenshotResult);
      } else {
        console.log('⚪ Skipped analysis: no callback available');
      }
    } catch (error) {
      console.error('Auto analysis failed:', error.message);
    } finally {
      analysisInFlight = false;
    }
  }, SCREENSHOT_DELAY_MS);
}

// Removed queueDelayedScreenshot - simplified to single screenshot approach

module.exports = {
  startAutoScreenshotCapture,
  stopAutoScreenshotCapture,
  getCurrentScreenContext,
  logSystemStatus,
  setArrowVisibility,
  queueAutoScreenshotAndAnalyze
};
