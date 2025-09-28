/**
 * Shared Coordinate Utilities
 * Common coordinate transformation and direction logic
 */

/**
 * Determine arrow direction based on coordinate position using 9-grid system
 */
function determineDirection(normalizedCoords) {
  const { x, y } = normalizedCoords;
  const xPercent = x / 10; // 0-1000 -> 0-100
  const yPercent = y / 10; // 0-1000 -> 0-100
  
  // Divide screen into 9 equal rectangles (33.33% each)
  const leftThird = xPercent <= 33.33;
  const rightThird = xPercent >= 66.67;
  const middleX = !leftThird && !rightThird;
  
  const topThird = yPercent <= 33.33;
  const bottomThird = yPercent >= 66.67;
  const middleY = !topThird && !bottomThird;
  
  // Corner positions (diagonal arrows at 45 degrees)
  if (topThird && leftThird) return 'up-left';        // Top-left corner
  if (topThird && rightThird) return 'up-right';      // Top-right corner
  if (bottomThird && leftThird) return 'down-left';   // Bottom-left corner
  if (bottomThird && rightThird) return 'down-right'; // Bottom-right corner
  
  // Edge positions (straight arrows)
  if (topThird && middleX) return 'up';               // Top edge
  if (bottomThird && middleX) return 'down';          // Bottom edge
  if (middleY && leftThird) return 'left';            // Left edge
  if (middleY && rightThird) return 'right';          // Right edge
  
  // Center position (50/50 probability between up and down)
  if (middleX && middleY) {
    return (x + y) % 2 === 0 ? 'up' : 'down';        // Deterministic but 50/50 distribution
  }
  
  // Fallback (should not happen)
  return 'up';
}

/**
 * Convert coordinates directly to screen pixels
 */
function coordsToScreen(percent, displayBounds) {
  const x = Math.round(displayBounds.x + (percent.x / 100) * displayBounds.width);
  const y = Math.round(displayBounds.y + (percent.y / 100) * displayBounds.height);
  return { x, y };
}

/**
 * Transform normalized coordinates (0-1000) to screen pixels
 */
function transformToPixels(normalizedCoords, dimensions) {
  const { x: xNorm, y: yNorm } = normalizedCoords;
  const { width, height } = dimensions;
  
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  
  const xPixel = clamp(Math.round((xNorm / 1000) * width), 0, width - 1);
  const yPixel = clamp(Math.round((yNorm / 1000) * height), 0, height - 1);
  
  return { x: xPixel, y: yPixel };
}

module.exports = {
  determineDirection,
  coordsToScreen,
  transformToPixels
};
