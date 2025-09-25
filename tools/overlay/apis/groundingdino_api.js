/**
 * Grounding DINO API Service - Object Detection
 * Simplified version using shared utilities
 */

const { toBase64DataURL, logVisionCall, logVisionResult, handleVisionError } = require('./vision-shared');
const Replicate = require('replicate');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '..', '.env') });

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const GROUNDING_DINO_MODEL = "adirik/grounding-dino:efd10a8ddc57ea28773327e881ce95e20cc1d734c589f7dd01d2036921ed78aa";

/**
 * Simplify complex queries to basic object names for better DINO detection
 */
function simplifyQuery(query) {
  const lowerQuery = query.toLowerCase();
  
  // Extract core animal/object names
  if (lowerQuery.includes('cat')) return 'cat';
  if (lowerQuery.includes('dog')) return 'dog';
  if (lowerQuery.includes('person') || lowerQuery.includes('human')) return 'person';
  if (lowerQuery.includes('button')) return 'button';
  if (lowerQuery.includes('car')) return 'car';
  if (lowerQuery.includes('bird')) return 'bird';
  
  // For multi-word descriptions, try to extract the main noun
  const words = lowerQuery.split(' ');
  const lastWord = words[words.length - 1];
  
  // Common objects that DINO recognizes well
  const commonObjects = ['mouse', 'keyboard', 'phone', 'laptop', 'book', 'chair', 'table', 'cup', 'bottle'];
  if (commonObjects.includes(lastWord)) {
    return lastWord;
  }
  
  // If no simplification possible, return original
  return query;
}

/**
 * Filter detections by target area
 */
function filterByArea(detections, targetArea) {
  if (!targetArea || !detections) return detections;
  
  return detections.filter(detection => {
    const [left, top, right, bottom] = detection.bbox;
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;
    
    // Updated for 1366x768 resolution
    switch (targetArea) {
      case "bottom-right":
        return centerX > 683 && centerY > 300;
      case "center":
        return centerX > 300 && centerX < 1066 && centerY > 150 && centerY < 600;
      case "top-left":
        return centerX < 683 && centerY < 500;
      case "top-right":
        return centerX > 683 && centerY < 500;
      case "bottom-left":
        return centerX < 683 && centerY > 300;
      default:
        return true;
    }
  });
}

/**
 * Detect object center using Grounding DINO
 */
async function detectObjectCenter(imagePath, query, targetArea = null) {
  if (!REPLICATE_API_TOKEN) {
    const timestamp = new Date().toISOString().substring(11, 23);
    console.log(`[${timestamp}] ⚠️ GROUNDING DINO: No API token configured`);
    return { x: null, y: null };
  }

  try {
    logVisionCall('Grounding DINO', query);
    
    // Simplify query for better detection
    const simplifiedQuery = simplifyQuery(query);
    
    const replicate = new Replicate();
    const dataUrl = toBase64DataURL(imagePath);
    
    const input = {
      image: dataUrl,
      query: simplifiedQuery,
      box_threshold: 0.25,
      text_threshold: 0.20,
      show_visualisation: false
    };

    // Call Replicate API
    const output = await replicate.run(GROUNDING_DINO_MODEL, { input });
    
    if (!output?.detections?.length) {
      logVisionResult('Grounding DINO', false);
      return { x: null, y: null };
    }

    // Filter by area if specified
    const candidates = filterByArea(output.detections, targetArea);
    
    if (!candidates.length) {
      logVisionResult('Grounding DINO', false);
      return { x: null, y: null };
    }

    // Get highest confidence detection
    const best = candidates.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];
    const [left, top, right, bottom] = best.bbox;
    const centerX = Math.round((left + right) / 2);
    const centerY = Math.round((top + bottom) / 2);
    
    logVisionResult('Grounding DINO', true, { x: centerX, y: centerY });
    
    return { x: centerX, y: centerY };
    
  } catch (error) {
    logVisionResult('Grounding DINO', false);
    return handleVisionError('Grounding DINO', error);
  }
}

module.exports = {
  detectObjectCenter
};