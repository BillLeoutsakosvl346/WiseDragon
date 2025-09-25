/**
 * Screenshot Compression - Unified 1366x768 PNG 64-color
 * Single format optimized for WebRTC + Vision Models
 */

const sharp = require('sharp');

/**
 * Unified compression: 1366x768 PNG with 64-color quantization
 * Optimized for WebRTC payload size while maintaining vision quality
 */
async function compressScreenshot(frameData) {
    const { buffer, width, height, format } = frameData;
    
    if (format !== 'BGRA') {
        throw new Error(`Unsupported format: ${format}. Expected BGRA from RobotJS.`);
    }
    
    // Process BGRA once with 64-color quantization at 1366x768 (WebRTC friendly)
    const result = await sharp(buffer, { raw: { width, height, channels: 4 } })
        .removeAlpha()                 // RGBA -> RGB in libvips (vectorized)
        .recomb([                      // BGRA->RGB channel swizzle in C
            [0, 0, 1],                 // B->R  
            [0, 1, 0],                 // G->G
            [1, 0, 0],                 // R->B
        ])
        .resize(1366, 768, { fit: 'fill', kernel: 'mitchell' })   // WebRTC-friendly resolution
        .png({
            palette: true,             // Enable 64-color quantization
            colours: 64,               // Optimal balance of quality/size
            dither: 0,                 // Clean look, no artifacts
            compressionLevel: 6,       // Good compression
            effort: 3                  // Balanced processing speed
        })
        .toBuffer();
    
    return {
        buffer: result,
        size: result.length,
        colors: 64,
        finalWidth: 1366,
        finalHeight: 768,
        format: 'png',
        compressionRatio: buffer.length / result.length
    };
}

module.exports = {
    compressScreenshot
};
