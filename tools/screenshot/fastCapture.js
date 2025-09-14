const { screen } = require('electron');

let robotjs, screenshotDesktop;

try {
    robotjs = require('@jitsi/robotjs');
} catch (err) {
    try {
        robotjs = require('robotjs');
    } catch (err2) {
        // No RobotJS available
    }
}

try {
    screenshotDesktop = require('screenshot-desktop');
} catch (err) {
    // screenshot-desktop not available
}

function getAvailableMethods() {
    const methods = [];
    if (robotjs) methods.push({ name: 'robotjs', description: 'RobotJS (Native)' });
    if (screenshotDesktop) methods.push({ name: 'screenshot-desktop', description: 'screenshot-desktop' });
    return methods;
}

async function captureWithRobotJS() {
    if (!robotjs) {
        throw new Error('RobotJS not available');
    }
    
    const screenSize = robotjs.getScreenSize();
    const bitmap = robotjs.screen.capture(0, 0, screenSize.width, screenSize.height);
    
    return {
        buffer: bitmap.image,
        width: bitmap.width,
        height: bitmap.height,
        format: 'BGRA',
        method: 'robotjs'
    };
}

async function captureWithScreenshotDesktop() {
    if (!screenshotDesktop) {
        throw new Error('screenshot-desktop not available');
    }
    
    const buffer = await screenshotDesktop({ format: 'png' });
    
    return {
        buffer: buffer,
        width: 1366,
        height: 768,
        format: 'PNG',
        method: 'screenshot-desktop'
    };
}

async function quickCapture() {
    if (robotjs) {
        return await captureWithRobotJS();
    }
    if (screenshotDesktop) {
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
