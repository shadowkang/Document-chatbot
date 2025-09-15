import React from 'react';
import { FileText, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import './Header.css';

const Header = ({ apiConnected }) => {
  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <FileText className="header-icon" size={28} />
          <div className="header-text">
            <h1>PDF QA Chatbot</h1>
            <p>Intelligent PDF Question Answering with OCR</p>
          </div>
        </div>
        
        <div className="header-right">
          <div className={`api-status ${apiConnected ? 'connected' : 'disconnected'}`}>
            {apiConnected ? (
              <>
                <Wifi size={16} />
                <span>API: Connected</span>
              </>
            ) : (
              <>
                <WifiOff size={16} />
                <span>API: Disconnected</span>
              </>
            )}
          </div>
          
          <button className="refresh-btn" onClick={handleRefresh} title="Refresh">
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
