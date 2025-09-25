/**
 * Arrow Renderer - Handles arrow HTML generation and visual styling
 * Responsible for creating golden arrows that point to UI elements
 */

/**
 * Calculate arrow tip offset for positioning
 */
function getArrowTipOffset(direction, size = 150) {
  const offset = size * 0.35;
  const offsets = { 
    right: { x: -offset, y: 0 }, 
    down: { x: 0, y: -offset }, 
    left: { x: offset, y: 0 }, 
    up: { x: 0, y: offset } 
  };
  return offsets[direction] || { x: 0, y: 0 };
}

/**
 * Generate HTML content for arrow overlay
 */
function createArrowHTML(direction, targetX, targetY, color = '#D4AF37', opacity = 0.7) {
  const size = 150;
  const rotations = { right: 0, down: 90, left: 180, up: 270 };
  const offset = getArrowTipOffset(direction, size);
  const centerX = targetX + offset.x;
  const centerY = targetY + offset.y;
  
  return `<!doctype html><meta charset="utf-8">
<style>
  html, body {
    margin: 0;
    height: 100%;
    background: transparent;
  }
  
  #root {
    position: fixed;
    inset: 0;
    pointer-events: none;
  }
  
  .arrow-container {
    position: absolute;
    transform: translate(-50%, -50%);
    backdrop-filter: blur(2px);
    border-radius: 20px;
    padding: 10px;
    pointer-events: none;
  }
  
  svg.arrow {
    display: block;
    overflow: visible;
    filter: drop-shadow(0 0 15px rgba(255, 215, 0, 0.8)) drop-shadow(0 0 30px rgba(212, 175, 55, 0.6));
    animation: arrowPulse 2s ease-in-out infinite;
    pointer-events: none;
  }
  
  @keyframes arrowPulse {
    0%, 100% { 
      filter: drop-shadow(0 0 15px rgba(255, 215, 0, 0.8)) drop-shadow(0 0 30px rgba(212, 175, 55, 0.6));
      transform: scale(1);
    }
    50% { 
      filter: drop-shadow(0 0 25px rgba(255, 215, 0, 1)) drop-shadow(0 0 50px rgba(212, 175, 55, 0.8));
      transform: scale(1.05);
    }
  }
</style>
<div id="root">
  <div class="arrow-container" style="left:${centerX}px;top:${centerY}px;opacity:${opacity};transform:translate(-50%,-50%) rotate(${rotations[direction] || 0}deg)">
    <svg class="arrow" width="${size}" height="${size}">
      <defs>
        <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"  style="stop-color:#FFD700"/>
          <stop offset="50%" style="stop-color:#D4AF37"/>
          <stop offset="100%" style="stop-color:#B8941F"/>
        </linearGradient>
      </defs>
      
      <!-- Simple arrow line -->
      <line x1="${size * 0.05}" y1="${size * 0.50}" x2="${size * 0.75}" y2="${size * 0.50}"
            stroke="#D4AF37" stroke-width="6" stroke-linecap="round"/>
      
      <!-- Simple arrow head -->
      <polygon points="${size * 0.85},${size * 0.5} ${size * 0.70},${size * 0.35} ${size * 0.70},${size * 0.65}"
               fill="#D4AF37" stroke="#D4AF37" stroke-width="1" stroke-linejoin="round"/>
    </svg>
  </div>
</div>`;
}

module.exports = {
  getArrowTipOffset,
  createArrowHTML
};
