/**
 * Enhanced logging utilities for WiseDragon
 * Centralized logging system used across all modules
 */

/**
 * Get formatted timestamp for logging
 */
function getTimestamp() {
  return new Date().toISOString().replace('T', ' ').replace('Z', '').substring(11, 23);
}

/**
 * Log with timestamp and category
 */
function logWithTime(category, message, ...args) {
  const timestamp = getTimestamp();
  console.log(`[${timestamp}] ${category} ${message}`, ...args);
}

/**
 * Log timing information
 */
function logTiming(operation, startTime, ...additionalInfo) {
  const duration = Date.now() - startTime;
  const timestamp = getTimestamp();
  console.log(`[${timestamp}] ⏱️  ${operation} took ${duration}ms`, ...additionalInfo);
  return duration;
}

/**
 * Log vision model call details
 */
function logVisionCall(modelName, description, imagePath, startTime) {
  const timestamp = getTimestamp();
  const filename = require('path').basename(imagePath);
  console.log(`[${timestamp}] 🔍 VISION CALL: ${modelName.toUpperCase()}`);
  console.log(`[${timestamp}]    📋 Query: "${description}"`);
  console.log(`[${timestamp}]    📸 Image: ${filename}`);
  console.log(`[${timestamp}]    ⏰ Started at: ${new Date(startTime).toISOString().substring(11, 23)}`);
}

/**
 * Log vision model response
 */
function logVisionResponse(modelName, response, coordinates, startTime) {
  const duration = Date.now() - startTime;
  const timestamp = getTimestamp();
  console.log(`[${timestamp}] 🤖 VISION RESPONSE: ${modelName.toUpperCase()} (${duration}ms)`);
  console.log(`[${timestamp}]    📝 Raw response: "${response}"`);
  if (coordinates) {
    console.log(`[${timestamp}]    📍 Coordinates: pixel(${coordinates.pixel?.x}, ${coordinates.pixel?.y}) | normalized(${coordinates.normalized?.x}, ${coordinates.normalized?.y})`);
  }
}

/**
 * Log arrow placement details
 */
function logArrowPlacement(direction, screenCoords, localCoords, description) {
  const timestamp = getTimestamp();
  console.log(`[${timestamp}] 🏹 ARROW PLACEMENT: ${direction.toUpperCase()}`);
  console.log(`[${timestamp}]    🎯 Target: "${description}"`);
  console.log(`[${timestamp}]    📍 Screen coords: (${screenCoords.x}, ${screenCoords.y})`);
  console.log(`[${timestamp}]    📍 Local coords: (${localCoords.x}, ${localCoords.y})`);
}

/**
 * Start timing operation
 */
function startTiming(operation) {
  const startTime = Date.now();
  const timestamp = getTimestamp();
  console.log(`[${timestamp}] ⏱️  Started: ${operation}`);
  return startTime;
}

module.exports = {
  getTimestamp,
  logWithTime,
  logTiming,
  logVisionCall,
  logVisionResponse,
  logArrowPlacement,
  startTiming
};
