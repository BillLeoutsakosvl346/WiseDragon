// Fast PNG Compression for Screenshots
// Based on screenshot_speed_research/compression/quantize_compress.js

const sharp = require('sharp');

/**
 * Check if Sharp compression is available
 */
function isCompressionAvailable() {
    return !!sharp;
}

/**
 * Convert BGRA buffer to optimized PNG with resizing
 */
async function compressBGRAToPNG(bgraBuffer, width, height, colors = 64, targetWidth = 1366, targetHeight = 768) {
    if (!sharp) throw new Error('Sharp not available');
    
    const start = performance.now();
    
    // Convert BGRA to RGB (remove alpha channel)
    const rgbBuffer = Buffer.alloc(width * height * 3);
    for (let i = 0, j = 0; i < bgraBuffer.length; i += 4, j += 3) {
        rgbBuffer[j] = bgraBuffer[i + 2];     // R
        rgbBuffer[j + 1] = bgraBuffer[i + 1]; // G  
        rgbBuffer[j + 2] = bgraBuffer[i];     // B
    }
    
    // Resize and compress in one pipeline (more efficient)
    const buffer = await sharp(rgbBuffer, { raw: { width, height, channels: 3 } })
        .resize(targetWidth, targetHeight, { fit: 'fill', kernel: 'lanczos3' })
        .png({
            palette: true,
            colours: colors,
            dither: 0.3,
            compressionLevel: 6,
            effort: 6
        })
        .toBuffer();
    
    const time = performance.now() - start;
    const ratio = bgraBuffer.length / buffer.length;
    
    console.log(`🎨 BGRA: ${width}×${height}→${targetWidth}×${targetHeight}, ${(buffer.length/1000).toFixed(1)}KB (${ratio.toFixed(1)}x) in ${time.toFixed(0)}ms`);
    
    return { 
        buffer, 
        size: buffer.length, 
        colors, 
        compressTime: time, 
        compressionRatio: ratio, 
        originalSize: bgraBuffer.length,
        finalWidth: targetWidth,
        finalHeight: targetHeight
    };
}

/**
 * Process PNG buffer with adaptive palette compression and optimal resizing
 * For screenshot-desktop which already returns PNG
 */
async function recompressPNG(pngBuffer, targetColors = 64, targetWidth = 1366, targetHeight = 768) {
    if (!sharp) throw new Error('Sharp not available');
    
    const start = performance.now();
    
    // Resize and compress in one efficient pipeline
    const buffer = await sharp(pngBuffer)
        .resize(targetWidth, targetHeight, { fit: 'fill', kernel: 'lanczos3' })
        .png({
            palette: true,
            colours: targetColors,
            dither: 0.1,
            compressionLevel: 4,
            effort: 3
        })
        .toBuffer();
    
    const time = performance.now() - start;
    const ratio = pngBuffer.length / buffer.length;
    
    console.log(`🎨 PNG: ${targetWidth}×${targetHeight}, ${(buffer.length/1000).toFixed(1)}KB (${ratio.toFixed(1)}x) in ${time.toFixed(0)}ms`);
    
    return {
        buffer,
        size: buffer.length,
        colors: targetColors,
        compressTime: time,
        compressionRatio: ratio,
        originalSize: pngBuffer.length,
        finalWidth: targetWidth,
        finalHeight: targetHeight
    };
}

/**
 * Adaptive compression - automatically handles different input formats
 * Optimized for 1366×768 target resolution
 */
async function adaptiveCompress(frameData, targetSizeKB = 150) {
    const { buffer, width, height, format } = frameData;
    
    if (format === 'BGRA') {
        // RobotJS: Capture full screen, resize to 1366×768, compress
        const result = await compressBGRAToPNG(buffer, width, height, 64, 1366, 768);
        if (result.size > targetSizeKB * 1000) {
            console.log(`⚠️ Trying 32 colors for size target...`);
            return await compressBGRAToPNG(buffer, width, height, 32, 1366, 768);
        }
        return result;
        
    } else if (format === 'PNG') {
        // screenshot-desktop: resize to 1366×768 and recompress
        return await recompressPNG(buffer, 64, 1366, 768);
    } else {
        throw new Error(`Unsupported format: ${format}`);
    }
}

module.exports = {
    isCompressionAvailable,
    compressBGRAToPNG,
    recompressPNG,
    adaptiveCompress
};
