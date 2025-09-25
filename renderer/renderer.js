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

// Listen for automatic screenshot analysis from main process
window.electronAPI?.receive('auto-analyze-screenshot', handleAutoScreenshotAnalysis);

/**
 * Handle automatic screenshot analysis after user clicks
 */
async function handleAutoScreenshotAnalysis(event, screenshotResult) {
  if (!dataChannel || dataChannel.readyState !== 'open') {
    console.log('DataChannel not ready for auto-analysis, skipping...');
    return;
  }

  console.log('📸 Sending automatic screenshot analysis to model...');

  // Send the screenshot to the model with context that this was an automatic capture
  dataChannel.send(JSON.stringify({
    type: 'conversation.item.create',
    event_id: generateEventId(),
    item: {
      type: 'message',
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: `I just clicked where you told me to click and this is my current screen (captured automatically after 2 seconds). 

**IF YOU SEE LOADING INDICATORS:**
If you see ANY loading indicators (spinners, "Loading...", progress bars, blank/white screens, partial content, skeleton loaders), respond with a brief natural phrase and ask me to let you know when it finishes. Use variety like: "Still loading - let me know when it's done!", "Page is still loading, tell me when you see it finish", "Almost there - ping me when it's ready!", "Give it a moment - let me know when you see the content", "Still working - tell me when the page loads", "Loading up - let me know when it's complete!"

**IF FULLY LOADED:**
Analyze what I've accomplished and guide me on what to do next. If I've completed the task, congratulate me and describe what I see. If I'm in the middle of a multi-step process, tell me the next step and show an arrow pointing to what I should click next.`
        },
        {
          type: 'input_image',
          image_url: `data:image/png;base64,${screenshotResult.image}`,
          detail: 'auto'
        }
      ]
    }
  }));
  
  await triggerResponseCreation();
}

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

    pc.ontrack = async (ev) => {
      audioEl.srcObject = ev.streams[0];
      status('Connected. Speak normally; the model replies when you pause.');
      btnDisc.disabled = false;
      
      // Start auto-screenshot system after successful connection
      try {
        await window.oai.startAutoScreenshot();
        console.log('📸 Auto-screenshot system started after connection');
      } catch (error) {
        console.error('Failed to start auto-screenshot:', error);
      }
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
  status('Disconnected.');
  btnConn.disabled = false;
}

function status(msg) {
  statusEl.textContent = msg;
}

function generateEventId() {
  return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Image display functions removed - UI simplified to buttons only


async function sendScreenshot(callInfo, result) {
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
