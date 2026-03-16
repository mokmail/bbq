import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  X, 
  Minimize2, 
  Maximize2, 
  Bot,
  User,
  Sparkles,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { 
  processUserQuery, 
  getSuggestedQuestions, 
  MessageTypes,
  setEvaluationContext 
} from '../services/chatAssistantService';
import './ChatAssistant.css';

const ChatAssistant = ({ results, isOpen, onToggle }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (results && results.length > 0) {
      setEvaluationContext(results);
      
      if (messages.length === 0) {
        const welcomeMessage = {
          type: MessageTypes.ASSISTANT,
          content: 'Hello! I am your BBQ evaluation assistant. I can help you understand the results from ' + results.length + ' model(s) that were evaluated.\n\nWhat would you like to know?',
          suggestions: getSuggestedQuestions().slice(0, 4)
        };
        setMessages([welcomeMessage]);
        setSuggestions(welcomeMessage.suggestions);
      }
    }
  }, [results]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  const handleSendMessage = async (text = inputValue) => {
    if (!text.trim()) return;

    const userMessage = {
      type: MessageTypes.USER,
      content: text
    };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    setTimeout(() => {
      const response = processUserQuery(text);
      setMessages(prev => [...prev, response]);
      setSuggestions(response.suggestions || []);
      setIsTyping(false);
    }, 500 + Math.random() * 500);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSuggestionClick = (suggestion) => {
    handleSendMessage(suggestion);
  };

  const clearChat = () => {
    setMessages([]);
    setSuggestions([]);
    if (results?.length > 0) {
      const welcomeMessage = {
        type: MessageTypes.ASSISTANT,
        content: 'Hello! I am your BBQ evaluation assistant. I can help you understand the results from ' + results.length + ' model(s) that were evaluated.\n\nWhat would you like to know?',
        suggestions: getSuggestedQuestions().slice(0, 4)
      };
      setMessages([welcomeMessage]);
      setSuggestions(welcomeMessage.suggestions);
    }
  };

  const formatContent = (content) => {
    const lines = content.split('\n');
    return lines.map((line, i) => {
      if (line.startsWith('## ')) {
        return React.createElement('h3', { key: i, className: 'chat-message-header' }, line.replace('## ', ''));
      }
      if (line.startsWith('### ')) {
        return React.createElement('h4', { key: i, className: 'chat-message-subheader' }, line.replace('### ', ''));
      }
      
      let formattedLine = line;
      formattedLine = formattedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      
      if (line.startsWith('- ') || line.startsWith('• ')) {
        return React.createElement('div', { key: i, className: 'chat-bullet-point' },
          React.createElement('span', { className: 'chat-bullet' }, '•'),
          React.createElement('span', { dangerouslySetInnerHTML: { __html: formattedLine.replace(/^[-•] /, '') } })
        );
      }
      
      if (line.trim() === '') {
        return React.createElement('br', { key: i });
      }
      
      return React.createElement('p', { key: i, dangerouslySetInnerHTML: { __html: formattedLine } });
    });
  };

  if (!isOpen) {
    return null;
  }

  return (
    React.createElement('div', { className: 'chat-wrapper' },
      React.createElement('div', { className: 'chat-container ' + (isMinimized ? 'minimized' : '') },
        React.createElement('div', { className: 'chat-header' },
          React.createElement('div', { className: 'chat-header-left' },
            React.createElement('div', { className: 'chat-avatar' },
              React.createElement(Bot, { className: 'w-5 h-5' })
            ),
            React.createElement('div', { className: 'chat-header-info' },
              React.createElement('h3', { className: 'chat-title' }, 'BBQ Assistant'),
              React.createElement('span', { className: 'chat-status' },
                React.createElement('span', { className: 'chat-status-dot' }),
                'Ready to help'
              )
            )
          ),
          React.createElement('div', { className: 'chat-header-actions' },
            React.createElement('button', {
              className: 'chat-action-btn',
              onClick: () => setIsMinimized(!isMinimized),
              title: isMinimized ? 'Expand' : 'Minimize'
            }, isMinimized ? React.createElement(Maximize2, { className: 'w-4 h-4' }) : React.createElement(Minimize2, { className: 'w-4 h-4' })),
            React.createElement('button', {
              className: 'chat-action-btn',
              onClick: onToggle,
              title: 'Close'
            }, React.createElement(X, { className: 'w-4 h-4' }))
          )
        ),
        !isMinimized && React.createElement(React.Fragment, null,
          React.createElement('div', { className: 'chat-messages' },
            messages.length === 0 ?
              React.createElement('div', { className: 'chat-empty-state' },
                React.createElement(Sparkles, { className: 'w-12 h-12' }),
                React.createElement('p', null, 'Ask me anything about your evaluation results!'),
                React.createElement('div', { className: 'chat-empty-suggestions' },
                  getSuggestedQuestions().slice(0, 3).map((q, i) =>
                    React.createElement('button', {
                      key: i,
                      className: 'chat-empty-suggestion',
                      onClick: () => handleSuggestionClick(q)
                    }, q)
                  )
                )
              ) :
              React.createElement(React.Fragment, null,
                messages.map((message, index) =>
                  React.createElement('div', {
                    key: index,
                    className: 'chat-message ' + (message.type === MessageTypes.USER ? 'user' : 'assistant')
                  },
                    React.createElement('div', { className: 'chat-message-avatar' },
                      message.type === MessageTypes.USER ?
                        React.createElement(User, { className: 'w-4 h-4' }) :
                        React.createElement(Bot, { className: 'w-4 h-4' })
                    ),
                    React.createElement('div', { className: 'chat-message-content' },
                      formatContent(message.content)
                    )
                  )
                ),
                isTyping &&
                  React.createElement('div', { className: 'chat-message assistant typing' },
                    React.createElement('div', { className: 'chat-message-avatar' },
                      React.createElement(Bot, { className: 'w-4 h-4' })
                    ),
                    React.createElement('div', { className: 'chat-typing-indicator' },
                      React.createElement('span', null),
                      React.createElement('span', null),
                      React.createElement('span', null)
                    )
                  ),
                React.createElement('div', { ref: messagesEndRef })
              )
          ),
          suggestions.length > 0 &&
            React.createElement('div', { className: 'chat-suggestions' },
              suggestions.map((suggestion, index) =>
                React.createElement('button', {
                  key: index,
                  className: 'chat-suggestion-chip',
                  onClick: () => handleSuggestionClick(suggestion)
                }, suggestion, React.createElement(ChevronRight, { className: 'w-3 h-3' }))
              )
            ),
          React.createElement('div', { className: 'chat-input-container' },
            React.createElement('div', { className: 'chat-input-wrapper' },
              React.createElement('input', {
                ref: inputRef,
                type: 'text',
                className: 'chat-input',
                placeholder: 'Ask about results, bias, recommendations...',
                value: inputValue,
                onChange: (e) => setInputValue(e.target.value),
                onKeyPress: handleKeyPress,
                disabled: !results || results.length === 0
              }),
              React.createElement('button', {
                className: 'chat-send-btn',
                onClick: () => handleSendMessage(),
                disabled: !inputValue.trim() || isTyping
              }, isTyping ? React.createElement(Loader2, { className: 'w-4 h-4 spin' }) : React.createElement(Send, { className: 'w-4 h-4' }))
            ),
            messages.length > 0 &&
              React.createElement('button', { className: 'chat-clear-btn', onClick: clearChat }, 'Clear chat')
          )
        )
      )
    )
  );
};

export default ChatAssistant;
