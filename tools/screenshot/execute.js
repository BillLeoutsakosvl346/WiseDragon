const { desktopCapturer, screen } = require('electron');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { setLastScreenshot } = require('../overlay_context');

async function execute(args) {
  console.log('📸 Starting screenshot capture with 1:1 geometry...');
  
  try {
    // Capture at 1:1 geometry - no spatial rescale, match display DIP size
    const disp = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const sz = { width: disp.bounds.width, height: disp.bounds.height }; // 1:1 DIPs
    
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: sz
    });
    
    // Find the source matching our target display, or fall back to first
    const src = sources.find(s => s.display_id === String(disp.id)) || sources[0];
    const native = src.thumbnail;
    const inputBuffer = native.toPNG(); // No spatial resize, only quantize
    const maxRawSize = 150000; // 150KB limit for optimal WebRTC performance
    
    console.log('🎨 Starting PNG palette quantization (64 → 32 → 16 → 8 colors)...');
    
    // Try palette sizes starting from 64 colors (sweet spot) and go down if too big
    const palettes = [64, 32, 16, 8];
    let bestResult = null;
    
    for (const colors of palettes) {
      console.log(`🎨 Trying ${colors} color palette...`);
      
      const buffer = await sharp(inputBuffer)
        .png({
          palette: true,        // Use indexed PNG (color quantization)
          colours: colors,      // Number of colors in palette
          dither: 0.3,         // Low dithering for crisp UI text
          compressionLevel: 9,  // Maximum lossless compression
          effort: 10           // Extra CPU for smaller files
        })
        .toBuffer();
        
      console.log(`🎨 ${colors} colors: ${buffer.length} bytes`);
      
      if (!bestResult || buffer.length < bestResult.buffer.length) {
        bestResult = { buffer, colors };
      }
      
      // Stop at first palette that fits the size limit
      if (buffer.length <= maxRawSize) {
        bestResult = { buffer, colors };
        console.log(`✅ ${colors} color palette fits - using quantized PNG`);
        break;
      } else {
        console.log(`❌ ${colors} colors too large, trying fewer colors...`);
      }
    }
    
    // Get image dimensions and metadata
    const imageSize = native.getSize();
    
    // Save processed image to screenshots_seen folder
    const screenshotsDir = path.join(__dirname, '..', '..', 'screenshots_seen');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
    const filename = `${timestamp}_${imageSize.width}x${imageSize.height}_${bestResult.colors}colors.png`;
    const filePath = path.join(screenshotsDir, filename);
    
    fs.writeFileSync(filePath, bestResult.buffer);
    console.log(`💾 Saved: screenshots_seen/${filename}`);
    console.log(`✅ PNG: ${imageSize.width}x${imageSize.height} (${bestResult.colors} colors, ${bestResult.buffer.length} bytes)`);
    
    // Store minimal meta for mapping (no timers, no guards)
    setLastScreenshot({
      displayId: disp.id,
      displayBounds: disp.bounds, // {x,y,width,height} DIPs
      imageW: imageSize.width,
      imageH: imageSize.height
    });
    
    return {
      success: true,
      image: bestResult.buffer.toString('base64'),
      imageFormat: 'png',
      width: imageSize.width,
      height: imageSize.height,
      source: 'desktopCapturer',
      paletteColors: bestResult.colors,
      fileSizeBytes: bestResult.buffer.length,
      quantized: true,
      lastScreenshotMeta: { imageW: imageSize.width, imageH: imageSize.height, displayBounds: disp.bounds }
    };
    
  } catch (error) {
    console.error('❌ Screenshot failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = { execute };
