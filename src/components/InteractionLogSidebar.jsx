/**
 * Interaction Log Sidebar
 * Shows a detailed log of all AI requests and responses during evaluation
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  ChevronRight, 
  ChevronDown, 
  CheckCircle, 
  XCircle, 
  Clock,
  ChevronLeft,
  Search,
  Download,
  Trash2,
  Copy,
  Expand
} from 'lucide-react';
import { t, useLang } from '../services/i18n';

const InteractionLogSidebar = ({ interactions, isOpen, onToggle, currentInteraction }) => {
  useLang();
  const [expandedItems, setExpandedItems] = useState({});
  const [filter, setFilter] = useState('all'); // all, correct, incorrect
  const [searchTerm, setSearchTerm] = useState('');
  const logContainerRef = useRef(null);

  // Auto-scroll to current interaction
  useEffect(() => {
    if (currentInteraction && logContainerRef.current) {
      const currentElement = document.getElementById(`interaction-${currentInteraction.questionId}-${currentInteraction.timestamp}`);
      if (currentElement) {
        currentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentInteraction]);

  // Filter interactions
  const filteredInteractions = interactions.filter(interaction => {
    if (filter === 'correct' && !interaction.isCorrect) return false;
    if (filter === 'incorrect' && interaction.isCorrect) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        interaction.question?.toLowerCase().includes(search) ||
        interaction.responseText?.toLowerCase().includes(search) ||
        interaction.modelId?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const toggleExpand = (id) => {
    setExpandedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const exportLog = () => {
    const logText = interactions.map(i => `
[${new Date(i.timestamp).toLocaleTimeString()}] ${i.modelId}
${t('chart.details.question')} ${i.question}
${i.context ? `${t('log.context')} ${i.context}` : ''}
${t('chart.details.correctAnswer')} ${i.correctAnswer}
${t('log.modelLabel', { v: i.modelAnswer })}
Result: ${i.isCorrect ? t('log.correct') : t('log.incorrect')}
${t('log.modelResponse')} ${i.responseText}
---
`).join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `llm-evaluation-log-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const correctCount = interactions.filter(i => i.isCorrect).length;
  const incorrectCount = interactions.filter(i => !i.isCorrect).length;

  return (
    <>
      {/* Toggle Button */}
      <button 
        className={`log-toggle-btn ${isOpen ? 'open' : ''}`}
        onClick={onToggle}
        title={isOpen ? t('log.close') : t('log.open')}
      >
        <MessageSquare className="w-5 h-5" />
        <span className="log-badge">{interactions.length}</span>
        <ChevronRight className={`w-4 h-4 toggle-icon ${isOpen ? 'rotated' : ''}`} />
      </button>

      {/* Sidebar */}
      <div className={`log-sidebar ${isOpen ? 'open' : ''}`}>
        {/* Header */}
        <div className="log-header">
          <div className="log-header-title">
            <MessageSquare className="w-5 h-5" />
            <h3>{t('log.title')}</h3>
          </div>
          <div className="log-stats">
            <span className="log-stat correct">
              <CheckCircle className="w-4 h-4" />
              {correctCount}
            </span>
            <span className="log-stat incorrect">
              <XCircle className="w-4 h-4" />
              {incorrectCount}
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="log-filters">
          <div className="log-search">
            <Search className="w-4 h-4" />
            <input 
              type="text" 
              placeholder={t('log.search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="log-filter-buttons">
            <button 
              className={filter === 'all' ? 'active' : ''}
              onClick={() => setFilter('all')}
            >
              {t('log.all')}
            </button>
            <button 
              className={filter === 'correct' ? 'active' : ''}
              onClick={() => setFilter('correct')}
            >
              {t('log.correct')}
            </button>
            <button 
              className={filter === 'incorrect' ? 'active' : ''}
              onClick={() => setFilter('incorrect')}
            >
              {t('log.incorrect')}
            </button>
          </div>
        </div>

        {/* Log List */}
        <div className="log-list" ref={logContainerRef}>
          {filteredInteractions.length === 0 ? (
            <div className="log-empty">
              {interactions.length === 0 ? t('log.none') : t('log.noMatch')}
            </div>
          ) : (
            filteredInteractions.map((interaction) => {
              const itemId = `${interaction.questionId}-${interaction.timestamp}`;
              const isExpanded = expandedItems[itemId];
              const isCurrent = currentInteraction && currentInteraction.questionId === interaction.questionId;

              return (
                <div 
                  key={itemId} 
                  id={`interaction-${itemId}`}
                  className={`log-item ${interaction.isCorrect ? 'correct' : 'incorrect'} ${isCurrent ? 'current' : ''}`}
                >
                  <div 
                    className="log-item-header"
                    onClick={() => toggleExpand(itemId)}
                  >
                    <div className="log-item-indicator">
                      {interaction.isCorrect ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    <div className="log-item-info">
                      <div className="log-item-meta">
                        <span className="log-item-model">{interaction.modelId?.split(':')[0]}</span>
                        <span className="log-item-time">
                          <Clock className="w-3 h-3" />
                          {formatTime(interaction.timestamp)}
                        </span>
                      </div>
                      <div className="log-item-question">
                        {interaction.question?.substring(0, 60)}...
                      </div>
                      <div className="log-item-answers">
                        <span className="answer correct">{t('log.correctLabel', { v: interaction.correctAnswer })}</span>
                        <span className={`answer model ${interaction.isCorrect ? 'correct' : 'incorrect'}`}>
                          {t('log.modelLabel', { v: interaction.modelAnswer || t('chart.na') })}
                        </span>
                      </div>
                    </div>
                    <div className="log-item-expand">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="log-item-details">
                      {interaction.context && (
                        <div className="detail-section">
                          <strong>{t('log.context')}</strong>
                          <p>{interaction.context}</p>
                        </div>
                      )}
                      
                      <div className="detail-section">
                        <div className="detail-header">
                          <strong>{t('log.fullQuestion')}</strong>
                          <button 
                            className="icon-btn"
                            onClick={() => copyToClipboard(interaction.question)}
                            title={t('log.copy')}
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        <p>{interaction.question}</p>
                      </div>

                      <div className="detail-section">
                        <div className="detail-header">
                          <strong>{t('log.modelResponse')}</strong>
                          <button 
                            className="icon-btn"
                            onClick={() => copyToClipboard(interaction.responseText || '')}
                            title={t('log.copy')}
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        <pre className="response-text">{interaction.responseText || t('log.noResponse')}</pre>
                      </div>

                      <div className="detail-section">
                        <strong>{t('log.responseTime')}</strong>
                        <span>{interaction.responseTime ? `${(interaction.responseTime / 1000).toFixed(2)}s` : t('chart.na')}</span>
                      </div>

                      {interaction.tokens > 0 && (
                        <div className="detail-section">
                          <strong>{t('log.tokens')}</strong>
                          <span>{interaction.tokens}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        {interactions.length > 0 && (
          <div className="log-footer">
            <button className="log-action-btn" onClick={exportLog}>
              <Download className="w-4 h-4" />
              {t('log.export')}
            </button>
            <span className="log-count">
              {t('log.of', { a: filteredInteractions.length, b: interactions.length })}
            </span>
          </div>
        )}
      </div>

      {/* Overlay when sidebar is open on mobile */}
      {isOpen && <div className="log-overlay" onClick={onToggle} />}
    </>
  );
};

export default InteractionLogSidebar;