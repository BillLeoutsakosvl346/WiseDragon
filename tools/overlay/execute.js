/**
 * Arrow Overlay Execute - Main orchestration logic
 * Coordinates screenshot capture, vision processing, and arrow display
 */

const { locateElement } = require('./apis/uground_api');
const { determineDirection, coordsToNorm, normToScreen } = require('./utils');
const { showArrowOverlay, cleanupAllOverlays } = require('./ui/overlay-manager');
const { logArrowPlacement, startTiming, logTiming } = require('../../utils/logger');
const screenshotTool = require('../screenshot');

/**
 * Main execution function - orchestrates screenshot, vision processing, and arrow display
 */
async function execute(args) {
  const totalStartTime = startTiming('Complete arrow overlay execution');
  
  try {
    const { 
      description, 
      vision_model = 'uground', 
      target_area, 
      color = '#D4AF37', 
      opacity = 0.7
    } = args;
    
    console.log(`[${require('../../utils/logger').getTimestamp()}] 🎯 ARROW OVERLAY REQUEST`);
    console.log(`[${require('../../utils/logger').getTimestamp()}]    📋 Description: "${description}"`);
    console.log(`[${require('../../utils/logger').getTimestamp()}]    🤖 Vision model: ${vision_model.toUpperCase()}`);
    console.log(`[${require('../../utils/logger').getTimestamp()}]    📍 Target area: ${target_area || 'any'}`);
    
    // Clean up any existing overlays first
    cleanupAllOverlays();

    // Always take a fresh screenshot using the existing screenshot tool (dual-path)
    const screenshotStartTime = Date.now();
    const screenshotResult = await screenshotTool.executor({});
    logTiming('Screenshot capture', screenshotStartTime);
    
    if (!screenshotResult.success) {
      return {
        success: false,
        error: `Failed to take screenshot: ${screenshotResult.error}`,
        description
      };
    }
    
    const screenshot = {
      path: screenshotResult.lastScreenshotMeta.path,  // Single unified path
      buffer: screenshotResult.image ? Buffer.from(screenshotResult.image, 'base64') : null,
      displayBounds: screenshotResult.lastScreenshotMeta.displayBounds,
      imageW: screenshotResult.lastScreenshotMeta.imageW,   // Unified dimensions
      imageH: screenshotResult.lastScreenshotMeta.imageH
    };
    
    // Log unified format details
    console.log(`[${require('../../utils/logger').getTimestamp()}] 📐 UNIFIED SCREENSHOT DEBUG:`);
    console.log(`[${require('../../utils/logger').getTimestamp()}]    🖥️  Actual screen: ${screenshot.displayBounds.width}x${screenshot.displayBounds.height}`);
    console.log(`[${require('../../utils/logger').getTimestamp()}]    🎨 Universal image: ${screenshot.imageW}x${screenshot.imageH} (64-color PNG)`);
    console.log(`[${require('../../utils/logger').getTimestamp()}]    📁 File: ${require('path').basename(screenshot.path)}`);
    console.log(`[${require('../../utils/logger').getTimestamp()}]    📡 WebRTC-optimized: 1366x768 for realtime API compatibility`);
    console.log(`[${require('../../utils/logger').getTimestamp()}]    📤 Used by: Realtime GPT + UGround (Modal) + DINO (Replicate)`);
    
    // Coordinates need to be scaled from 1366x768 to actual screen resolution
    console.log(`[${require('../../utils/logger').getTimestamp()}]    ✅ Standard 1366x768 - coordinates will be scaled to screen resolution`);

    // Process with appropriate vision model
    const visionResult = await processWithVisionModel(screenshot, description, vision_model, target_area);
    
    if (!visionResult.success) {
      console.error(`[${require('../../utils/logger').getTimestamp()}] 🔴 Vision service failed:`, visionResult.error);
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

    // Log detailed arrow placement info
    logArrowPlacement(direction, { x: screenX, y: screenY }, { x: screenX - screenshot.displayBounds.x, y: screenY - screenshot.displayBounds.y }, description);

    // Show the arrow overlay
    const overlayStartTime = Date.now();
    const overlay = showArrowOverlay(direction, screenX, screenY, screenshot.displayBounds, { color, opacity });
    logTiming('Arrow overlay creation', overlayStartTime);

    // Convert screenshot to base64 if buffer is available
    const base64Image = screenshot.buffer ? screenshot.buffer.toString('base64') : null;
    
    logTiming('Complete arrow overlay execution', totalStartTime);
    console.log(`[${require('../../utils/logger').getTimestamp()}] ✅ ARROW OVERLAY SUCCESS: ${direction.toUpperCase()} arrow placed`);
    
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
    console.error(`[${require('../../utils/logger').getTimestamp()}] 🔴 OVERLAY ARROW FAILED:`, error.message);
    logTiming('Complete arrow overlay execution (FAILED)', totalStartTime);
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
    // Use Replicate Grounding DINO for real-world objects
    console.log(`[${require('../../utils/logger').getTimestamp()}] 🦕 Using Replicate Grounding DINO for object detection`);
    const { detectObjectCenter } = require('./apis/groundingdino_api');
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
    // Use Modal UGround for UI elements (default, SF optimized)
    console.log(`[${require('../../utils/logger').getTimestamp()}] 🚀 Using Modal UGround for UI element detection`);
    return await locateElement(screenshot.path, description);
  }
}

module.exports = { 
  execute, 
  cleanupOverlays: cleanupAllOverlays 
};
