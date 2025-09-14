/**
 * Modal API Service for UGround Vision Model
 * 
 * Handles communication with the Modal-hosted vision model
 * for precise UI element location detection.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// Modal API Configuration
const BASE_URL = 'https://billleoutsakosvl346--uground-vllm-serve.modal.run/v1';
const MODEL = 'osunlp/UGround-V1-2B';

// Modal API Credentials from environment variables
const MODAL_KEY = process.env.MODAL_KEY;
const MODAL_SECRET = process.env.MODAL_SECRET;

if (!MODAL_KEY || !MODAL_SECRET) {
  throw new Error('MODAL_KEY and MODAL_SECRET must be set in .env file');
}

/**
 * Convert PNG file to base64 data URL
 */
function toDataURL(pngPath) {
  const buffer = fs.readFileSync(pngPath);
  const base64 = buffer.toString('base64');
  return `data:image/png;base64,${base64}`;
}

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
 * Build messages for the vision model API call
 */
function buildMessages(dataUrl, prompt) {
  return [
    { 
      role: 'system', 
      content: 'Return ONLY one line like "(x, y)" on a 0..1000 grid.' 
    },
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: dataUrl } },
        { type: 'text', text: `${prompt}\nOutput just "(x, y)".` }
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
 * Locate UI element using Modal-hosted vision model
 * 
 * @param {string} screenshotPath - Path to the screenshot file
 * @param {string} prompt - Description of element to locate
 * @returns {Promise<Object>} Location result with pixel coordinates and direction
 */
async function locateElement(screenshotPath, prompt) {
  try {
    console.log(`🔍 Vision: Locating "${prompt}" in ${path.basename(screenshotPath)}`);
    
    // Prepare request data
    const dataUrl = toDataURL(screenshotPath);
    const dimensions = inferDimensions(screenshotPath);
    const messages = buildMessages(dataUrl, prompt);
    
    // Call Modal API
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
        temperature: 0,
        max_tokens: 16
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Modal API error ${response.status}: ${errorText}`);
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

module.exports = {
  locateElement
};
