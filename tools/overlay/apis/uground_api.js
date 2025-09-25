/**
 * Modal UGround API Service - Main UI Element Detection
 * 
 * High-performance Modal deployment (SF → US West Oregon)
 * Uses base64 data URLs (no GCS upload needed!)
 */

const fs = require('fs');
const path = require('path');
const { determineDirection } = require('../utils');
const { logVisionCall, logVisionResponse, logTiming, startTiming } = require('../../../utils/logger');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });

// Modal API Configuration (US West-2 Oregon optimized for SF)
const BASE_URL = process.env.MODAL_ENDPOINT || 'https://billleoutsakosvl346--uground-vllm-uswest-serve.modal.run/v1';
const MODEL = 'uground-2b';  // Served model name in Modal

// Modal API Credentials from environment variables
const MODAL_KEY = process.env.MODAL_KEY;
const MODAL_SECRET = process.env.MODAL_SECRET;

if (!MODAL_KEY || !MODAL_SECRET) {
  console.warn(`[${require('../../../utils/logger').getTimestamp()}] ⚠️  Modal credentials not found - UGround service disabled`);
  console.warn(`[${require('../../../utils/logger').getTimestamp()}] 💡 Set MODAL_KEY and MODAL_SECRET in .env to enable UGround`);
}

/**
 * Convert image file to base64 data URL (optimized for Modal)
 */
function toDataURL(imagePath) {
  const buffer = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Extract width and height from screenshot filename
 */
function inferDimensions(filePath) {
  const filename = path.basename(filePath);
  const match = filename.match(/_(\d+)x(\d+)_/);
  return match ? 
    { width: Number(match[1]), height: Number(match[2]) } : 
    { width: 1366, height: 768 }; // Updated fallback to WebRTC-friendly resolution
}

/**
 * Build messages for the Modal vision model API call
 */
function buildMessages(dataUrl, prompt) {
  return [
    { 
      role: 'system', 
      content: 'Output exactly one line "(x, y)". x,y are integers in 0..1000 from the image top-left.' 
    },
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: dataUrl } },
        { type: 'text', text: `Locate the ${prompt}.` }
      ]
    }
  ];
}

/**
 * Parse coordinates from model response
 */
function parseCoordinates(responseText) {
  const numbers = (responseText.match(/-?\d+(\.\d+)?/g) || []).map(Number);
  if (numbers.length < 2) {
    throw new Error(`Invalid model response: "${responseText}"`);
  }
  return { x: numbers[0], y: numbers[1] };
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

/**
 * Locate UI element using Modal-hosted UGround model
 * 
 * @param {string} screenshotPath - Path to the screenshot file
 * @param {string} prompt - Description of element to locate
 * @returns {Promise<Object>} Location result with pixel coordinates and direction
 */
async function locateElement(screenshotPath, prompt) {
  const overallStartTime = startTiming(`Modal UGround processing for "${prompt}"`);
  
  try {
    logVisionCall('modal_uground', prompt, screenshotPath, overallStartTime);
    
    // 1) Convert to base64 data URL (no GCS upload needed!)
    const encodingStartTime = Date.now();
    const dataUrl = toDataURL(screenshotPath);
    const encodingDuration = logTiming('Base64 encoding', encodingStartTime);
    
    // Log what we're sending to Modal
    const dimensions = inferDimensions(screenshotPath);
    const messages = buildMessages(dataUrl, prompt);
    const stats = fs.statSync(screenshotPath);
    const fileSizeKB = Math.round(stats.size / 1024);
    const dataUrlSizeKB = Math.round(dataUrl.length / 1024);
    
    console.log(`[${require('../../../utils/logger').getTimestamp()}] 📋 Sending to Modal UGround: Image ${dimensions.width}x${dimensions.height}, Query: "${prompt}"`);
    console.log(`[${require('../../../utils/logger').getTimestamp()}] 📁 File: ${path.basename(screenshotPath)} (${fileSizeKB}KB)`);
    console.log(`[${require('../../../utils/logger').getTimestamp()}] 📊 Base64 payload: ${dataUrlSizeKB}KB (${encodingDuration}ms encoding)`);
    console.log(`[${require('../../../utils/logger').getTimestamp()}] 🌐 Modal endpoint: ${BASE_URL} (SF → Oregon us-west-2)`);
    console.log(`[${require('../../../utils/logger').getTimestamp()}] 📡 Request method: Direct base64 (NO GCS upload!)`);
    console.log(`[${require('../../../utils/logger').getTimestamp()}] 🎯 About to send ${dataUrlSizeKB}KB payload to Modal...`);
    
    // Check unified image format
    const isUnifiedFormat = screenshotPath.includes('64colors.png');
    if (isUnifiedFormat) {
      console.log(`[${require('../../../utils/logger').getTimestamp()}] 🎨 UNIFIED FORMAT: 1366x768 PNG 64-color quantization`);
      console.log(`[${require('../../../utils/logger').getTimestamp()}] ✅ Optimized for WebRTC + Modal + all vision models (us-west-2)`);
    } else {
      console.log(`[${require('../../../utils/logger').getTimestamp()}] ⚠️  Non-standard format detected - expected 1366x768 64colors.png`);
    }
    
    // 2) Call Modal API with detailed timing breakdown
    console.log(`[${require('../../../utils/logger').getTimestamp()}] 🚀 Starting Modal HTTP request to us-west-2...`);
    const apiStartTime = Date.now();
    
    // Time the actual network request
    const requestStartTime = Date.now();
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Modal-Key': MODAL_KEY,
        'Modal-Secret': MODAL_SECRET
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0,          // Deterministic for UI element detection
        max_tokens: 16
      })
    });
    const requestDuration = Date.now() - requestStartTime;
    console.log(`[${require('../../../utils/logger').getTimestamp()}] 🌐 HTTP request to Modal: ${requestDuration}ms`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Modal API error ${response.status}: ${errorText}`);
    }
    
    // Time the response parsing
    const parseStartTime = Date.now();
    const result = await response.json();
    const responseText = result?.choices?.[0]?.message?.content?.trim() ?? '';
    const parseDuration = Date.now() - parseStartTime;
    console.log(`[${require('../../../utils/logger').getTimestamp()}] 📝 Response parsing: ${parseDuration}ms`);
    
    const apiDuration = logTiming('Modal API call', apiStartTime);
    
    // Log detailed breakdown of where time went
    console.log(`[${require('../../../utils/logger').getTimestamp()}] 📊 MODAL TIMING BREAKDOWN:`);
    console.log(`[${require('../../../utils/logger').getTimestamp()}]   🌐 Network request: ${requestDuration}ms`);
    console.log(`[${require('../../../utils/logger').getTimestamp()}]   📝 JSON parsing: ${parseDuration}ms`);
    console.log(`[${require('../../../utils/logger').getTimestamp()}]   📦 Payload sent: ${dataUrlSizeKB}KB base64`);
    console.log(`[${require('../../../utils/logger').getTimestamp()}]   🎯 Total time: ${apiDuration}ms`);
    
    // Performance analysis
    if (requestDuration > 1000) {
      console.log(`[${require('../../../utils/logger').getTimestamp()}] ⚠️  Network request >1s - possible Modal infrastructure delay`);
    }
    if (requestDuration < 500) {
      console.log(`[${require('../../../utils/logger').getTimestamp()}] ✅ Good network performance to us-west-2`);
    }
    
    // Parse coordinates with detailed logging
    const normalizedCoords = parseCoordinates(responseText);
    const pixelCoords = transformToPixels(normalizedCoords, dimensions);
    const direction = determineDirection(normalizedCoords);
    
    logVisionResponse('modal_uground', responseText, { pixel: pixelCoords, normalized: normalizedCoords }, overallStartTime);
    
    return {
      success: true,
      coordinates: {
        normalized: normalizedCoords,  // 0-1000 scale
        pixel: pixelCoords,           // actual screen pixels
        percent: {                    // 0-100 scale for overlay system
          x: normalizedCoords.x / 10,
          y: normalizedCoords.y / 10
        }
      },
      direction,
      dimensions,
      modelResponse: responseText
    };
    
  } catch (error) {
    console.error(`[${require('../../../utils/logger').getTimestamp()}] 🔴 UGround API error:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Check if UGround service is available
 */
function isModalAvailable() {
  return !!(MODAL_KEY && MODAL_SECRET);
}

module.exports = {
  locateElement,
  isModalAvailable
};
