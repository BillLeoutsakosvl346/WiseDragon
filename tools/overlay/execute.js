/**
 * Overlay Arrow Tool - Complete arrow placement system
 * Handles screenshot capture, vision processing, and arrow display
 */

const { locateElement } = require('./apis/uground_api');
const { showArrowOverlay, cleanupAllOverlays } = require('./ui/overlay-manager');
const screenshotTool = require('../screenshot');

/**
 * Determine arrow direction based on coordinate position
 */
function determineDirection(normalizedCoords) {
  const { x, y } = normalizedCoords;
  const xPercent = x / 10; // 0-1000 -> 0-100
  const yPercent = y / 10; // 0-1000 -> 0-100
  
  if (yPercent <= 25) return 'up';
  if (yPercent >= 75) return 'down';
  if (xPercent <= 25) return 'left';
  if (xPercent >= 75) return 'right';
  
  // Middle area - deterministic but pseudo-random
  const directions = ['up', 'right', 'down', 'left'];
  return directions[Math.floor((x + y) % 4)];
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