// tools/overlay_context.js
let lastScreenshot = null; // { imageW, imageH, displayBounds, capturedAt }

function setLastScreenshot(meta) { lastScreenshot = meta; }
function getLastScreenshot() { return lastScreenshot; }

module.exports = { setLastScreenshot, getLastScreenshot };
