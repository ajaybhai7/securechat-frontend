const fs = require('fs');
const file = 'C:/Users/squad/Desktop/SecureChat/frontend/src/components/ChatLayout.jsx';
let content = fs.readFileSync(file, 'utf8');

const offlineFix = `  // Auto-hangup if peer goes offline
  useEffect(() => {
    if (callState !== 'idle' && activeCallUser) {
      const peer = users.find(u => u.username === activeCallUser);
      if (peer && !peer.online) {
        toast.error(\`\${activeCallUser} went offline. Call ended.\`);
        endCallLocally();
      }
    }
  }, [users, callState, activeCallUser]);

  const toggleMute = () => {`;

content = content.replace("  const toggleMute = () => {", offlineFix);

fs.writeFileSync(file, content);
console.log("Added offline auto-hangup fix");
