import React, { useState, useEffect } from 'react';
import './App.css';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import { checkAPIHealth } from './services/api';

function App() {
  const [availablePDFs, setAvailablePDFs] = useState([]);
  const [apiConnected, setApiConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Check API health
        const healthResponse = await checkAPIHealth();
        setApiConnected(true);
        
        // Set a default PDF list since we don't have a list endpoint
        setAvailablePDFs([
          { id: 'documents', name: 'KattSafe Documents', exists: true, path: 'documents' }
        ]);
        
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setApiConnected(false);
      } finally {
        setLoading(false);
      }
    };

    initializeApp();
  }, []);

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Connecting to Azure Assistant API...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <Header apiConnected={apiConnected} />
      <div className="app-content">
        <Sidebar availablePDFs={availablePDFs} />
        <ChatArea availablePDFs={availablePDFs} />
      </div>
    </div>
  );
}

export default App;
