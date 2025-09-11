const statusEl = document.getElementById('status');
const audioEl = document.getElementById('assistant');
const btnConn = document.getElementById('connect');
const btnDisc = document.getElementById('disconnect');
const agentViewEl = document.getElementById('agent-view');
const imageInfoEl = document.getElementById('image-info');

// Backchannel audio configuration
const BACKCHANNEL_VOICE = 'nova'; // Choose a good voice from available recordings
const TOTAL_PHRASES = 10; // Number of recordings per voice (1.mp3 to 10.mp3)

/**
 * Play random pre-recorded backchannel phrase instantly
 */
function playBackchannelAudio() {
  try {
    // Pick random phrase number (1-10)
    const phraseNumber = Math.floor(Math.random() * TOTAL_PHRASES) + 1;
    const audioPath = `../voice_recordings/${BACKCHANNEL_VOICE}/${phraseNumber}.mp3`;
    
    console.log(`🎤 Playing backchannel: ${BACKCHANNEL_VOICE}/phrase${phraseNumber}`);
    
    // Create audio element and play immediately
    const audio = new Audio(audioPath);
    audio.volume = 0.6; // Lower volume to not compete with main AI voice
    
    audio.onended = () => {
      console.log('✅ Backchannel audio completed');
    };
    
    audio.onerror = (error) => {
      console.error('❌ Backchannel audio failed:', error);
    };
    
    // Play immediately - no API delay!
    audio.play().catch(err => console.error('Playback failed:', err));
    
  } catch (error) {
    console.error('❌ Backchannel error:', error.message);
  }
}

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
  console.log(`📤 Sending PNG ${result.paletteColors} colors to AI (${result.width}x${result.height}, ${result.fileSizeBytes} bytes)`);
  
  // Display the image that agent will see
  displayAgentImage(result.image, {
    type: 'screenshot',
    width: result.width,
    height: result.height,
    colors: result.paletteColors,
    size: result.fileSizeBytes
  });
  
  // Send function call output
  const functionOutput = {
    type: 'conversation.item.create',
    event_id: generateEventId(),
    item: {
      type: 'function_call_output',
      call_id: callInfo.event.call_id,
      output: JSON.stringify({
        success: true,
        message: `Screenshot captured: ${result.width}x${result.height}`
      })
    }
  };
  
  dataChannel.send(JSON.stringify(functionOutput));
  await new Promise(resolve => setTimeout(resolve, 50));
  
  // Send image
  const imageMessage = {
    type: 'conversation.item.create',
    event_id: generateEventId(),
    item: {
      type: 'message',
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: `Screenshot of my screen (${result.width}x${result.height}). Please analyze this image.`
        },
        {
          type: 'input_image',
          image_url: `data:image/png;base64,${result.image}`,
          detail: 'auto'
        }
      ]
    }
  };
  
  dataChannel.send(JSON.stringify(imageMessage));
  await triggerResponseCreation();
}

async function sendFunctionCallResult(callInfo, result) {
  // For screenshot results, use dedicated screenshot sender
  if ((result.imageUrl || result.image) && result.source === 'desktopCapturer') {
    await sendScreenshot(callInfo, result);
    return;
  }
  
  // For arrow overlay results with coordinate image
  if (result.image && callInfo.name === 'show_arrow_overlay') {
    console.log(`📤 Sending coordinate overlay to AI (${result.width}x${result.height})`);
    
    // Display the coordinate-overlaid image that agent will see
    displayAgentImage(result.image, {
      type: 'coordinate-overlay',
      width: result.width,
      height: result.height
    });
    
    // Send function call output first
    const functionOutput = {
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
    };
    
    dataChannel.send(JSON.stringify(functionOutput));
    
    // Trigger response to let agent continue conversation naturally
    await triggerResponseCreation();
    return;
  }
  
  // For other tools, send simple output
  const conversationItem = {
    type: 'conversation.item.create',
    event_id: generateEventId(),
    item: {
      type: 'function_call_output',
      call_id: callInfo.event.call_id,
      output: JSON.stringify(result)
    }
  };
  
  dataChannel.send(JSON.stringify(conversationItem));
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
  const result = await window.oai.executeTool(functionName, args);
  
  callInfo.result = result;
  callInfo.executed = true;
  
  status(result.success ? `${functionName} completed` : `${functionName} failed`);
  await sendFunctionCallResult(callInfo, result);
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
  else if (event.type === 'response.done') {
    clearFunctionCallsForResponse(event.response.id);
  }
  else if (event.type.startsWith('error')) {
    console.error('Error event:', event.type, event.error);
  }
}


function handleFunctionCallStarted(event) {
  const item = event.item;
  const callId = item.call_id;
  const functionName = item.name;
  
  console.log('🤖 AI calling:', functionName);
  
  const callInfo = {
    name: functionName,
    itemId: item.id,
    responseId: event.response_id,
    startTime: Date.now()
  };
  
  activeFunctionCalls.set(callId, callInfo);
  
  if (functionName === 'take_screenshot') {
    // Play backchannel at the EARLIEST possible moment
    playBackchannelAudio(); // Instant response when AI decides to screenshot
    
    status('Taking screenshot...');
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
  callInfo.arguments = args;
  callInfo.completed = true;
  callInfo.event = event;
  
  status(`Executing ${callInfo.name}...`);
  executeTool(callInfo.name, args, callInfo);
}
