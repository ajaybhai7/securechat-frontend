const fs = require('fs');
const file = 'C:/Users/squad/Desktop/SecureChat/frontend/src/components/ChatLayout.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add Context Menu and Forward Modal rendering just before the end of the return statement
const endOfReturn = `      {/* Call Screens */}`;
const modalsCode = `      {/* Reply Preview Above Input */}
      {replyingTo && (
        <div className="absolute bottom-[80px] left-4 right-4 md:left-auto md:right-auto md:w-[calc(100%-2rem)] bg-telegram-sidebar p-3 rounded-xl border-l-4 border-telegram-primary flex justify-between items-center shadow-lg z-20">
          <div className="truncate">
            <p className="text-xs text-telegram-primary font-bold">{replyingTo.senderName || 'User'}</p>
            <p className="text-sm truncate">{replyingTo.isFile ? '📎 Attachment' : replyingTo.text}</p>
          </div>
          <button onClick={() => setReplyingTo(null)} className="text-telegram-muted hover:text-white"><X className="w-5 h-5"/></button>
        </div>
      )}

      {/* Editing Preview Above Input */}
      {editingMessage && (
        <div className="absolute bottom-[80px] left-4 right-4 md:left-auto md:right-auto md:w-[calc(100%-2rem)] bg-telegram-sidebar p-3 rounded-xl border-l-4 border-yellow-500 flex justify-between items-center shadow-lg z-20">
          <div className="truncate">
            <p className="text-xs text-yellow-500 font-bold">Editing Message</p>
            <p className="text-sm truncate">{editingMessage.text}</p>
          </div>
          <button onClick={() => { setEditingMessage(null); setMessage(''); }} className="text-telegram-muted hover:text-white"><X className="w-5 h-5"/></button>
        </div>
      )}

      {/* Context Menu (Bottom Sheet) */}
      {contextMenu && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setContextMenu(null)}>
          <div className="bg-telegram-sidebar w-full sm:w-80 rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl border border-telegram-hover" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-telegram-hover rounded-full mx-auto my-3 sm:hidden"></div>
            <div className="p-4 border-b border-telegram-hover flex items-center justify-between">
               <h3 className="font-bold text-lg">Message Options</h3>
               <button onClick={() => setContextMenu(null)} className="text-telegram-muted"><X className="w-5 h-5"/></button>
            </div>
            <div className="flex flex-col p-2">
              <button 
                onClick={() => { setReplyingTo(contextMenu.msg); setContextMenu(null); }}
                className="flex items-center gap-3 p-4 hover:bg-telegram-hover rounded-xl text-left transition-colors"
              >
                <CornerUpLeft className="w-5 h-5 text-telegram-primary" /> Reply
              </button>
              
              <button 
                onClick={() => { setForwardingMessage(contextMenu.msg); setContextMenu(null); }}
                className="flex items-center gap-3 p-4 hover:bg-telegram-hover rounded-xl text-left transition-colors"
              >
                <Share2 className="w-5 h-5 text-green-500" /> Forward
              </button>

              {contextMenu.msg.fromMe && !contextMenu.msg.isDeleted && !contextMenu.msg.isFile && (
                <button 
                  onClick={() => { setEditingMessage(contextMenu.msg); setMessage(contextMenu.msg.text); setContextMenu(null); }}
                  className="flex items-center gap-3 p-4 hover:bg-telegram-hover rounded-xl text-left transition-colors"
                >
                  <Edit2 className="w-5 h-5 text-yellow-500" /> Edit
                </button>
              )}

              {contextMenu.msg.fromMe && !contextMenu.msg.isDeleted && (
                <button 
                  onClick={() => handleDeleteMessage(contextMenu.msg.id)}
                  className="flex items-center gap-3 p-4 hover:bg-red-500/20 rounded-xl text-left transition-colors text-red-500"
                >
                  <Trash2 className="w-5 h-5" /> Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Forward Modal */}
      {forwardingMessage && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-telegram-sidebar p-6 rounded-2xl w-full max-w-sm shadow-2xl border border-telegram-hover">
            <div className="flex justify-between items-center mb-6">
               <h2 className="text-xl font-bold">Forward to...</h2>
               <button onClick={() => setForwardingMessage(null)} className="text-telegram-muted hover:text-white"><X className="w-6 h-6"/></button>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
               <p className="text-xs text-telegram-primary font-bold uppercase mb-2">Users</p>
               {users.map(u => (
                 <div key={u.username} onClick={() => {
                     const fwdMsg = forwardingMessage;
                     setForwardingMessage(null);
                     // Direct send
                     const msgId = generateId();
                     socket.emit('send_message', { 
                        id: msgId, sender: user.username, receiver: u.username, 
                        encryptedContent: fwdMsg.text, encryptedContentSender: '', 
                        isGroup: false, isForwarded: true, isFile: fwdMsg.isFile, fileName: fwdMsg.fileName 
                     });
                     setMessages(prev => ({
                        ...prev,
                        [u.username]: [...(prev[u.username] || []), { id: msgId, text: fwdMsg.text, fromMe: true, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), isForwarded: true, isFile: fwdMsg.isFile, fileName: fwdMsg.fileName }]
                     }));
                     toast.success('Message forwarded!');
                 }} className="flex items-center gap-3 p-3 hover:bg-telegram-hover cursor-pointer rounded-xl transition-colors">
                    <div className="w-10 h-10 bg-telegram-primary rounded-full flex items-center justify-center font-bold">{u.username.charAt(0).toUpperCase()}</div>
                    <p className="font-semibold">{u.username}</p>
                 </div>
               ))}
               {users.length === 0 && <p className="text-sm text-telegram-muted">No users found</p>}
            </div>
          </div>
        </div>
      )}

      {/* Call Screens */}`;
content = content.replace(endOfReturn, modalsCode);

// 2. We need to import the new icons from lucide-react!
const importOld = `import { Send, Phone, Video, Search, User, Key, Lock, ArrowLeft, Users, MoreVertical, Plus, Image as ImageIcon, Smile, Settings, PhoneOff, Mic, MicOff, VideoOff, Paperclip, Link as LinkIcon, LogOut, Check, X, Bell } from 'lucide-react';`;
const importNew = `import { Send, Phone, Video, Search, User, Key, Lock, ArrowLeft, Users, MoreVertical, Plus, Image as ImageIcon, Smile, Settings, PhoneOff, Mic, MicOff, VideoOff, Paperclip, Link as LinkIcon, LogOut, Check, X, Bell, CornerUpLeft, Edit2, Trash2, Share2 } from 'lucide-react';`;
content = content.replace(importOld, importNew);

fs.writeFileSync(file, content);
console.log("Updated Modals and Imports");
