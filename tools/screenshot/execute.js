const { desktopCapturer, screen } = require('electron');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function execute(args) {
  console.log('📸 Starting screenshot capture with PNG color quantization...');
  
  try {
    // OpenAI vision optimal: 1365×768 (16:9 with short-side 768px)
    // This matches exactly what OpenAI's server will resize to anyway
    const thumbnailSize = { width: 1365, height: 768 };
    
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: thumbnailSize
    });
    
    const thumbnail = sources[0].thumbnail;
    const maxRawSize = 150000; // 150KB limit for optimal WebRTC performance
    const inputBuffer = thumbnail.toPNG(); // Get raw PNG for Sharp processing
    
    console.log('🎨 Starting PNG palette quantization (64 → 32 → 16 → 8 colors)...');
    
    // Try palette sizes starting from 64 colors (sweet spot) and go down if too big
    const palettes = [64, 32, 16, 8];
    let bestResult = null;
    
    for (const colors of palettes) {
      console.log(`🎨 Trying ${colors} color palette...`);
      
      const buffer = await sharp(inputBuffer)
        .resize(thumbnailSize.width, thumbnailSize.height, {
          fit: 'inside',
          withoutEnlargement: true,
          kernel: 'lanczos3'
        })
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
    
    const capturedSize = thumbnail.getSize();
    
    // Save processed image to screenshots_seen folder
    const screenshotsDir = path.join(__dirname, '..', '..', 'screenshots_seen');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
    const filename = `${timestamp}_${capturedSize.width}x${capturedSize.height}_${bestResult.colors}colors.png`;
    const filePath = path.join(screenshotsDir, filename);
    
    fs.writeFileSync(filePath, bestResult.buffer);
    console.log(`💾 Saved: screenshots_seen/${filename}`);
    console.log(`✅ PNG: ${capturedSize.width}x${capturedSize.height} (${bestResult.colors} colors, ${bestResult.buffer.length} bytes)`);
    
    return {
      success: true,
      image: bestResult.buffer.toString('base64'),
      imageFormat: 'png',
      width: capturedSize.width,
      height: capturedSize.height,
      source: 'desktopCapturer',
      paletteColors: bestResult.colors,
      fileSizeBytes: bestResult.buffer.length,
      quantized: true
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
