/**
 * Hugging Face API Service for UGround Vision Model
 * 
 * Handles communication with the HF-hosted vision model via GCS uploads
 * for precise UI element location detection.
 */

const fs = require('fs');
const path = require('path');
const { determineDirection } = require('./utils');
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
 * Locate UI element using HF-hosted vision model via GCS uploads
 * 
 * @param {string} screenshotPath - Path to the screenshot file
 * @param {string} prompt - Description of element to locate
 * @returns {Promise<Object>} Location result with pixel coordinates and direction
 */
async function locateElement(screenshotPath, prompt) {
  try {
    console.log(`🔍 Vision: Locating "${prompt}" in ${path.basename(screenshotPath)}`);
    
    // 1) Upload screenshot to GCS
    const { uploadAndSign } = await import('./gcs_upload_and_sign.js');
    const signedUrl = await uploadAndSign(screenshotPath);
    console.log(`📤 Uploaded to GCS: ${signedUrl.substring(0, 100)}...`);
    
    // 2) Prepare request data
    const dimensions = inferDimensions(screenshotPath);
    const messages = buildMessages(signedUrl, prompt);
    
    // 3) Call HF API
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
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HF API error ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    const responseText = result?.choices?.[0]?.message?.content?.trim() ?? '';
    
    console.log(`🤖 Vision model response: ${responseText}`);
    
    // Parse coordinates
    const normalizedCoords = parseCoordinates(responseText);
    const pixelCoords = transformToPixels(normalizedCoords, dimensions);
    const direction = determineDirection(normalizedCoords);
    
    console.log(`📍 Located at: (${pixelCoords.x}, ${pixelCoords.y}) -> ${direction} arrow`);
    
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
    console.error('🔴 Vision service error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Simple wrapper for basic coordinate lookup (for agent use)
 * 
 * @param {string} imagePath - Path to the image file
 * @param {string} description - Description of element to find
 * @returns {Promise<Object>} Simple {x, y} coordinates or {x: null, y: null}
 */
async function getCoordinates(imagePath, description) {
  const result = await locateElement(imagePath, description);
  return result.success ? result.coordinates.pixel : { x: null, y: null };
}

module.exports = {
  locateElement,    // Full overlay system function
  getCoordinates    // Simple agent function
};
