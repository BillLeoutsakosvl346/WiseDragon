// tools/overlay/groundingdino_api.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const Replicate = require('replicate');

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const GROUNDING_DINO_MODEL = "adirik/grounding-dino:efd10a8ddc57ea28773327e881ce95e20cc1d734c589f7dd01d2036921ed78aa";

// --- helpers ---
function filterByArea(detections, targetArea) {
  if (!targetArea || !detections) return detections;
  
  return detections.filter(detection => {
    const [left, top, right, bottom] = detection.bbox;
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;
    
    switch (targetArea) {
      case "bottom-right":
        return centerX > 720 && centerY > 400;
      case "center":
        return centerX > 600 && centerX < 1300 && centerY > 300 && centerY < 900;
      case "top-left":
        return centerX < 600 && centerY < 400;
      case "top-right":
        return centerX > 1300 && centerY < 400;
      case "bottom-left":
        return centerX < 600 && centerY > 800;
      default:
        return true;
    }
  });
}

// --- exports ---
async function detectObjectCenter(imagePath, query, targetArea = null) {
  if (!REPLICATE_API_TOKEN) {
    return { x: null, y: null };
  }

  const replicate = new Replicate();
  
  // Dynamically import uploadAndSign (CommonJS/ESM compatibility)
  const { uploadAndSign } = await import('./gcs_upload_and_sign.js');
  const signedUrl = await uploadAndSign(imagePath);
  
  const input = {
    image: signedUrl,
    query: query,
    box_threshold: 0.3,
    text_threshold: 0.25,
    show_visualisation: false
  };

  const output = await replicate.run(GROUNDING_DINO_MODEL, { input }).catch(() => null);
  
  if (!output?.detections?.length) {
    return { x: null, y: null };
  }

  // Filter by area if specified
  const candidates = filterByArea(output.detections, targetArea);
  
  if (!candidates.length) {
    return { x: null, y: null };
  }

  // Get highest confidence detection in target area
  const best = candidates.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];
  const [left, top, right, bottom] = best.bbox;
  const centerX = Math.round((left + right) / 2);
  const centerY = Math.round((top + bottom) / 2);
  
  return { x: centerX, y: centerY };
}

module.exports = {
  detectObjectCenter
};