/**
 * Hugging Face API Service for UGround Vision Model
 * 
 * Handles communication with the HF-hosted vision model via GCS uploads
 * for precise UI element location detection.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// We'll dynamically import uploadAndSign in the function where it's needed

// HF API Configuration from .env
const HF_ENDPOINT = process.env.HF_ENDPOINT;
const HF_TOKEN = process.env.HF_TOKEN;
const HF_MODEL = process.env.HF_MODEL || "osunlp/UGround-V1-2B";

if (!HF_ENDPOINT || !HF_TOKEN) {
  throw new Error('HF_ENDPOINT and HF_TOKEN must be set in .env file');
}

// Remove toDataURL function - we now use GCS signed URLs instead

/**
 * Extract width and height from screenshot filename
 */
function inferDimensions(filePath) {
  const filename = path.basename(filePath);
  const match = filename.match(/_(\d+)x(\d+)_/);
  return match ? 
    { width: Number(match[1]), height: Number(match[2]) } : 
    { width: 1920, height: 1200 }; // fallback
}

/**
 * Build messages for the HF vision model API call
 */
function buildMessages(signedUrl, prompt) {
  return [
    { 
      role: 'system', 
      content: 'Output exactly one line "(x, y)". x,y are integers in 0..1000 from the image top-left.' 
    },
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: signedUrl } },
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
 * Locate UI element using HF-hosted vision model via GCS uploads
 * 
 * @param {string} screenshotPath - Path to the screenshot file
 * @param {string} prompt - Description of element to locate
 * @returns {Promise<Object>} Location result with pixel coordinates and direction
 */
async function locateElement(screenshotPath, prompt) {
  const visionStartTime = performance.now();
  try {
    console.log(`🔍 Vision: Locating "${prompt}" in ${path.basename(screenshotPath)}`);
    
    // 1) Dynamically import and upload screenshot to GCS
    console.log(`⏱️  [VISION] Starting GCS upload at ${performance.now().toFixed(2)}ms`);
    const uploadStart = performance.now();
    const { uploadAndSign } = await import('../../vision_model_apis/gcs_upload_and_sign.js');
    const signedUrl = await uploadAndSign(screenshotPath);
    const uploadEnd = performance.now();
    console.log(`📤 Uploaded to GCS: ${signedUrl.substring(0, 100)}...`);
    console.log(`⏱️  [VISION] GCS upload took ${(uploadEnd - uploadStart).toFixed(2)}ms`);
    
    // 2) Prepare request data
    const prepStart = performance.now();
    const dimensions = inferDimensions(screenshotPath);
    const messages = buildMessages(signedUrl, prompt);
    const prepEnd = performance.now();
    console.log(`⏱️  [VISION] Request preparation took ${(prepEnd - prepStart).toFixed(2)}ms`);
    
    // 3) Call HF API
    console.log(`⏱️  [VISION] Starting HF API call at ${(performance.now() - visionStartTime).toFixed(2)}ms from vision start`);
    const apiStart = performance.now();
    const url = `${HF_ENDPOINT.replace(/\/+$/, "")}/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: HF_MODEL,
        messages,
        temperature: 0.2,
        max_tokens: 16
      })
    });
    const apiEnd = performance.now();
    console.log(`⏱️  [VISION] HF API call took ${(apiEnd - apiStart).toFixed(2)}ms`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HF API error ${response.status}: ${errorText}`);
    }
    
    const parseStart = performance.now();
    const result = await response.json();
    const responseText = result?.choices?.[0]?.message?.content?.trim() ?? '';
    
    console.log(`🤖 Vision model response: ${responseText}`);
    
    // Parse coordinates
    const normalizedCoords = parseCoordinates(responseText);
    const pixelCoords = transformToPixels(normalizedCoords, dimensions);
    const direction = determineDirection(normalizedCoords);
    const parseEnd = performance.now();
    
    console.log(`📍 Located at: (${pixelCoords.x}, ${pixelCoords.y}) -> ${direction} arrow`);
    console.log(`⏱️  [VISION] Response parsing took ${(parseEnd - parseStart).toFixed(2)}ms`);
    
    const totalVisionTime = performance.now() - visionStartTime;
    console.log(`⏱️  [VISION] 🎯 VISION TOTAL: ${totalVisionTime.toFixed(2)}ms (${(totalVisionTime/1000).toFixed(1)}s)`);
    
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
      modelResponse: responseText,
      timing: {
        total: totalVisionTime,
        upload: uploadEnd - uploadStart,
        api: apiEnd - apiStart,
        parsing: parseEnd - parseStart
      }
    };
    
  } catch (error) {
    const errorTime = performance.now() - visionStartTime;
    console.error('🔴 Vision service error:', error.message);
    console.log(`⏱️  [VISION] ❌ FAILED after ${errorTime.toFixed(2)}ms (${(errorTime/1000).toFixed(1)}s)`);
    return {
      success: false,
      error: error.message,
      timing: { total: errorTime }
    };
  }
}

module.exports = {
  locateElement
};
