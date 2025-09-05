const { desktopCapturer, screen } = require('electron');

async function execute(args) {
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
    const maxRawSize = 75000;
    let selectedBuffer, selectedFormat, selectedQuality;
    
    // Try PNG first (best for text), fallback to JPEG
    const pngBuffer = thumbnail.toPNG();
    if (pngBuffer.length <= maxRawSize) {
      selectedBuffer = pngBuffer;
      selectedFormat = 'png';
      selectedQuality = 100;
    } else {
      selectedFormat = 'jpeg';
      const qualities = [90, 80, 70, 60, 50];
      
      for (const quality of qualities) {
        const buffer = thumbnail.toJPEG(quality);
        if (buffer.length <= maxRawSize) {
          selectedBuffer = buffer;
          selectedQuality = quality;
          break;
        }
      }
      
      if (!selectedBuffer) {
        selectedBuffer = thumbnail.toJPEG(50);
        selectedQuality = 50;
      }
    }
    
    const capturedSize = thumbnail.getSize();
    
    return {
      success: true,
      image: selectedBuffer.toString('base64'),
      imageFormat: selectedFormat,
      width: capturedSize.width,
      height: capturedSize.height,
      source: 'desktopCapturer'
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = { execute };
