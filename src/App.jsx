import React, { useState } from 'react';
import ChatLayout from './components/ChatLayout';
import Auth from './components/Auth';
import { Toaster } from 'react-hot-toast';

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? { username: saved } : null;
  });

  if (!user) {
    return (
      <>
        <Toaster position="top-center" toastOptions={{ style: { background: '#17212b', color: '#fff' } }} />
        <Auth onLogin={(username) => setUser({ username })} />
      </>
    );
  }

  return (
    <div className="App">
      <Toaster position="top-center" toastOptions={{ style: { background: '#17212b', color: '#fff' } }} />
      <ChatLayout user={user} />
    </div>
  );
}

export default App;
