import React from 'react';
import { FileText, Database } from 'lucide-react';
import './Sidebar.css';

const Sidebar = ({ availablePDFs }) => {

  return (
    <div className="sidebar">
      {/* Document Collection Section */}
      <div className="sidebar-section">
        <div className="section-header">
          <Database size={18} />
          <h3>Azure Vector Store</h3>
        </div>
        
        <div className="document-info">
          <p className="info-text">
            🔍 <strong>Intelligent Document Search</strong>
          </p>
          <p className="subtitle">
            Powered by Azure OpenAI with automatic OCR and semantic search across all KattSafe documents.
          </p>
          
          <div className="status-indicator">
            <span className={`status-dot ${availablePDFs.length > 0 ? 'online' : 'offline'}`}></span>
            <span className="status-text">
              {availablePDFs.length > 0 ? `${availablePDFs.length} documents indexed` : 'Loading documents...'}
            </span>
          </div>
        </div>
      </div>

      {/* Available Documents Section */}
      <div className="sidebar-section">
        <div className="section-header">
          <FileText size={18} />
          <h3>Document Library</h3>
        </div>
        
        <div className="document-list">
          {availablePDFs.map((pdf, index) => (
            <div key={index} className="document-item">
              <FileText size={14} />
              <span className="doc-name">{pdf.name || pdf}</span>
              <span className="doc-status">✓</span>
            </div>
          ))}
          
          {availablePDFs.length === 0 && (
            <div className="loading-docs">
              <p>📄 Loading document library...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
