const statusEl = document.getElementById('status');
const audioEl = document.getElementById('assistant');
const btnConn = document.getElementById('connect');
const btnDisc = document.getElementById('disconnect');
const agentViewEl = document.getElementById('agent-view');
const imageInfoEl = document.getElementById('image-info');

// Backchannel audio removed - no automatic sounds on screenshot capture

let pc; // RTCPeerConnection
let localStream; // Your microphone stream
let activeFunctionCalls = new Map(); // Track ongoing function calls
let dataChannel = null; // WebRTC data channel for sending events

btnConn.onclick = start;
btnDisc.onclick = stop;

async function start() {
  console.log('🚀 Starting voice connection...');
  btnConn.disabled = true;
  status('Requesting microphone…');

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    pc = new RTCPeerConnection();

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        console.log('✅ WebRTC connected');
      }
    };

    pc.addTransceiver('audio', { direction: 'recvonly' });
    for (const track of localStream.getTracks()) {
      pc.addTrack(track, localStream);
    }

    dataChannel = pc.createDataChannel('oai-events', { ordered: true });
    setupDataChannelHandlers();

    pc.ontrack = (ev) => {
      audioEl.srcObject = ev.streams[0];
      status('Connected. Speak normally; the model replies when you pause.');
      btnDisc.disabled = false;
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const { value: EPHEMERAL_KEY } = await window.oai.getEphemeral();
    const resp = await fetch('https://api.openai.com/v1/realtime/calls?model=gpt-realtime', {
      method: 'POST',
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${EPHEMERAL_KEY}`,
        'Content-Type': 'application/sdp'
      }
    });

    if (!resp.ok) {
      throw new Error(`OpenAI connection failed: ${resp.status} ${resp.statusText}`);
    }

    const answer = { type: 'answer', sdp: await resp.text() };
    await pc.setRemoteDescription(answer);
    console.log('✅ Voice connection established');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    status(`Connection failed: ${error.message}`);
    btnConn.disabled = false;
  }
}

async function stop() {
  btnDisc.disabled = true;
  
  if (pc) pc.close();
  if (localStream) {
    for (const t of localStream.getTracks()) t.stop();
  }
  
  pc = null;
  localStream = null;
  dataChannel = null;
  activeFunctionCalls.clear();
  
  hideAgentImage(); // Clear the image display
  status('Disconnected.');
  btnConn.disabled = false;
}

function status(msg) {
  statusEl.textContent = msg;
}

// Helper to generate unique event IDs
function generateEventId() {
  return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Display image that agent sees
function displayAgentImage(base64Image, imageInfo) {
  if (base64Image) {
    agentViewEl.src = `data:image/png;base64,${base64Image}`;
    agentViewEl.classList.add('visible');
    
    let infoText = '';
    if (imageInfo.type === 'screenshot') {
      infoText = `Screenshot: ${imageInfo.width}×${imageInfo.height} (${imageInfo.colors} colors, ${imageInfo.size} bytes)`;
    } else if (imageInfo.type === 'coordinate-overlay') {
      infoText = `Coordinate Overlay: ${imageInfo.width}×${imageInfo.height} - Agent can see grid coordinates`;
    }
    
    imageInfoEl.textContent = infoText;
    console.log('🖼️ Displaying agent view:', infoText);
  }
}

// Hide agent image display
function hideAgentImage() {
  agentViewEl.classList.remove('visible');
  imageInfoEl.textContent = '';
}


async function sendScreenshot(callInfo, result) {
  const sendStart = Date.now();
  const fromFunctionStart = sendStart - callInfo.startTime;
  
  console.log(`\n📡 SENDING SCREENSHOT TO MODEL`);
  console.log(`==============================`);
  console.log(`📊 Image: ${result.width}×${result.height}, ${(result.fileSizeBytes/1000).toFixed(0)}KB (${result.source})`);
  console.log(`⏱️ Time from AI request to ready: ${fromFunctionStart}ms`);
  console.log(`📤 Base64 size: ${(result.image.length * 0.75 / 1024).toFixed(0)}KB`);
  
  // Display what agent sees
  displayAgentImage(result.image, {
    type: 'screenshot',
    width: result.width,
    height: result.height,
    colors: result.paletteColors,
    size: result.fileSizeBytes
  });
  
  // Send function output
  const outputStart = Date.now();
  dataChannel.send(JSON.stringify({
    type: 'conversation.item.create',
    event_id: generateEventId(),
    item: {
      type: 'function_call_output',
      call_id: callInfo.event.call_id,
      output: JSON.stringify({
        success: true,
        message: `Screenshot captured: ${result.width}×${result.height}`
      })
    }
  }));
  
  await new Promise(resolve => setTimeout(resolve, 50));
  const outputTime = Date.now() - outputStart;
  
  // Send image to model
  const imageStart = Date.now();
  console.log(`🤖 Transmitting image to AI model via WebRTC...`);
  dataChannel.send(JSON.stringify({
    type: 'conversation.item.create',
    event_id: generateEventId(),
    item: {
      type: 'message',
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: `Screenshot of my screen (${result.width}×${result.height}). Please analyze this image.`
        },
        {
          type: 'input_image',
          image_url: `data:image/png;base64,${result.image}`,
          detail: 'auto'
        }
      ]
    }
  }));
  const imageTime = Date.now() - imageStart;
  
  // Trigger AI response
  console.log(`🚀 Triggering AI response processing...`);
  await triggerResponseCreation();
  
  const totalSendTime = Date.now() - sendStart;
  console.log(`📡 TRANSMISSION COMPLETE: ${totalSendTime}ms`);
  console.log(`📊 Breakdown: Function output=${outputTime}ms, Image send=${imageTime}ms`);
  console.log(`🧠 AI model now has the screenshot and is processing...`);
  
  // Store timing for tracking model response
  callInfo.imageSentAt = Date.now();
}

async function sendFunctionCallResult(callInfo, result) {
  // Route screenshot results
  if ((result.imageUrl || result.image) && (result.source === 'desktopCapturer' || result.source === 'robotjs' || result.source === 'screenshot-desktop')) {
    await sendScreenshot(callInfo, result);
    return;
  }
  
  // For coordinate overlay results
  if (result.image && callInfo.name === 'show_arrow_overlay') {
    const overlayStart = Date.now();
    const fromFunctionStart = overlayStart - callInfo.startTime;
    
    console.log(`\n🎯 SENDING COORDINATE OVERLAY TO MODEL`);
    console.log(`=====================================`);
    console.log(`📊 Overlay: ${result.width}×${result.height} with 8×6 grid`);
    console.log(`⏱️ Time from AI request to ready: ${fromFunctionStart}ms`);
    
    displayAgentImage(result.image, {
      type: 'coordinate-overlay',
      width: result.width,
      height: result.height
    });
    
    dataChannel.send(JSON.stringify({
      type: 'conversation.item.create',
      event_id: generateEventId(),
      item: {
        type: 'function_call_output',
        call_id: callInfo.event.call_id,
        output: JSON.stringify({
          success: result.success,
          message: 'Arrow placed successfully. Continue conversation naturally.'
        })
      }
    }));
    
    await triggerResponseCreation();
    
    const transmissionTime = Date.now() - overlayStart;
    console.log(`📡 Coordinate overlay transmission: ${transmissionTime}ms`);
    console.log(`🤖 AI model now has coordinate overlay and should respond with arrow placement...`);
    
    // Store timing for tracking model response
    callInfo.imageSentAt = Date.now();
    return;
  }
  
  // For other tools
  dataChannel.send(JSON.stringify({
    type: 'conversation.item.create',
    event_id: generateEventId(),
    item: {
      type: 'function_call_output',
      call_id: callInfo.event.call_id,
      output: JSON.stringify(result)
    }
  }));
  
  await triggerResponseCreation();
}


async function triggerResponseCreation() {
  const responseEvent = {
    type: 'response.create',
    event_id: generateEventId()
  };
  
  dataChannel.send(JSON.stringify(responseEvent));
  status('AI analyzing...');
}

async function executeTool(functionName, args, callInfo) {
  const executionStart = Date.now();
  
  const result = await window.oai.executeTool(functionName, args);
  
  const executionTime = Date.now() - executionStart;
  const totalFunctionTime = Date.now() - callInfo.startTime;
  
  callInfo.result = result;
  callInfo.executed = true;
  callInfo.executionTime = executionTime;
  callInfo.executedAt = Date.now();
  
  console.log(`✅ ${functionName} execution completed in ${executionTime}ms`);
  console.log(`⏱️ Total function time: ${totalFunctionTime}ms (from AI initiation to completion)`);
  
  status(result.success ? `${functionName} completed` : `${functionName} failed`);
  
  // Log start of model transmission
  console.log(`📤 Starting transmission to AI model...`);
  const transmissionStart = Date.now();
  callInfo.transmissionStarted = transmissionStart;
  
  await sendFunctionCallResult(callInfo, result);
  
  const transmissionTime = Date.now() - transmissionStart;
  callInfo.transmissionTime = transmissionTime;
  console.log(`📡 Transmission to model completed in ${transmissionTime}ms`);
  console.log(`🤖 AI model is now processing the ${functionName} result...`);
}

function setupDataChannelHandlers() {
  dataChannel.onopen = () => console.log('📡 Data channel ready');
  dataChannel.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleRealtimeEvent(data);
  };
  dataChannel.onerror = (error) => console.error('❌ Data channel error:', error);
  dataChannel.onclose = () => {
    console.log('📡 Data channel closed');
    dataChannel = null;
  };
}

function handleRealtimeEvent(event) {
  if (event.type === 'response.output_item.added' && event.item?.type === 'function_call') {
    handleFunctionCallStarted(event);
  }
  else if (event.type === 'response.function_call_arguments.done') {
    handleFunctionCallDone(event);
  }
  else if (event.type === 'response.created') {
    const responseStart = Date.now();
    console.log(`🧠 AI RESPONSE STARTED at ${new Date().toISOString()}`);
    console.log(`🤖 Model is processing and will respond...`);
    
    // Store response start time for tracking
    if (!window.responseTimings) window.responseTimings = new Map();
    window.responseTimings.set(event.response.id, { startTime: responseStart });
  }
  else if (event.type === 'response.audio_transcript.delta') {
    // Model is speaking - log first word timing
    if (event.delta && !window.firstWordLogged) {
      console.log(`🗣️ AI STARTED SPEAKING: "${event.delta.trim()}" at ${new Date().toISOString()}`);
      
      // Calculate time from any active function calls
      for (const [callId, callInfo] of activeFunctionCalls.entries()) {
        if (callInfo.transmissionStarted) {
          const speakingTime = Date.now() - callInfo.transmissionStarted;
          console.log(`📊 Time from transmission to speaking: ${speakingTime}ms`);
          break;
        }
      }
      window.firstWordLogged = true;
    }
  }
  else if (event.type === 'response.done') {
    const responseId = event.response.id;
    const responseEndTime = Date.now();
    
    // Calculate total response time
    if (window.responseTimings && window.responseTimings.has(responseId)) {
      const timing = window.responseTimings.get(responseId);
      const totalResponseTime = responseEndTime - timing.startTime;
      console.log(`🏁 AI RESPONSE COMPLETED in ${totalResponseTime}ms`);
      window.responseTimings.delete(responseId);
    }
    
    // Show complete timeline for screenshot functions
    for (const [callId, callInfo] of activeFunctionCalls.entries()) {
      if ((callInfo.name === 'take_screenshot' || callInfo.name === 'show_arrow_overlay') && callInfo.imageSentAt) {
        const fullPipelineTime = responseEndTime - callInfo.startTime;
        const modelProcessingTime = responseEndTime - callInfo.imageSentAt;
        
        console.log(`\n📊 COMPLETE ${callInfo.name.toUpperCase()} TIMELINE`);
        console.log(`===============================================`);
        console.log(`⏱️ AI request → Function complete: ${callInfo.executionTime}ms`);
        console.log(`📡 Function complete → Image sent: ${callInfo.transmissionTime}ms`);
        console.log(`🧠 Image sent → AI response: ${modelProcessingTime}ms`);
        console.log(`🎯 TOTAL PIPELINE: ${fullPipelineTime}ms`);
        console.log(`📋 Function: ${callInfo.name} (${callInfo.result?.source || 'unknown'})`);
        break;
      }
    }
    
    // Reset speaking flag for next response
    window.firstWordLogged = false;
    
    clearFunctionCallsForResponse(responseId);
  }
  else if (event.type.startsWith('error')) {
    console.error('❌ Error event:', event.type, event.error);
  }
}


function handleFunctionCallStarted(event) {
  const item = event.item;
  const callId = item.call_id;
  const functionName = item.name;
  
  const startTime = Date.now();
  console.log(`\n🤖 AI INITIATED: ${functionName} at ${new Date().toISOString()}`);
  console.log(`⏱️ Function call started (ID: ${callId})`);
  
  const callInfo = {
    name: functionName,
    itemId: item.id,
    responseId: event.response_id,
    startTime,
    initiatedAt: new Date().toISOString()
  };
  
  activeFunctionCalls.set(callId, callInfo);
  
  if (functionName === 'take_screenshot') {
    console.log('📸 SCREENSHOT PIPELINE STARTING...');
    status('Taking screenshot...');
  } else if (functionName === 'show_arrow_overlay') {
    console.log('🎯 ARROW OVERLAY PIPELINE STARTING...');
    status('Placing arrow...');
  } else {
    status(`Calling ${functionName}...`);
  }
}

function clearFunctionCallsForResponse(responseId) {
  for (const [callId, callInfo] of activeFunctionCalls.entries()) {
    if (callInfo.responseId === responseId) {
      activeFunctionCalls.delete(callId);
    }
  }
}

function handleFunctionCallDone(event) {
  const callInfo = activeFunctionCalls.get(event.call_id);
  if (!callInfo) return;
  
  const args = JSON.parse(event.arguments || '{}');
  const completedTime = Date.now();
  const argumentsTime = completedTime - callInfo.startTime;
  
  callInfo.arguments = args;
  callInfo.completed = true;
  callInfo.event = event;
  callInfo.argumentsCompletedAt = completedTime;
  
  console.log(`⚙️ Function arguments processed in ${argumentsTime}ms`);
  console.log(`🔧 Executing ${callInfo.name} with parsed arguments...`);
  
  status(`Executing ${callInfo.name}...`);
  executeTool(callInfo.name, args, callInfo);
}
