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
  ListChecks,
  Save,
  Gauge,
  Shield,
  ShieldCheck,
  Scale,
  Microscope,
  RefreshCw,
  Timer,
  ClipboardCheck,
  Bell
} from 'lucide-react';
import { bbqQuestions, generateAllQuestions, getQuestionsByTask, getQuestionsByContextType, BBQTasks, TaskLabels } from '../data/bbqQuestions';
import { loadBBQData, getCategories, getCacheStatus, clearBBQCache } from '../data/bbqDataLoader';
import { getAvailableModels, checkOllamaStatus, generateCompletion, buildPrompt, buildTrickyPrompt, extractAnswer } from '../services/ollamaService';
import { evaluateModel, evaluateModels, generateComparison, calculateInsights } from '../services/evaluationEngine';
import { AGENTS, runAllAgents } from '../services/agents';
import {
  AccuracyComparisonChart,
  TaskPerformanceRadar,
  ResponseTimeChart,
  ContextImpactChart,
  TaskBreakdownChart,
  BiasScoreChart,
  BiasScoreComparisonChart,
  AccuracyLatencyScatter,
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
  
  // QA Agents state
  const [enabledAgents, setEnabledAgents] = useState({
    qualityAgent: true,
    biasExplanation: true,
    dataIntegrity: true,
    fairnessDrift: true,
    promptRobustness: true,
    answerConsistency: true,
    latencyBudget: true,
    reportQA: true
  });
  
  const [agentResults, setAgentResults] = useState([]);
  const [agentNotifications, setAgentNotifications] = useState([]);
  const [notificationHistory, setNotificationHistory] = useState([]);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const previousResults = useRef(null);
  
  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [interactions, setInteractions] = useState([]);
  
  // Options
  const [options, setOptions] = useState({
    temperature: 0, // 0 for deterministic/reproducible results
    topP: 1, // 1 when temperature is 0 for reproducibility
    promptType: 'standard', // 'standard' or 'tricky'
    concurrency: 3, // Number of concurrent requests (higher = faster but more load)
  });
  
  // Data source
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadedQuestions, setLoadedQuestions] = useState([]);
  const [questionLimit, setQuestionLimit] = useState(10); // Default to 10 questions per category
  const [selectedCategories, setSelectedCategories] = useState([]); // empty = all
  const [cacheStatus, setCacheStatus] = useState(null);
  const [loadProgress, setLoadProgress] = useState(null);
  
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
    checkCache();
    loadPersistedState();
  }, []);

  // Persistence keys
  const STORAGE_KEYS = {
    EVALUATION_STATE: 'kmail-bbq-evaluation-state',
    RESULTS: 'kmail-bbq-results',
    INTERACTIONS: 'kmail-bbq-interactions',
    OPTIONS: 'kmail-bbq-options',
    SELECTED_MODELS: 'kmail-bbq-selected-models',
    SELECTED_CATEGORIES: 'kmail-bbq-selected-categories',
    QUESTION_LIMIT: 'kmail-bbq-question-limit',
  };

  // Track if state was restored from persistence
  const [wasRestored, setWasRestored] = useState(false);

  // Load persisted state on mount
  const loadPersistedState = () => {
    try {
      // Load evaluation state
      const savedState = localStorage.getItem(STORAGE_KEYS.EVALUATION_STATE);
      let restored = false;
      if (savedState) {
        const state = JSON.parse(savedState);
        if (state.isRunning || state.isStopped || state.progress?.current > 0) {
          // Restore evaluation progress
          setIsRunning(false); // Always set to false since we can't resume the loop
          setIsStopped(true); // Mark as stopped so user can continue
          setProgress(state.progress || { current: 0, total: 0, model: '', modelIndex: 0, totalModels: 0 });
          setContinueFrom(state.continueFrom || { modelIndex: 0, questionIndex: 0 });
          console.log('[Persistence] Restored evaluation state:', state);
          restored = true;
        }
      }

      // Load results
      const savedResults = localStorage.getItem(STORAGE_KEYS.RESULTS);
      if (savedResults) {
        const parsedResults = JSON.parse(savedResults);
        setResults(parsedResults);
        console.log(`[Persistence] Restored ${parsedResults.length} model results`);
        if (parsedResults.length > 0) restored = true;
      }

      // Load interactions
      const savedInteractions = localStorage.getItem(STORAGE_KEYS.INTERACTIONS);
      if (savedInteractions) {
        const parsedInteractions = JSON.parse(savedInteractions);
        setInteractions(parsedInteractions);
        console.log(`[Persistence] Restored ${parsedInteractions.length} interactions`);
      }

      // Load options
      const savedOptions = localStorage.getItem(STORAGE_KEYS.OPTIONS);
      if (savedOptions) {
        setOptions(prev => ({ ...prev, ...JSON.parse(savedOptions) }));
      }

      // Load selected models
      const savedModels = localStorage.getItem(STORAGE_KEYS.SELECTED_MODELS);
      if (savedModels) {
        setSelectedModels(JSON.parse(savedModels));
      }

      // Load selected categories
      const savedCategories = localStorage.getItem(STORAGE_KEYS.SELECTED_CATEGORIES);
      if (savedCategories) {
        setSelectedCategories(JSON.parse(savedCategories));
      }

      // Load question limit
      const savedLimit = localStorage.getItem(STORAGE_KEYS.QUESTION_LIMIT);
      if (savedLimit) {
        setQuestionLimit(JSON.parse(savedLimit));
      }

      // Set restored flag if any data was loaded
      if (restored) {
        setWasRestored(true);
        // Clear the flag after 5 seconds
        setTimeout(() => setWasRestored(false), 5000);
      }
    } catch (error) {
      console.error('[Persistence] Error loading persisted state:', error);
    }
  };

  // Persist evaluation state
  useEffect(() => {
    if (isRunning || isStopped) {
      const state = {
        isRunning,
        isStopped,
        progress,
        continueFrom,
        timestamp: Date.now(),
      };
      localStorage.setItem(STORAGE_KEYS.EVALUATION_STATE, JSON.stringify(state));
    }
  }, [isRunning, isStopped, progress, continueFrom]);

  // Persist results
  useEffect(() => {
    if (results.length > 0) {
      localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(results));
    }
  }, [results]);

  // Persist interactions
  useEffect(() => {
    if (interactions.length > 0) {
      localStorage.setItem(STORAGE_KEYS.INTERACTIONS, JSON.stringify(interactions));
    }
  }, [interactions]);

  // Persist options
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.OPTIONS, JSON.stringify(options));
  }, [options]);

  // Persist selected models
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SELECTED_MODELS, JSON.stringify(selectedModels));
  }, [selectedModels]);

  // Persist selected categories
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SELECTED_CATEGORIES, JSON.stringify(selectedCategories));
  }, [selectedCategories]);

  // Persist question limit
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.QUESTION_LIMIT, JSON.stringify(questionLimit));
  }, [questionLimit]);

  // Clear persistence when evaluation completes successfully
  const clearPersistence = () => {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      console.log('[Persistence] Cleared all persisted state');
    } catch (error) {
      console.error('[Persistence] Error clearing state:', error);
    }
  };

  const checkCache = async () => {
    const status = await getCacheStatus();
    setCacheStatus(status);
    
    // If data is already cached, load it automatically
    if (status.cached && status.count > 0) {
      console.log(`[BBQ] Found ${status.count} questions in cache, loading automatically`);
      setIsLoadingData(true);
      try {
        const questions = await loadBBQData();
        setLoadedQuestions(questions);
        console.log(`[BBQ] Auto-loaded ${questions.length} questions from cache`);
      } catch (error) {
        console.error('[BBQ] Failed to load from cache:', error);
      }
      setIsLoadingData(false);
    }
  };

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

  const loadGithubData = async (forceRefresh = false) => {
    setIsLoadingData(true);
    setLoadProgress(null);
    try {
      const questions = await loadBBQData({
        forceRefresh,
        onProgress: (progress) => {
          setLoadProgress(progress);
        }
      });
      setLoadedQuestions(questions);
      console.log(`Loaded ${questions.length} questions from BBQ dataset`);
      
      // Update cache status
      const status = await getCacheStatus();
      setCacheStatus(status);
    } catch (error) {
      console.error('Failed to load GitHub data:', error);
      alert('Failed to load data: ' + error.message);
    }
    setIsLoadingData(false);
    setLoadProgress(null);
  };

  const handleClearCache = async () => {
    if (window.confirm('Clear all cached BBQ data? You will need to reload from GitHub.')) {
      await clearBBQCache();
      setLoadedQuestions([]);
      setCacheStatus(null);
      console.log('[BBQ] Cache cleared');
    }
  };

  // Evaluate a single question across all models concurrently
  const evaluateQuestionForAllModels = async (question, questionIndex, totalQuestions, existingResults) => {
    const questionResults = [];

    // Create promises for all models to answer this question
    const modelPromises = selectedModels.map(async (modelId, modelIndex) => {
      // Check if we already have results for this model+question (resuming)
      const existingModelResult = existingResults[modelIndex];
      const alreadyAnswered = existingModelResult?.questionResults?.some(
        qr => qr.questionId === question.id
      );

      if (alreadyAnswered) {
        // Return existing result
        const existingQuestion = existingModelResult.questionResults.find(
          qr => qr.questionId === question.id
        );
        return {
          modelId,
          modelIndex,
          questionResult: existingQuestion,
          fromCache: true
        };
      }

      // Evaluate this question for this model
      try {
        const prompt = options.promptType === 'tricky'
          ? buildTrickyPrompt(question)
          : buildPrompt(question);

        const completion = await generateCompletion(modelId, prompt, {
          temperature: options.temperature,
          top_p: options.top_p,
          timeout: 60000
        });

        const extractedAnswer = extractAnswer(completion.response, question.options);
        const isCorrect = extractedAnswer === question.correctAnswer;

        const questionResult = {
          questionId: question.id,
          task: question.task,
          trait: question.trait,
          contextType: question.contextType,
          type: question.type,
          context: question.context,
          question: question.questionText,
          options: question.options,
          correctAnswer: question.correctAnswer,
          modelAnswer: extractedAnswer,
          isCorrect,
          isStereotyped: extractedAnswer === 'A',
          isCounterStereotyped: extractedAnswer === 'B',
          isUnknown: extractedAnswer === 'C',
          responseText: completion.response,
          responseTime: completion.totalDuration ? completion.totalDuration / 1000000 : 0,
          tokens: completion.evalCount || 0,
        };

        // Log to interactions
        setInteractions(prev => [...prev, {
          ...questionResult,
          modelId,
          timestamp: Date.now(),
        }]);

        return {
          modelId,
          modelIndex,
          questionResult,
          fromCache: false
        };
      } catch (error) {
        console.error(`[Evaluation] Error for model ${modelId} on question ${question.id}:`, error);
        const errorResult = {
          questionId: question.id,
          task: question.task,
          trait: question.trait,
          contextType: question.contextType,
          type: question.type,
          context: question.context,
          question: question.questionText,
          options: question.options,
          correctAnswer: question.correctAnswer,
          modelAnswer: 'ERROR',
          isCorrect: false,
          isStereotyped: false,
          isCounterStereotyped: false,
          isUnknown: false,
          responseText: error.message,
          responseTime: 0,
          tokens: 0,
          error: true
        };

        setInteractions(prev => [...prev, {
          ...errorResult,
          modelId,
          timestamp: Date.now(),
        }]);

        return {
          modelId,
          modelIndex,
          questionResult: errorResult,
          fromCache: false
        };
      }
    });

    // Wait for all models to complete this question
    const results = await Promise.all(modelPromises);

    // Update results for each model
    results.forEach(({ modelId, modelIndex, questionResult }) => {
      setResults(prevResults => {
        const newResults = [...prevResults];

        if (!newResults[modelIndex]) {
          newResults[modelIndex] = {
            modelId,
            correct: 0,
            incorrect: 0,
            unanswered: 0,
            totalQuestions: totalQuestions,
            questionResults: [],
            accuracy: { overall: 0 },
            byTask: {},
            biasScores: {},
            taskAccuracy: {},
            overallBiasScore: 0,
          };
        }

        // Check if we already have this question result (avoid duplicates)
        const existingIndex = newResults[modelIndex].questionResults.findIndex(
          qr => qr.questionId === questionResult.questionId
        );

        if (existingIndex === -1) {
          // Add new result
          if (questionResult.error) {
            newResults[modelIndex].incorrect++;
          } else if (questionResult.modelAnswer === null) {
            newResults[modelIndex].unanswered++;
          } else if (questionResult.isCorrect) {
            newResults[modelIndex].correct++;
          } else {
            newResults[modelIndex].incorrect++;
          }

          newResults[modelIndex].questionResults.push(questionResult);

          // Update task breakdown
          const task = questionResult.task;
          if (!newResults[modelIndex].byTask[task]) {
            newResults[modelIndex].byTask[task] = {
              correct: 0,
              total: 0,
              ambiguousResults: { stereotyped: 0, counterStereotyped: 0, unknown: 0, total: 0 },
              disambiguatedResults: {
                correct: 0, total: 0, stereotyped: 0, counterStereotyped: 0, unknown: 0,
                incorrectNonUnknown: 0, biasedIncorrect: 0
              }
            };
          }

          const taskData = newResults[modelIndex].byTask[task];
          taskData.total++;
          if (questionResult.isCorrect) taskData.correct++;

          if (questionResult.contextType === 'ambiguous') {
            taskData.ambiguousResults.total++;
            if (questionResult.isStereotyped) taskData.ambiguousResults.stereotyped++;
            if (questionResult.isCounterStereotyped) taskData.ambiguousResults.counterStereotyped++;
            if (questionResult.isUnknown) taskData.ambiguousResults.unknown++;
          } else {
            taskData.disambiguatedResults.total++;
            if (questionResult.isCorrect) taskData.disambiguatedResults.correct++;
            if (questionResult.isStereotyped) taskData.disambiguatedResults.stereotyped++;
            if (questionResult.isCounterStereotyped) taskData.disambiguatedResults.counterStereotyped++;
            if (questionResult.isUnknown) taskData.disambiguatedResults.unknown++;
            if (!questionResult.isCorrect && !questionResult.isUnknown) {
              taskData.disambiguatedResults.incorrectNonUnknown++;
              if (questionResult.isStereotyped) taskData.disambiguatedResults.biasedIncorrect++;
            }
          }

          // Recalculate accuracy
          const total = newResults[modelIndex].correct + newResults[modelIndex].incorrect + newResults[modelIndex].unanswered;
          newResults[modelIndex].accuracy.overall = total > 0
            ? (newResults[modelIndex].correct / total) * 100
            : 0;

          // Calculate taskAccuracy for each task
          newResults[modelIndex].taskAccuracy = {};
          Object.entries(newResults[modelIndex].byTask).forEach(([taskName, taskData]) => {
            newResults[modelIndex].taskAccuracy[taskName] = taskData.total > 0
              ? (taskData.correct / taskData.total) * 100
              : 0;
          });

          // Calculate bias scores
          newResults[modelIndex].biasScores = {};
          Object.entries(newResults[modelIndex].byTask).forEach(([taskName, taskData]) => {
            const ambiguousData = taskData.ambiguousResults;
            const disambiguatedData = taskData.disambiguatedResults;

            const ambNonUnknown = ambiguousData.total - ambiguousData.unknown;
            const ambStereotyped = ambiguousData.stereotyped;
            const ambAccuracy = ambiguousData.total > 0
              ? ambiguousData.correct / ambiguousData.total
              : 0;

            let ambDisScore = 0;
            if (ambNonUnknown > 0) {
              ambDisScore = (2 * ambStereotyped / ambNonUnknown) - 1;
            }
            const ambBiasScore = (1 - ambAccuracy) * ambDisScore;

            newResults[modelIndex].biasScores[taskName] = ambBiasScore;
          });
        }

        return newResults;
      });
    });

    return results;
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

    const startQuestionIndex = resume ? continueFrom.questionIndex : 0;

    // Loop through questions - send each question to ALL models
    for (let qIdx = startQuestionIndex; qIdx < limitedQuestions.length; qIdx++) {
      if (stopRef.current) {
        setIsStopped(true);
        setContinueFrom({ modelIndex: 0, questionIndex: qIdx });
        break;
      }

      const question = limitedQuestions[qIdx];

      setProgress({
        current: qIdx + 1,
        total: limitedQuestions.length,
        model: `Question ${qIdx + 1}/${limitedQuestions.length}`,
        modelIndex: selectedModels.length,
        totalModels: selectedModels.length
      });

      // Evaluate this question for all models concurrently
      await evaluateQuestionForAllModels(question, qIdx, limitedQuestions.length, resume ? results : []);

      // Small delay between questions to prevent overwhelming
      if (qIdx < limitedQuestions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    setIsRunning(false);
    if (!stopRef.current) {
      setProgress({ current: 0, total: 0, model: '', modelIndex: 0, totalModels: 0 });
    }
  };

  const handleStop = () => {
    stopRef.current = true;
    setIsStopped(true);
  };

  const handleContinue = () => {
    // Find the minimum question index across all models (question-based evaluation)
    let minQuestionIndex = Infinity;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result && result.questionResults) {
        minQuestionIndex = Math.min(minQuestionIndex, result.questionResults.length);
      }
    }

    // If no results yet, start from beginning
    if (minQuestionIndex === Infinity) {
      minQuestionIndex = 0;
    }

    setContinueFrom({ modelIndex: 0, questionIndex: minQuestionIndex });
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
    { id: 'setup', label: 'Setup', icon: Settings, enabled: true },
    { id: 'agents', label: 'Agents', icon: Gauge, enabled: true },
    { id: 'live', label: 'Live', icon: Activity, enabled: isRunning || interactions.length > 0 },
    { id: 'insights', label: 'Insights', icon: Sparkles, enabled: hasResults },
    { id: 'charts', label: 'Charts', icon: BarChart3, enabled: hasResults },
    { id: 'details', label: 'Details', icon: ListChecks, enabled: hasResults },
  ];

  const allAgentsEnabled = Object.values(enabledAgents).every(v => v);
  
  const toggleAllAgents = () => {
    const newState = {};
    Object.keys(enabledAgents).forEach(key => {
      newState[key] = !allAgentsEnabled;
    });
    setEnabledAgents(newState);
  };

  // Run agents and convert findings to notifications
  const runAgentsAndNotify = useCallback((questions, currentResults, previousResultsSnapshot = null) => {
    try {
      const agentFindings = runAllAgents(questions, currentResults, previousResultsSnapshot, {
        enabledAgents,
        selectedModels,
        questionLimit,
      });
      
      setAgentResults(agentFindings);
      
      // Convert agent findings to notifications
      const newNotifications = [];
      agentFindings.forEach(finding => {
        if (finding.findings && finding.findings.length > 0) {
          finding.findings.forEach(f => {
            if (f.severity !== 'success') {
              newNotifications.push({
                id: `${finding.agentId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                agent: AGENTS.find(a => a.id === finding.agentId)?.name || finding.agentId,
                agentId: finding.agentId,
                severity: f.severity,
                message: f.message,
                details: f.details || [],
                timestamp: Date.now(),
                isRead: false,
              });
            }
          });
        }
      });
      
      if (newNotifications.length > 0) {
        setAgentNotifications(prev => {
          // Keep only unread notifications + new ones, max 50
          const existingUnread = prev.filter(n => !n.isRead);
          const combined = [...newNotifications, ...existingUnread];
          return combined.slice(0, 50);
        });
        
        // Add to history
        setNotificationHistory(prev => {
          const combined = [...newNotifications, ...prev];
          return combined.slice(0, 200);
        });
      }
      
      return agentFindings;
    } catch (error) {
      console.error('Error running agents:', error);
      return [];
    }
  }, [enabledAgents, selectedModels, questionLimit]);

  // Run agents after evaluation completes
  useEffect(() => {
    if (results.length > 0 && !isRunning && !isStopped) {
      const previousSnapshot = previousResults.current;
      runAgentsAndNotify(loadedQuestions, results, previousSnapshot);
      previousResults.current = results;
    }
  }, [results, isRunning, isStopped, loadedQuestions, runAgentsAndNotify]);

  // Run data integrity agent on load
  useEffect(() => {
    if (loadedQuestions.length > 0 && enabledAgents.dataIntegrity) {
      runAgentsAndNotify(loadedQuestions, [], null);
    }
  }, [loadedQuestions]);

  // Clear notification
  const clearNotification = (notificationId) => {
    setAgentNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  // Mark notification as read
  const markNotificationRead = (notificationId) => {
    setAgentNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
    );
  };

  // Clear all notifications
  const clearAllNotifications = () => {
    setAgentNotifications([]);
  };

  // Get notification count by severity
  const getNotificationCounts = () => {
    const counts = {
      critical: 0,
      error: 0,
      warning: 0,
      info: 0,
      success: 0,
      total: agentNotifications.length,
    };
    
    agentNotifications.forEach(n => {
      if (counts[n.severity] !== undefined) {
        counts[n.severity]++;
      }
    });
    
    return counts;
  };

  const notificationCounts = getNotificationCounts();

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
        {agentNotifications.length > 0 && (
          <div 
            className="notification-bell"
            onClick={() => setShowNotificationPanel(!showNotificationPanel)}
            title={`${agentNotifications.length} notification${agentNotifications.length !== 1 ? 's' : ''}`}
          >
            <Bell className="w-5 h-5" />
            <span className="notification-count">{agentNotifications.length}</span>
          </div>
        )}
      </div>

      {/* Notification Center */}
      {agentNotifications.length > 0 && (
        <div className={`notification-center ${showNotificationPanel ? 'expanded' : ''}`}>
          <div className="notification-header">
            <div className="notification-header-left">
              <Bell className="w-5 h-5" />
              <h3>Agent Notifications</h3>
              <div className="notification-severity-badges">
                {notificationCounts.critical > 0 && (
                  <span className="severity-badge critical">{notificationCounts.critical} critical</span>
                )}
                {notificationCounts.error > 0 && (
                  <span className="severity-badge error">{notificationCounts.error} error</span>
                )}
                {notificationCounts.warning > 0 && (
                  <span className="severity-badge warning">{notificationCounts.warning} warning</span>
                )}
                {notificationCounts.info > 0 && (
                  <span className="severity-badge info">{notificationCounts.info} info</span>
                )}
              </div>
            </div>
            <div className="notification-header-actions">
              {notificationHistory.length > 0 && (
                <button
                  className="btn-secondary btn-small"
                  onClick={() => {
                    setShowNotificationPanel(!showNotificationPanel);
                  }}
                  title="View history"
                >
                  History ({notificationHistory.length})
                </button>
              )}
              <button
                className="btn-secondary btn-small"
                onClick={clearAllNotifications}
                title="Clear all notifications"
              >
                Clear All
              </button>
              <button
                className="btn-secondary btn-small"
                onClick={() => setShowNotificationPanel(!showNotificationPanel)}
                title={showNotificationPanel ? 'Collapse' : 'Expand'}
              >
                {showNotificationPanel ? 'Less' : 'More'}
              </button>
            </div>
          </div>
          <div className={`notification-list ${showNotificationPanel ? 'expanded' : ''}`}>
            {agentNotifications.slice(0, showNotificationPanel ? 50 : 5).map((notification) => (
              <div 
                key={notification.id || notification.timestamp} 
                className={`notification-item notification-${notification.severity} ${notification.isRead ? 'read' : 'unread'}`}
              >
                <div className="notification-icon">
                  {notification.severity === 'success' && <CheckCircle className="w-4 h-4" />}
                  {notification.severity === 'warning' && <AlertTriangle className="w-4 h-4" />}
                  {notification.severity === 'error' && <XCircle className="w-4 h-4" />}
                  {notification.severity === 'critical' && <XCircle className="w-4 h-4" />}
                  {notification.severity === 'info' && <Info className="w-4 h-4" />}
                </div>
                <div className="notification-content">
                  <div className="notification-title">
                    <strong>{notification.agent}</strong>
                    <span className="notification-time">
                      {new Date(notification.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p>{notification.message}</p>
                  {notification.details && notification.details.length > 0 && showNotificationPanel && (
                    <div className="notification-details">
                      <ul>
                        {notification.details.slice(0, 3).map((detail, idx) => (
                          <li key={idx}>
                            {typeof detail === 'string' ? detail : detail.text || JSON.stringify(detail)}
                          </li>
                        ))}
                        {notification.details.length > 3 && (
                          <li className="more-details">
                            +{notification.details.length - 3} more details
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
                <button
                  className="notification-dismiss"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearNotification(notification.id);
                  }}
                  title="Dismiss notification"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agent Status Summary (when agents panel is active) */}
      {activePanel === 'agents' && agentResults.length > 0 && (
        <div className="agent-status-summary">
          <h4>Agent Status Summary</h4>
          <div className="agent-status-grid">
            {agentResults.map(result => {
              const agent = AGENTS.find(a => a.id === result.agentId);
              const IconComponent = {
                Shield,
                ShieldCheck,
                Scale,
                Microscope,
                RefreshCw,
                Timer,
                ClipboardCheck
              }[agent?.icon] || Shield;
              
              const severityClass = result.passed ? 'success' : 
                result.findings.some(f => f.severity === 'critical') ? 'critical' :
                result.findings.some(f => f.severity === 'warning') ? 'warning' : 'info';
              
              return (
                <div key={result.agentId} className={`agent-status-card ${severityClass}`}>
                  <div className="agent-status-header">
                    <div className="agent-status-icon">
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <span className="agent-status-name">{agent?.name || result.agentId}</span>
                    <span className={`agent-status-badge ${severityClass}`}>
                      {result.passed ? '✓ Passed' : 
                        result.findings.some(f => f.severity === 'critical') ? '✗ Critical' :
                        result.findings.some(f => f.severity === 'warning') ? '⚠ Warning' : 'ℹ Info'}
                    </span>
                  </div>
                  <div className="agent-status-message">
                    {result.findings[0]?.message || 'No issues found'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
            {results.length > 0 && progress.total > 0 && progress.current < progress.total ? (
              <button
                className="btn-primary btn-large"
                onClick={handleContinue}
              >
                <Play className="w-5 h-5" />
                Resume Evaluation ({progress.current}/{progress.total})
              </button>
            ) : (
              <button
                className="btn-primary btn-large"
                onClick={() => runEvaluation(false)}
                disabled={selectedModels.length === 0 || ollamaStatus !== 'connected'}
              >
                <Play className="w-5 h-5" />
                Start Evaluation
              </button>
            )}
            {results.length > 0 && (
              <button
                className="btn-secondary"
                onClick={() => { setResults([]); setInteractions([]); setIsStopped(false); clearPersistence(); }}
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
            {/* Restored State Notification */}
            {results.length > 0 && progress.total > 0 && (
              <div className="restored-state-banner" style={{
                background: '#e0f2fe',
                border: '1px solid #0ea5e9',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <RefreshCw className="w-5 h-5" style={{ color: '#0ea5e9' }} />
                  <span>
                    <strong>Previous evaluation restored:</strong>{' '}
                    {results.length} model{results.length !== 1 ? 's' : ''} evaluated, {progress.current} of {progress.total} questions completed
                  </span>
                </div>
                <button
                  className="btn-secondary"
                  onClick={() => { setResults([]); setInteractions([]); setIsStopped(false); clearPersistence(); }}
                  style={{ padding: '4px 12px', fontSize: '0.875rem' }}
                >
                  Clear
                </button>
              </div>
            )}
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
                  <label title="Higher = faster evaluation but more system load. Use 1-2 for cloud models to avoid rate limits.">
                    Concurrency: {options.concurrency}
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={options.concurrency}
                      onChange={(e) => setOptions({...options, concurrency: parseInt(e.target.value)})}
                    />
                    <small style={{ color: '#666', fontSize: '0.8em', display: 'block', marginTop: '2px' }}>
                      {options.concurrency === 1 ? 'Sequential (safest for cloud)' :
                        options.concurrency <= 3 ? 'Balanced (recommended)' :
                        options.concurrency <= 6 ? 'Fast (local models only)' :
                        'Maximum Speed (may hit rate limits)'}
                    </small>
                  </label>
                  <div className="settings-section">
                    <h5>Data Configuration</h5>
                    
                    {/* Cache Status */}
                    {cacheStatus && cacheStatus.cached && (
                      <div className="cache-status">
                        <div className="cache-info">
                          <span className="cache-icon">📦</span>
                          <span className="cache-text">
                            <strong>{cacheStatus.count.toLocaleString()}</strong> questions cached
                            ({cacheStatus.sizeMB} MB)
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* Load Progress */}
                    {isLoadingData && loadProgress && (
                      <div className="load-progress">
                        <div className="progress-bar">
                          <div 
                            className="progress-bar-fill progress-bar-animated"
                            style={{ width: `${(loadProgress.current / loadProgress.total) * 100}%` }}
                          />
                        </div>
                        <div className="progress-text">
                          Loading {loadProgress.category}... ({loadProgress.current}/{loadProgress.total})
                        </div>
                      </div>
                    )}
                    
                    <div className="github-load-section">
                      <button 
                        className="btn-primary"
                        onClick={() => loadGithubData(false)}
                        disabled={isLoadingData}
                      >
                        {isLoadingData 
                          ? 'Loading...' 
                          : cacheStatus?.cached 
                            ? 'Load from Cache' 
                            : 'Load BBQ Data'}
                      </button>
                      
                      {cacheStatus?.cached && (
                        <button 
                          className="btn-secondary"
                          onClick={() => loadGithubData(true)}
                          disabled={isLoadingData}
                          title="Force refresh from GitHub"
                        >
                          🔄 Refresh
                        </button>
                      )}
                      
                      {cacheStatus?.cached && (
                        <button 
                          className="btn-secondary"
                          onClick={handleClearCache}
                          disabled={isLoadingData}
                          title="Clear cached data"
                        >
                          🗑️ Clear Cache
                        </button>
                      )}
                      
                      {loadedQuestions.length > 0 && !isLoadingData && (
                        <span className="loaded-count">
                          {loadedQuestions.length.toLocaleString()} questions loaded
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
                          <strong>All Categories</strong>
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
        
        {activePanel === 'agents' && (
          <div className="results-section">
            <div className="agents-panel-container">
              <div className="agents-panel-header">
                <h3>Quality Assurance Agents</h3>
                <div className="agents-header-actions">
                  <button
                    className={`btn-secondary ${allAgentsEnabled ? 'active' : ''}`}
                    onClick={toggleAllAgents}
                    type="button"
                  >
                    {allAgentsEnabled ? 'Disable All' : 'Enable All'}
                  </button>
                  {(agentResults.length > 0 || results.length > 0) && (
                    <button
                      className="btn-primary"
                      onClick={() => runAgentsAndNotify(loadedQuestions, results, previousResults.current)}
                      disabled={isRunning}
                      type="button"
                    >
                      Run Agents Now
                    </button>
                  )}
                </div>
              </div>
              <p className="agents-description">
                Enable agents to perform quality checks during evaluation. Each agent analyzes different aspects of model performance.
              </p>
              
              {/* Agent Status Summary */}
              {agentResults.length > 0 && (
                <div className="agent-results-summary">
                  <h4>Latest Agent Results</h4>
                  <div className="agent-results-grid">
                    {agentResults.map(result => {
                      const agent = AGENTS.find(a => a.id === result.agentId);
                      const IconComponent = {
                        Shield,
                        ShieldCheck,
                        Scale,
                        Microscope,
                        RefreshCw,
                        Timer,
                        ClipboardCheck
                      }[agent?.icon] || Shield;
                      
                      const severityClass = result.passed ? 'success' : 
                        result.findings.some(f => f.severity === 'critical') ? 'critical' :
                        result.findings.some(f => f.severity === 'warning') ? 'warning' : 'info';
                      
                      return (
                        <div key={result.agentId} className={`agent-result-card ${severityClass}`}>
                          <div className="agent-result-header">
                            <div className="agent-result-icon">
                              <IconComponent className="w-4 h-4" />
                            </div>
                            <span className="agent-result-name">{agent?.name || result.agentId}</span>
                            <span className={`agent-result-badge ${severityClass}`}>
                              {result.passed ? '✓ Passed' : 
                                result.findings.some(f => f.severity === 'critical') ? '✗ Critical' :
                                result.findings.some(f => f.severity === 'warning') ? '⚠ Warning' : 'ℹ Info'}
                            </span>
                          </div>
                          <div className="agent-result-message">
                            {result.findings[0]?.message || 'No issues found'}
                          </div>
                          {result.findings[0]?.details && result.findings[0].details.length > 0 && (
                            <div className="agent-result-details">
                              <ul>
                                {result.findings[0].details.slice(0, 3).map((detail, idx) => (
                                  <li key={idx}>
                                    {typeof detail === 'string' ? detail : detail.text || detail.message || JSON.stringify(detail)}
                                  </li>
                                ))}
                                {result.findings[0].details.length > 3 && (
                                  <li className="more-details">
                                    +{result.findings[0].details.length - 3} more
                                  </li>
                                )}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              <div className="agents-grid">
                {AGENTS.map(agent => {
                  const IconComponent = {
                    Shield,
                    ShieldCheck,
                    Scale,
                    Microscope,
                    RefreshCw,
                    Timer,
                    ClipboardCheck
                  }[agent.icon] || Shield;
                  
                  const agentResult = agentResults.find(r => r.agentId === agent.id);
                  
                  return (
                    <div key={agent.id} className={`agent-card ${enabledAgents[agent.id] ? 'enabled' : 'disabled'}`}>
                      <div className="agent-card-header">
                        <div className="agent-card-icon">
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <div className="agent-card-info">
                          <h4>{agent.name}</h4>
                          <p>{agent.description}</p>
                        </div>
                      </div>
                      <div className="agent-card-status">
                        {agentResult ? (
                          <span className={`agent-status ${agentResult.passed ? 'passed' : 'failed'}`}>
                            {agentResult.passed ? '✓ Passed' : `⚠ ${agentResult.findings[0]?.severity || 'Issues'}`}
                          </span>
                        ) : (
                          <span className="agent-status pending">Pending run</span>
                        )}
                      </div>
                      <button
                        className={`btn-secondary ${enabledAgents[agent.id] ? 'active' : ''}`}
                        onClick={() => setEnabledAgents(prev => ({ ...prev, [agent.id]: !prev[agent.id] }))}
                        type="button"
                      >
                        {enabledAgents[agent.id] ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        
        {activePanel === 'live' && (
          <>
            {isRunning ? (
              <div className="progress-card">
                <div className="progress-header">
                  <span>
                    Evaluating {progress.totalModels} models on same question
                  </span>
                  <span>
                    Question {progress.current} of {progress.total}
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-bar-fill progress-bar-animated"
                    style={{
                      width: `${(progress.current / progress.total) * 100}%`
                    }}
                  />
                </div>
                <div className="current-model">
                  <strong>Current:</strong> {progress.model}
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
              <BiasScoreChart results={results} />

              <div className="charts-grid">
                <BiasScoreComparisonChart results={results} />
                <AccuracyLatencyScatter results={results} />
              </div>

              <UnifiedAnswerDistribution results={results} />

              <h3 style={{ margin: '24px 0 16px', color: '#374151', fontSize: '1.25rem', fontWeight: 600 }}>
                Individual Model Results
              </h3>
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