const fs = require('fs');
const file = 'C:/Users/squad/Desktop/SecureChat/frontend/src/components/ChatLayout.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add handlers just above  // --- MESSAGING ---
const messagingComment = `  // --- MESSAGING ---`;
const handlersCode = `  // --- GESTURES ---
  const handleTouchStart = (e, msg) => {
    const target = e.currentTarget;
    target.dataset.startX = e.touches[0].clientX;
    target.dataset.currentX = 0;
    target.style.transition = 'none';
    
    target.longPressTimer = setTimeout(() => {
      setContextMenu({ msg, x: e.touches[0].clientX, y: e.touches[0].clientY });
      target.dataset.startX = null; 
    }, 500);
  };
  const handleTouchMove = (e) => {
    const target = e.currentTarget;
    if (target.longPressTimer) clearTimeout(target.longPressTimer);
    if (!target.dataset.startX) return;

    let diffX = e.touches[0].clientX - parseFloat(target.dataset.startX);
    if (diffX < 0) diffX = 0; // only swipe right to reply
    if (diffX > 60) diffX = 60 + (diffX - 60) * 0.2; // resistance

    target.style.transform = \`translateX(\${diffX}px)\`;
    target.dataset.currentX = diffX;
  };
  const handleTouchEnd = (e, msg) => {
    const target = e.currentTarget;
    if (target.longPressTimer) clearTimeout(target.longPressTimer);
    target.style.transition = 'transform 0.2s ease-out';
    target.style.transform = 'translateX(0px)';
    if (target.dataset.currentX > 50) {
      setReplyingTo(msg);
    }
    target.dataset.startX = null;
    target.dataset.currentX = 0;
  };

  const handleContextMenu = (e, msg) => {
    e.preventDefault();
    setContextMenu({ msg, x: e.clientX, y: e.clientY });
  };

  const handleDeleteMessage = (msgId) => {
    const chatKey = activeChat.isGroup ? activeChat.id : activeChat.username;
    socket.emit('send_message', {
       sender: user.username, receiver: chatKey,
       isDelete: true, targetId: msgId, isGroup: activeChat.isGroup
    });
    setMessages(prev => {
       const chatMsgs = prev[chatKey] || [];
       return { ...prev, [chatKey]: chatMsgs.map(m => m.id === msgId ? { ...m, isDeleted: true, text: '🚫 This message was deleted', isFile: false, isAudio: false } : m) };
    });
    setContextMenu(null);
  };

  // --- MESSAGING ---`;
content = content.replace(messagingComment, handlersCode);

// 2. Replace the message map loop
const loopOld = `              {(messages[activeChat.isGroup ? activeChat.id : activeChat.username] || []).map((msg, idx) => (
                <div key={idx} className={\`flex \${msg.fromMe ? 'justify-end' : ''}\`}>
                  <div className={\`max-w-md shadow-sm \${msg.fromMe ? 'bg-telegram-messageOut rounded-2xl rounded-br-none text-white' : 'bg-telegram-messageIn rounded-2xl rounded-bl-none'} \${(msg.isFile && (msg.text.startsWith('data:image') || isImageFile(msg.fileName))) ? 'p-1 bg-transparent border-none' : 'p-3'}\`}>
                    
                    {activeChat.isGroup && !msg.fromMe && <p className="text-xs text-telegram-primary font-bold mb-1">{msg.senderName}</p>}

                    {msg.isAudio ? (
                       <audio src={msg.text} controls className="h-10 w-48" />
                    ) : msg.isFile && (msg.text.startsWith('data:image') || isImageFile(msg.fileName)) ? (
                       <img src={msg.text} alt={msg.fileName} className="max-w-[200px] md:max-w-[300px] object-cover rounded-xl shadow-md border border-white/10" />
                    ) : msg.isFile && isVideoFile(msg.fileName) ? (
                       <video src={msg.text} controls className="max-w-[250px] md:max-w-[350px] rounded-lg mb-2" />
                    ) : msg.isFile ? (
                       <a href={msg.text} download={msg.fileName} className="flex items-center gap-2 bg-black/20 p-3 rounded-lg hover:bg-black/30 transition-colors">
                          <Paperclip className="w-5 h-5 text-telegram-primary" />
                          <span className="truncate max-w-[150px] text-sm">{msg.fileName}</span>
                       </a>
                    ) : (
                       <p className="break-words leading-relaxed">{msg.text}</p>
                    )}
                    <p className={\`text-[10px] text-right mt-1.5 \${msg.fromMe ? 'text-blue-200' : 'text-telegram-muted'}\`}>{msg.time}</p>
                  </div>
                </div>
              ))}`;

const loopNew = `              {(messages[activeChat.isGroup ? activeChat.id : activeChat.username] || []).map((msg, idx) => (
                <div key={msg.id || idx} className={\`flex \${msg.fromMe ? 'justify-end' : ''}\`}>
                  <div 
                    onTouchStart={(e) => handleTouchStart(e, msg)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={(e) => handleTouchEnd(e, msg)}
                    onContextMenu={(e) => handleContextMenu(e, msg)}
                    className={\`max-w-[85%] sm:max-w-md shadow-sm select-none transition-transform \${msg.fromMe ? 'bg-telegram-messageOut rounded-2xl rounded-br-none text-white' : 'bg-telegram-messageIn rounded-2xl rounded-bl-none'} \${(msg.isFile && (msg.text.startsWith('data:image') || isImageFile(msg.fileName)) && !msg.isDeleted) ? 'p-1 bg-transparent border-none' : 'p-3'}\`}
                  >
                    {msg.isForwarded && <p className="text-[10px] italic mb-1 opacity-70">➡️ Forwarded</p>}
                    
                    {activeChat.isGroup && !msg.fromMe && <p className="text-xs text-telegram-primary font-bold mb-1">{msg.senderName}</p>}

                    {msg.replyTo && (
                       <div className="bg-black/10 border-l-4 border-telegram-primary p-2 mb-2 rounded text-sm opacity-80 truncate">
                         {msg.replyTo.isFile ? '📎 Attachment' : msg.replyTo.text}
                       </div>
                    )}

                    {msg.isDeleted ? (
                       <p className="italic opacity-60 text-sm">🚫 This message was deleted</p>
                    ) : msg.isAudio ? (
                       <audio src={msg.text} controls className="h-10 w-48" />
                    ) : msg.isFile && (msg.text.startsWith('data:image') || isImageFile(msg.fileName)) ? (
                       <img src={msg.text} alt={msg.fileName} className="max-w-[200px] md:max-w-[300px] object-cover rounded-xl shadow-md border border-white/10 pointer-events-none" />
                    ) : msg.isFile && isVideoFile(msg.fileName) ? (
                       <video src={msg.text} controls className="max-w-[250px] md:max-w-[350px] rounded-lg mb-2" />
                    ) : msg.isFile ? (
                       <a href={msg.text} download={msg.fileName} className="flex items-center gap-2 bg-black/20 p-3 rounded-lg hover:bg-black/30 transition-colors">
                          <Paperclip className="w-5 h-5 text-telegram-primary" />
                          <span className="truncate max-w-[150px] text-sm">{msg.fileName}</span>
                       </a>
                    ) : (
                       <p className="break-words leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    )}
                    
                    <div className="flex items-center justify-end gap-1 mt-1.5">
                       {msg.isEdited && <span className="text-[10px] opacity-60 italic">(edited)</span>}
                       <p className={\`text-[10px] \${msg.fromMe ? 'text-blue-200' : 'text-telegram-muted'}\`}>{msg.time}</p>
                    </div>
                  </div>
                </div>
              ))}`;
content = content.replace(loopOld, loopNew);

fs.writeFileSync(file, content);
console.log("Updated loop and gestures");
