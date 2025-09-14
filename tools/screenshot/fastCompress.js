// Fast PNG Compression for Screenshots
// Based on screenshot_speed_research/compression/quantize_compress.js

const sharp = require('sharp');

/**
 * Check if Sharp compression is available
 */
function isCompressionAvailable() {
    return !!sharp;
}

async function compressBGRAToPNG(bgraBuffer, width, height, colors = 64, targetWidth = 1366, targetHeight = 768) {
    if (!sharp) throw new Error('Sharp not available');
    
    const rgbBuffer = Buffer.alloc(width * height * 3);
    for (let i = 0, j = 0; i < bgraBuffer.length; i += 4, j += 3) {
        rgbBuffer[j] = bgraBuffer[i + 2];     // R
        rgbBuffer[j + 1] = bgraBuffer[i + 1]; // G  
        rgbBuffer[j + 2] = bgraBuffer[i];     // B
    }
    
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
    
    const ratio = bgraBuffer.length / buffer.length;
    
    return { 
        buffer, 
        size: buffer.length, 
        colors, 
        compressionRatio: ratio, 
        originalSize: bgraBuffer.length,
        finalWidth: targetWidth,
        finalHeight: targetHeight
    };
}

async function recompressPNG(pngBuffer, targetColors = 64, targetWidth = 1366, targetHeight = 768) {
    if (!sharp) throw new Error('Sharp not available');
    
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
    
    const ratio = pngBuffer.length / buffer.length;
    
    return {
        buffer,
        size: buffer.length,
        colors: targetColors,
        compressionRatio: ratio,
        originalSize: pngBuffer.length,
        finalWidth: targetWidth,
        finalHeight: targetHeight
    };
}

async function adaptiveCompress(frameData, targetSizeKB = 150) {
    const { buffer, width, height, format } = frameData;
    
    if (format === 'BGRA') {
        const result = await compressBGRAToPNG(buffer, width, height, 64, 1366, 768);
        if (result.size > targetSizeKB * 1000) {
            return await compressBGRAToPNG(buffer, width, height, 32, 1366, 768);
        }
        return result;
        
    } else if (format === 'PNG') {
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
