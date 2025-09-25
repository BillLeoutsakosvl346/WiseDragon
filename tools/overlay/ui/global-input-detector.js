/**
 * Global Input Detector - Handles system-wide click and scroll detection
 * Uses uiohook-napi for cross-platform input detection
 */

const { systemPreferences } = require('electron');
const { getTimestamp } = require('../../../utils/logger');

let globalInputHook = null;
let fallbackTimeout = null;

/**
 * Start global input detection hook
 */
function startGlobalInputDetection(onInteractionCallback) {
  // Clean up existing hook first
  stopGlobalInputDetection();
  
  console.log(`[${getTimestamp()}] 👁️ Setting up global input detection...`);
  
  try {
    // Try to load uiohook-napi for global input detection
    const { uIOhook } = require('uiohook-napi');
    
    // Check platform-specific requirements
    if (process.platform === 'darwin') {
      // macOS: Check for Accessibility permission
      const trusted = systemPreferences.isTrustedAccessibilityClient(false);
      if (!trusted) {
        console.log(`[${getTimestamp()}] 🍎 macOS: Requesting Accessibility permission for global input detection...`);
        systemPreferences.isTrustedAccessibilityClient(true); // Prompts user
        console.log(`[${getTimestamp()}] ⚠️ Please grant Accessibility permission and restart the app for click detection to work`);
      }
    }
    
    // Check for Wayland on Linux (not supported)
    if (process.platform === 'linux' && process.env.XDG_SESSION_TYPE === 'wayland') {
      console.warn(`[${getTimestamp()}] ⚠️ Wayland detected - global input detection not supported. Using fallback timeout.`);
      setupFallbackTimeout(onInteractionCallback);
      return;
    }
    
    // Set up debouncing to avoid double-firing
    let lastInteraction = 0;
    const DEBOUNCE_MS = 100;
    
    const onInteraction = () => {
      const now = Date.now();
      if (now - lastInteraction > DEBOUNCE_MS) {
        lastInteraction = now;
        console.log(`[${getTimestamp()}] 🖱️ Global interaction detected`);
        onInteractionCallback();
      }
    };
    
    // Listen for mouse clicks and scroll events
    uIOhook.on('mousedown', onInteraction);
    uIOhook.on('wheel', onInteraction);
    
    // Start the global hook
    uIOhook.start();
    
    globalInputHook = {
      supported: true,
      stop: () => {
        try {
          uIOhook.removeAllListeners('mousedown');
          uIOhook.removeAllListeners('wheel');
          uIOhook.stop();
        } catch (error) {
          console.log(`[${getTimestamp()}] Note: Error stopping uIOhook (this is normal):`, error.message);
        }
      }
    };
    
    console.log(`[${getTimestamp()}] ✅ Global input detection active`);
    
  } catch (error) {
    console.log(`[${getTimestamp()}] ⚠️ uiohook-napi not available, using fallback timeout:`, error.message);
    console.log(`[${getTimestamp()}] 💡 Install with: npm install uiohook-napi && npx electron-rebuild -f -w uiohook-napi`);
    setupFallbackTimeout(onInteractionCallback);
  }
}

/**
 * Stop global input detection
 */
function stopGlobalInputDetection() {
  if (globalInputHook && globalInputHook.supported) {
    try {
      globalInputHook.stop();
      console.log(`[${getTimestamp()}] 🛑 Global input hook stopped`);
    } catch (error) {
      console.log(`[${getTimestamp()}] Note: Error stopping global hook:`, error.message);
    }
  }
  globalInputHook = null;
  
  // Clear fallback timeout
  if (fallbackTimeout) {
    clearTimeout(fallbackTimeout);
    fallbackTimeout = null;
  }
}

/**
 * Setup fallback timeout for when global detection isn't available
 */
function setupFallbackTimeout(onInteractionCallback) {
  console.log(`[${getTimestamp()}] ⏱️ Using fallback 10-second timeout`);
  fallbackTimeout = setTimeout(() => {
    console.log(`[${getTimestamp()}] ⏰ Arrow timeout cleanup (10s fallback)`);
    onInteractionCallback();
  }, 10000);
}

/**
 * Check if global input detection is supported
 */
function isGlobalInputSupported() {
  try {
    require('uiohook-napi');
    // Check for Wayland on Linux
    if (process.platform === 'linux' && process.env.XDG_SESSION_TYPE === 'wayland') {
      return false;
    }
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  startGlobalInputDetection,
  stopGlobalInputDetection,
  isGlobalInputSupported
};
