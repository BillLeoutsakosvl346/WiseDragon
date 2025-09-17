/**
 * Arrow Overlay Execute - Main orchestration logic
 */

const { screen } = require('electron');
const { locateElement } = require('./uground_api');
const { determineDirection, coordsToNorm, normToScreen } = require('./utils');
const { showArrowOverlay, cleanupAllOverlays } = require('./overlay-manager');
const { getLastScreenshot } = require('../overlay_context');
const screenshotTool = require('../screenshot');

/**
 * Main execution function - orchestrates screenshot, vision processing, and arrow display
 */
async function execute(args) {
  try {
    const { 
      description, 
      vision_model = 'uground', 
      target_area, 
      color = '#D4AF37', 
      opacity = 0.7
    } = args;
    
    console.log(`🎯 Arrow overlay requested: "${description}" using ${vision_model}`);
    
    // Clean up any existing overlays first
    cleanupAllOverlays();

    // Get current screenshot or take a fresh one
    let screenshot = getLastScreenshot();
    
    if (!screenshot || !screenshot.path) {
      console.log('📷 No current screenshot available, taking a fresh one...');
      // Use existing screenshot tool to take a new screenshot
      const screenshotResult = await screenshotTool.executor({});
      
      if (!screenshotResult.success) {
        return {
          success: false,
          error: `Failed to take screenshot: ${screenshotResult.error}`,
          description
        };
      }
      
      screenshot = {
        path: screenshotResult.path,
        buffer: screenshotResult.buffer,
        displayBounds: screenshotResult.displayBounds,
        imageW: screenshotResult.width,
        imageH: screenshotResult.height
      };
    } else {
      console.log(`📷 Using current screenshot: ${screenshot.path}`);
    }

    // Process with appropriate vision model
    const visionResult = await processWithVisionModel(screenshot, description, vision_model, target_area);
    
    if (!visionResult.success) {
      console.error('🔴 Vision service failed:', visionResult.error);
      return {
        success: false,
        error: `Vision service failed: ${visionResult.error}`,
        description
      };
    }

    // Calculate screen coordinates for arrow placement
    const { coordinates, direction } = visionResult;
    const { x_norm, y_norm } = coordsToNorm(coordinates.percent.x, coordinates.percent.y);
    const { x: screenX, y: screenY } = normToScreen(x_norm, y_norm, screenshot.displayBounds);

    // Show the arrow overlay
    const overlay = showArrowOverlay(direction, screenX, screenY, screenshot.displayBounds, { color, opacity });

    // Convert screenshot to base64 if buffer is available
    const base64Image = screenshot.buffer ? screenshot.buffer.toString('base64') : null;
    
    console.log(`✅ Arrow overlay successful: ${direction} arrow pointing to "${description}"`);
    
    return {
      success: true,
      message: `Arrow overlay displayed: ${direction} arrow pointing to "${description}"`,
      description,
      direction,
      coordinates: { 
        screen: { x: screenX, y: screenY },
        pixel: coordinates.pixel,
        normalized: coordinates.normalized,
        percent: coordinates.percent
      },
      displayBounds: screenshot.displayBounds,
      screenshotPath: screenshot.path,
      image: base64Image,
      imageFormat: 'png', 
      width: screenshot.imageW || screenshot.width,
      height: screenshot.imageH || screenshot.height,
      visionModel: {
        model: vision_model,
        response: visionResult.modelResponse,
        accuracy: vision_model === 'grounding_dino' ? 'Grounding DINO object detection' : 'UGround UI element detection'
      }
    };

  } catch (error) {
    console.error('🔴 Overlay arrow failed:', error.message);
    cleanupAllOverlays();
    
    return {
      success: false,
      error: error.message,
      description: args.description || 'unknown'
    };
  }
}

/**
 * Process screenshot with appropriate vision model
 */
async function processWithVisionModel(screenshot, description, visionModel, targetArea) {
  if (visionModel === 'grounding_dino') {
    // Use Grounding DINO for real-world objects
    const { detectObjectCenter } = require('./groundingdino_api');
    const coords = await detectObjectCenter(screenshot.path, description, targetArea);
    
    if (coords.x === null || coords.y === null) {
      return { success: false, error: 'Object not detected by Grounding DINO' };
    }

    // Convert to expected format
    const dimensions = { 
      width: screenshot.imageW || screenshot.width, 
      height: screenshot.imageH || screenshot.height 
    };
    const normalizedCoords = { 
      x: Math.round((coords.x / dimensions.width) * 1000), 
      y: Math.round((coords.y / dimensions.height) * 1000) 
    };
    
    return {
      success: true,
      coordinates: {
        normalized: normalizedCoords,
        pixel: coords,
        percent: {
          x: normalizedCoords.x / 10,
          y: normalizedCoords.y / 10
        }
      },
      direction: determineDirection(normalizedCoords),
      dimensions,
      modelResponse: `Grounding DINO detected object at (${coords.x}, ${coords.y})`
    };
  } else {
    // Use UGround for UI elements (default)
    return await locateElement(screenshot.path, description);
  }
}

module.exports = { 
  execute, 
  cleanupOverlays: cleanupAllOverlays 
};
