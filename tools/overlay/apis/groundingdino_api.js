// tools/overlay/apis/groundingdino_api.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '..', '.env') });
const Replicate = require('replicate');
const fs = require('fs');
const path = require('path');
const { logVisionCall, logVisionResponse, logTiming, startTiming } = require('../../../utils/logger');

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const GROUNDING_DINO_MODEL = "adirik/grounding-dino:efd10a8ddc57ea28773327e881ce95e20cc1d734c589f7dd01d2036921ed78aa";

/**
 * Convert image file to base64 data URL for Replicate
 */
function imageToDataURL(imagePath) {
  const buffer = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

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

function getAreaDescription(targetArea) {
  switch (targetArea) {
    case "top-right": return "X > 683, Y < 500 (right half, upper portion)";
    case "top-left": return "X < 683, Y < 500 (left half, upper portion)";
    case "bottom-right": return "X > 683, Y > 300 (right half, lower portion)";
    case "bottom-left": return "X < 683, Y > 300 (left half, lower portion)";
    case "center": return "X: 300-1066, Y: 150-600 (center area)";
    default: return "No area filter";
  }
}

// --- helpers ---
function filterByArea(detections, targetArea) {
  if (!targetArea || !detections) return detections;
  
  return detections.filter(detection => {
    const [left, top, right, bottom] = detection.bbox;
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;
    
    // Updated for 1366x768 resolution with more permissive areas
    switch (targetArea) {
      case "bottom-right":
        return centerX > 683 && centerY > 300;      // Right half, lower portion
      case "center":
        return centerX > 300 && centerX < 1066 && centerY > 150 && centerY < 600;
      case "top-left":
        return centerX < 683 && centerY < 500;      // Left half, upper portion
      case "top-right":
        return centerX > 683 && centerY < 500;      // Right half, upper portion (more permissive)
      case "bottom-left":
        return centerX < 683 && centerY > 300;      // Left half, lower portion
      default:
        return true;
    }
  });
}

// --- exports ---
async function detectObjectCenter(imagePath, query, targetArea = null) {
  const overallStartTime = startTiming(`Grounding DINO processing for "${query}"`);
  
  if (!REPLICATE_API_TOKEN) {
    console.log(`[${require('../../../utils/logger').getTimestamp()}] ⚠️  GROUNDING DINO: No API token configured`);
    return { x: null, y: null };
  }

  try {
    logVisionCall('grounding_dino', query, imagePath, overallStartTime);
    
    // Simplify query for better DINO object detection
    const simplifiedQuery = simplifyQuery(query);
    if (simplifiedQuery !== query) {
      console.log(`[${require('../../../utils/logger').getTimestamp()}] 🔍 Query simplified: "${query}" → "${simplifiedQuery}"`);
    }
    
    const replicate = new Replicate();
    
    // Convert to base64 data URL (no GCS upload needed!)
    const encodingStartTime = Date.now();
    const dataUrl = imageToDataURL(imagePath);
    const encodingDuration = logTiming('Base64 encoding', encodingStartTime);
    
    const input = {
      image: dataUrl,              // Base64 data URL (no GCS!)
      query: simplifiedQuery,      // Use simplified query for better detection
      box_threshold: 0.25,         // Lower threshold for better detection
      text_threshold: 0.20,        // Lower threshold for better detection
      show_visualisation: false
    };

    console.log(`[${require('../../../utils/logger').getTimestamp()}] 📋 Sending to Grounding DINO: Query: "${query}", Target area: ${targetArea || 'any'}`);
    
    // Check unified image format and log payload details
    const stats = fs.statSync(imagePath);
    const fileSizeKB = Math.round(stats.size / 1024);
    const dataUrlSizeKB = Math.round(dataUrl.length / 1024);
    const isUnifiedFormat = imagePath.includes('64colors.png');
    
    console.log(`[${require('../../../utils/logger').getTimestamp()}] 📁 File: ${path.basename(imagePath)} (${fileSizeKB}KB)`);
    console.log(`[${require('../../../utils/logger').getTimestamp()}] 📊 Base64 payload: ${dataUrlSizeKB}KB (${encodingDuration}ms encoding)`);
    console.log(`[${require('../../../utils/logger').getTimestamp()}] 📡 Request method: Direct base64 (NO GCS upload!)`);
    
    if (isUnifiedFormat) {
      console.log(`[${require('../../../utils/logger').getTimestamp()}] 🎨 UNIFIED FORMAT: 1366x768 PNG 64-color quantization`);
      console.log(`[${require('../../../utils/logger').getTimestamp()}] ✅ Optimized for WebRTC + Replicate Grounding DINO (direct base64)`);
    } else {
      console.log(`[${require('../../../utils/logger').getTimestamp()}] ⚠️  Non-standard format detected - expected 1366x768 64colors.png`);
    }
    
    // Check payload size against Replicate limits
    if (dataUrlSizeKB > 256) {
      console.log(`[${require('../../../utils/logger').getTimestamp()}] ⚠️  Payload ${dataUrlSizeKB}KB > 256KB Replicate limit - may fail`);
    } else {
      console.log(`[${require('../../../utils/logger').getTimestamp()}] ✅ Payload ${dataUrlSizeKB}KB within Replicate 256KB limit`);
    }
    
    console.log(`[${require('../../../utils/logger').getTimestamp()}] ⚙️  Thresholds: box=${input.box_threshold}, text=${input.text_threshold} (lowered for better detection)`);
    
    // Call Replicate API with detailed timing
    console.log(`[${require('../../../utils/logger').getTimestamp()}] 🦕 Starting Replicate Grounding DINO request...`);
    const apiStartTime = Date.now();
    
    const requestStartTime = Date.now();
    const output = await replicate.run(GROUNDING_DINO_MODEL, { input }).catch((error) => {
      console.log(`[${require('../../../utils/logger').getTimestamp()}] ❌ Grounding DINO API error:`, error.message);
      return null;
    });
    const requestDuration = Date.now() - requestStartTime;
    
    const apiDuration = logTiming('Replicate API call', apiStartTime);
    
    // Detailed breakdown logging
    console.log(`[${require('../../../utils/logger').getTimestamp()}] 📊 REPLICATE TIMING BREAKDOWN:`);
    console.log(`[${require('../../../utils/logger').getTimestamp()}]   🌐 Network request: ${requestDuration}ms`);
    console.log(`[${require('../../../utils/logger').getTimestamp()}]   📦 Payload sent: ${dataUrlSizeKB}KB base64`);
    console.log(`[${require('../../../utils/logger').getTimestamp()}]   🎯 Total time: ${apiDuration}ms`);
    
    // Performance analysis
    if (requestDuration > 2000) {
      console.log(`[${require('../../../utils/logger').getTimestamp()}] ⚠️  Network request >2s - possible Replicate infrastructure delay`);
    } else if (requestDuration < 1000) {
      console.log(`[${require('../../../utils/logger').getTimestamp()}] ✅ Good network performance to Replicate`);
    }
    
    if (!output?.detections?.length) {
      logVisionResponse('grounding_dino', 'No detections found', null, overallStartTime);
      return { x: null, y: null };
    }

    console.log(`[${require('../../../utils/logger').getTimestamp()}] 📊 Grounding DINO found ${output.detections.length} detections`);
    
    // Log ALL detections for debugging
    console.log(`[${require('../../../utils/logger').getTimestamp()}] 🔍 ALL DETECTIONS FOUND:`);
    output.detections.forEach((det, i) => {
      const [left, top, right, bottom] = det.bbox;
      const centerX = Math.round((left + right) / 2);
      const centerY = Math.round((top + bottom) / 2);
      const conf = Math.round((det.confidence || 0) * 100);
      console.log(`[${require('../../../utils/logger').getTimestamp()}]   ${i+1}. "${det.class || 'object'}" at (${centerX}, ${centerY}) - ${conf}% confidence, bbox=[${left}, ${top}, ${right}, ${bottom}]`);
    });
    
    // Filter by area if specified
    const candidates = filterByArea(output.detections, targetArea);
    
    console.log(`[${require('../../../utils/logger').getTimestamp()}] 🎯 AREA FILTERING for "${targetArea}" (1366x768 coordinates):`);
    console.log(`[${require('../../../utils/logger').getTimestamp()}]   📊 Filter zone: ${getAreaDescription(targetArea)}`);
    console.log(`[${require('../../../utils/logger').getTimestamp()}]   📊 Before filtering: ${output.detections.length} detections`);
    console.log(`[${require('../../../utils/logger').getTimestamp()}]   📊 After filtering: ${candidates.length} detections`);
    
    // If no candidates, suggest removing area filter
    if (!candidates.length && targetArea) {
      console.log(`[${require('../../../utils/logger').getTimestamp()}] 💡 Try removing target_area="${targetArea}" - objects may be outside expected zone`);
    }
    
    if (!candidates.length) {
      console.log(`[${require('../../../utils/logger').getTimestamp()}] 🔍 No detections in target area "${targetArea}" - all filtered out!`);
      console.log(`[${require('../../../utils/logger').getTimestamp()}] ⚠️  Area filter might be too restrictive for 1366x768`);
      logVisionResponse('grounding_dino', `${output.detections.length} detections, but none in target area`, null, overallStartTime);
      return { x: null, y: null };
    }

    // Log filtered candidates
    console.log(`[${require('../../../utils/logger').getTimestamp()}] 🎯 CANDIDATES IN TARGET AREA:`);
    candidates.forEach((det, i) => {
      const [left, top, right, bottom] = det.bbox;
      const centerX = Math.round((left + right) / 2);
      const centerY = Math.round((top + bottom) / 2);
      const conf = Math.round((det.confidence || 0) * 100);
      console.log(`[${require('../../../utils/logger').getTimestamp()}]   ${i+1}. "${det.class || 'object'}" at (${centerX}, ${centerY}) - ${conf}% confidence`);
    });

    // Get highest confidence detection in target area
    const best = candidates.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];
    const [left, top, right, bottom] = best.bbox;
    const centerX = Math.round((left + right) / 2);
    const centerY = Math.round((top + bottom) / 2);
    
    console.log(`[${require('../../../utils/logger').getTimestamp()}] 🏆 SELECTED: "${best.class || 'object'}" - confidence=${(best.confidence * 100).toFixed(1)}%, bbox=[${left}, ${top}, ${right}, ${bottom}]`);
    console.log(`[${require('../../../utils/logger').getTimestamp()}] 📍 Final coordinates: (${centerX}, ${centerY})`);
    
    logVisionResponse('grounding_dino', `Found object at center (${centerX}, ${centerY}) with ${(best.confidence * 100).toFixed(1)}% confidence`, { pixel: { x: centerX, y: centerY } }, overallStartTime);
    
    return { x: centerX, y: centerY };
    
  } catch (error) {
    console.error(`[${require('../../../utils/logger').getTimestamp()}] ❌ Grounding DINO error:`, error.message);
    logTiming('Grounding DINO (failed)', overallStartTime);
    return { x: null, y: null };
  }
}

module.exports = {
  detectObjectCenter
};
