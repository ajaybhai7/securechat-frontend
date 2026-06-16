const fs = require('fs');
const file = 'C:/Users/squad/Desktop/SecureChat/frontend/src/components/ChatLayout.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add pendingIceCandidatesRef
content = content.replace(
  "const peerConnectionRef = useRef(null);",
  "const peerConnectionRef = useRef(null);\n  const pendingIceCandidatesRef = useRef([]);"
);

// 2. Update call_accepted listener
const callAcceptedOld = `    newSocket.on('call_accepted', async (signal) => {
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal));
          setCallState('connected');
        } catch (err) {
          console.error("Failed to set remote description on call accepted:", err);
        }
      }
    });`;

const callAcceptedNew = `    newSocket.on('call_accepted', async (signal) => {
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal));
          setCallState('connected');
          
          pendingIceCandidatesRef.current.forEach(async (candidate) => {
             try { await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } 
             catch(e) { console.error("Error adding queued ice candidate (A):", e); }
          });
          pendingIceCandidatesRef.current = [];
        } catch (err) {
          console.error("Failed to set remote description on call accepted:", err);
        }
      }
    });`;
content = content.replace(callAcceptedOld, callAcceptedNew);

// 3. Update ice_candidate listener
const iceOld = `    newSocket.on('ice_candidate', async (data) => {
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.error("Error adding ice candidate:", err);
        }
      }
    });`;

const iceNew = `    newSocket.on('ice_candidate', async (data) => {
      if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.error("Error adding ice candidate:", err);
        }
      } else {
        pendingIceCandidatesRef.current.push(data.candidate);
      }
    });`;
content = content.replace(iceOld, iceNew);

// 4. Update acceptCall to process pending candidates
const acceptCallOld = `      await pc.setRemoteDescription(new RTCSessionDescription(callIncoming.signal));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('answer_call', { to: callIncoming.from, signal: answer });
      setCallIncoming(null);`;

const acceptCallNew = `      await pc.setRemoteDescription(new RTCSessionDescription(callIncoming.signal));
      
      pendingIceCandidatesRef.current.forEach(async (candidate) => {
         try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } 
         catch(e) { console.error("Error adding queued ice candidate (B):", e); }
      });
      pendingIceCandidatesRef.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('answer_call', { to: callIncoming.from, signal: answer });
      setCallIncoming(null);`;
content = content.replace(acceptCallOld, acceptCallNew);

// 5. Update endCallLocally to clear pending candidates
const endCallOld = `    setCallState('idle');`;
const endCallNew = `    pendingIceCandidatesRef.current = [];\n    setCallState('idle');`;
content = content.replace(endCallOld, endCallNew);

fs.writeFileSync(file, content);
console.log("Fixed WebRTC ICE Candidates queue");
