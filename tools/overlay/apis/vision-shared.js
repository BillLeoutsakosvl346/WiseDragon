/**
 * Shared Vision API Utilities
 * Common functions used by both UGround and Grounding DINO APIs
 */

const fs = require('fs');
const path = require('path');

/**
 * Convert image file to base64 data URL
 */
function toBase64DataURL(imagePath) {
  const buffer = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Extract dimensions from screenshot filename or use fallback
 */
function inferDimensions(filePath) {
  const filename = path.basename(filePath);
  const match = filename.match(/_(\d+)x(\d+)_/);
  return match ? 
    { width: Number(match[1]), height: Number(match[2]) } : 
    { width: 1366, height: 768 };
}

/**
 * Simple logging for vision calls
 */
function logVisionCall(modelName, query) {
  const timestamp = new Date().toISOString().substring(11, 23);
  console.log(`[${timestamp}] 🤖 Using ${modelName.toUpperCase()} for: "${query}"`);
}

/**
 * Simple logging for vision results
 */
function logVisionResult(modelName, success, coords) {
  const timestamp = new Date().toISOString().substring(11, 23);
  if (success && coords) {
    console.log(`[${timestamp}] ✅ ${modelName.toUpperCase()} found target at (${coords.x}, ${coords.y})`);
  } else {
    console.log(`[${timestamp}] ❌ ${modelName.toUpperCase()} could not locate target`);
  }
}

/**
 * Standard error handling for vision APIs
 */
function handleVisionError(modelName, error) {
  const timestamp = new Date().toISOString().substring(11, 23);
  console.error(`[${timestamp}] ❌ ${modelName} error:`, error.message);
  return { success: false, error: error.message };
}

module.exports = {
  toBase64DataURL,
  inferDimensions,
  logVisionCall,
  logVisionResult,
  handleVisionError
};
