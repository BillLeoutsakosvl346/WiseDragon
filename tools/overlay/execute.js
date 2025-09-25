/**
 * Overlay Arrow Tool - Complete arrow placement system
 * Handles screenshot capture, vision processing, and arrow display
 */

const { locateElement } = require('./apis/uground_api');
const { showArrowOverlay, cleanupAllOverlays, cleanupOverlayVisuals, setArrowStateCallback } = require('./ui/overlay-manager');
const { setArrowVisibility } = require('./screen-state');
const screenshotTool = require('../screenshot');

// Set up callback to track arrow visibility for auto-analysis
setArrowStateCallback(setArrowVisibility);

/**
 * Determine arrow direction based on coordinate position using 9-grid system
 */
function determineDirection(normalizedCoords) {
  const { x, y } = normalizedCoords;
  const xPercent = x / 10; // 0-1000 -> 0-100
  const yPercent = y / 10; // 0-1000 -> 0-100
  
  // Divide screen into 9 equal rectangles (33.33% each)
  const leftThird = xPercent <= 33.33;
  const rightThird = xPercent >= 66.67;
  const middleX = !leftThird && !rightThird;
  
  const topThird = yPercent <= 33.33;
  const bottomThird = yPercent >= 66.67;
  const middleY = !topThird && !bottomThird;
  
  // Corner positions (diagonal arrows at 45 degrees)
  if (topThird && leftThird) return 'up-left';        // Top-left corner
  if (topThird && rightThird) return 'up-right';      // Top-right corner
  if (bottomThird && leftThird) return 'down-left';   // Bottom-left corner
  if (bottomThird && rightThird) return 'down-right'; // Bottom-right corner
  
  // Edge positions (straight arrows)
  if (topThird && middleX) return 'up';               // Top edge
  if (bottomThird && middleX) return 'down';          // Bottom edge
  if (middleY && leftThird) return 'left';            // Left edge
  if (middleY && rightThird) return 'right';          // Right edge
  
  // Center position (50/50 probability between up and down)
  if (middleX && middleY) {
    return (x + y) % 2 === 0 ? 'up' : 'down';        // Deterministic but 50/50 distribution
  }
  
  // Fallback (should not happen)
  return 'up';
}

/**
 * Convert coordinates directly to screen pixels (simplified)
 */
function coordsToScreen(percent, displayBounds) {
  const x = Math.round(displayBounds.x + (percent.x / 100) * displayBounds.width);
  const y = Math.round(displayBounds.y + (percent.y / 100) * displayBounds.height);
  return { x, y };
}

/**
 * Process screenshot with appropriate vision model
 */
async function processWithVisionModel(screenshot, description, visionModel, targetArea) {
  if (visionModel === 'grounding_dino') {
    const { detectObjectCenter } = require('./apis/groundingdino_api');
    const coords = await detectObjectCenter(screenshot.path, description, targetArea);
    
    if (coords.x === null || coords.y === null) {
      return { success: false, error: 'Object not detected by Grounding DINO' };
    }

    const dimensions = { width: screenshot.imageW, height: screenshot.imageH };
    const normalizedCoords = { 
      x: Math.round((coords.x / dimensions.width) * 1000), 
      y: Math.round((coords.y / dimensions.height) * 1000) 
    };
    
    return {
      success: true,
      coordinates: {
        normalized: normalizedCoords,
        pixel: coords,
        percent: { x: normalizedCoords.x / 10, y: normalizedCoords.y / 10 }
      },
      direction: determineDirection(normalizedCoords),
      dimensions,
      modelResponse: `Grounding DINO detected object at (${coords.x}, ${coords.y})`
    };
  } else {
    // Use Modal UGround for UI elements
    return await locateElement(screenshot.path, description);
  }
}

/**
 * Main execution function - orchestrates the complete arrow placement process
 */
async function execute(args) {
  const timestamp = () => new Date().toISOString().substring(11, 23);
  
  try {
    const { 
      description, 
      vision_model = 'uground', 
      target_area, 
      color = '#D4AF37', 
      opacity = 0.7
    } = args;
    
    console.log(`[${timestamp()}] 🎯 Placing arrow for: "${description}"`);
    
    // Clean up any existing overlays
    cleanupAllOverlays();

    // Take fresh screenshot
    const screenshotResult = await screenshotTool.executor({});
    if (!screenshotResult.success) {
      return {
        success: false,
        error: `Failed to take screenshot: ${screenshotResult.error}`,
        description
      };
    }
    
    const screenshot = {
      path: screenshotResult.lastScreenshotMeta.path,
      buffer: screenshotResult.image ? Buffer.from(screenshotResult.image, 'base64') : null,
      displayBounds: screenshotResult.lastScreenshotMeta.displayBounds,
      imageW: screenshotResult.lastScreenshotMeta.imageW,
      imageH: screenshotResult.lastScreenshotMeta.imageH
    };

    // Process with appropriate vision model
    const visionResult = await processWithVisionModel(screenshot, description, vision_model, target_area);
    
    if (!visionResult.success) {
      return {
        success: false,
        error: `Vision service failed: ${visionResult.error}`,
        description
      };
    }

    // Calculate screen coordinates for arrow placement
    const { coordinates, direction } = visionResult;
    const screenCoords = coordsToScreen(coordinates.percent, screenshot.displayBounds);

    // Show the arrow overlay
    const overlay = showArrowOverlay(direction, screenCoords.x, screenCoords.y, screenshot.displayBounds, { color, opacity });
    
    console.log(`[${timestamp()}] ✅ ${direction.toUpperCase()} arrow placed at (${screenCoords.x}, ${screenCoords.y})`);
    
    return {
      success: true,
      message: `Arrow overlay displayed: ${direction} arrow pointing to "${description}"`,
      description,
      direction,
      coordinates: { 
        screen: screenCoords,
        pixel: coordinates.pixel,
        normalized: coordinates.normalized,
        percent: coordinates.percent
      },
      displayBounds: screenshot.displayBounds,
      screenshotPath: screenshot.path,
      image: screenshot.buffer ? screenshot.buffer.toString('base64') : null,
      imageFormat: 'png', 
      width: screenshot.imageW,
      height: screenshot.imageH,
      visionModel: {
        model: vision_model,
        response: visionResult.modelResponse,
        accuracy: vision_model === 'grounding_dino' ? 'Grounding DINO object detection' : 'UGround UI element detection'
      }
    };

  } catch (error) {
    const timestamp = () => new Date().toISOString().substring(11, 23);
    console.error(`[${timestamp()}] ❌ Arrow placement failed:`, error.message);
    cleanupAllOverlays();
    
    return {
      success: false,
      error: error.message,
      description: args.description || 'unknown'
    };
  }
}

module.exports = { 
  execute, 
  cleanupOverlays: cleanupAllOverlays 
};