/**
 * Modal GPU Warmup Script
 * Pre-starts the Modal UGround container to avoid cold start delays
 * 
 * Usage:
 *   node modal/warm_modal.js              - Single warmup ping
 *   node modal/warm_modal.js --keep-warm  - Keep warm with multiple pings
 * 
 * Note: Run with Node.js, NOT Python!
 */

require('dotenv').config();

// Modal configuration
const MODAL_ENDPOINT = process.env.MODAL_ENDPOINT;
const MODEL = 'uground-2b';

if (!MODAL_ENDPOINT) {
  console.error('❌ MODAL_ENDPOINT not configured!');
  console.log('💡 First deploy Modal: modal deploy modal/modal_uground_deploy.py');
  console.log('💡 Then add the endpoint to your .env file:');
  console.log('   MODAL_ENDPOINT=https://your-modal-endpoint.modal.run/v1');
  process.exit(1);
}

/**
 * Create a simple test image (small base64) to wake up the model
 */
function createTestImage() {
  // Create a tiny 100x100 test image with simple content
  const fs = require('fs');
  const sharp = require('sharp');
  
  return sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
  .png()
  .toBuffer()
  .then(buffer => {
    const base64 = buffer.toString('base64');
    return `data:image/png;base64,${base64}`;
  });
}

/**
 * Send a warmup request to Modal
 */
async function warmupModal() {
  try {
    console.log('🔥 Warming up Modal UGround container...');
    console.log(`📍 Endpoint: ${MODAL_ENDPOINT}`);
    console.log(`🌍 Region: Europe West (London) for low latency`);
    
    // Create minimal test payload
    const testImage = await createTestImage();
    const testPayloadKB = Math.round(testImage.length / 1024);
    
    console.log(`📦 Sending ${testPayloadKB}KB test payload...`);
    
    const messages = [
      { 
        role: 'system', 
        content: 'Output exactly one line "(x, y)". x,y are integers in 0..1000 from the image top-left.' 
      },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: testImage } },
          { type: 'text', text: 'Locate the center.' }
        ]
      }
    ];
    
    const startTime = Date.now();
    console.log('⏰ Sending warmup request...');
    
    const response = await fetch(`${MODAL_ENDPOINT}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0,
        max_tokens: 16
      })
    });
    
    const duration = Date.now() - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Warmup failed: ${response.status} - ${errorText}`);
      
      if (response.status === 404) {
        console.log('\n💡 The Modal app is not running or has stopped.');
        console.log('📝 Fix this by:');
        console.log('   1. Redeploy: modal deploy modal/modal_uground_deploy.py');
        console.log('   2. Copy the new endpoint URL from the output');
        console.log('   3. Update MODAL_ENDPOINT in your .env file');
        console.log('   4. Run this warmup script again');
        console.log('\n⚠️  The endpoint should end with /v1 (e.g., https://...modal.run/v1)');
      } else if (response.status === 503) {
        console.log('\n💡 Container is starting up (cold start).');
        console.log('   Try running this warmup script again in 30 seconds.');
      }
      
      return false;
    }
    
    const result = await response.json();
    const responseText = result?.choices?.[0]?.message?.content?.trim() ?? '';
    
    console.log(`✅ Modal container warmed up successfully! (${duration}ms)`);
    console.log(`🤖 Test response: "${responseText}"`);
    
    // Analyze warmup performance
    if (duration > 10000) {
      console.log('🐌 Cold start detected (>10s) - container was sleeping');
      console.log('💡 Next arrow placements should be ~200-300ms (5-50x faster!)');
    } else if (duration > 2000) {
      console.log('❄️  Partial cold start (2-10s) - container was scaling up');
      console.log('💡 Next arrow placements should be ~200-300ms');
    } else if (duration > 500) {
      console.log('🔥 Container warm! Arrow placements will be ~200-300ms');
    } else {
      console.log('🚀 Container HOT! Arrow placements will be lightning fast (<200ms)');
    }
    
    return true;
    
  } catch (error) {
    console.error('💥 Warmup failed:', error.message);
    return false;
  }
}

/**
 * Ping Modal multiple times to ensure it stays warm
 */
async function keepWarm(iterations = 3, delay = 30000) {
  console.log(`🔄 Keep-warm mode: Will ping Modal ${iterations} times every ${delay/1000}s`);
  
  for (let i = 1; i <= iterations; i++) {
    console.log(`\n📡 Keep-warm ping ${i}/${iterations}:`);
    
    const success = await warmupModal();
    if (!success) {
      console.log('❌ Keep-warm failed, stopping...');
      break;
    }
    
    if (i < iterations) {
      console.log(`⏳ Waiting ${delay/1000}s before next ping...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  console.log('\n✅ Keep-warm cycle complete!');
  console.log('🚀 Modal container should stay warm for ~15 minutes');
}

/**
 * Main warmup function
 */
async function main() {
  const args = process.argv.slice(2);
  const keepWarmMode = args.includes('--keep-warm');
  
  console.log('🔥 Modal UGround GPU Warmup Script\n');
  console.log('📌 This script pre-starts the Modal GPU container to avoid cold start delays');
  console.log('⚡ Warm GPU = instant arrow placement (~200ms vs 10-30s cold start)\n');
  
  if (keepWarmMode) {
    await keepWarm(3, 30000); // 3 pings, 30 seconds apart
  } else {
    const success = await warmupModal();
    if (success) {
      console.log('\n✅ Modal GPU is warmed up and ready for WiseDragon!');
      console.log('🎯 Arrow placement will now be instant');
      console.log('💡 Tip: For extended warmup, use: node modal/warm_modal.js --keep-warm');
    }
  }
}

// Handle script arguments
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Script failed:', error.message);
    process.exit(1);
  });
}

module.exports = { warmupModal, keepWarm };
