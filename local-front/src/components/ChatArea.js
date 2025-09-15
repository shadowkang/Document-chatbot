import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, Trash2, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { askQuestion } from '../services/api';
import './ChatArea.css';

const ChatArea = ({ availablePDFs }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const sampleQuestions = [
    "What is the warranty period for LD494 hinged and LD498/499 sliding roof access hatches?",
    "According to Australian Standards, what clearance requirements apply to ladders near roof access hatches?",
    "Which hatch type is recommended for small to medium internal access spaces?",
    "What are the dimensions of the sliding roof access hatch with product code LD497.1000?",
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Add welcome message when component mounts
    setMessages([{
      id: Date.now(),
      type: 'assistant',
      content: `👋 Hello! I'm your KattSafe Documentation assistant. I can help you find information from all your KattSafe documents using intelligent semantic search. Ask me anything about KattSafe products, installation, safety, or procedures!`,
      timestamp: new Date().toLocaleTimeString()
    }]);
  }, []);

  const handleSendMessage = async (question = inputMessage) => {
    if (!question.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: question,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // FastAPI /ask 接口只需要 { query }
      const response = await askQuestion({ query: question });

      // 新的API响应格式处理
      const assistantMessage = {
        id: Date.now() + 1,
        type: 'assistant',
        content: response.answer,
        reference: response.reference,
        hits: response.hits,
        confidence: response.confidence,
        timestamp: new Date().toLocaleTimeString()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        type: 'error',
        content: `Error: ${error.message}`,
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([{
      id: Date.now(),
      type: 'assistant',
      content: `👋 Hello! I'm your KattSafe Documentation assistant. I can help you find information from all your KattSafe documents using intelligent semantic search. Ask me anything about KattSafe products, installation, safety, or procedures!`,
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const copyMessage = (content) => {
    navigator.clipboard.writeText(content);
  };

  // 将文本中的URL转换为超链接，并改进格式化
  const renderMessageWithLinks = (text) => {
    // URL正则表达式
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    // 先处理换行和格式化
    const formatText = (content) => {
      // 处理编号列表和bullet points
      return content
        .split('\n')
        .map((line, index) => {
          // 处理编号列表 (1. 2. 3. 等)
          if (/^\d+\.\s+\*\*/.test(line)) {
            return (
              <div key={index} className="numbered-item">
                {formatLineWithLinks(line)}
              </div>
            );
          }
          // 处理子项目 (- 开头)
          else if (/^\s*-\s+/.test(line)) {
            return (
              <div key={index} className="sub-item">
                {formatLineWithLinks(line)}
              </div>
            );
          }
          // 处理普通段落
          else if (line.trim()) {
            return (
              <div key={index} className="paragraph">
                {formatLineWithLinks(line)}
              </div>
            );
          }
          // 空行
          else {
            return <div key={index} className="line-break"></div>;
          }
        });
    };

    const formatLineWithLinks = (line) => {
      if (!urlRegex.test(line)) {
        return formatMarkdown(line);
      }

      const parts = line.split(urlRegex);
      return parts.map((part, index) => {
        if (urlRegex.test(part)) {
          return (
            <a 
              key={index} 
              href={part} 
              target="_blank" 
              rel="noopener noreferrer"
              className="message-link"
              title="点击打开链接"
            >
              {part}
            </a>
          );
        }
        return <span key={index}>{formatMarkdown(part)}</span>;
      });
    };

    // 处理markdown格式 (粗体)
    const formatMarkdown = (text) => {
      // 处理 **粗体** 格式
      const parts = text.split(/(\*\*[^*]+\*\*)/g);
      return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index}>{part.slice(2, -2)}</strong>;
        }
        return part;
      });
    };

    return formatText(text);
  };

  const fixCitation = async (messageId, answer, question) => {
    // TODO: 实现引用修正功能，需要后端支持
    console.log('Citation fix not implemented yet');
  };

  return (
    <div className="chat-area">
      <div className="chat-header">
        <div className="chat-title">
          <MessageCircle size={20} />
          <span>KattSafe Documentation Assistant</span>
        </div>
        <div className="chat-info">
          <span className="search-indicator">
            🤖• {availablePDFs.length} documents indexed
          </span>
          <button className="clear-btn" onClick={clearChat} title="Clear Chat">
            <Trash2 size={16} />
            Clear
          </button>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.type}`}>
            <div className="message-content">
              <div className="message-text">
                {typeof message.content === 'string' 
                  ? renderMessageWithLinks(message.content)
                  : message.content
                }
              </div>
              
              {/* 显示Reference信息 */}
              {message.reference && (
                <div className="reference-section">
                  <div className="reference-separator"></div>
                  <div className="reference-content">
                    <div className="reference-header">📚 Reference:</div>
                    <div className="reference-details">
                      {message.reference.folder && (
                        <div className="reference-item">
                          <span className="reference-label">Folder:</span>
                          <span className="reference-value">{message.reference.folder}</span>
                        </div>
                      )}
                      {message.reference.file && (
                        <div className="reference-item">
                          <span className="reference-label">File:</span>
                          <span className="reference-value">{message.reference.file}</span>
                        </div>
                      )}
                      {message.reference.page && message.reference.page !== null && message.reference.page !== "" && (
                        <div className="reference-item">
                          <span className="reference-label">Page:</span>
                          <span className="reference-value">{message.reference.page}</span>
                        </div>
                      )}
                      {message.reference.url && (
                        <div className="reference-item">
                          <span className="reference-label">Document:</span>
                          <a 
                            href={message.reference.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="reference-link"
                          >
                            <ExternalLink size={14} />
                            Open PDF
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* 显示查找结果数量 */}
              {message.hits && (
                <div className="search-info">
                  <span className="hits-count">Found {message.hits} relevant document chunks</span>
                </div>
              )}
              
              
                {message.citations && message.citations.length > 0 && (
                  <div className="citations">
                    <div className="citation-header-with-actions">
                      <h4>📚 Sources & Citations:</h4>
                      {message.type === 'assistant' && !message.correctedFilename && (
                        <button 
                          className="fix-citation-btn"
                          onClick={() => fixCitation(message.id, message.content, messages.find(m => m.type === 'user' && m.id < message.id)?.content)}
                          disabled={message.fixingCitation}
                          title="Fix citation using enhanced content analysis"
                        >
                          {message.fixingCitation ? (
                            <>
                              <RefreshCw size={12} className="spinning" />
                              Fixing...
                            </>
                          ) : (
                            <>
                              <RefreshCw size={12} />
                              Fix Citation
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    
                    {message.correctedFilename && (
                      <div className="correction-notice">
                        <strong>✅ Citation Corrected:</strong> {message.correctedFilename}
                        <br />
                        <em>{message.correctionReasoning}</em>
                      </div>
                    )}
                    
                    {message.citationError && (
                      <div className="citation-error">
                        <strong>❌ Citation Fix Failed:</strong> {message.citationError}
                      </div>
                    )}
                    
                    {message.citations.map((citation, index) => (
                      <div key={index} className="citation">
                        <div className="citation-header">
                          {citation.page ? (
                            <span className="page">📄 Page {citation.page}</span>
                          ) : (
                            <span className="page">📄 Document Reference</span>
                          )}
                        </div>
                        <div className="quote-text">{citation.quote}</div>
                        {citation.document_link && (
                          <a 
                            href={citation.document_link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="document-link"
                            title="Open original document"
                          >
                            <ExternalLink size={14} />
                            View Document
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {message.confidence !== undefined && (
                  <div className="message-meta">
                    <span className="confidence">
                      Confidence: {message.confidence}%
                    </span>
                  </div>
                )}
              </div>
              
              <div className="message-footer">
                <span className="timestamp">{message.timestamp}</span>
                <button 
                  className="copy-btn" 
                  onClick={() => copyMessage(message.content)}
                  title="Copy message"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
          )
        )}        {isLoading && (
          <div className="message assistant loading">
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {messages.filter(msg => msg.type === 'user').length === 0 && (
        <div className="sample-questions">
          <div className="sample-header">
            <span className="lightbulb">💡</span>
            <span>Sample Questions:</span>
          </div>
          <div className="questions-grid">
            {sampleQuestions.map((question, index) => (
              <button
                key={index}
                className="sample-question"
                onClick={() => handleSendMessage(question)}
                disabled={isLoading}
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="chat-input">
        <div className="input-container">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question about your PDF document..."
            disabled={isLoading}
            rows="1"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim() || isLoading}
            className="send-btn"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatArea;
