const statusEl = document.getElementById('status');
const audioEl = document.getElementById('assistant');
const btnConn = document.getElementById('connect');
const btnDisc = document.getElementById('disconnect');

let pc; // RTCPeerConnection
let localStream; // Your microphone stream

btnConn.onclick = start;
btnDisc.onclick = stop;

async function start() {
  btnConn.disabled = true;
  status('Requesting microphone…');

  // 1) Ask the browser for your mic (MediaDevices API)
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // 2) Create the WebRTC peer connection
  pc = new RTCPeerConnection();

  // 3) Tell WebRTC we expect to RECEIVE one audio track from the remote side
  pc.addTransceiver('audio', { direction: 'recvonly' });

  // 4) Send your mic upstream to the model
  for (const track of localStream.getTracks()) {
    pc.addTrack(track, localStream);
  }

  // 5) When the model sends audio back, play it
  pc.ontrack = (ev) => {
    audioEl.srcObject = ev.streams[0];
    status('Connected. Speak normally; the model replies when you pause.');
    btnDisc.disabled = false;
  };

  // 6) Create local SDP offer and set it
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  // 7) Fetch a short-lived ephemeral key from preload→main IPC
  const { value: EPHEMERAL_KEY } = await window.oai.getEphemeral();

  // 8) Send the offer SDP to OpenAI’s WebRTC endpoint
  const resp = await fetch('https://api.openai.com/v1/realtime/calls?model=gpt-realtime', {
    method: 'POST',
    body: offer.sdp,
    headers: {
      Authorization: `Bearer ${EPHEMERAL_KEY}`,
      'Content-Type': 'application/sdp'
    }
  });

  // 9) Set the returned SDP answer; once set, audio will start flowing
  const answer = { type: 'answer', sdp: await resp.text() };
  await pc.setRemoteDescription(answer);
}

async function stop() {
  btnDisc.disabled = true;
  if (pc) pc.close();
  if (localStream) {
    for (const t of localStream.getTracks()) t.stop();
  }
  pc = null;
  localStream = null;
  status('Disconnected.');
  btnConn.disabled = false;
}

function status(msg) {
  statusEl.textContent = msg;
}
