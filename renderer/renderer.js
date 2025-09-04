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
  console.log('🎬 Starting voice agent connection');
  btnConn.disabled = true;
  status('Requesting microphone…');

  try {
    // 1) Get microphone
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log('✅ Microphone access granted');

    // 2) Create WebRTC connection
    pc = new RTCPeerConnection();

    // Connection state tracking
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        console.log('✅ WebRTC connected - voice communication active');
      }
    };

    // 3) Set up audio
    pc.addTransceiver('audio', { direction: 'recvonly' });
    for (const track of localStream.getTracks()) {
      pc.addTrack(track, localStream);
    }

    // 3.1) Create data channel for function calls (BEFORE SDP offer!)
    console.log('📡 Creating data channel for function calls');
    dataChannel = pc.createDataChannel('oai-events', { ordered: true });
    setupDataChannelHandlers();

    // 4) Audio playback
    pc.ontrack = (ev) => {
      audioEl.srcObject = ev.streams[0];
      status('Connected. Speak normally; the model replies when you pause.');
      btnDisc.disabled = false;
      console.log('🎉 Voice agent ready for conversation');
    };

    // 5) WebRTC negotiation
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // 6) Connect to OpenAI
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

    // 7) Complete connection
    const answer = { type: 'answer', sdp: await resp.text() };
    await pc.setRemoteDescription(answer);
    console.log('✅ WebRTC negotiation complete');
    
  } catch (error) {
    console.error('❌ === CONNECTION FAILED ===');
    console.error('💥 Error details:', error);
    console.error('🔍 Error type:', error.name);
    console.error('💬 Error message:', error.message);
    status(`Connection failed: ${error.message}`);
    btnConn.disabled = false;
  }
}

async function stop() {
  console.log('🛑 Disconnecting voice agent');
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
  console.log('✅ Voice agent disconnected');
}

function status(msg) {
  statusEl.textContent = msg;
}


// Send large images by chunking the data channel message
async function sendImageInChunks(imageMessage, result) {
  console.log('🔄 === CHUNKING LARGE IMAGE FOR DATA CHANNEL ===');
  console.log('📊 Original image size:', Math.round(result.image.length / 1024) + 'KB');
  
  try {
    // Split image data into smaller base64 chunks
    const imageData = result.image;
    const chunkSize = 40000; // ~40KB chunks (leaving room for JSON)
    const totalChunks = Math.ceil(imageData.length / chunkSize);
    
    console.log('📊 Splitting into', totalChunks, 'chunks of ~40KB each');
    
    // First, send function call output
    const functionOutput = {
      type: 'conversation.item.create',
      event_id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      item: {
        type: 'function_call_output',
        call_id: callInfo.event.call_id,
        output: JSON.stringify({
          success: true,
          message: `Screenshot captured: ${result.width}x${result.height}, sending in ${totalChunks} chunks`
        })
      }
    };
    
    dataChannel.send(JSON.stringify(functionOutput));
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Send image chunks and reassemble
    let reassembledImage = '';
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, imageData.length);
      const chunk = imageData.slice(start, end);
      
      console.log(`📤 Sending chunk ${i + 1}/${totalChunks} (${chunk.length} chars)`);
      
      const chunkMessage = {
        type: 'conversation.item.create',
        event_id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `Image chunk ${i + 1}/${totalChunks}: ${chunk}`
            }
          ]
        }
      };
      
      dataChannel.send(JSON.stringify(chunkMessage));
      reassembledImage += chunk;
      
      // Small delay between chunks
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Send a simple text message explaining chunking failed
    console.log('📤 Chunking too complex for real-time - sending simple text...');
    const textFallback = {
      type: 'conversation.item.create',
      event_id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `I captured a high-quality screenshot of my screen (${result.width}x${result.height}) but it's too large to send. Based on our conversation, please help me with what I'm working on.`
          }
        ]
      }
    };
    
    dataChannel.send(JSON.stringify(textFallback));
    console.log('✅ Text fallback sent - avoiding chunking complexity');
    
    // Don't trigger response here - will be triggered by main flow
    
  } catch (error) {
    console.error('❌ Chunking strategy failed:', error);
    // Don't trigger response here either
  }
}

// Send screenshot directly using proper OpenAI Realtime API format
async function sendScreenshotDirectly(callInfo, result) {
  console.log('📷 === SCREENSHOT: USING PROPER OPENAI FORMAT ===');
  console.log('📊 Image:', `${result.width}x${result.height}`, Math.round(result.image.length / 1024) + 'KB');
  
  try {
    // Step 1: Send function call output (required)
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
    console.log('✅ Function output sent');
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Step 2: Send image using correct OpenAI Realtime format
    const imageMessage = {
      type: 'conversation.item.create', 
      event_id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Here is my current screen. Please describe exactly what you see in this image:`
          },
          {
            type: 'input_image',
            image_url: `data:image/jpeg;base64,${result.image}`
          }
        ]
      }
    };
    
    console.log('📤 SENDING IMAGE WITH CORRECT OPENAI FORMAT');
    console.log('🔍 Using: type="input_image", image_url="data:image/jpeg;base64,..."');
    
    const imageStr = JSON.stringify(imageMessage);
    const messageSizeKB = Math.round(imageStr.length / 1024);
    console.log('📊 Final message size:', messageSizeKB + 'KB');
    
    // Check data channel size limit (64KB for WebRTC) 
    if (imageStr.length > 65536) {
      console.error('❌ IMAGE TOO LARGE FOR DATA CHANNEL:', messageSizeKB + 'KB');
      console.log('🔄 Implementing data channel chunking strategy...');
      
      await sendImageInChunks(imageMessage, result);
      return; // Don't trigger response here, chunking handles it
    } else {
      dataChannel.send(imageStr);
      console.log('✅ Screenshot image sent to AI (size OK)');
    }
    
    // Step 3: Trigger response
    await new Promise(resolve => setTimeout(resolve, 50));
    await triggerResponseCreation();
    
  } catch (error) {
    console.error('❌ Screenshot send failed:', error);
  }
}




// Send function call result back to OpenAI
async function sendFunctionCallResult(callInfo, result) {
  console.log('📤 SENDING FUNCTION RESULT TO OPENAI');
  console.log('✅ Success:', result.success);
  console.log('📊 Data size:', result.image ? `${Math.round(result.image.length / 1024)}KB` : 'No image');
  
  if (!dataChannel || dataChannel.readyState !== 'open') {
    console.error('❌ Data channel not available - cannot send result');
    return;
  }
  
  try {
    console.log('🔄 Formatting function call output...');
    
    // Create function call output item based on OpenAI's expected format
    const eventId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const conversationItem = {
      type: 'conversation.item.create',
      event_id: eventId,
      item: {
        type: 'function_call_output',
        call_id: callInfo.event.call_id,
        output: result.success ? formatSuccessfulResult(result) : formatErrorResult(result)
      }
    };
    
    console.log('📋 Conversation item details:', {
      type: conversationItem.type,
      event_id: eventId,
      call_id: conversationItem.item.call_id,
      output_length: conversationItem.item.output.length,
      success: result.success
    });
    
    // Send the conversation item via data channel
    const message = JSON.stringify(conversationItem);
    console.log('📤 === PREPARING TO SEND VIA DATA CHANNEL ===');
    console.log('📊 Message size:', message.length, 'characters');
    console.log('📋 Message preview:', message.substring(0, 150) + (message.length > 150 ? '...' : ''));
    
    // For screenshot results, use direct image approach (per OpenAI docs)
    if (result.image && result.source === 'desktopCapturer') {
      console.log('📷 SENDING SCREENSHOT DIRECTLY PER OPENAI FORMAT');
      await sendScreenshotDirectly(callInfo, result);
      return;
    }
    
    dataChannel.send(message);
    console.log('✅ Function result sent to AI');
    await triggerResponseCreation();
    
  } catch (error) {
    console.error('❌ === SEND FUNCTION RESULT FAILED ===');
    console.error('💥 Error type:', error.name);
    console.error('📝 Error message:', error.message);
    console.error('🔍 Full error:', error);
    status('❌ Failed to send result to AI');
  }
}

// Format successful tool result for OpenAI
function formatSuccessfulResult(result) {
  if (result.image && result.source === 'desktopCapturer') {
    console.log('🔄 Formatting screenshot result without large image data...');
    console.log('📸 Image metadata for verification:', {
      dimensions: `${result.width}x${result.height}`,
      sizeKB: Math.round(result.image.length / 1024),
      timestamp: new Date(result.timestamp).toISOString(),
      displayName: result.display?.name
    });
    
    return JSON.stringify({
      success: true,
      type: 'screenshot',
      dimensions: {
        width: result.width,
        height: result.height
      },
      metadata: {
        timestamp: result.timestamp,
        source: result.source,
        file_size_kb: Math.round(result.image.length / 1024),
        display_name: result.display?.name,
        capture_time: new Date(result.timestamp).toISOString()
      },
      message: `Screenshot captured successfully at ${new Date(result.timestamp).toISOString()}. Image shows current screen content at ${result.width}x${result.height} pixels, ${Math.round(result.image.length / 1024)}KB. Ready for AI analysis.`
    });
  } else {
    // For other results, just return as JSON
    return JSON.stringify(result);
  }
}

// Format error result for OpenAI
function formatErrorResult(result) {
  return JSON.stringify({
    success: false,
    error: result.error,
    source: result.source || 'unknown',
    message: `Tool execution failed: ${result.error}`
  });
}

// Trigger response creation
async function triggerResponseCreation() {
  if (!dataChannel || dataChannel.readyState !== 'open') {
    console.error('❌ Data channel not available for response creation');
    return;
  }
  
  try {
    const responseEvent = {
      type: 'response.create',
      event_id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    dataChannel.send(JSON.stringify(responseEvent));
    console.log('✅ Response creation triggered');
    status('🧠 AI analyzing screenshot...');
    
  } catch (error) {
    console.error('❌ Response creation failed:', error);
    status('❌ Failed to trigger AI response');
  }
}

// Tool execution function
async function executeTool(functionName, args, callInfo) {
  const startTime = Date.now();
  
  // Detailed logging ONLY for screenshot tool
  if (functionName === 'take_screenshot') {
    console.log('📷 === SCREENSHOT TOOL EXECUTION ===');
    console.log('⏰ Execution start:', new Date().toISOString());
    console.log('🔄 Making IPC call to main process for screen capture...');
  }
  
  try {
    // Execute tool via secure IPC bridge
    const result = await window.oai.executeTool(functionName, args);
    const executionTime = Date.now() - startTime;
    
    // Detailed logging ONLY for screenshot results
    if (functionName === 'take_screenshot') {
      console.log('✅ === SCREENSHOT EXECUTION COMPLETED ===');
      console.log('⏱️ Total time:', executionTime + 'ms');
      console.log('📊 Result:', {
        success: result.success,
        dimensions: `${result.width}x${result.height}`,
        sizeKB: Math.round(result.image?.length / 1024) || 0,
        captureTime: new Date(result.timestamp).toLocaleString()
      });
      
      if (result.image) {
        console.log('🖼️ Image data captured:');
        console.log('  📏 Dimensions:', `${result.width}x${result.height}`);
        console.log('  📊 Size:', Math.round(result.image.length / 1024) + 'KB');
        console.log('  🎯 Preview:', result.image.substring(0, 50) + '...');
      }
    }
    
    callInfo.result = result;
    callInfo.executionTime = executionTime;
    callInfo.executed = true;
    
    if (result.success) {
      status(`✅ ${functionName} completed`);
      await sendFunctionCallResult(callInfo, result);
    } else {
      console.error('❌ Tool execution failed:', result.error);
      status(`❌ ${functionName} failed`);
      await sendFunctionCallResult(callInfo, result);
    }
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('❌ Tool execution error after', executionTime + 'ms:', error);
    
    const errorResult = {
      success: false,
      error: error.message,
      source: 'execution_error',
      timestamp: Date.now()
    };
    
    callInfo.result = errorResult;
    callInfo.executionTime = executionTime;
    callInfo.executed = true;
    
    await sendFunctionCallResult(callInfo, errorResult);
  }
}

// Data channel handlers setup
function setupDataChannelHandlers() {
  if (!dataChannel) {
    console.error('❌ Cannot set up handlers - no data channel');
    return;
  }
  
  dataChannel.onopen = () => {
    console.log('✅ Data channel ready - function calling enabled');
  };
  
  dataChannel.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      // Special logging for function call related events
      if (data.type.includes('function_call') || data.type === 'response.output_item.added') {
        console.log('🚨 FUNCTION CALL EVENT:', data.type);
        console.log('📊 Details:', JSON.stringify(data, null, 2));
      }
      
      handleRealtimeEvent(data);
      
    } catch (error) {
      console.error('❌ Data channel parse error:', error);
    }
  };
  
  dataChannel.onerror = (error) => {
    console.error('❌ === DATA CHANNEL ERROR ===');
    console.error('💥 Error details:', error);
  };
  
  dataChannel.onclose = () => {
    console.log('📡 === DATA CHANNEL CLOSED ===');
    console.log('🔄 No more real-time events will be received');
    dataChannel = null;
  };
}

function handleRealtimeEvent(event) {
  // Track function call lifecycle (detailed logging)
  if (event.type === 'response.output_item.added' && event.item?.type === 'function_call') {
    console.log('🚀 FUNCTION CALL DETECTED:', event.item.name);
    handleFunctionCallStarted(event);
  }
  
  else if (event.type === 'response.function_call_arguments.done') {
    console.log('🎯 FUNCTION CALL READY FOR EXECUTION');
    handleFunctionCallDone(event);
  }
  
  // Brief logging for session events
  else if (event.type === 'session.created') {
    console.log('🎉 Session established');
    console.log('📊 Tools available:', event.session.tools?.length || 0);
    if (event.session.tools?.length > 0) {
      console.log('✅ Screenshot tool registered:', event.session.tools.map(t => t.name));
    }
  }
  
  else if (event.type === 'response.done') {
    clearFunctionCallsForResponse(event.response.id);
  }
  
  else if (event.type.startsWith('error')) {
    console.error('❌ ERROR EVENT:', event.type, event.error);
  }
  
  // Minimal logging for other events
}

function handleFunctionCallStarted(event) {
  const item = event.item;
  const callId = item.call_id;
  const functionName = item.name;
  
  console.log('🚀 Function call started:', functionName);
  
  // Store function call info for later use
  const callInfo = {
    name: functionName,
    itemId: item.id,
    responseId: event.response_id,
    startTime: Date.now()
  };
  
  activeFunctionCalls.set(callId, callInfo);
  
  // Add visual feedback for screenshot tool (no audio to avoid conflicts)
  if (functionName === 'take_screenshot') {
    status(`📷 Taking screenshot for analysis...`);
  } else {
    status(`🔧 AI calling: ${functionName}`);
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
  console.log('🎯 Function call arguments complete');
  
  const callInfo = activeFunctionCalls.get(event.call_id);
  if (!callInfo) {
    console.error('❌ Function call tracking error - Call ID not found:', event.call_id);
    return;
  }
  
  try {
    const args = JSON.parse(event.arguments || '{}');
    const functionName = callInfo.name;
    
    console.log('🚀 STARTING TOOL EXECUTION:', functionName);
    
    callInfo.arguments = args;
    callInfo.completed = true;
    callInfo.event = event;
    
    status(`⚡ Executing: ${functionName}...`);
    executeTool(functionName, args, callInfo);
    
  } catch (error) {
    console.error('❌ Function arguments parse error:', error);
  }
}
