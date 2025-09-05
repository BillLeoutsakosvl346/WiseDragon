const { desktopCapturer, screen } = require('electron');
const sharp = require('sharp');

async function execute(args) {
  console.log('📸 Starting screenshot capture with PNG color quantization...');
  
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const maxDimension = 1080;
    const aspectRatio = primaryDisplay.size.width / primaryDisplay.size.height;
    
    const thumbnailSize = aspectRatio > 1 ? {
      width: Math.min(primaryDisplay.size.width, maxDimension),
      height: Math.min(primaryDisplay.size.height, Math.round(maxDimension / aspectRatio))
    } : {
      width: Math.min(primaryDisplay.size.width, Math.round(maxDimension * aspectRatio)),
      height: Math.min(primaryDisplay.size.height, maxDimension)
    };
    
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: thumbnailSize
    });
    
    const thumbnail = sources[0].thumbnail;
    const maxRawSize = 150000; // 150KB limit for optimal WebRTC performance
    const inputBuffer = thumbnail.toPNG(); // Get raw PNG for Sharp processing
    
    console.log('🎨 Starting PNG palette quantization (256 → 128 → 64 → 32 → 16 colors)...');
    
    // Try different palette sizes: 256→128→64→32→16 colors (starting higher since compression is so effective)
    const palettes = [256, 128, 64, 32, 16];
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
    
    // Use the best result we found
    let selectedBuffer = bestResult.buffer;
    let selectedColors = bestResult.colors;
    
    const capturedSize = thumbnail.getSize();
    
    console.log(`✅ Quantized PNG: ${capturedSize.width}x${capturedSize.height} (${selectedColors} colors, ${selectedBuffer.length} bytes)`);
    console.log(`🎨 Compression: ${((1 - selectedBuffer.length / inputBuffer.length) * 100).toFixed(1)}% size reduction vs original PNG`);
    
    return {
      success: true,
      image: selectedBuffer.toString('base64'),
      imageFormat: 'png',
      width: capturedSize.width,
      height: capturedSize.height,
      source: 'desktopCapturer',
      paletteColors: selectedColors,
      fileSizeBytes: selectedBuffer.length,
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
