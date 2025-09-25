/**
 * Modal UGround API Service - UI Element Detection
 * Simplified version using shared utilities
 */

const { toBase64DataURL, inferDimensions, logVisionCall, logVisionResult, handleVisionError } = require('./vision-shared');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '..', '.env') });

// Modal API Configuration
const BASE_URL = process.env.MODAL_ENDPOINT || 'https://billleoutsakosvl346--uground-vllm-uswest-serve.modal.run/v1';
const MODEL = 'uground-2b';
const MODAL_KEY = process.env.MODAL_KEY;
const MODAL_SECRET = process.env.MODAL_SECRET;

if (!MODAL_KEY || !MODAL_SECRET) {
  const timestamp = new Date().toISOString().substring(11, 23);
  console.warn(`[${timestamp}] ⚠️ Modal credentials not found - UGround service disabled`);
  console.warn(`[${timestamp}] 💡 Set MODAL_KEY and MODAL_SECRET in .env to enable UGround`);
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
 * Determine arrow direction based on coordinate position
 */
function determineDirection(normalizedCoords) {
  const { x, y } = normalizedCoords;
  const xPercent = x / 10; // 0-1000 -> 0-100
  const yPercent = y / 10; // 0-1000 -> 0-100
  
  if (yPercent <= 25) return 'up';
  if (yPercent >= 75) return 'down';
  if (xPercent <= 25) return 'left';
  if (xPercent >= 75) return 'right';
  
  // Middle area - deterministic but pseudo-random
  const directions = ['up', 'right', 'down', 'left'];
  return directions[Math.floor((x + y) % 4)];
}

/**
 * Locate UI element using Modal-hosted UGround model
 */
async function locateElement(screenshotPath, prompt) {
  try {
    logVisionCall('UGround', prompt);
    
    // Convert to base64 data URL
    const dataUrl = toBase64DataURL(screenshotPath);
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
    
    // Parse coordinates
    const normalizedCoords = parseCoordinates(responseText);
    const pixelCoords = transformToPixels(normalizedCoords, dimensions);
    const direction = determineDirection(normalizedCoords);
    
    logVisionResult('UGround', true, pixelCoords);
    
    return {
      success: true,
      coordinates: {
        normalized: normalizedCoords,
        pixel: pixelCoords,
        percent: {
          x: normalizedCoords.x / 10,
          y: normalizedCoords.y / 10
        }
      },
      direction,
      dimensions,
      modelResponse: responseText
    };
    
  } catch (error) {
    logVisionResult('UGround', false);
    return handleVisionError('UGround', error);
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