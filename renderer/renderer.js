const statusEl = document.getElementById('status');
const audioEl = document.getElementById('assistant');
const btnConn = document.getElementById('connect');
const btnDisc = document.getElementById('disconnect');
const agentViewEl = document.getElementById('agent-view');
const imageInfoEl = document.getElementById('image-info');

let pc; // RTCPeerConnection
let localStream; // Your microphone stream
let activeFunctionCalls = new Map(); // Track ongoing function calls
let dataChannel = null; // WebRTC data channel for sending events

btnConn.onclick = start;
btnDisc.onclick = stop;

async function start() {
  btnConn.disabled = true;
  status('Requesting microphone…');

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    pc = new RTCPeerConnection();

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
    
  } catch (error) {
    console.error(`[${new Date().toISOString().replace('T', ' ').replace('Z', '').substring(11, 23)}] Connection failed:`, error.message);
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

function generateEventId() {
  return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function displayAgentImage(base64Image, imageInfo) {
  if (base64Image) {
    agentViewEl.src = `data:image/png;base64,${base64Image}`;
    agentViewEl.classList.add('visible');
    
    const typeNames = {
      'screenshot': 'Screenshot',
      'coordinate-overlay': 'Coordinate Overlay', 
      'plain-screenshot': 'Plain Screenshot'
    };
    
    const typeName = typeNames[imageInfo.type] || 'Image';
    imageInfoEl.textContent = `${typeName}: ${imageInfo.width}×${imageInfo.height}`;
  }
}

function hideAgentImage() {
  agentViewEl.classList.remove('visible');
  imageInfoEl.textContent = '';
}


async function sendScreenshot(callInfo, result) {
  displayAgentImage(result.image, {
    type: 'screenshot',
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
        success: true,
        message: `Screenshot captured: ${result.width}×${result.height}`
      })
    }
  }));
  
  await new Promise(resolve => setTimeout(resolve, 50));
  
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
  
  await triggerResponseCreation();
}

async function sendFunctionCallResult(callInfo, result) {
  // Handle screenshot results
  if ((result.imageUrl || result.image) && (result.source === 'desktopCapturer' || result.source === 'robotjs' || result.source === 'screenshot-desktop')) {
    await sendScreenshot(callInfo, result);
    return;
  }
  
  // Handle arrow overlay with image
  if (result.image && callInfo.name === 'show_arrow_overlay') {
    displayAgentImage(result.image, {
      type: 'plain-screenshot',
      width: result.width,
      height: result.height
    });
    
    result = {
      success: result.success,
      message: 'Arrow placed successfully. Continue conversation naturally.'
    };
  }
  
  // Send standard function call output
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
  const result = await window.oai.executeTool(functionName, args);
  
  callInfo.result = result;
  callInfo.executed = true;
  
  status(result.success ? `${functionName} completed` : `${functionName} failed`);
  
  await sendFunctionCallResult(callInfo, result);
}

function setupDataChannelHandlers() {
  dataChannel.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleRealtimeEvent(data);
  };
  
  dataChannel.onerror = (error) => {
    const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', '').substring(11, 23);
    console.error(`[${timestamp}] Data channel error:`, error);
    console.error(`[${timestamp}] 📡 WebRTC data channel failed - large image may have exceeded limits`);
  };
  
  dataChannel.onclose = () => {
    const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', '').substring(11, 23);
    console.log(`[${timestamp}] 📡 WebRTC data channel closed`);
    dataChannel = null;
  };
  
  // Add buffer state monitoring
  Object.defineProperty(dataChannel, 'bufferedAmount', {
    get: function() {
      return this._bufferedAmount || 0;
    },
    set: function(value) {
      this._bufferedAmount = value;
      if (value > 100000) { // 100KB buffer warning
        const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', '').substring(11, 23);
        console.warn(`[${timestamp}] ⚠️  WebRTC buffer high: ${Math.round(value/1024)}KB - large image transmission`);
      }
    }
  });
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
    console.error(`[${new Date().toISOString().replace('T', ' ').replace('Z', '').substring(11, 23)}] Error event:`, event.type, event.error);
  }
}


function handleFunctionCallStarted(event) {
  const item = event.item;
  const callId = item.call_id;
  const functionName = item.name;
  
  const callInfo = {
    name: functionName,
    itemId: item.id,
    responseId: event.response_id
  };
  
  activeFunctionCalls.set(callId, callInfo);
  
  if (functionName === 'take_screenshot') {
    status('Taking screenshot...');
  } else if (functionName === 'show_arrow_overlay') {
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
  
  callInfo.arguments = args;
  callInfo.completed = true;
  callInfo.event = event;
  
  status(`Executing ${callInfo.name}...`);
  executeTool(callInfo.name, args, callInfo);
}
