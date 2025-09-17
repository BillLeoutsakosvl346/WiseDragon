/**
 * Screen Context Provider - Provides current screen context to AI conversations
 */

const { getLastScreenshot } = require('../overlay_context');

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
 * Get enhanced AI instructions that include current screen context
 */
function getEnhancedInstructions(baseInstructions) {
  const screenContext = getCurrentScreenContext();
  
  const screenContextInstruction = screenContext.hasCurrentScreen 
    ? `\n\n**CURRENT SCREEN CONTEXT:**\n${screenContext.message}\n- Screenshot available at: ${screenContext.screenshotPath}\n- Screen dimensions: ${screenContext.dimensions.width}x${screenContext.dimensions.height}\n- Last interaction: ${screenContext.secondsAgo} seconds ago\n\nWhen the user asks about their screen, refers to UI elements, or needs guidance, immediately take a screenshot to see their current view. The available screenshot shows their screen state after their last click/interaction.`
    : `\n\n**CURRENT SCREEN CONTEXT:**\n${screenContext.message}\n\nWhen the user asks about their screen or needs guidance, immediately take a screenshot to see their current view.`;

  return baseInstructions + screenContextInstruction;
}

/**
 * Check if current screenshot is recent (within last 30 seconds)
 */
function isCurrentScreenRecent(maxAgeSeconds = 30) {
  const currentScreenshot = getLastScreenshot();
  
  if (!currentScreenshot) {
    return false;
  }
  
  const timeSinceCapture = Date.now() - new Date(currentScreenshot.capturedAt).getTime();
  return timeSinceCapture <= (maxAgeSeconds * 1000);
}

module.exports = {
  getCurrentScreenContext,
  getEnhancedInstructions,
  isCurrentScreenRecent
};
