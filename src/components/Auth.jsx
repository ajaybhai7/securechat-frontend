import React, { useState } from 'react';
import { generateKeyPair, exportPublicKey, exportPrivateKey } from '../utils/crypto';

const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:5000'
  : 'https://securechat-backend-production-2542.up.railway.app';

export default function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [inviteGroup, setInviteGroup] = useState('');
  
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const g = params.get('g');
    if (g) setInviteGroup(g);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) return;

    try {
      if (!isLogin) {
        // Signup flow: generate keys for End-to-End Encryption
        const keyPair = await generateKeyPair();
        const pubKey = await exportPublicKey(keyPair.publicKey);
        const privKey = await exportPrivateKey(keyPair.privateKey);
        
        const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, publicKey: pubKey, inviteGroup })
        });
        
        if (!res.ok) throw new Error("Registration failed. Username might already exist.");
        
        // Save keys securely in local storage
        localStorage.setItem(`private_key_${username}`, privKey);
        localStorage.setItem(`public_key_${username}`, pubKey);
        console.log("Keys generated and registered securely for:", username);
      } else {
        const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        
        if (!res.ok) throw new Error("Invalid credentials!");
        
        const data = await res.json();
        if (data.publicKey) {
          localStorage.setItem(`public_key_${username}`, data.publicKey);
        }
      }
      
      // Proceed to chat
      localStorage.setItem('currentUser', username);
      onLogin(username);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="flex h-dvh items-center justify-center bg-telegram-bg text-white font-sans">
      <div className="w-full max-w-md bg-telegram-sidebar p-8 rounded-2xl shadow-xl border border-telegram-hover relative overflow-hidden">
        <div className="text-center mb-8 relative z-10">
          <div className="w-16 h-16 bg-telegram-primary rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg shadow-telegram-primary/40">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold tracking-tight">SecureChat</h2>
          <p className="text-telegram-primary text-sm mt-1 font-medium">End-to-End Encrypted</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          <div>
            <label className="block text-sm font-medium text-telegram-muted mb-1 ml-1">Username</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-telegram-bg border border-telegram-hover rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-telegram-primary transition-all"
              placeholder="Enter your username"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-telegram-muted mb-1 ml-1">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-telegram-bg border border-telegram-hover rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-telegram-primary transition-all"
              placeholder="Enter your password"
            />
          </div>

          <button 
            type="submit" 
            className="w-full bg-telegram-primary hover:bg-blue-600 text-white font-semibold py-3.5 rounded-xl transition-all mt-4 shadow-lg shadow-telegram-primary/30"
          >
            {isLogin ? 'Log In to SecureChat' : 'Create Account & Keys'}
          </button>
        </form>

        <div className="mt-8 text-center relative z-10">
          <button 
            onClick={() => setIsLogin(!isLogin)} 
            className="text-telegram-muted text-sm hover:text-white transition-colors"
          >
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <span className="text-telegram-primary font-medium">
              {isLogin ? "Sign up" : "Log in"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
