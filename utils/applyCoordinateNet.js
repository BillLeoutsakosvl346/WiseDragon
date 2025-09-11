const sharp = require('sharp');

// Default configuration
const defaultOptions = {
  gridCols: 8,              // 8 columns for better precision
  gridRows: 6,              // 6 rows for better precision
  includeEdges: true,       // include 0 and 1
  dotRadiusPx: 8,           // Even smaller dots for minimal visual clutter
  labelMode: 'norm',        // 'norm' | 'px' | 'none'
  labelEvery: 1,            // label every single point
  fontPx: 32,               // Much bigger font for maximum coordinate readability
  labelColor: '#FF0000',    // Very visible red color
  labelStroke: '#000000',   // Black stroke around red text
  labelStrokeWidth: 1.2,    // Thinner stroke for lighter appearance
  labelDx: 18,              // Less space from dot
  labelDy: 18,              // Less space from dot
  drawBorderBox: false,     // optional thin border
  pngPaletteColors: 32      // set false for full-colour
};

/**
 * @param {Buffer} imageBuffer - PNG/JPEG screenshot
 * @param {Object} [opts]
 * @returns {Promise<Buffer>} PNG buffer with overlay
 */
async function applyCoordinateNet(imageBuffer, opts = {}) {
  // Merge options with defaults
  const options = { ...defaultOptions, ...opts };
  
  // Get image metadata
  const { width, height } = await sharp(imageBuffer).metadata();
  
  // Generate grid points
  const points = [];
  const cols = options.includeEdges ? options.gridCols + 1 : options.gridCols;
  const rows = options.includeEdges ? options.gridRows + 1 : options.gridRows;
  
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      let x_norm, y_norm;
      
      if (options.includeEdges) {
        x_norm = i / options.gridCols;
        y_norm = j / options.gridRows;
      } else {
        x_norm = (i + 1) / (options.gridCols + 1);
        y_norm = (j + 1) / (options.gridRows + 1);
      }
      
      const xPx = x_norm * width;
      const yPx = y_norm * height;
      
      points.push({ x_norm, y_norm, xPx, yPx, i, j });
    }
  }
  
  // Build SVG string
  let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  
  // Optional border box
  if (options.drawBorderBox) {
    svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="none" stroke="#000" stroke-width="1"/>`;
  }
  
  // Draw dots and labels
  points.forEach((point, index) => {
    const { x_norm, y_norm, xPx, yPx } = point;
    
    // Draw dot
    svg += `<circle cx="${xPx}" cy="${yPx}" r="${options.dotRadiusPx}" fill="#ff0000" stroke="#fff" stroke-width="0.5"/>`;
    
    // Add label if needed
    if (options.labelMode !== 'none' && index % options.labelEvery === 0) {
      let labelText = '';
      
      if (options.labelMode === 'norm') {
        // Use standard screen coordinates: top-left is (0,0), bottom-right is (100,100)
        labelText = `(${Math.round(x_norm * 100)},${Math.round(y_norm * 100)})`;
      } else if (options.labelMode === 'px') {
        labelText = `(${Math.round(xPx)},${Math.round(yPx)})`;
      }
      
      if (labelText) {
        // Smart positioning based on grid position to keep labels fully visible
        let textX, textY, textAnchor, dominantBaseline;
        
        const isTop = (point.j === 0);
        const isBottom = (point.j === rows - 1);
        const isLeft = (point.i === 0);
        const isRight = (point.i === cols - 1);
        
        // Handle corners first
        if (isTop && isLeft) {
          [textX, textY, textAnchor, dominantBaseline] = [xPx + options.labelDx, yPx + options.labelDy, 'start', 'hanging'];
        } else if (isTop && isRight) {
          [textX, textY, textAnchor, dominantBaseline] = [xPx - options.labelDx, yPx + options.labelDy, 'end', 'hanging'];
        } else if (isBottom && isLeft) {
          [textX, textY, textAnchor, dominantBaseline] = [xPx + options.labelDx, yPx - options.labelDy, 'start', 'baseline'];
        } else if (isBottom && isRight) {
          [textX, textY, textAnchor, dominantBaseline] = [xPx - options.labelDx, yPx - options.labelDy, 'end', 'baseline'];
        } 
        // Handle edges
        else if (isTop) {
          [textX, textY, textAnchor, dominantBaseline] = [xPx, yPx + options.labelDy, 'middle', 'hanging'];
        } else if (isBottom) {
          [textX, textY, textAnchor, dominantBaseline] = [xPx, yPx - options.labelDy, 'middle', 'baseline'];
        } else if (isLeft) {
          [textX, textY, textAnchor, dominantBaseline] = [xPx + options.labelDx, yPx, 'start', 'middle'];
        } else if (isRight) {
          [textX, textY, textAnchor, dominantBaseline] = [xPx - options.labelDx, yPx, 'end', 'middle'];
        } 
        // Interior points - place above
        else {
          [textX, textY, textAnchor, dominantBaseline] = [xPx, yPx - options.labelDy, 'middle', 'baseline'];
        }
        
        svg += `<text x="${textX}" y="${textY}" ` +
               `font-family="Arial, sans-serif" font-size="${options.fontPx}" font-weight="bold" ` +
               `fill="${options.labelColor}" ` +
               `stroke="${options.labelStroke}" stroke-width="${options.labelStrokeWidth}" ` +
               `text-anchor="${textAnchor}" dominant-baseline="${dominantBaseline}" ` +
               `paint-order="stroke">${labelText}</text>`;
      }
    }
  });
  
  svg += '</svg>';
  
  // Composite SVG over base image
  let pipeline = sharp(imageBuffer).composite([{
    input: Buffer.from(svg),
    top: 0,
    left: 0
  }]);
  
  // Configure PNG output
  if (options.pngPaletteColors !== false && typeof options.pngPaletteColors === 'number') {
    pipeline = pipeline.png({ 
      palette: true, 
      colors: options.pngPaletteColors 
    });
  } else {
    pipeline = pipeline.png();
  }
  
  return await pipeline.toBuffer();
}

module.exports = { applyCoordinateNet };
