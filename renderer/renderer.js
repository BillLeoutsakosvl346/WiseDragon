const statusEl = document.getElementById('status');
const audioEl = document.getElementById('assistant');
const btnConn = document.getElementById('connect');
const btnDisc = document.getElementById('disconnect');

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

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        console.log('WebRTC connected');
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
    
  } catch (error) {
    console.error('Connection failed:', error.message);
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
  
  status('Disconnected.');
  btnConn.disabled = false;
}

function status(msg) {
  statusEl.textContent = msg;
}



// Send screenshot via base64 method
async function sendScreenshot(callInfo, result) {
  try {
    // Send function call output
    const functionOutput = {
      type: 'conversation.item.create',
      event_id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
      event_id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
            image_url: `data:image/${result.imageFormat || 'jpeg'};base64,${result.image}`,
            detail: 'high'
          }
        ]
      }
    };
    
    dataChannel.send(JSON.stringify(imageMessage));
    await triggerResponseCreation();
    
  } catch (error) {
    console.error('Screenshot send failed:', error);
  }
}




// Send function call result back to OpenAI
async function sendFunctionCallResult(callInfo, result) {
  if (!dataChannel || dataChannel.readyState !== 'open') {
    console.error('Data channel not available');
    return;
  }
  
  try {
    // For screenshot results, use dedicated screenshot sender
    if ((result.imageUrl || result.image) && result.source === 'desktopCapturer') {
      await sendScreenshot(callInfo, result);
      return;
    }
    
    // For other tools, send simple output
    const conversationItem = {
      type: 'conversation.item.create',
      event_id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      item: {
        type: 'function_call_output',
        call_id: callInfo.event.call_id,
        output: JSON.stringify(result)
      }
    };
    
    dataChannel.send(JSON.stringify(conversationItem));
    await triggerResponseCreation();
    
  } catch (error) {
    console.error('Send function result failed:', error.message);
    status('Failed to send result to AI');
  }
}


// Trigger response creation
async function triggerResponseCreation() {
  if (!dataChannel || dataChannel.readyState !== 'open') {
    console.error('Data channel not available for response creation');
    return;
  }
  
  try {
    const responseEvent = {
      type: 'response.create',
      event_id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    dataChannel.send(JSON.stringify(responseEvent));
    status('AI analyzing...');
    
  } catch (error) {
    console.error('Response creation failed:', error);
  }
}

// Tool execution function
async function executeTool(functionName, args, callInfo) {
  try {
    const result = await window.oai.executeTool(functionName, args);
    
    callInfo.result = result;
    callInfo.executed = true;
    
    if (result.success) {
      status(`${functionName} completed`);
    } else {
      status(`${functionName} failed`);
    }
    
    await sendFunctionCallResult(callInfo, result);
    
  } catch (error) {
    console.error('Tool execution error:', error.message);
    
    const errorResult = {
      success: false,
      error: error.message,
      source: 'execution_error',
      timestamp: Date.now()
    };
    
    callInfo.result = errorResult;
    callInfo.executed = true;
    
    await sendFunctionCallResult(callInfo, errorResult);
  }
}

// Data channel handlers setup
function setupDataChannelHandlers() {
  if (!dataChannel) return;
  
  dataChannel.onopen = () => {
    console.log('Data channel ready');
  };
  
  dataChannel.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleRealtimeEvent(data);
    } catch (error) {
      console.error('Data channel parse error:', error);
    }
  };
  
  dataChannel.onerror = (error) => {
    console.error('Data channel error:', error);
  };
  
  dataChannel.onclose = () => {
    console.log('Data channel closed');
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
  
  const callInfo = {
    name: functionName,
    itemId: item.id,
    responseId: event.response_id,
    startTime: Date.now()
  };
  
  activeFunctionCalls.set(callId, callInfo);
  
  if (functionName === 'take_screenshot') {
    status('Taking screenshot...');
  } else {
    status(`Calling ${functionName}...`);
  }
}

function clearFunctionCallsForResponse(responseId) {
  // Clean up completed function calls
  for (const [callId, callInfo] of activeFunctionCalls.entries()) {
    if (callInfo.responseId === responseId) {
      activeFunctionCalls.delete(callId);
    }
  }
}

function handleFunctionCallDone(event) {
  const callInfo = activeFunctionCalls.get(event.call_id);
  if (!callInfo) {
    console.error('Function call ID not found:', event.call_id);
    return;
  }
  
  try {
    const args = JSON.parse(event.arguments || '{}');
    const functionName = callInfo.name;
    
    callInfo.arguments = args;
    callInfo.completed = true;
    callInfo.event = event;
    
    status(`Executing ${functionName}...`);
    executeTool(functionName, args, callInfo);
    
  } catch (error) {
    console.error('Function arguments parse error:', error);
  }
}
