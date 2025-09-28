const statusEl = document.getElementById('status');
const audioEl = document.getElementById('assistant');
const btnConn = document.getElementById('connect');
const btnDisc = document.getElementById('disconnect');


let pc; // RTCPeerConnection
let localStream; // Your microphone stream
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
          text: window.prompts.AUTO_ANALYSIS_AFTER_CLICK
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


async function sendScreenshot(event, result) {
  dataChannel.send(JSON.stringify({
    type: 'conversation.item.create',
    event_id: generateEventId(),
    item: {
      type: 'function_call_output',
      call_id: event.call_id,
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
          text: window.prompts.MANUAL_SCREENSHOT_ANALYSIS(result.width, result.height)
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

async function sendFunctionCallResult(event, result) {
  // Handle screenshot results
  if ((result.imageUrl || result.image) && (result.source === 'desktopCapturer' || result.source === 'robotjs' || result.source === 'screenshot-desktop')) {
    await sendScreenshot(event, result);
    return;
  }
  
  // Handle arrow overlay with image
  if (result.image && event.name === 'show_arrow_overlay') {
    result = {
      success: result.success,
      message: window.prompts.ARROW_PLACEMENT_SUCCESS
    };
  }
  
  // Send standard function call output
  dataChannel.send(JSON.stringify({
    type: 'conversation.item.create',
    event_id: generateEventId(),
    item: {
      type: 'function_call_output',
      call_id: event.call_id,
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

async function executeTool(functionName, args, event) {
  const result = await window.oai.executeTool(functionName, args);
  
  status(result.success ? `${functionName} completed` : `${functionName} failed`);
  
  await sendFunctionCallResult(event, result);
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
  if (event.type === 'response.function_call_arguments.done') {
    handleFunctionCall(event);
  }
  else if (event.type.startsWith('error')) {
    console.error(`[${new Date().toISOString().replace('T', ' ').replace('Z', '').substring(11, 23)}] Error event:`, event.type, event.error);
  }
}

function handleFunctionCall(event) {
  const functionName = event.name;
  const args = JSON.parse(event.arguments || '{}');
  
  if (functionName === 'take_screenshot') {
    status('Taking screenshot...');
  } else if (functionName === 'show_arrow_overlay') {
    status('Placing arrow...');
  } else {
    status(`Calling ${functionName}...`);
  }
  
  executeTool(functionName, args, event);
}
