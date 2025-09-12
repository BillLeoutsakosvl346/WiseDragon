// Fast Screenshot Capture Methods
// Based on screenshot_speed_research findings

const { screen } = require('electron');

// Available capture methods (in order of preference)
let robotjs, screenshotDesktop;

// Try to load capture libraries (prioritize Jitsi fork)
try {
    robotjs = require('@jitsi/robotjs');
    console.log('✅ @jitsi/robotjs loaded');
} catch (err) {
    try {
        robotjs = require('robotjs');
        console.log('✅ robotjs loaded');
    } catch (err2) {
        console.log('⚠️ No RobotJS available:', err.message);
    }
}

try {
    screenshotDesktop = require('screenshot-desktop');
} catch (err) {
    console.log('⚠️ screenshot-desktop not available:', err.message);
}

function getAvailableMethods() {
    const methods = [];
    if (robotjs) methods.push({ name: 'robotjs', description: 'RobotJS (Native)' });
    if (screenshotDesktop) methods.push({ name: 'screenshot-desktop', description: 'screenshot-desktop' });
    return methods;
}

/**
 * Fast screenshot capture using RobotJS (returns full screen BGRA buffer)
 */
async function captureWithRobotJS() {
    if (!robotjs) {
        throw new Error('RobotJS not available');
    }
    
    const captureStart = performance.now();
    
    // Get actual screen dimensions
    const screenSize = robotjs.getScreenSize();
    console.log(`🤖 RobotJS: Capturing full screen ${screenSize.width}×${screenSize.height}...`);
    
    // Capture FULL screen (not just a portion)
    const bitmap = robotjs.screen.capture(0, 0, screenSize.width, screenSize.height);
    
    const captureTime = performance.now() - captureStart;
    console.log(`🤖 RobotJS: Full screen captured in ${captureTime.toFixed(2)}ms`);
    console.log(`📊 RobotJS: Raw BGRA size: ${(bitmap.image.length/1024/1024).toFixed(2)}MB`);
    
    // Return full screen capture - compression will handle resize to 1366×768
    return {
        buffer: bitmap.image,
        width: bitmap.width,
        height: bitmap.height,
        format: 'BGRA',
        captureTime,
        method: 'robotjs'
    };
}

/**
 * Fast screenshot capture using screenshot-desktop
 * Note: screenshot-desktop captures full screen, we'll resize in compression
 */
async function captureWithScreenshotDesktop() {
    if (!screenshotDesktop) {
        throw new Error('screenshot-desktop not available');
    }
    
    const captureStart = performance.now();
    console.log('📷 screenshot-desktop: Starting capture...');
    
    // screenshot-desktop returns a Promise that resolves to PNG buffer
    const buffer = await screenshotDesktop({ format: 'png' });
    
    const captureTime = performance.now() - captureStart;
    console.log(`📷 screenshot-desktop: Captured in ${captureTime.toFixed(2)}ms`);
    console.log(`📊 screenshot-desktop: PNG size: ${(buffer.length/1024).toFixed(1)}KB`);
    
    // This returns PNG buffer, not raw BGRA, so we need different handling
    return {
        buffer: buffer,
        width: 1366, // Target optimized resolution
        height: 768,
        format: 'PNG', 
        captureTime,
        method: 'screenshot-desktop'
    };
}

async function quickCapture() {
    if (robotjs) {
        console.log('📷 Using RobotJS');
        return await captureWithRobotJS();
    }
    if (screenshotDesktop) {
        console.log('📷 Using screenshot-desktop');
        return await captureWithScreenshotDesktop();
    }
    throw new Error('No capture methods available. Install: npm install robotjs screenshot-desktop');
}

module.exports = {
    getAvailableMethods,
    captureWithRobotJS,
    captureWithScreenshotDesktop,
    quickCapture,
    isAvailable: () => !!(robotjs || screenshotDesktop)
};
