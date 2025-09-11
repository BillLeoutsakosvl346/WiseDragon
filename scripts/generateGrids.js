const { applyCoordinateNet } = require('../utils/applyCoordinateNet');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

// Common screen resolutions to pre-generate grids for
const COMMON_RESOLUTIONS = [
  { width: 1920, height: 1200 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 3840, height: 2160 }, // 4K
  { width: 1366, height: 768 },
  { width: 1680, height: 1050 },
  { width: 2560, height: 1600 },
  { width: 1440, height: 900 }
];

async function generateCoordinateGridOnly(width, height) {
  console.log(`📐 Generating coordinate grid for ${width}x${height}...`);
  
  // Create transparent background image
  const transparentBackground = await sharp({
    create: {
      width: width,
      height: height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  }).png().toBuffer();

  // Apply coordinate net to transparent background
  const gridOverlay = await applyCoordinateNet(transparentBackground, {
    // Override to make dots/text more visible on transparent background
    labelStroke: '#ffffff',
    labelStrokeWidth: 2.0
  });

  return gridOverlay;
}

async function generateAllGrids() {
  const startTime = Date.now();
  console.log('🎯 Starting coordinate grid pre-generation...');
  
  // Ensure media directory exists
  const mediaDir = path.join(__dirname, '..', 'media');
  try {
    await fs.mkdir(mediaDir, { recursive: true });
    console.log('📁 Media directory created/verified');
  } catch (error) {
    console.log('📁 Media directory already exists');
  }

  // Generate grids for each resolution
  for (const resolution of COMMON_RESOLUTIONS) {
    const { width, height } = resolution;
    const filename = `grid_${width}x${height}.png`;
    const filepath = path.join(mediaDir, filename);
    
    try {
      const gridStart = Date.now();
      
      // Generate coordinate grid overlay
      const gridBuffer = await generateCoordinateGridOnly(width, height);
      
      // Save to media folder
      await fs.writeFile(filepath, gridBuffer);
      
      const gridTime = Date.now() - gridStart;
      console.log(`✅ Generated ${filename} in ${gridTime}ms`);
      
    } catch (error) {
      console.error(`❌ Failed to generate ${filename}:`, error.message);
    }
  }

  const totalTime = Date.now() - startTime;
  console.log(`🎉 Grid generation complete! Total time: ${totalTime}ms`);
  console.log(`📊 Generated ${COMMON_RESOLUTIONS.length} coordinate grid overlays`);
}

// Run the generation
generateAllGrids().catch(error => {
  console.error('❌ Grid generation failed:', error);
  process.exit(1);
});
