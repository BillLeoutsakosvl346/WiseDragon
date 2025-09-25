/**
 * Overlay Utilities - Coordinate transformations and arrow logic
 */

/**
 * Determine arrow direction based on coordinate position
 */
function determineDirection(normalizedCoords) {
  const { x, y } = normalizedCoords;
  
  // Convert to 0-100 scale for easier threshold logic
  const xPercent = x / 10; // 0-1000 -> 0-100
  const yPercent = y / 10; // 0-1000 -> 0-100
  
  // Priority order: edges first, then corners, then middle
  if (yPercent <= 25) return 'up';        // Top edge - arrow points up
  if (yPercent >= 75) return 'down';      // Bottom edge - arrow points down
  if (xPercent <= 25) return 'left';      // Left edge - arrow points left
  if (xPercent >= 75) return 'right';     // Right edge - arrow points right
  
  // Middle area - choose randomly but consistently
  const directions = ['up', 'right', 'down', 'left'];
  return directions[Math.floor((x + y) % 4)]; // Pseudo-random but deterministic
}

/**
 * Convert 0-100 coordinates to normalized 0-1 coordinates
 */
function coordsToNorm(x100, y100) {
  return { x_norm: x100 / 100, y_norm: y100 / 100 };
}

/**
 * Convert normalized coordinates to screen pixels
 */
function normToScreen(xn, yn, bounds) {
  return { 
    x: Math.round(bounds.x + xn * bounds.width), 
    y: Math.round(bounds.y + yn * bounds.height) 
  };
}

module.exports = {
  determineDirection,
  coordsToNorm,
  normToScreen
};
