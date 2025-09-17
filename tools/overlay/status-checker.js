/**
 * Status Checker - Utility to check auto-screenshot and screen context status
 */

const { isAutoScreenshotActive, getLastCaptureInfo } = require('./auto-screenshot-capture');
const { getCurrentScreenContext, isCurrentScreenRecent } = require('./screen-context-provider');
const { isGlobalInputSupported } = require('./global-input-detector');

/**
 * Get complete status of all screen capture systems
 */
function getSystemStatus() {
  const autoScreenshotStatus = isAutoScreenshotActive();
  const captureInfo = getLastCaptureInfo();
  const screenContext = getCurrentScreenContext();
  const globalInputSupported = isGlobalInputSupported();
  const screenRecent = isCurrentScreenRecent();
  
  return {
    autoScreenshot: {
      enabled: autoScreenshotStatus,
      globalInputSupported: globalInputSupported,
      lastCaptureMs: captureInfo.timeSinceLastCapture,
      debounceMs: captureInfo.debounceMs
    },
    screenContext: {
      hasCurrentScreen: screenContext.hasCurrentScreen,
      isRecent: screenRecent,
      ...(screenContext.hasCurrentScreen && {
        capturedAt: screenContext.capturedAt,
        secondsAgo: screenContext.secondsAgo,
        dimensions: screenContext.dimensions,
        path: screenContext.screenshotPath
      })
    },
    summary: {
      ready: autoScreenshotStatus && globalInputSupported,
      hasRecentScreen: screenContext.hasCurrentScreen && screenRecent,
      message: getStatusMessage(autoScreenshotStatus, globalInputSupported, screenContext, screenRecent)
    }
  };
}

/**
 * Generate human-readable status message
 */
function getStatusMessage(autoEnabled, globalSupported, screenContext, screenRecent) {
  if (!autoEnabled) {
    return "❌ Auto-screenshot not enabled";
  }
  
  if (!globalSupported) {
    return "⚠️ Auto-screenshot enabled but global input detection not supported (install uiohook-napi)";
  }
  
  if (!screenContext.hasCurrentScreen) {
    return "✅ Auto-screenshot ready - waiting for first user interaction";
  }
  
  if (screenRecent) {
    return `✅ Auto-screenshot active - current screen available (${screenContext.secondsAgo}s ago)`;
  } else {
    return `⚠️ Auto-screenshot active - screen available but outdated (${screenContext.secondsAgo}s ago)`;
  }
}

/**
 * Log system status to console
 */
function logSystemStatus() {
  const status = getSystemStatus();
  
  console.log('\n🔍 WiseDragon Auto-Screenshot Status:');
  console.log(`   ${status.summary.message}`);
  
  if (status.screenContext.hasCurrentScreen) {
    console.log(`   📸 Last screenshot: ${status.screenContext.path}`);
    console.log(`   📐 Dimensions: ${status.screenContext.dimensions.width}x${status.screenContext.dimensions.height}`);
  }
  
  console.log('');
}

module.exports = {
  getSystemStatus,
  logSystemStatus
};
