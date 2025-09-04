/**
 * Screenshot Tool Executor
 * 
 * Implements real screenshot capture functionality using Electron's desktopCapturer API.
 * Captures the primary display and returns base64 PNG data.
 */

const { desktopCapturer, screen } = require('electron');

/**
 * Execute screenshot capture
 * @param {Object} args - Function arguments (currently unused)
 * @returns {Promise<Object>} Screenshot result
 */
async function execute(args) {
  console.log('📷 === SCREENSHOT TOOL EXECUTION START ===');
  console.log('📋 Arguments received:', JSON.stringify(args, null, 2));
  console.log('⏰ Start time:', new Date().toISOString());
  
  const startTime = Date.now();
  
  try {
    console.log('🔍 Checking Electron environment...');
    
    // Check if we're running in Electron environment
    if (!desktopCapturer || !screen) {
      throw new Error('Screenshot capture requires Electron environment');
    }
    
    console.log('✅ Electron APIs available (desktopCapturer, screen)');
    
    // Get primary display info first to set appropriate thumbnail size
    console.log('🖥️ Getting primary display information...');
    const primaryDisplay = screen.getPrimaryDisplay();
    const displaySize = primaryDisplay.size;
    
    console.log('📊 Primary display details:', {
      size: `${displaySize.width}x${displaySize.height}`,
      scaleFactor: primaryDisplay.scaleFactor,
      rotation: primaryDisplay.rotation,
      internal: primaryDisplay.internal
    });
    
    // Calculate thumbnail size for capture (optimized for AI vision + data channel)
    // Strategy: Target 50-60KB final message size for optimal quality
    // Increased resolution for better AI analysis while staying under 64KB limit
    const maxDimension = 640; // Tuned to hit 50-60KB final message size without chunking
    const aspectRatio = displaySize.width / displaySize.height;
    
    let thumbnailSize;
    if (aspectRatio > 1) {
      // Landscape: limit width, calculate height
      thumbnailSize = {
        width: Math.min(displaySize.width, maxDimension),
        height: Math.min(displaySize.height, Math.round(maxDimension / aspectRatio))
      };
    } else {
      // Portrait: limit height, calculate width  
      thumbnailSize = {
        width: Math.min(displaySize.width, Math.round(maxDimension * aspectRatio)),
        height: Math.min(displaySize.height, maxDimension)
      };
    }
    
    console.log('📏 Optimized thumbnail size for data channel limits:', thumbnailSize);
    console.log('📊 Aspect ratio preserved:', aspectRatio.toFixed(2));
    
    console.log('📏 Calculated thumbnail size:', thumbnailSize);
    
    // Get available display sources with full resolution thumbnail
    console.log('🔍 Getting available screen sources...');
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: thumbnailSize
    });
    
    console.log('📊 Available sources:', sources.length);
    
    if (sources.length === 0) {
      throw new Error('No screen sources available');
    }
    
    console.log('📋 All available sources:', sources.map(s => ({
      id: s.id,
      name: s.name,
      display_id: s.display_id,
      thumbnailSize: s.thumbnail ? s.thumbnail.getSize() : 'no thumbnail'
    })));
    
    // Use the first available screen source (typically primary display)
    const primarySource = sources[0];
    console.log('🎯 === SELECTING SCREENSHOT SOURCE ===');
    console.log('📊 Selected source:', {
      id: primarySource.id,
      name: primarySource.name,
      display_id: primarySource.display_id
    });
    console.log('⏰ Screenshot will be taken NOW (current time):', new Date().toISOString());
    console.log('🔍 Make sure the content you want analyzed is visible on screen RIGHT NOW');
    
    // Get the thumbnail (this is our screenshot)
    console.log('📸 Extracting thumbnail from source...');
    const thumbnail = primarySource.thumbnail;
    
    if (thumbnail.isEmpty()) {
      throw new Error('Screenshot capture failed - empty thumbnail');
    }
    
    console.log('✅ Thumbnail extracted successfully');
    console.log('📊 Thumbnail properties:', {
      isEmpty: thumbnail.isEmpty(),
      aspect_ratio: thumbnail.getAspectRatio(),
      size: thumbnail.getSize()
    });
    
    // Convert nativeImage using optimal compression for AI + data channel
    console.log('🔄 Converting thumbnail with optimal compression...');
    
    // Try multiple compression levels to find the best fit
    const jpegBuffer80 = thumbnail.toJPEG(80); // Higher quality
    const jpegBuffer60 = thumbnail.toJPEG(60); // Medium quality  
    const jpegBuffer40 = thumbnail.toJPEG(40); // Lower quality
    
    console.log('📊 Compression options:');
    console.log('  📊 JPEG 80%:', jpegBuffer80.length, 'bytes');
    console.log('  📊 JPEG 60%:', jpegBuffer60.length, 'bytes'); 
    console.log('  📊 JPEG 40%:', jpegBuffer40.length, 'bytes');
    console.log('  📊 PNG ref:', thumbnail.toPNG().length, 'bytes');
    
    // Choose compression level that fits in data channel with best quality
    // Target: 50-60KB final message size, but must stay under 64KB total with JSON
    const maxDataChannelPayload = 48000; // ~48KB for image data (leaves 16KB for JSON overhead)
    let selectedBuffer, selectedQuality;
    
    if (jpegBuffer80.length <= maxDataChannelPayload) {
      selectedBuffer = jpegBuffer80;
      selectedQuality = 80;
    } else if (jpegBuffer60.length <= maxDataChannelPayload) {
      selectedBuffer = jpegBuffer60;
      selectedQuality = 60;
    } else if (jpegBuffer40.length <= maxDataChannelPayload) {
      selectedBuffer = jpegBuffer40;
      selectedQuality = 40;
    } else {
      // If still too large, try even lower quality to fit
      const jpegBuffer30 = thumbnail.toJPEG(30);
      const jpegBuffer20 = thumbnail.toJPEG(20);
      
      console.log('  📊 JPEG 30%:', jpegBuffer30.length, 'bytes');
      console.log('  📊 JPEG 20%:', jpegBuffer20.length, 'bytes');
      
      if (jpegBuffer30.length <= maxDataChannelPayload) {
        selectedBuffer = jpegBuffer30;
        selectedQuality = 30;
      } else if (jpegBuffer20.length <= maxDataChannelPayload) {
        selectedBuffer = jpegBuffer20;
        selectedQuality = 20;
      } else {
        // Absolute fallback - will trigger chunking strategy
        selectedBuffer = jpegBuffer20;
        selectedQuality = 20;
      }
    }
    
    console.log('✅ Selected JPEG quality:', selectedQuality + '%');
    console.log('📊 Selected buffer size:', selectedBuffer.length, 'bytes');
    
    console.log('🔄 Converting selected JPEG to base64...');
    const base64Image = selectedBuffer.toString('base64');
    
    // Get actual captured image dimensions
    const capturedSize = thumbnail.getSize();
    const executionTime = Date.now() - startTime;
    
    console.log('✅ === SCREENSHOT CAPTURE COMPLETED ===');
    console.log('⏱️ Total capture time:', executionTime + 'ms');
    console.log('📏 Final dimensions:', `${capturedSize.width}x${capturedSize.height}`);
    console.log('📊 Base64 string length:', base64Image.length, 'characters');
    console.log('💾 Estimated file size:', Math.round(base64Image.length / 1024), 'KB');
    
    // Check if image will fit in WebRTC data channel (~64KB limit including JSON)
    const estimatedMessageSize = base64Image.length + 500; // +500 for JSON overhead
    const maxDataChannelSize = 65536; // 64KB
    
    if (estimatedMessageSize > maxDataChannelSize) {
      console.warn('⚠️ SCREENSHOT TOO LARGE FOR DATA CHANNEL');
      console.warn('📊 Estimated message size:', Math.round(estimatedMessageSize / 1024) + 'KB');
      console.warn('📊 Data channel limit: 64KB');
      console.warn('🔄 Image will trigger fallback to text description');
    } else {
      console.log('✅ Screenshot size OK for data channel');
      console.log('📊 Estimated message size:', Math.round(estimatedMessageSize / 1024) + 'KB');
    }
    
    console.log('🎯 First 50 chars:', base64Image.substring(0, 50) + '...');
    console.log('📸 Captured:', primarySource.name);
    console.log('⏰ Timestamp:', new Date().toISOString());
    
    const result = {
      success: true,
      image: base64Image,
      width: capturedSize.width,
      height: capturedSize.height,
      timestamp: Date.now(),
      source: 'desktopCapturer',
      executionTime: executionTime,
      display: {
        id: primarySource.id,
        name: primarySource.name,
        primary: true,
        scaleFactor: primaryDisplay.scaleFactor,
        size: displaySize,
        internal: primaryDisplay.internal
      }
    };
    
    console.log('📦 Final result package:', {
      success: result.success,
      dimensions: `${result.width}x${result.height}`,
      imageSize: `${Math.round(result.image.length / 1024)}KB`,
      executionTime: result.executionTime + 'ms',
      timestamp: new Date(result.timestamp).toISOString(),
      source: result.source,
      displayName: result.display.name
    });
    
    return result;
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    console.error('❌ === SCREENSHOT CAPTURE FAILED ===');
    console.error('⏱️ Failed after:', executionTime + 'ms');
    console.error('💥 Error type:', error.name);
    console.error('📝 Error message:', error.message);
    console.error('🔍 Full error object:', error);
    console.error('📋 Stack trace:', error.stack);
    
    // Additional debugging for common errors
    if (error.message.includes('Electron environment')) {
      console.error('🔧 Debug: desktopCapturer available:', !!desktopCapturer);
      console.error('🔧 Debug: screen available:', !!screen);
    }
    
    if (error.message.includes('No screen sources')) {
      console.error('🔧 Debug: This might be a permission issue');
      console.error('🔧 Debug: Check screen recording permissions on macOS');
    }
    
    const errorResult = {
      success: false,
      error: error.message,
      timestamp: Date.now(),
      source: 'desktopCapturer',
      executionTime: executionTime,
      errorType: error.name
    };
    
    console.error('📦 Error result package:', errorResult);
    
    return errorResult;
  }
}

module.exports = {
  execute
};
