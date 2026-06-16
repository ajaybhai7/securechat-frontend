const fs = require('fs');
const file = 'C:/Users/squad/Desktop/SecureChat/frontend/src/components/ChatLayout.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add generateId
content = content.replace("export default function ChatLayout({ user }) {", "const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);\n\nexport default function ChatLayout({ user }) {");

// 2. Update receive_message
const receiveMsgOld = `        const chatKey = data.isGroup ? data.receiver : (data.sender === user.username ? data.receiver : data.sender);
        setMessages(prev => ({
          ...prev,
          [chatKey]: [...(prev[chatKey] || []), { 
            text: finalDecryptedText, 
            fromMe: data.sender === user.username, 
            senderName: data.sender, 
            time: new Date(data.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), 
            isFile: data.isFile, 
            fileName: data.fileName, 
            isAudio: data.isAudio 
          }]
        }));`;

const receiveMsgNew = `        const chatKey = data.isGroup ? data.receiver : (data.sender === user.username ? data.receiver : data.sender);
        
        setMessages(prev => {
          const chatMsgs = prev[chatKey] || [];
          if (data.isEdit) {
             return { ...prev, [chatKey]: chatMsgs.map(m => m.id === data.targetId ? { ...m, text: finalDecryptedText, isEdited: true } : m) };
          }
          if (data.isDelete) {
             return { ...prev, [chatKey]: chatMsgs.map(m => m.id === data.targetId ? { ...m, isDeleted: true, text: '🚫 This message was deleted', isFile: false, isAudio: false } : m) };
          }
          return {
            ...prev,
            [chatKey]: [...chatMsgs, { 
              id: data.id || generateId(),
              text: finalDecryptedText, 
              fromMe: data.sender === user.username, 
              senderName: data.sender, 
              time: new Date(data.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), 
              isFile: data.isFile, 
              fileName: data.fileName, 
              isAudio: data.isAudio,
              replyTo: data.replyTo,
              isForwarded: data.isForwarded
            }]
          };
        });`;
content = content.replace(receiveMsgOld, receiveMsgNew);

// 3. Update handleSendMessage
const sendMsgOld = `      const chatKey = activeChat.isGroup ? activeChat.id : activeChat.username;
      socket.emit('send_message', { 
        sender: user.username, 
        receiver: chatKey, 
        encryptedContent, 
        encryptedContentSender, 
        isGroup: activeChat.isGroup 
      });
      
      setMessages(prev => ({
        ...prev,
        [chatKey]: [...(prev[chatKey] || []), { text: message, fromMe: true, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }]
      }));
      setMessage('');`;

const sendMsgNew = `      const chatKey = activeChat.isGroup ? activeChat.id : activeChat.username;
      
      if (editingMessage) {
         socket.emit('send_message', {
           sender: user.username, receiver: chatKey,
           encryptedContent, encryptedContentSender, isGroup: activeChat.isGroup,
           isEdit: true, targetId: editingMessage.id
         });
         setMessages(prev => {
           const chatMsgs = prev[chatKey] || [];
           return { ...prev, [chatKey]: chatMsgs.map(m => m.id === editingMessage.id ? { ...m, text: message, isEdited: true } : m) };
         });
         setEditingMessage(null);
         setMessage('');
         return;
      }

      const msgId = generateId();
      
      socket.emit('send_message', { 
        id: msgId,
        sender: user.username, 
        receiver: chatKey, 
        encryptedContent, 
        encryptedContentSender, 
        isGroup: activeChat.isGroup,
        replyTo: replyingTo ? replyingTo : null
      });
      
      setMessages(prev => ({
        ...prev,
        [chatKey]: [...(prev[chatKey] || []), { id: msgId, text: message, fromMe: true, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), replyTo: replyingTo }]
      }));
      setMessage('');
      setReplyingTo(null);`;
content = content.replace(sendMsgOld, sendMsgNew);

fs.writeFileSync(file, content);
console.log("Updated state management in ChatLayout");
