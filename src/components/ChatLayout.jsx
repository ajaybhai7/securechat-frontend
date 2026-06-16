import React, { useState, useEffect, useRef } from 'react';
import { Search, Paperclip, Smile, Send, Phone, Video, MoreVertical, X, Mic, Users, Link as LinkIcon, ArrowLeft, Image as ImageIcon, VideoOff, MicOff, PhoneOff } from 'lucide-react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import EmojiPicker from 'emoji-picker-react';
import { encryptMessage, decryptMessage, importPublicKey, importPrivateKey } from '../utils/crypto';

const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:5000'
  : 'https://securechat-backend-production-2542.up.railway.app';

const isImageFile = (fileName) => {
  if (!fileName) return false;
  const ext = fileName.split('.').pop().toLowerCase();
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
};

const isVideoFile = (fileName) => {
  if (!fileName) return false;
  const ext = fileName.split('.').pop().toLowerCase();
  return ['mp4', 'webm', 'ogg', 'mov'].includes(ext);
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

export default function ChatLayout({ user }) {
  const [socket, setSocket] = useState(null);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeChat, setActiveChat] = useState(null); 
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem(`chat_history_${user.username}`);
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem(`chat_history_${user.username}`, JSON.stringify(messages));
  }, [messages, user.username]); 

  // Mobile View State
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

  // Message Interaction States
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [contextMenu, setContextMenu] = useState(null); // { message, x, y }


  // UI States
  const [showProfile, setShowProfile] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [myBio, setMyBio] = useState('Hey there! I am using SecureChat.');
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState('');

  // Voice & Files
  const fileInputRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // WebRTC Calling States
  const [callIncoming, setCallIncoming] = useState(null); // { from, signal, isVideo }
  const [callState, setCallState] = useState('idle'); // 'idle' | 'dialing' | 'ringing' | 'connected'
  const [activeCallUser, setActiveCallUser] = useState(null);
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);

  // Emojis & GIFs
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearch, setGifSearch] = useState('');
  const [gifs, setGifs] = useState([]);

  // Active chat ref for notifications
  const activeChatRef = useRef(activeChat);
  useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);

  // Request Notification Permissions
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const searchGifs = async (query) => {
    try {
      const res = await fetch(`https://g.tenor.com/v1/search?q=${query || 'trending'}&key=LIVDSRZULELA&limit=20`);
      const data = await res.json();
      setGifs(data.results || []);
    } catch (err) { console.error("GIF fetch failed", err); }
  };
  useEffect(() => { if (showGifPicker && gifs.length === 0) searchGifs(''); }, [showGifPicker]);

  useEffect(() => {
    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => newSocket.emit('user_login', user.username));

    newSocket.on('users_list', (usersList) => {
      setUsers(usersList.filter(u => u.username !== user.username));
      const me = usersList.find(u => u.username === user.username);
      if (me && me.bio) setMyBio(me.bio);
    });

    newSocket.on('groups_list', (groupsList) => {
      setGroups(groupsList.filter(g => g.members.includes(user.username)));
    });

    newSocket.on('receive_message', async (data) => {
      try {
        let finalDecryptedText = data.encryptedContent;
        if (!data.isFile && !data.isGroup) {
          const privKeyBase64 = localStorage.getItem(`private_key_${user.username}`);
          if(privKeyBase64) {
            const privateKey = await importPrivateKey(privKeyBase64);
            const encryptedText = data.sender === user.username ? data.encryptedContentSender : data.encryptedContent;
            if (encryptedText) {
              finalDecryptedText = await decryptMessage(encryptedText, privateKey);
            }
          }
        }
        
        const chatKey = data.isGroup ? data.receiver : (data.sender === user.username ? data.receiver : data.sender);
        
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
        });

        // Notifications
        const currentChatKey = activeChatRef.current ? (activeChatRef.current.isGroup ? activeChatRef.current.id : activeChatRef.current.username) : null;
        if (currentChatKey !== chatKey || document.hidden) {
          const title = data.isGroup ? `New message in Group` : `New message from ${data.sender}`;
          const body = data.isFile ? '📎 Attachment' : finalDecryptedText;
          
          toast(title + ': ' + body, {
            icon: '💬',
            style: { borderRadius: '10px', background: '#2b5278', color: '#fff' }
          });

          if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
            new Notification(title, { body: body });
          }
        }
      } catch (err) { console.error("Decryption failed", err); }
    });

    // WebRTC Signaling events
    newSocket.on('call_incoming', (data) => {
      setCallIncoming(data);
      setCallState('ringing');
      setActiveCallUser(data.from);
      setIsVideoCall(data.isVideo);
    });

    newSocket.on('call_accepted', async (signal) => {
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal));
          setCallState('connected');
        } catch (err) {
          console.error("Failed to set remote description on call accepted:", err);
        }
      }
    });

    newSocket.on('ice_candidate', async (data) => {
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.error("Error adding ice candidate:", err);
        }
      }
    });

    newSocket.on('call_ended', () => {
      endCallLocally();
      toast("Call ended");
    });

    // Fetch chat history
    fetch(`${BACKEND_URL}/api/messages?username=${user.username}`)
      .then(res => res.json())
      .then(async (history) => {
        const privKeyBase64 = localStorage.getItem(`private_key_${user.username}`);
        let privateKey = null;
        if (privKeyBase64) {
          privateKey = await importPrivateKey(privKeyBase64);
        }

        const loadedMessages = {};
        for (const msg of history) {
          let text = msg.encryptedContent;
          if (!msg.isFile && !msg.isGroup) {
            try {
              if (privateKey) {
                const encryptedText = msg.sender === user.username ? msg.encryptedContentSender : msg.encryptedContent;
                if (encryptedText) {
                  text = await decryptMessage(encryptedText, privateKey);
                }
              }
            } catch (err) {
              console.error("Failed to decrypt history message:", err);
              text = "[Decryption Failed]";
            }
          }

          const chatKey = msg.isGroup ? msg.receiver : (msg.sender === user.username ? msg.receiver : msg.sender);
          if (!loadedMessages[chatKey]) loadedMessages[chatKey] = [];
          loadedMessages[chatKey].push({
            text,
            fromMe: msg.sender === user.username,
            senderName: msg.sender,
            time: new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            isFile: msg.isFile,
            fileName: msg.fileName,
            isAudio: msg.isAudio
          });
        }
        setMessages(loadedMessages);
      })
      .catch(err => console.error("Failed to fetch messages history", err));

    return () => newSocket.close();
  }, [user.username]);

  // --- WEBRTC CALLING LOGIC ---
  const startCall = async (targetUser, isVideo) => {
    const target = users.find(u => u.username === targetUser);
    if (!target) return;
    if (!target.online) {
      toast.error(`${targetUser} is offline right now!`);
      return;
    }

    setCallState('dialing');
    setActiveCallUser(targetUser);
    setIsVideoCall(isVideo);
    setIsVideoMuted(false);
    setIsMuted(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo });
      localStreamRef.current = stream;
      
      setTimeout(() => {
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      }, 150);

      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      peerConnectionRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('ice_candidate', { to: targetUser, candidate: event.candidate, from: user.username });
        }
      };

      pc.ontrack = (event) => {
        if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          remoteVideoRef.current.play().catch(e => console.log("Video play error", e));
        }
        if (remoteAudioRef.current && remoteAudioRef.current.srcObject !== event.streams[0]) {
          remoteAudioRef.current.srcObject = event.streams[0];
          remoteAudioRef.current.play().catch(e => console.log("Audio play error", e));
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('call_user', { userToCall: targetUser, signalData: offer, from: user.username, isVideo });
    } catch (err) {
      console.error("Failed to start call:", err);
      toast.error("Could not access camera/microphone");
      endCallLocally();
    }
  };

  const acceptCall = async () => {
    if (!callIncoming) return;
    setCallState('connected');
    setActiveCallUser(callIncoming.from);
    setIsVideoCall(callIncoming.isVideo);
    setIsVideoMuted(false);
    setIsMuted(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callIncoming.isVideo });
      localStreamRef.current = stream;

      setTimeout(() => {
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      }, 150);

      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      peerConnectionRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('ice_candidate', { to: callIncoming.from, candidate: event.candidate, from: user.username });
        }
      };

      pc.ontrack = (event) => {
        if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          remoteVideoRef.current.play().catch(e => console.log("Video play error", e));
        }
        if (remoteAudioRef.current && remoteAudioRef.current.srcObject !== event.streams[0]) {
          remoteAudioRef.current.srcObject = event.streams[0];
          remoteAudioRef.current.play().catch(e => console.log("Audio play error", e));
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(callIncoming.signal));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('answer_call', { to: callIncoming.from, signal: answer });
      setCallIncoming(null);
    } catch (err) {
      console.error("Failed to accept call:", err);
      toast.error("Media access denied. Call failed.");
      rejectCall();
    }
  };

  const rejectCall = () => {
    if (callIncoming && socket) {
      socket.emit('end_call', { to: callIncoming.from });
    }
    endCallLocally();
  };

  const hangUp = () => {
    if (activeCallUser && socket) {
      socket.emit('end_call', { to: activeCallUser });
    } else if (callIncoming && callIncoming.from && socket) {
      socket.emit('end_call', { to: callIncoming.from });
    }
    endCallLocally();
  };

  const endCallLocally = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setCallState('idle');
    setActiveCallUser(null);
    setCallIncoming(null);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => track.enabled = !track.enabled);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => track.enabled = !track.enabled);
      setIsVideoMuted(!isVideoMuted);
    }
  };

  // --- GESTURES ---
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

    target.style.transform = `translateX(${diffX}px)`;
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

  // --- MESSAGING ---
  const handleSendMessage = async () => {
    if (!message || !activeChat || !socket) return;
    try {
      let encryptedContent = message;
      let encryptedContentSender = '';
      if (!activeChat.isGroup) {
        const pubKey = await importPublicKey(activeChat.publicKey);
        encryptedContent = await encryptMessage(message, pubKey);

        const myPubKeyBase64 = localStorage.getItem(`public_key_${user.username}`);
        if (myPubKeyBase64) {
          const myPubKey = await importPublicKey(myPubKeyBase64);
          encryptedContentSender = await encryptMessage(message, myPubKey);
        }
      }
      
      const chatKey = activeChat.isGroup ? activeChat.id : activeChat.username;
      
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
      setReplyingTo(null);
    } catch(err) { console.error("Encryption failed", err); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeChat || !socket) return;

    const loadingToast = toast.loading(`Uploading "${file.name}"...`);
    
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${BACKEND_URL}/api/upload`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error("Upload failed");

      const uploadData = await res.json();
      toast.dismiss(loadingToast);
      toast.success("Uploaded successfully!");

      const fileUrl = uploadData.fileUrl;
      const chatKey = activeChat.isGroup ? activeChat.id : activeChat.username;
      socket.emit('send_message', {
        sender: user.username, receiver: chatKey, 
        encryptedContent: fileUrl, isFile: true, fileName: file.name, isGroup: activeChat.isGroup 
      });
      
      setMessages(prev => ({
        ...prev,
        [chatKey]: [...(prev[chatKey] || []), { text: fileUrl, fromMe: true, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), isFile: true, fileName: file.name }]
      }));
    } catch (err) {
      toast.dismiss(loadingToast);
      toast.error("File upload failed!");
      console.error(err);
    }
  };

  const handleSendGif = (gifUrl) => {
    if (!activeChat || !socket) return;
    const chatKey = activeChat.isGroup ? activeChat.id : activeChat.username;
    socket.emit('send_message', {
      sender: user.username, receiver: chatKey, 
      encryptedContent: gifUrl, isFile: true, fileName: 'image.gif', isGroup: activeChat.isGroup 
    });
    setMessages(prev => ({
      ...prev,
      [chatKey]: [...(prev[chatKey] || []), { text: gifUrl, fromMe: true, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), isFile: true, fileName: 'image.gif' }]
    }));
  };

  // --- VOICE RECORDING ---
  const startRecording = async (e) => {
    if (e) e.preventDefault();
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current);
        const loadingToast = toast.loading("Sending voice note...");
        
        try {
          const formData = new FormData();
          formData.append('file', audioBlob, `voice_note_${Date.now()}.webm`);

          const res = await fetch(`${BACKEND_URL}/api/upload`, {
            method: 'POST',
            body: formData
          });

          if (!res.ok) throw new Error("Upload failed");

          const uploadData = await res.json();
          toast.dismiss(loadingToast);

          const audioUrl = uploadData.fileUrl;
          const chatKey = activeChat.isGroup ? activeChat.id : activeChat.username;
          socket.emit('send_message', {
            sender: user.username, receiver: chatKey, 
            encryptedContent: audioUrl, isFile: true, isAudio: true, fileName: 'Voice Note', isGroup: activeChat.isGroup 
          });

          setMessages(prev => ({
            ...prev,
            [chatKey]: [...(prev[chatKey] || []), { text: audioUrl, fromMe: true, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), isFile: true, isAudio: true, fileName: 'Voice Note' }]
          }));
        } catch (err) {
          toast.dismiss(loadingToast);
          toast.error("Failed to send voice note");
          console.error(err);
        }
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch(err) { console.error("Mic access denied", err); }
  };

  const stopRecording = (e) => {
    if (e) e.preventDefault();
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // --- GROUPS & PROFILE ---
  const handleCreateGroup = async () => {
    if(!groupName || selectedMembers.length === 0) return;
    await fetch(`${BACKEND_URL}/api/groups/create`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: groupName, creator: user.username, members: selectedMembers })
    });
    setShowNewGroup(false);
    setGroupName('');
    setSelectedMembers([]);
  };

  const handleUpdateProfile = async () => {
    await fetch(`${BACKEND_URL}/api/profile/edit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user.username, bio: myBio })
    });
    setShowProfile(false);
  };

  const copyInviteLink = (groupId) => {
    const link = `${window.location.origin}/?g=${groupId}`;
    navigator.clipboard.writeText(link);
    alert("Invite link copied! Share it with friends.");
  };

  // --- SEARCH USER by USERNAME ---
  const handleSearchUser = async () => {
    setSearchError('');
    setSearchResult(null);
    if (!searchQuery.trim()) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/users/search?username=${searchQuery.trim()}`);
      if (!res.ok) {
        setSearchError('User not found. Ask them to register first.');
        return;
      }
      const foundUser = await res.json();
      if (foundUser.username === user.username) {
        setSearchError('Yeh toh aap khud hain! 😄');
        return;
      }
      setSearchResult(foundUser);
    } catch {
      setSearchError('Search failed. Check connection.');
    }
  };

  const openChatWithSearchResult = () => {
    setActiveChat({ ...searchResult, isGroup: false });
    setIsMobileChatOpen(true);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResult(null);
  };

  const handleSelectChat = (chatData) => {
    setActiveChat(chatData);
    setIsMobileChatOpen(true);
  };

  return (
    <div className="flex w-full h-dvh bg-telegram-bg text-telegram-text font-sans overflow-hidden relative">
      {/* Sidebar */}
      <div className={`${isMobileChatOpen ? 'hidden md:flex' : 'flex'} w-full md:w-80 bg-telegram-sidebar border-r border-telegram-bg flex-col z-20`}>
        <div className="p-4 flex items-center justify-between border-b border-telegram-bg/50">
           <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowProfile(true)}>
             <div className="w-10 h-10 bg-telegram-primary rounded-full flex items-center justify-center font-bold text-white hover:opacity-80 transition-opacity">
                {user.username.charAt(0).toUpperCase()}
             </div>
             <div>
               <div className="font-semibold">{user.username}</div>
               <div className="text-[10px] text-telegram-primary">My Profile</div>
             </div>
           </div>
           <div className="flex items-center gap-2">
             <button onClick={() => setShowSearch(true)} className="p-2 text-telegram-muted hover:text-white bg-telegram-bg rounded-full" title="Search User">
               <Search className="w-5 h-5" />
             </button>
             <button onClick={() => setShowNewGroup(true)} className="p-2 text-telegram-muted hover:text-white bg-telegram-bg rounded-full" title="New Group">
               <Users className="w-5 h-5" />
             </button>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {groups.length > 0 && <div className="p-3 text-xs text-telegram-muted font-bold uppercase tracking-wider bg-telegram-bg/20">My Groups</div>}
          {groups.map(g => (
            <div key={g.id} onClick={() => handleSelectChat({...g, isGroup: true})} className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${activeChat?.id === g.id ? 'bg-telegram-primary/20 border-l-2 border-telegram-primary' : 'hover:bg-telegram-hover'}`}>
              <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-lg min-w-[3rem]"><Users className="w-6 h-6 text-white"/></div>
              <div className="flex-1 overflow-hidden">
                <h3 className="font-semibold truncate">{g.name}</h3>
                <p className="text-xs text-telegram-primary">{g.members.length} members</p>
              </div>
            </div>
          ))}

          <div className="p-3 text-xs text-telegram-muted font-bold uppercase tracking-wider bg-telegram-bg/20">Direct Messages</div>
          {users.map(u => (
            <div key={u.username} onClick={() => handleSelectChat({...u, isGroup: false})} className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${activeChat?.username === u.username ? 'bg-telegram-primary/20 border-l-2 border-telegram-primary' : 'hover:bg-telegram-hover'}`}>
              <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center font-bold text-lg relative min-w-[3rem]">
                {u.username.charAt(0).toUpperCase()}
                {u.online && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-telegram-sidebar rounded-full"></div>}
              </div>
              <div className="flex-1 overflow-hidden">
                <h3 className="font-semibold truncate">{u.username}</h3>
                <p className="text-xs text-telegram-muted truncate">{u.bio}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Window */}
      <div className={`${isMobileChatOpen ? 'flex' : 'hidden md:flex'} flex-1 flex-col relative bg-telegram-bg z-10`}>
        {activeChat ? (
          <>
            <div className="h-16 bg-telegram-sidebar flex justify-between items-center px-4 shadow-md z-30 shrink-0">
              <div className="flex items-center gap-3 overflow-hidden">
                 <button onClick={() => setIsMobileChatOpen(false)} className="md:hidden p-1 text-telegram-muted hover:text-white shrink-0">
                    <ArrowLeft className="w-6 h-6" />
                 </button>
                 <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center font-bold shrink-0">
                    {activeChat.isGroup ? <Users className="w-5 h-5 text-white" /> : activeChat.username.charAt(0).toUpperCase()}
                 </div>
                 <div>
                   <h2 className="font-semibold">{activeChat.isGroup ? activeChat.name : activeChat.username}</h2>
                   <p className="text-xs text-telegram-primary">{activeChat.isGroup ? `${activeChat.members.length} members` : (activeChat.online ? 'Online' : 'Offline')}</p>
                 </div>
              </div>
              <div className="flex items-center gap-5 text-telegram-muted">
                {activeChat.isGroup && (
                   <button onClick={() => copyInviteLink(activeChat.id)} className="flex items-center gap-1 hover:text-telegram-primary text-sm font-medium mr-2">
                     <LinkIcon className="w-4 h-4" /> Invite Link
                   </button>
                )}
                {!activeChat.isGroup && <Phone onClick={() => startCall(activeChat.username, false)} className="w-5 h-5 cursor-pointer hover:text-white" />}
                {!activeChat.isGroup && <Video onClick={() => startCall(activeChat.username, true)} className="w-5 h-5 cursor-pointer hover:text-white" />}
                <MoreVertical className="w-5 h-5 cursor-pointer hover:text-white" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{backgroundImage: "url('https://web.telegram.org/a/chat-bg-pattern-dark.png')", backgroundSize: '400px', opacity: 0.9}}>
              {(messages[activeChat.isGroup ? activeChat.id : activeChat.username] || []).map((msg, idx) => (
                <div key={idx} className={`flex ${msg.fromMe ? 'justify-end' : ''}`}>
                  <div className={`max-w-md shadow-sm ${msg.fromMe ? 'bg-telegram-messageOut rounded-2xl rounded-br-none text-white' : 'bg-telegram-messageIn rounded-2xl rounded-bl-none'} ${(msg.isFile && (msg.text.startsWith('data:image') || isImageFile(msg.fileName))) ? 'p-1 bg-transparent border-none' : 'p-3'}`}>
                    
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
                       <p>{msg.text}</p>
                    )}

                    <p className={`text-[10px] text-right mt-1 ${msg.fromMe ? 'text-blue-200' : 'text-telegram-muted'}`}>{msg.time} {msg.fromMe && '✓✓'}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-telegram-bg relative z-30 border-t border-telegram-sidebar shrink-0">
              {showEmojiPicker && (
                <div className="absolute bottom-20 left-4 z-50 shadow-2xl w-[calc(100vw-2rem)] max-w-[350px]">
                  <EmojiPicker theme="dark" width="100%" height={350} onEmojiClick={(emojiData) => setMessage(prev => prev + emojiData.emoji)} />
                </div>
              )}
              {showGifPicker && (
                <div className="absolute bottom-20 left-4 md:left-16 z-50 w-[calc(100vw-2rem)] max-w-[320px] h-96 bg-telegram-sidebar rounded-xl border border-telegram-hover p-3 shadow-2xl flex flex-col">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-sm">Send a GIF</h3>
                    <button onClick={() => setShowGifPicker(false)}><X className="w-4 h-4 text-telegram-muted hover:text-white" /></button>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Search Tenor..." 
                    value={gifSearch}
                    onChange={(e) => { setGifSearch(e.target.value); searchGifs(e.target.value); }}
                    className="bg-telegram-bg text-white px-3 py-2 rounded-lg text-sm mb-3 outline-none focus:border-telegram-primary border border-transparent w-full"
                  />
                  <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-2 pr-1">
                    {gifs.map(gif => (
                      <img 
                        key={gif.id} 
                        src={gif.media[0].tinygif.url} 
                        alt="GIF" 
                        className="w-full h-24 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => { handleSendGif(gif.media[0].tinygif.url); setShowGifPicker(false); }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 w-full max-w-4xl mx-auto">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                <button onClick={() => fileInputRef.current.click()} className="p-2 text-telegram-muted hover:text-white transition-colors">
                  <Paperclip className="w-6 h-6" />
                </button>
                <div className="flex-1 bg-telegram-sidebar rounded-xl flex items-center pr-2 overflow-hidden">
                  <button onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false); }} className="p-1.5 sm:p-3 text-telegram-muted hover:text-white shrink-0"><Smile className="w-6 h-6" /></button>
                  <button onClick={() => { setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); }} className="p-1.5 sm:p-3 text-telegram-muted hover:text-white shrink-0"><ImageIcon className="w-5 h-5" /></button>
                  <input 
                    type="text" 
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Message..."
                    className="flex-1 min-w-0 w-full bg-transparent text-white outline-none py-3"
                  />
                  {message.length === 0 && (
                    <button 
                       onMouseDown={startRecording} 
                       onMouseUp={stopRecording}
                       onMouseLeave={stopRecording}
                       onTouchStart={startRecording}
                       onTouchEnd={stopRecording}
                       className={`p-2 rounded-full transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-telegram-muted hover:text-white'}`}
                       title="Hold to Record Voice"
                    >
                      <Mic className="w-5 h-5" />
                    </button>
                  )}
                </div>
                {message.length > 0 && (
                  <button onClick={handleSendMessage} className="p-3 bg-telegram-primary text-white rounded-full hover:bg-blue-600 shadow-lg transition-colors">
                    <Send className="w-6 h-6 ml-1" />
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-telegram-muted">
            <div className="text-center bg-telegram-sidebar/50 py-2 px-4 rounded-full border border-telegram-hover">
              Select a chat to start messaging
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {showProfile && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-telegram-sidebar p-6 rounded-2xl w-full max-w-sm shadow-2xl border border-telegram-hover">
            <div className="flex justify-between items-center mb-6">
               <h2 className="text-xl font-bold">My Profile</h2>
               <button onClick={() => setShowProfile(false)} className="text-telegram-muted hover:text-white"><X className="w-6 h-6"/></button>
            </div>
            <div className="w-24 h-24 bg-telegram-primary rounded-full mx-auto flex items-center justify-center text-3xl font-bold text-white mb-6 animate-fade-in">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="mb-4">
               <label className="block text-sm text-telegram-muted mb-1">Username</label>
               <input type="text" disabled value={user.username} className="w-full bg-telegram-bg p-3 rounded-xl opacity-50 cursor-not-allowed" />
            </div>
            <div className="mb-6">
               <label className="block text-sm text-telegram-muted mb-1">Bio</label>
               <input type="text" value={myBio} onChange={e => setMyBio(e.target.value)} className="w-full bg-telegram-bg p-3 rounded-xl focus:border-telegram-primary outline-none transition-colors border border-transparent" />
            </div>
            <button onClick={handleUpdateProfile} className="w-full bg-telegram-primary py-3 rounded-xl font-bold hover:bg-blue-600 mb-3 shadow-md">Save Profile</button>
            <button onClick={() => { localStorage.removeItem('currentUser'); window.location.reload(); }} className="w-full bg-red-500/20 text-red-500 py-3 rounded-xl font-bold hover:bg-red-500/30 transition-colors">Log Out</button>
          </div>
        </div>
      )}

      {showNewGroup && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-telegram-sidebar p-6 rounded-2xl w-full max-w-sm shadow-2xl border border-telegram-hover">
            <div className="flex justify-between items-center mb-6">
               <h2 className="text-xl font-bold">Create Group</h2>
               <button onClick={() => setShowNewGroup(false)} className="text-telegram-muted hover:text-white"><X className="w-6 h-6"/></button>
            </div>
            <input type="text" value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Group Name" className="w-full bg-telegram-bg p-3 rounded-xl mb-4 focus:border-telegram-primary outline-none border border-transparent" />
            <p className="text-sm text-telegram-muted mb-2">Select Members:</p>
            <div className="max-h-48 overflow-y-auto bg-telegram-bg rounded-xl p-2 mb-6">
               {users.map(u => (
                 <label key={u.username} className="flex items-center gap-3 p-2 hover:bg-telegram-hover rounded-lg cursor-pointer">
                   <input type="checkbox" checked={selectedMembers.includes(u.username)} onChange={(e) => {
                      if(e.target.checked) setSelectedMembers([...selectedMembers, u.username]);
                      else setSelectedMembers(selectedMembers.filter(m => m !== u.username));
                   }} className="w-4 h-4 accent-telegram-primary" />
                   <span>{u.username}</span>
                 </label>
               ))}
               {users.length === 0 && <p className="text-xs text-telegram-muted p-2">No users to add.</p>}
            </div>
            <button onClick={handleCreateGroup} className="w-full bg-telegram-primary py-3 rounded-xl font-bold hover:bg-blue-600 disabled:opacity-50" disabled={!groupName || selectedMembers.length === 0}>Create Group</button>
          </div>
        </div>
      )}

      {/* SEARCH USER MODAL */}
      {showSearch && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-telegram-sidebar p-6 rounded-2xl w-full max-w-sm shadow-2xl border border-telegram-hover">
            <div className="flex justify-between items-center mb-6">
               <h2 className="text-xl font-bold">Find a User</h2>
               <button onClick={() => { setShowSearch(false); setSearchResult(null); setSearchError(''); setSearchQuery(''); }} className="text-telegram-muted hover:text-white"><X className="w-6 h-6"/></button>
            </div>
            <p className="text-sm text-telegram-muted mb-3">Username se kisi ko bhi dhundho aur turant chat shuru karo.</p>
            <div className="flex gap-2 mb-4">
              <input 
                type="text" 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleSearchUser()}
                placeholder="Username dalo (e.g. Rahul)" 
                className="flex-1 bg-telegram-bg p-3 rounded-xl focus:border-telegram-primary outline-none border border-transparent"
              />
              <button onClick={handleSearchUser} className="px-4 py-3 bg-telegram-primary rounded-xl hover:bg-blue-600 font-bold">
                <Search className="w-5 h-5" />
              </button>
            </div>

            {searchError && (
              <div className="bg-red-500/20 border border-red-500/40 text-red-300 p-3 rounded-xl text-sm mb-4">
                {searchError}
              </div>
            )}

            {searchResult && (
              <div className="bg-telegram-bg p-4 rounded-xl flex items-center gap-4 mb-4 border border-telegram-primary/30">
                <div className="w-14 h-14 bg-telegram-primary rounded-full flex items-center justify-center font-bold text-2xl text-white">
                  {searchResult.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{searchResult.username}</h3>
                  <p className="text-sm text-telegram-muted">{searchResult.bio || 'SecureChat user'}</p>
                  <span className={`text-xs font-medium ${searchResult.online ? 'text-green-400' : 'text-telegram-muted'}`}>
                    {searchResult.online ? '🟢 Online' : '⚪ Offline'}
                  </span>
                </div>
              </div>
            )}

            {searchResult && (
              <button onClick={openChatWithSearchResult} className="w-full bg-telegram-primary py-3 rounded-xl font-bold hover:bg-blue-600 flex items-center justify-center gap-2">
                <Send className="w-5 h-5" /> Message {searchResult.username}
              </button>
            )}
          </div>
        </div>
      )}

      {/* WEBRTC CALL INTERFACE OVERLAY */}
      {callState !== 'idle' && (
        <div className="absolute inset-0 bg-telegram-bg/95 z-[100] flex flex-col items-center justify-between p-6 text-white overflow-y-auto">
          <audio ref={remoteAudioRef} autoPlay playsInline style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }} />
          
          {/* Call Header */}
          <div className="text-center mt-12">
            <div className="w-24 h-24 bg-telegram-primary/20 border-2 border-telegram-primary rounded-full mx-auto flex items-center justify-center text-4xl font-bold text-white mb-6 animate-pulse">
              {activeCallUser ? activeCallUser.charAt(0).toUpperCase() : '?'}
            </div>
            <h2 className="text-3xl font-bold tracking-wide">{activeCallUser}</h2>
            <p className="text-telegram-muted text-sm mt-2 font-medium capitalize">
              {callState === 'dialing' && 'Calling...'}
              {callState === 'ringing' && 'Incoming Call...'}
              {callState === 'connected' && `In Call (${isVideoCall ? 'Video' : 'Audio'})`}
            </p>
          </div>

          {/* Videos Grid */}
          {callState === 'connected' && isVideoCall && (
            <div className="flex-1 w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6 my-6 relative min-h-[300px]">
              <div className="relative bg-telegram-sidebar rounded-2xl overflow-hidden shadow-2xl border border-telegram-hover">
                <video ref={localVideoRef} autoPlay playsInline muted={true} className="w-full h-full object-cover rounded-2xl transform -scale-x-100 min-h-[200px]" />
                <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md">
                  Aap (You) {isVideoMuted && '🎥 Off'} {isMuted && '🎙️ Muted'}
                </div>
              </div>
              <div className="relative bg-telegram-sidebar rounded-2xl overflow-hidden shadow-2xl border border-telegram-hover">
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover rounded-2xl min-h-[200px]" />
                <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md">
                  {activeCallUser}
                </div>
              </div>
            </div>
          )}

          {/* Audio-only Call Animation */}
          {callState === 'connected' && !isVideoCall && (
            <div className="flex-1 flex items-center justify-center my-6">
              <div className="relative flex items-center justify-center">
                <div className="absolute w-48 h-48 bg-telegram-primary/10 rounded-full animate-ping"></div>
                <div className="absolute w-36 h-36 bg-telegram-primary/20 rounded-full animate-pulse"></div>
                <div className="w-24 h-24 bg-telegram-primary rounded-full flex items-center justify-center shadow-lg shadow-telegram-primary/30 relative">
                  <Phone className="w-10 h-10 text-white" />
                </div>
              </div>
            </div>
          )}

          {/* Local video preview during dialing */}
          {callState === 'dialing' && isVideoCall && (
            <div className="w-48 h-36 bg-telegram-sidebar border border-telegram-hover rounded-xl overflow-hidden shadow-xl my-4">
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100" />
            </div>
          )}

          {/* Ringing (Incoming Call) Controls */}
          {callState === 'ringing' && (
            <div className="flex gap-8 mb-12 animate-bounce">
              <button 
                onClick={acceptCall}
                className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30 hover:bg-green-600 hover:scale-105 active:scale-95 transition-all text-white animate-pulse"
                title="Accept Call"
              >
                <Phone className="w-8 h-8" />
              </button>
              <button 
                onClick={rejectCall}
                className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30 hover:bg-red-600 hover:scale-105 active:scale-95 transition-all text-white"
                title="Reject Call"
              >
                <PhoneOff className="w-8 h-8" />
              </button>
            </div>
          )}

          {/* Active Call (Dialing/Connected) Controls */}
          {callState !== 'ringing' && (
            <div className="flex items-center gap-6 mb-12">
              <button 
                onClick={toggleMute}
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-md transition-all hover:scale-105 active:scale-95 ${isMuted ? 'bg-red-500 text-white' : 'bg-telegram-sidebar text-telegram-muted hover:text-white border border-telegram-hover'}`}
                title={isMuted ? "Unmute Mic" : "Mute Mic"}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>
              
              <button 
                onClick={hangUp}
                className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/40 hover:bg-red-600 hover:scale-105 active:scale-95 transition-all text-white"
                title="Hang Up"
              >
                <PhoneOff className="w-8 h-8" />
              </button>

              {isVideoCall && (
                <button 
                  onClick={toggleVideo}
                  className={`w-14 h-14 rounded-full flex items-center justify-center shadow-md transition-all hover:scale-105 active:scale-95 ${isVideoMuted ? 'bg-red-500 text-white' : 'bg-telegram-sidebar text-telegram-muted hover:text-white border border-telegram-hover'}`}
                  title={isVideoMuted ? "Turn On Camera" : "Turn Off Camera"}
                >
                  {isVideoMuted ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                </button>
              )}
            </div>
          )}

        </div>
      )}
    </div>

  );
}
