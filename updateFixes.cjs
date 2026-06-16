const fs = require('fs');
const file = 'C:/Users/squad/Desktop/SecureChat/frontend/src/components/ChatLayout.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Fix audio element visibility
const audioOld = `<audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />`;
const audioNew = `<audio ref={remoteAudioRef} autoPlay playsInline style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }} />`;
content = content.replace(audioOld, audioNew);

// 2. Make sure hangUp always clears state even if socket fails
const hangUpOld = `  const hangUp = () => {
    if (activeCallUser && socket) {
      socket.emit('end_call', { to: activeCallUser });
    }
    endCallLocally();
  };`;

const hangUpNew = `  const hangUp = () => {
    if (activeCallUser && socket) {
      socket.emit('end_call', { to: activeCallUser });
    } else if (callIncoming && callIncoming.from && socket) {
      socket.emit('end_call', { to: callIncoming.from });
    }
    endCallLocally();
  };`;
content = content.replace(hangUpOld, hangUpNew);

fs.writeFileSync(file, content);
console.log("Applied Audio and Hangup fixes");
