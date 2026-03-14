/**
 * LLM Model Evaluator Component
 * Main interface for evaluating Ollama models on BBQ benchmark
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Brain,
  BarChart3,
  Settings,
  ChevronDown,
  AlertTriangle,
  Info,
  Activity,
  Sparkles,
  SlidersHorizontal,
  ListChecks,
  Save
} from 'lucide-react';
import { bbqQuestions, generateAllQuestions, getQuestionsByTask, getQuestionsByContextType, BBQTasks, TaskLabels } from '../data/bbqQuestions';
import { loadBBQData, getCategories } from '../data/bbqDataLoader';
import { getAvailableModels, checkOllamaStatus } from '../services/ollamaService';
import { evaluateModel, evaluateModels, generateComparison, calculateInsights } from '../services/evaluationEngine';
import {
  AccuracyComparisonChart,
  TaskPerformanceRadar,
  ResponseTimeChart,
  ContextImpactChart,
  TaskBreakdownChart,
  AccuracyDistributionChart,
  UnifiedAnswerDistribution,
  Leaderboard,
  QuestionResultsTable,
  StatsSummary,
  InsightsPanel,
  CHART_COLORS
} from './EvaluationCharts';
import InteractionLogSidebar from './InteractionLogSidebar';

// Style imports
import './EvaluationCharts.css';
import './InteractionLogSidebar.css';

const LLMEvaluator = ({ onResultsChange, onSaveReport }) => {
  // State
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModels, setSelectedModels] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, model: '', modelIndex: 0, totalModels: 0 });
  const [results, setResults] = useState([]);
  const [currentQuestionResult, setCurrentQuestionResult] = useState(null);
  const [ollamaStatus, setOllamaStatus] = useState('checking');
  const [activePanel, setActivePanel] = useState('setup');
  
  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [interactions, setInteractions] = useState([]);
  
  // Options
  const [options, setOptions] = useState({
    temperature: 0, // 0 for deterministic/reproducible results
    topP: 1, // 1 when temperature is 0 for reproducibility
    promptType: 'standard', // 'standard' or 'tricky'
  });
  
  // Data source
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadedQuestions, setLoadedQuestions] = useState([]);
  const [questionLimit, setQuestionLimit] = useState(0); // 0 = all questions
  const [selectedCategories, setSelectedCategories] = useState([]); // empty = all
  
  // Stop/Continue state
  const stopRef = useRef(false);
  const [isStopped, setIsStopped] = useState(false);
  const [continueFrom, setContinueFrom] = useState({ modelIndex: 0, questionIndex: 0 });

  useEffect(() => {
    if (onResultsChange) {
      onResultsChange(results);
    }
  }, [results, onResultsChange]);

  // Initialize
  useEffect(() => {
    checkStatus();
    fetchModels();
  }, []);

  const checkStatus = async () => {
    const status = await checkOllamaStatus();
    setOllamaStatus(status ? 'connected' : 'disconnected');
  };

  const fetchModels = async () => {
    const models = await getAvailableModels();
    setAvailableModels(models);
  };

  const toggleModelSelection = (modelId) => {
    setSelectedModels(prev => {
      if (prev.includes(modelId)) {
        return prev.filter(m => m !== modelId);
      }
      return [...prev, modelId];
    });
  };

  const selectAllModels = () => {
    if (selectedModels.length === availableModels.length) {
      setSelectedModels([]);
    } else {
      setSelectedModels(availableModels.map(m => m.id));
    }
  };

  const loadGithubData = async () => {
    setIsLoadingData(true);
    try {
      const questions = await loadBBQData();
      setLoadedQuestions(questions);
      console.log(`Loaded ${questions.length} questions from GitHub`);
    } catch (error) {
      console.error('Failed to load GitHub data:', error);
      alert('Failed to load data from GitHub');
    }
    setIsLoadingData(false);
  };

  const runEvaluation = async (resume = false) => {
    if (selectedModels.length === 0) {
      alert('Please select at least one model to evaluate');
      return;
    }
    
    if (loadedQuestions.length === 0) {
      alert('Please load BBQ data from GitHub first');
      return;
    }

    // Get questions based on data source
    let allQuestions;
    if (loadedQuestions.length > 0) {
      allQuestions = loadedQuestions;
    } else {
      alert('Please load BBQ data from GitHub first');
      return;
    }
    
    // Filter by selected categories (if none selected, use all)
    const categoriesToUse = selectedCategories.length > 0 ? selectedCategories : [...new Set(allQuestions.map(q => q.source))];
    allQuestions = allQuestions.filter(q => categoriesToUse.includes(q.source));
    
    if (allQuestions.length === 0) {
      alert('Please select at least one category');
      return;
    }
    
    // Group questions by source for per-category limiting
    const bySource = {};
    allQuestions.forEach(q => {
      const src = q.source || q.category || q.task;
      if (!bySource[src]) bySource[src] = [];
      bySource[src].push(q);
    });
    
    const sources = Object.keys(bySource);
    
    // Apply question limit - per selected category
    let limitedQuestions;
    if (questionLimit > 0) {
      // Take N questions from each activated category
      limitedQuestions = [];
      sources.forEach(src => {
        const shuffled = [...bySource[src]].sort(() => Math.random() - 0.5);
        limitedQuestions.push(...shuffled.slice(0, questionLimit));
      });
    } else {
      limitedQuestions = allQuestions;
    }

    // Reset for fresh start
    if (!resume) {
      setIsRunning(true);
      setIsStopped(false);
      setResults([]);
      setInteractions([]);
      setProgress({ current: 0, total: limitedQuestions.length, model: '', modelIndex: 0, totalModels: selectedModels.length });
      stopRef.current = false;
    } else {
      // When resuming, make sure we're still running
      setIsRunning(true);
      stopRef.current = false;
    }

    const startModelIndex = resume ? continueFrom.modelIndex : 0;
    const startQuestionIndex = resume ? continueFrom.questionIndex : 0;

    // Build results array - for resume, we need to rebuild with existing results
    let allResults = [];
    
    // Copy existing results that are fully completed
    for (let i = 0; i < startModelIndex; i++) {
      if (results[i]) {
        allResults.push(results[i]);
      }
    }

    for (let i = startModelIndex; i < selectedModels.length; i++) {
      const modelId = selectedModels[i];
      
      setProgress(prev => ({
        ...prev,
        model: modelId,
        modelIndex: i + 1,
      }));

      // Get the starting question index for this model
      const questionStartIdx = (i === startModelIndex) ? startQuestionIndex : 0;
      
      // Skip if this model is already fully completed
      if (i < results.length && results[i]?.questionResults?.length >= limitedQuestions.length) {
        allResults.push(results[i]);
        continue;
      }
      
      // For resuming, if we have partial results for current model, use remaining questions
      let questionsToAsk;
      if (i < results.length && results[i]?.questionResults) {
        const existingCount = results[i].questionResults.length;
        if (existingCount >= questionStartIdx) {
          questionsToAsk = limitedQuestions.slice(questionStartIdx);
        } else {
          questionsToAsk = limitedQuestions.slice(existingCount);
        }
      } else {
        questionsToAsk = limitedQuestions.slice(questionStartIdx);
      }
      
      // If no questions left to ask, skip
      if (questionsToAsk.length === 0) {
        if (i < results.length) {
          allResults.push(results[i]);
        }
        continue;
      }
      
      const modelResult = await evaluateModel(
        modelId,
        questionsToAsk,
        (current, total, questionResult) => {
          const actualQuestionNum = questionStartIdx + current;
          setProgress({ 
            current: actualQuestionNum, 
            total: limitedQuestions.length, 
            model: modelId, 
            modelIndex: i + 1, 
            totalModels: selectedModels.length 
          });
          setCurrentQuestionResult(questionResult);
          
          setInteractions(prev => [...prev, {
            ...questionResult,
            modelId,
            timestamp: Date.now(),
          }]);
        },
        { 
          temperature: options.temperature, 
          top_p: options.topP, 
          promptType: options.promptType, 
          shouldStop: () => stopRef.current,
          onLiveUpdate: (liveData) => {
            const modelIdx = i;
            setResults(prevResults => {
              const newResults = [...prevResults];
              const total = liveData.correct + liveData.incorrect + liveData.unanswered;
              
              if (!newResults[modelIdx]) {
                newResults[modelIdx] = {
                  modelId,
                  correct: 0,
                  incorrect: 0,
                  unanswered: 0,
                  totalQuestions: liveData.totalQuestions,
                  questionResults: [],
                  accuracy: { overall: 0 },
                  byTask: {},
                  biasScores: {},
                  taskAccuracy: {},
                  overallBiasScore: 0,
                };
              }
              
              newResults[modelIdx] = {
                ...newResults[modelIdx],
                correct: liveData.correct,
                incorrect: liveData.incorrect,
                unanswered: liveData.unanswered,
                totalQuestions: liveData.totalQuestions,
                questionResults: [...(newResults[modelIdx].questionResults || []), liveData.currentQuestion],
                accuracy: {
                  overall: total > 0 ? (liveData.correct / total) * 100 : 0,
                },
                averageResponseTime: liveData.averageResponseTime || 0,
                totalTime: liveData.totalTime || 0,
                byTask: liveData.byTask || newResults[modelIdx].byTask || {},
                taskAccuracy: liveData.taskAccuracy || newResults[modelIdx].taskAccuracy || {},
                biasScores: newResults[modelIdx].biasScores || {},
                overallBiasScore: newResults[modelIdx].overallBiasScore || 0,
              };
              
              return newResults;
            });
          }
        }
      );

      // Merge with existing partial results if resuming
      if (i < results.length && results[i]?.questionResults) {
        const existingResults = results[i].questionResults;
        const newResults = modelResult.questionResults || [];
        modelResult.questionResults = [...existingResults, ...newResults];
        
        // Also merge other stats
        modelResult.correct = results[i].correct + modelResult.correct;
        modelResult.incorrect = results[i].incorrect + modelResult.incorrect;
        modelResult.unanswered = results[i].unanswered + modelResult.unanswered;
      }
      
      allResults.push(modelResult);
    }

    setResults(allResults);
    setIsRunning(false);
    setProgress({ current: 0, total: 0, model: '', modelIndex: 0, totalModels: 0 });
  };

  const handleStop = () => {
    stopRef.current = true;
    setIsStopped(true);
  };

  const handleContinue = () => {
    // Find where we stopped - look at the last model that has results
    let lastModelIndex = 0;
    let lastQuestionIndex = 0;
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result && result.questionResults && result.questionResults.length > 0) {
        lastModelIndex = i;
        lastQuestionIndex = result.questionResults.length;
      }
    }
    
    // If the last model is complete, move to next model
    const categoriesToUse = selectedCategories.length > 0 ? selectedCategories : [...new Set(loadedQuestions.map(q => q.source))];
    const numCategories = categoriesToUse.length;
    const totalQuestions = questionLimit > 0 ? questionLimit * numCategories : loadedQuestions.length;
    
    if (lastQuestionIndex >= totalQuestions) {
      lastModelIndex = lastModelIndex + 1;
      lastQuestionIndex = 0;
    }
    
    setContinueFrom({ modelIndex: lastModelIndex, questionIndex: lastQuestionIndex });
    setIsStopped(false);
    runEvaluation(true);
  };

  // Calculate insights when results are available
  const insights = results.length > 0 ? calculateInsights(results) : null;
  const comparison = results.length > 0 ? generateComparison(results) : null;
  const hasResults = results.length > 0;

  const getModelTags = (model) => {
    const tags = [];
    if (model?.parameters) tags.push(model.parameters);
    if (model?.source) tags.push(model.source);
    if (model?.id?.includes(':latest') || model?.name?.includes(':latest')) {
      tags.push('latest');
    }
    return tags;
  };

  const panels = [
    { id: 'setup', label: 'Setup', icon: SlidersHorizontal, enabled: true },
    { id: 'live', label: 'Live', icon: Activity, enabled: isRunning || interactions.length > 0 },
    { id: 'insights', label: 'Insights', icon: Sparkles, enabled: hasResults },
    { id: 'charts', label: 'Charts', icon: BarChart3, enabled: hasResults },
    { id: 'details', label: 'Details', icon: ListChecks, enabled: hasResults },
  ];

  const renderEmptyPanel = (title, message) => (
    <div className="panel-empty">
      <Info className="w-5 h-5" />
      <div>
        <div className="panel-empty-title">{title}</div>
        <div className="panel-empty-message">{message}</div>
      </div>
    </div>
  );

  return (
    <div className="evaluator-container">
      {/* Header */}
      <div className="evaluator-header">
        <div className="flex items-center gap-3">
          <Brain className="w-8 h-8 text-blue-600" />
          <div>
            <h1>LLM Model Evaluator</h1>
            <p>Evaluate Ollama models on BBQ Bias Benchmark</p>
          </div>
        </div>
        <div className="status-badge">
          <span className={`status-dot status-${ollamaStatus}`}></span>
          Ollama: {ollamaStatus === 'connected' ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      <div className="panel-tabs">
        {panels.map((panel) => {
          const PanelIcon = panel.icon;
          return (
            <button
              key={panel.id}
              className={`panel-tab ${activePanel === panel.id ? 'active' : ''}`}
              onClick={() => panel.enabled && setActivePanel(panel.id)}
              disabled={!panel.enabled}
              type="button"
            >
              <PanelIcon className="w-4 h-4" />
              <span>{panel.label}</span>
            </button>
          );
        })}
      </div>

      <div className="sticky-controls">
        {isRunning ? (
          <button 
            className="btn-danger btn-large"
            onClick={handleStop}
          >
            <Pause className="w-5 h-5" />
            Stop & Show Results
          </button>
        ) : isStopped ? (
          <>
            <button 
              className="btn-primary btn-large"
              onClick={handleContinue}
            >
              <Play className="w-5 h-5" />
              Continue
            </button>
            <button 
              className="btn-secondary"
              onClick={() => { setResults([]); setInteractions([]); setIsStopped(false); }}
            >
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
          </>
        ) : (
          <>
            <button 
              className="btn-primary btn-large"
              onClick={() => runEvaluation(false)}
              disabled={selectedModels.length === 0 || ollamaStatus !== 'connected'}
            >
              <Play className="w-5 h-5" />
              Start Evaluation
            </button>
            {results.length > 0 && (
              <button 
                className="btn-secondary"
                onClick={() => { setResults([]); setInteractions([]); setIsStopped(false); }}
              >
                <RotateCcw className="w-4 h-4" /> Reset
              </button>
            )}
          </>
        )}
        
        {results.length > 0 && !isStopped && (
          <button 
            className="btn-secondary"
            onClick={() => { setResults([]); setInteractions([]); setSidebarOpen(false); }}
          >
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
        )}

        {results.length > 0 && !isRunning && (
          <button
            className="btn-secondary"
            onClick={() => onSaveReport && onSaveReport(results)}
          >
            <Save className="w-4 h-4" /> Save to Report
          </button>
        )}
      </div>

      <div className="panel-body">
        {activePanel === 'setup' && (
          <>
            <div className="model-selection-card">
              <div className="card-header">
                <h2>Select Models</h2>
                <div className="flex gap-2">
                  <button 
                    className="btn-secondary"
                    onClick={selectAllModels}
                    disabled={isRunning}
                  >
                    {selectedModels.length === availableModels.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              </div>

              <div className="settings-panel">
                <h4>Generation Options</h4>
                <div className="settings-grid">
                  <label>
                    Temperature: {options.temperature}
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.1"
                      value={options.temperature}
                      onChange={(e) => setOptions({...options, temperature: parseFloat(e.target.value)})}
                    />
                  </label>
                  <label>
                    Top P: {options.topP}
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.1"
                      value={options.topP}
                      onChange={(e) => setOptions({...options, topP: parseFloat(e.target.value)})}
                    />
                  </label>
                  <label>
                    Prompt Type:
                    <select 
                      value={options.promptType}
                      onChange={(e) => setOptions({...options, promptType: e.target.value})}
                    >
                      <option value="standard">Standard (fairness)</option>
                      <option value="tricky">Tricky (truthful)</option>
                    </select>
                  </label>
                  <div className="settings-section">
                    <h5>Data Configuration</h5>
                    <div className="github-load-section">
                      <button 
                        className="btn-primary"
                        onClick={loadGithubData}
                        disabled={isLoadingData}
                      >
                        {isLoadingData ? 'Loading...' : 'Load BBQ Data'}
                      </button>
                      {loadedQuestions.length > 0 && (
                        <span className="loaded-count">
                          {loadedQuestions.length.toLocaleString()} questions
                        </span>
                      )}
                    </div>
                    {loadedQuestions.length > 0 && (
                      <div className="category-filter">
                        <label className="category-label">
                          <input
                            type="checkbox"
                            checked={selectedCategories.length === 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCategories([]);
                              }
                            }}
                          />
                          <strong>All</strong>
                        </label>
                        {[...new Set(loadedQuestions.map(q => q.source))].sort().map(cat => (
                          <label key={cat} className="category-label">
                            <input
                              type="checkbox"
                              checked={
                                selectedCategories.length === 0 
                                  ? true 
                                  : selectedCategories.includes(cat)
                              }
                              onChange={(e) => {
                                const allCats = [...new Set(loadedQuestions.map(q => q.source))];
                                if (e.target.checked) {
                                  if (selectedCategories.length === 0) {
                                    setSelectedCategories(allCats.filter(c => c !== cat));
                                  } else if (!selectedCategories.includes(cat)) {
                                    setSelectedCategories([...selectedCategories, cat]);
                                  }
                                } else {
                                  if (selectedCategories.length === 0) {
                                    setSelectedCategories(allCats.filter(c => c !== cat));
                                  } else {
                                    setSelectedCategories(selectedCategories.filter(c => c !== cat));
                                  }
                                }
                              }}
                            />
                            {cat.replace(/_/g, ' ')}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <label>
                    Questions per Category:
                    <select 
                      value={questionLimit}
                      onChange={(e) => setQuestionLimit(parseInt(e.target.value))}
                      disabled={loadedQuestions.length === 0}
                    >
                      <option value="0">All questions</option>
                      <option value="5">5</option>
                      <option value="10">10</option>
                      <option value="20">20</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="models-grid">
                {availableModels.map((model, index) => (
                  <label 
                    key={model.id} 
                    className={`model-checkbox ${selectedModels.includes(model.id) ? 'selected' : ''}`}
                  >
                    <input 
                      type="checkbox"
                      checked={selectedModels.includes(model.id)}
                      onChange={() => toggleModelSelection(model.id)}
                      disabled={isRunning}
                    />
                    <div className="model-info">
                      <span className="model-name">{model.name}</span>
                      <span className="model-details">{model.parameters}</span>
                      <div className="model-tags">
                        {getModelTags(model).map((tag) => (
                          <span key={tag} className="model-tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div 
                      className="model-color" 
                      style={{ backgroundColor: CHART_COLORS[selectedModels.indexOf(model.id) % CHART_COLORS.length] || '#ccc' }}
                    />
                  </label>
                ))}
              </div>
              
              <div className="selected-count">
                {selectedModels.length} model(s) selected
              </div>
            </div>

            {!hasResults && !isRunning && (
              <div className="info-message">
                <Info className="w-5 h-5" />
                <div>
                  <strong>How it works:</strong>
                  <ul>
                    <li>Select one or more models from your Ollama instance</li>
                    <li>Click "Start Evaluation" to run the BBQ benchmark</li>
                    <li>The system will test each model on {(() => {
                      const cats = selectedCategories.length > 0 ? selectedCategories : [...new Set(loadedQuestions.map(q => q.source))];
                      return questionLimit > 0 ? questionLimit * cats.length : loadedQuestions.length;
                    })()} questions</li>
                    <li>Results include accuracy, response times, and bias analysis</li>
                  </ul>
                </div>
              </div>
            )}
          </>
        )}

        {activePanel === 'live' && (
          <>
            {isRunning ? (
              <div className="progress-card">
                <div className="progress-header">
                  <span>
                    Evaluating: Model {progress.modelIndex} of {progress.totalModels}
                  </span>
                  <span>
                    Question {progress.current} of {progress.total}
                  </span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-bar-fill progress-bar-animated"
                    style={{ 
                      width: `${((progress.current + (progress.modelIndex - 1) * progress.total) / (progress.totalModels * progress.total)) * 100}%` 
                    }}
                  />
                </div>
                <div className="current-model">
                  <strong>Current Model:</strong> {progress.model}
                </div>
                
                {currentQuestionResult && (
                  <div className="live-result">
                    <div className="live-result-header">Latest Response:</div>
                    <div className={`live-result-badge ${currentQuestionResult.isCorrect ? 'correct' : 'incorrect'}`}>
                      {currentQuestionResult.isCorrect ? (
                        <><CheckCircle className="w-4 h-4" /> Correct</>
                      ) : (
                        <><XCircle className="w-4 h-4" /> Incorrect</>
                      )}
                    </div>
                    <div className="live-result-details">
                      <span>Task: {TaskLabels[currentQuestionResult.task] || currentQuestionResult.task}</span>
                      <span>Answer: {currentQuestionResult.modelAnswer || 'N/A'} ({currentQuestionResult.correctAnswer})</span>
                    </div>
                    <div className="live-detail-grid">
                      <div className="live-detail-item">
                        <span className="live-detail-label">Model</span>
                        <span className="live-detail-value">{currentQuestionResult.modelId?.split(':')[0] || progress.model}</span>
                      </div>
                      <div className="live-detail-item">
                        <span className="live-detail-label">Context</span>
                        <span className="live-detail-value">{currentQuestionResult.contextType || 'N/A'}</span>
                      </div>
                      <div className="live-detail-item">
                        <span className="live-detail-label">Latency</span>
                        <span className="live-detail-value">{((currentQuestionResult.responseTime || 0) / 1000).toFixed(2)}s</span>
                      </div>
                      <div className="live-detail-item">
                        <span className="live-detail-label">Tokens</span>
                        <span className="live-detail-value">{currentQuestionResult.tokens ?? 'N/A'}</span>
                      </div>
                    </div>
                    <div className="live-question-block">
                      <div className="live-question-title">Current Question</div>
                      {currentQuestionResult.context && (
                        <div className="live-context">
                          <span className="live-context-label">Context</span>
                          <p>{currentQuestionResult.context}</p>
                        </div>
                      )}
                      <p className="live-question-text">{currentQuestionResult.question}</p>
                      <div className="live-options">
                        {(currentQuestionResult.options || []).map((option) => (
                          <div key={option} className="live-option">
                            <span className="live-option-label">{option.slice(0, 2)}</span>
                            <span className="live-option-text">{option.slice(3)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="live-response-block">
                      <div className="live-question-title">Model Response</div>
                      <pre className="live-response-text">{currentQuestionResult.responseText || 'No response captured.'}</pre>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              renderEmptyPanel('Live view is idle', 'Start an evaluation to see streaming results.')
            )}
          </>
        )}

        {activePanel === 'insights' && (
          hasResults ? (
            <div className="results-section">
              <StatsSummary results={results} insights={insights} />
              {insights && <InsightsPanel insights={insights} results={results} />}
              <Leaderboard results={results} />
            </div>
          ) : (
            renderEmptyPanel('No insights yet', 'Run an evaluation to generate insights.')
          )
        )}

        {activePanel === 'charts' && (
          hasResults ? (
            <div className="results-section">
              <div className="charts-grid">
                <AccuracyComparisonChart results={results} />
                <ResponseTimeChart results={results} />
              </div>

              <div className="charts-grid">
                <ContextImpactChart results={results} />
                <TaskPerformanceRadar results={results} />
              </div>

              <TaskBreakdownChart results={results} />
              <UnifiedAnswerDistribution results={results} />

              <div className="charts-grid">
                {results.map((result) => (
                  <AccuracyDistributionChart key={result.modelId} result={result} />
                ))}
              </div>
            </div>
          ) : (
            renderEmptyPanel('No charts yet', 'Run an evaluation to populate charts.')
          )
        )}

        {activePanel === 'details' && (
          hasResults ? (
            <div className="results-section">
              {results.map((result, index) => (
                <div key={result.modelId} className="individual-result">
                  <h3 style={{ color: CHART_COLORS[index % CHART_COLORS.length] }}>
                    {result.modelId}
                  </h3>
                  <div className="result-stats">
                    <div className="result-stat">
                      <span className="result-stat-label">Accuracy</span>
                      <span className="result-stat-value">{(result.accuracy?.overall || 0).toFixed(1)}%</span>
                    </div>
                    <div className="result-stat">
                      <span className="result-stat-label">Correct</span>
                      <span className="result-stat-value">{result.correct || 0}</span>
                    </div>
                    <div className="result-stat">
                      <span className="result-stat-label">Avg Time</span>
                      <span className="result-stat-value">{((result.averageResponseTime || 0) / 1000).toFixed(2)}s</span>
                    </div>
                  </div>
                </div>
              ))}

              <div className="model-detail-section">
                <QuestionResultsTable results={results} />
              </div>
            </div>
          ) : (
            renderEmptyPanel('No details available', 'Run an evaluation to view model-level details.')
          )
        )}
      </div>

      {/* Interaction Log Sidebar */}
      <InteractionLogSidebar 
        interactions={interactions}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        currentInteraction={currentQuestionResult}
      />
    </div>
  );
};

export default LLMEvaluator;