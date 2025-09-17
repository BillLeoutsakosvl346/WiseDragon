const { BrowserWindow, screen } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { getLastScreenshot } = require('../overlay_context');
const { quickCapture } = require('../screenshot/fastCapture');
const { adaptiveCompress } = require('../screenshot/fastCompress');
const { locateElement } = require('./uground_api');
const { determineDirection, coordsToNorm, normToScreen } = require('./utils');
const sessionManager = require('../sessionManager');

// Keep track of overlay windows
let overlays = [];

/**
 * Simple arrow tip offset - arrow points to target
 */
function getArrowTipOffset(direction, size = 150) {
  const offset = size * 0.35;
  const offsets = { 
    right: { x: -offset, y: 0 }, 
    down: { x: 0, y: -offset }, 
    left: { x: offset, y: 0 }, 
    up: { x: 0, y: offset } 
  };
  return offsets[direction] || { x: 0, y: 0 };
}

function createOverlayHTML(dir, targetX, targetY, color = '#D4AF37', opacity = 0.7) {
  const size = 150;
  const rotations = { right: 0, down: 90, left: 180, up: 270 };
  const offset = getArrowTipOffset(dir, size);
  const centerX = targetX + offset.x;
  const centerY = targetY + offset.y;
  
  return `<!doctype html><meta charset="utf-8">
<style>
  html, body {
    margin: 0;
    height: 100%;
    background: transparent;
  }
  
  #root {
    position: fixed;
    inset: 0;
    pointer-events: none;
  }
  
  .arrow-container {
    position: absolute;
    transform: translate(-50%, -50%);
    backdrop-filter: blur(2px);
    border-radius: 20px;
    padding: 10px;
  }
  
  svg.arrow {
    display: block;
    overflow: visible;
    filter: drop-shadow(0 0 15px rgba(255, 215, 0, 0.8)) drop-shadow(0 0 30px rgba(212, 175, 55, 0.6));
    animation: arrowPulse 2s ease-in-out infinite;
  }
  
  @keyframes arrowPulse {
    0%, 100% { 
      filter: drop-shadow(0 0 15px rgba(255, 215, 0, 0.8)) drop-shadow(0 0 30px rgba(212, 175, 55, 0.6));
      transform: scale(1);
    }
    50% { 
      filter: drop-shadow(0 0 25px rgba(255, 215, 0, 1)) drop-shadow(0 0 50px rgba(212, 175, 55, 0.8));
      transform: scale(1.05);
    }
  }
  
  .arrow-shaft {
    stroke: url(#goldGradient);
    stroke-width: 8;
    stroke-linecap: round;
    fill: none;
  }
  
  .arrow-head {
    fill: url(#goldGradient);
    stroke: url(#goldGradient);
    stroke-width: 2;
    stroke-linejoin: round;
  }
</style>
<div id="root">
  <div class="arrow-container" style="left:${centerX}px;top:${centerY}px;opacity:${opacity};transform:translate(-50%,-50%) rotate(${rotations[dir] || 0}deg)">
    <svg class="arrow" width="${size}" height="${size}">
      <defs>
        <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"  style="stop-color:#FFD700"/>
          <stop offset="50%" style="stop-color:#D4AF37"/>
          <stop offset="100%" style="stop-color:#B8941F"/>
        </linearGradient>
      </defs>
      
      <!-- Simple arrow line -->
      <line x1="${size * 0.05}" y1="${size * 0.50}" x2="${size * 0.75}" y2="${size * 0.50}"
            stroke="#D4AF37" stroke-width="6" stroke-linecap="round"/>
      
      <!-- Simple arrow head -->
      <polygon points="${size * 0.85},${size * 0.5} ${size * 0.70},${size * 0.35} ${size * 0.70},${size * 0.65}"
               fill="#D4AF37" stroke="#D4AF37" stroke-width="1" stroke-linejoin="round"/>
    </svg>
  </div>
</div>`;
}

function makeOverlayFor(display, htmlContent) {
  const win = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    focusable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });

  // Load HTML content directly
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

  return win;
}

function cleanupOverlays() {
  overlays.forEach(win => {
    if (win && !win.isDestroyed()) {
      win.destroy();
    }
  });
  overlays = [];
}


// Removed coordinate grid functionality - now using plain screenshots

async function takePlainScreenshot() {
  const frameData = await quickCapture();
  const disp = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  let { width, height } = frameData;
  
  if (!width || !height) {
    width = 1366;
    height = 768;
  }
  
  let screenshotBuffer;
  if (frameData.format === 'BGRA') {
    const compressed = await adaptiveCompress(frameData, 500);
    screenshotBuffer = compressed.buffer;
  } else {
    screenshotBuffer = frameData.buffer;
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
  const filename = `${timestamp}_${width}x${height}_plain.png`;
  const outputPath = sessionManager.getScreenshotPath(filename);
  await fs.writeFile(outputPath, screenshotBuffer);
  
  return {
    path: outputPath,
    buffer: screenshotBuffer,
    displayBounds: disp.bounds,
    imageW: width,
    imageH: height
  };
}

async function execute(args) {
  try {
    const { 
      description, 
      vision_model = 'uground', 
      target_area, 
      color = '#D4AF37', 
      opacity = 0.7, 
      duration_ms = 8000 
    } = args;
    
    console.log(`🎯 Arrow overlay requested: "${description}" using ${vision_model}`);
    cleanupOverlays();

    // Take a fresh screenshot for vision analysis
    const plainScreenshot = await takePlainScreenshot();
    console.log(`📷 Screenshot taken: ${plainScreenshot.path}`);

    // Use appropriate vision service based on model selection
    let visionResult;
    if (vision_model === 'grounding_dino') {
      // Use Grounding DINO for real-world objects
      const { detectObjectCenter } = require('./groundingdino_api');
      const coords = await detectObjectCenter(plainScreenshot.path, description, target_area);
      
      if (coords.x === null || coords.y === null) {
        visionResult = { success: false, error: 'Object not detected by Grounding DINO' };
      } else {
        // Convert to the format expected by overlay system
        const dimensions = { width: plainScreenshot.imageW, height: plainScreenshot.imageH };
        const normalizedCoords = { 
          x: Math.round((coords.x / dimensions.width) * 1000), 
          y: Math.round((coords.y / dimensions.height) * 1000) 
        };
        
        visionResult = {
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
      }
    } else {
      // Use UGround for UI elements (default)
      visionResult = await locateElement(plainScreenshot.path, description);
    }
    
    if (!visionResult.success) {
      console.error('🔴 Vision service failed:', visionResult.error);
      return {
        success: false,
        error: `Vision service failed: ${visionResult.error}`,
        description
      };
    }

    // Extract coordinates and direction from vision result
    const { coordinates, direction } = visionResult;
    const { x_norm, y_norm } = coordsToNorm(coordinates.percent.x, coordinates.percent.y);
    const { x: gx, y: gy } = normToScreen(x_norm, y_norm, plainScreenshot.displayBounds);

    // Create overlay on the correct display
    const target = screen.getDisplayNearestPoint({ x: gx, y: gy });
    const targetLocalX = gx - target.bounds.x;
    const targetLocalY = gy - target.bounds.y;

    console.log(`🏹 Placing ${direction} arrow pointing to screen (${gx}, ${gy}) -> local (${targetLocalX}, ${targetLocalY})`);

    const htmlContent = createOverlayHTML(direction, targetLocalX, targetLocalY, color, opacity);
    const overlay = makeOverlayFor(target, htmlContent);
    overlays.push(overlay);

    // Auto-cleanup after duration
    setTimeout(() => {
      if (overlay && !overlay.isDestroyed()) {
        overlay.destroy();
        overlays = overlays.filter(w => w !== overlay);
      }
    }, duration_ms);

    const base64Image = plainScreenshot.buffer.toString('base64');
    
    console.log(`✅ Arrow overlay successful: ${direction} arrow pointing to "${description}"`);
    
    return {
      success: true,
      message: `Arrow overlay displayed: ${direction} arrow pointing to "${description}"`,
      description,
      direction,
      coordinates: { 
        screen: { x: gx, y: gy },
        pixel: coordinates.pixel,
        normalized: coordinates.normalized,
        percent: coordinates.percent
      },
      displayBounds: target.bounds,
      screenshotPath: plainScreenshot.path,
      image: base64Image,
      imageFormat: 'png',
      width: plainScreenshot.imageW,
      height: plainScreenshot.imageH,
      duration_ms,
      visionModel: {
        model: vision_model,
        response: visionResult.modelResponse,
        accuracy: vision_model === 'grounding_dino' ? 'Grounding DINO object detection' : 'UGround UI element detection'
      }
    };

  } catch (error) {
    console.error('🔴 Overlay arrow failed:', error.message);
    cleanupOverlays();
    
    return {
      success: false,
      error: error.message,
      description: args.description || 'unknown'
    };
  }
}

// Clean up overlays when app is closing
process.on('exit', cleanupOverlays);
process.on('SIGINT', cleanupOverlays);
process.on('SIGTERM', cleanupOverlays);

module.exports = { execute };
