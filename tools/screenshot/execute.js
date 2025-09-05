const { desktopCapturer, screen } = require('electron');

async function execute(args) {
  const startTime = Date.now();
  
  try {
    if (!desktopCapturer || !screen) {
      throw new Error('Screenshot capture requires Electron environment');
    }
    
    const primaryDisplay = screen.getPrimaryDisplay();
    const displaySize = primaryDisplay.size;
    
    // Calculate 720px thumbnail size (optimized for 60KB data channel limit)
    const maxDimension = 720;
    const aspectRatio = displaySize.width / displaySize.height;
    const thumbnailSize = aspectRatio > 1 ? {
      width: Math.min(displaySize.width, maxDimension),
      height: Math.min(displaySize.height, Math.round(maxDimension / aspectRatio))
    } : {
      width: Math.min(displaySize.width, Math.round(maxDimension * aspectRatio)),
      height: Math.min(displaySize.height, maxDimension)
    };
    
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: thumbnailSize
    });
    
    if (sources.length === 0) {
      throw new Error('No screen sources available');
    }
    
    const thumbnail = sources[0].thumbnail;
    if (!thumbnail || thumbnail.isEmpty()) {
      throw new Error('Screenshot capture failed - no thumbnail');
    }
    
    // Generate JPEG at different qualities and select best fit for 45KB target (= ~60KB final)
    const jpegBuffers = {
      90: thumbnail.toJPEG(90),
      80: thumbnail.toJPEG(80), 
      70: thumbnail.toJPEG(70),
      60: thumbnail.toJPEG(60),
      50: thumbnail.toJPEG(50)
    };
    
    const maxRawSize = 45000; // 45KB raw = ~60KB after base64+JSON
    let selectedBuffer, selectedQuality;
    
    for (const quality of [90, 80, 70, 60, 50]) {
      if (jpegBuffers[quality].length <= maxRawSize) {
        selectedBuffer = jpegBuffers[quality];
        selectedQuality = quality;
        break;
      }
    }
    
    if (!selectedBuffer) {
      selectedBuffer = jpegBuffers[50]; // Fallback
      selectedQuality = 50;
    }
    
    const capturedSize = thumbnail.getSize();
    const base64Image = selectedBuffer.toString('base64');
    const executionTime = Date.now() - startTime;
    
    return {
      success: true,
      image: base64Image,
      imageFormat: 'jpeg',
      width: capturedSize.width,
      height: capturedSize.height,
      timestamp: Date.now(),
      source: 'desktopCapturer',
      executionTime: executionTime,
      quality: selectedQuality,
      fileSizeBytes: selectedBuffer.length,
      display: {
        id: sources[0].id,
        name: sources[0].name,
        primary: true,
        scaleFactor: primaryDisplay.scaleFactor,
        size: displaySize,
        internal: primaryDisplay.internal
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      timestamp: Date.now(),
      source: 'desktopCapturer',
      executionTime: Date.now() - startTime,
      errorType: error.name
    };
  }
}

module.exports = {
  execute
};
