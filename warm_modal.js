/**
 * Modal GPU Warmup Script
 * Pre-starts the Modal UGround container to avoid cold start delays
 */

require('dotenv').config();

// Modal configuration
const MODAL_ENDPOINT = process.env.MODAL_ENDPOINT || 'https://billleoutsakosvl346--uground-vllm-uswest-serve.modal.run/v1';
const MODAL_KEY = process.env.MODAL_KEY;
const MODAL_SECRET = process.env.MODAL_SECRET;
const MODEL = 'uground-2b';

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
    
    if (!MODAL_KEY || !MODAL_SECRET) {
      console.error('❌ Missing Modal credentials!');
      console.log('💡 Add to your .env file:');
      console.log('   MODAL_KEY=your_modal_key');
      console.log('   MODAL_SECRET=your_modal_secret');
      return false;
    }
    
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
    
    const duration = Date.now() - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Warmup failed: ${response.status} - ${errorText}`);
      return false;
    }
    
    const result = await response.json();
    const responseText = result?.choices?.[0]?.message?.content?.trim() ?? '';
    
    console.log(`✅ Modal container warmed up successfully! (${duration}ms)`);
    console.log(`🤖 Test response: "${responseText}"`);
    
    // Analyze warmup performance
    if (duration > 10000) {
      console.log('🐌 Cold start detected (>10s) - container was sleeping');
      console.log('💡 Subsequent requests should be much faster (~200-500ms)');
    } else if (duration > 2000) {
      console.log('❄️  Partial cold start (2-10s) - container was scaling up');
    } else {
      console.log('🔥 Container was already warm - ready for use!');
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
  
  console.log('🔥 Modal UGround Warmup Script\n');
  
  if (keepWarmMode) {
    await keepWarm(3, 30000); // 3 pings, 30 seconds apart
  } else {
    const success = await warmupModal();
    if (success) {
      console.log('\n🚀 Modal is ready for WiseDragon!');
      console.log('💡 For extended warmup, use: node warm_modal.js --keep-warm');
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
