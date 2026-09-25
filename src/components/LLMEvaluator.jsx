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
  Gauge,
  Shield,
  ShieldCheck,
  Scale,
  Microscope,
  RefreshCw,
  Timer,
  ClipboardCheck,
  Bell,
  Globe
} from 'lucide-react';
import { TaskLabels } from '../data/bbqQuestions';
import { loadBBQData, getCacheStatus, clearBBQCache, loadBBQMetadata, getMetadataStatus } from '../data/bbqDataLoader';
import { generateCompletion as ollamaGenerateCompletion, buildPrompt, buildTrickyPrompt, extractAnswer } from '../services/ollamaService';
import { generateCompletion as llmGenerateCompletion } from '../services/llmService';
import { getEnabledProviders } from '../services/providerService';
import { calculateInsights } from '../services/evaluationEngine';
import { buildModelResult, addQuestionResult } from '../services/bbqScoring';
import { createCancelledError, isCancelledError } from '../services/cancellation';
import {
  createPlan,
  planSignature,
  resolvePlanQuestions,
  resolveResumeIndex,
} from '../services/evaluationPlan';
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
  CHART_COLORS,
  EnhancedResultsComparison,
  QuestionResultsDetailed
} from './EvaluationCharts';
import InteractionLogSidebar from './InteractionLogSidebar';
import ProviderSettings from './ProviderSettings';
import EvaluationStage from './EvaluationStage';

// Style imports
import './EvaluationCharts.css';
import './InteractionLogSidebar.css';

const LLMEvaluator = ({ onResultsChange, onProviderSettingsChange }) => {
  // State
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModels, setSelectedModels] = useState([]);
  const [selectedProviderFilter, setSelectedProviderFilter] = useState(null);
  const [providerSettingsOpen, setProviderSettingsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, model: '', modelIndex: 0, totalModels: 0 });
  const [results, setResults] = useState([]);
  // Live state for the animated evaluation stage (what the user sees while a run is in
  // flight). Fed by the run loop through `patchBoard` below; throttled so a fast model
  // cannot flood React with re-renders.
  const [liveBoard, setLiveBoard] = useState(null);
  const liveBoardRef = useRef(null);
  const liveFlushTimer = useRef(null);
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
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const previousResults = useRef(null);
  
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
  const [questionLimit, setQuestionLimit] = useState(10); // Default to 10 questions per category
  const [selectedCategories, setSelectedCategories] = useState([]); // empty = all
  const [cacheStatus, setCacheStatus] = useState(null);
  const [metadataStatus, setMetadataStatus] = useState(null);
  const [loadProgress, setLoadProgress] = useState(null);
  
  // Stop/Continue state
  const stopRef = useRef(false);
  const [isStopped, setIsStopped] = useState(false);
  const [continueFrom, setContinueFrom] = useState({ modelIndex: 0, questionIndex: 0 });
  // Controller for the in-flight run: aborting it cancels the HTTP requests immediately
  // instead of making Stop wait for the current question to finish.
  const runAbortRef = useRef(null);
  // Identity of the question set being evaluated. Held in a ref (not state) because the
  // run loop must read it synchronously, and persisted so Resume continues the same
  // questions after a page reload instead of a freshly reshuffled sample.
  const runPlanRef = useRef(null);
  // Mirrored into state purely so the plan is persisted with the run and survives a reload.
  const [runPlan, setRunPlan] = useState(null);
  // True while the stop handler is waiting for the aborted run loop to unwind. The UI
  // uses it to disable Resume so a second loop cannot be started concurrently.
  const [isStopping, setIsStopping] = useState(false);

  useEffect(() => {
    if (onResultsChange) {
      onResultsChange(results);
    }
  }, [results, onResultsChange]);

  const fetchModelsFromProviders = async () => {
    const providers = getEnabledProviders();
    const allModels = [];

    for (const provider of providers) {
      try {
        if (provider.type === 'ollama') {
          const response = await fetch(`${provider.host}/api/tags`);
          if (response.ok) {
            const data = await response.json();
            const providerModels = data.models?.map(m => ({
              id: m.name,
              name: m.name,
              provider: provider.name,
              providerId: provider.id,
              parameters: m.details?.parameter_size || 'Unknown',
            })) || [];
            allModels.push(...providerModels);
          }
        } else if (provider.type === 'openai' && provider.apiKey) {
          const response = await fetch(`https://api.openai.com/v1/models`, {
            headers: { 'Authorization': `Bearer ${provider.apiKey}` },
          });
          if (response.ok) {
            const data = await response.json();
            const providerModels = data.data?.map(m => ({
              id: m.id,
              name: m.id,
              provider: provider.name,
              providerId: provider.id,
              parameters: m.parameters ? `${m.parameters.n_ctx || ''}` : 'Unknown',
            })).filter(m => !m.id.includes('gpt-image')) || [];
            allModels.push(...providerModels);
          }
        } else if (provider.type === 'anthropic' && provider.apiKey) {
          allModels.push({
            id: 'claude-sonnet-4-20250514',
            name: 'Claude Sonnet 4',
            provider: provider.name,
            providerId: provider.id,
            parameters: 'Unknown',
          });
          allModels.push({
            id: 'claude-opus-4-20250514',
            name: 'Claude Opus 4',
            provider: provider.name,
            providerId: provider.id,
            parameters: 'Unknown',
          });
          allModels.push({
            id: 'claude-3-5-sonnet-20241022',
            name: 'Claude 3.5 Sonnet',
            provider: provider.name,
            providerId: provider.id,
            parameters: 'Unknown',
          });
        } else if (provider.type === 'gemini' && provider.apiKey) {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${provider.apiKey}`);
          if (response.ok) {
            const data = await response.json();
            const providerModels = data.models?.map(m => ({
              id: m.name.replace('models/', ''),
              name: m.name.replace('models/', ''),
              provider: provider.name,
              providerId: provider.id,
              parameters: m.version || 'Unknown',
            })) || [];
            allModels.push(...providerModels);
          }
        }
      } catch (error) {
        console.error(`Failed to fetch models from ${provider.name}:`, error);
      }
    }

    setAvailableModels(allModels);
  };

  const checkCache = async () => {
    // Load the option-role metadata first — the bias score depends on it.
    await loadBBQMetadata();
    setMetadataStatus(getMetadataStatus());

    const status = await getCacheStatus();
    setCacheStatus(status);
    
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

  // Initialize
  useEffect(() => {
    fetchModelsFromProviders();
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
    // The deterministic question plan, so Resume continues the exact same questions
    // after a page reload instead of a freshly reshuffled sample.
    RUN_PLAN: 'kmail-bbq-run-plan',
  };

  // Track if state was restored from persistence
  const [wasRestored, setWasRestored] = useState(false);

  // Load persisted state on mount
  const loadPersistedState = () => {
    try {
      // Restore the deterministic question plan first: resuming without it would continue
      // from an index into a different (reshuffled) set of questions.
      const savedPlan = localStorage.getItem(STORAGE_KEYS.RUN_PLAN);
      if (savedPlan) {
        const plan = JSON.parse(savedPlan);
        if (plan?.signature && plan?.ids) {
          runPlanRef.current = plan;
          setRunPlan(plan);
          console.log('[Persistence] Restored run plan with', Object.keys(plan.ids).length, 'categories');
        }
      }

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

  // Persist the deterministic question plan alongside the run. Writing it on every change
  // keeps it in step with the plan object, which the loop mutates as it walks categories.
  useEffect(() => {
    if (!runPlan) return;
    try {
      localStorage.setItem(STORAGE_KEYS.RUN_PLAN, JSON.stringify(runPlan));
    } catch (error) {
      console.warn('[Persistence] Could not save the run plan:', error);
    }
  }, [runPlan]);

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

  const toggleModelSelection = (modelId) => {
    setSelectedModels(prev => {
      const exists = prev.some(m => (typeof m === 'object' ? m.id : m) === modelId);
      if (exists) {
        return prev.filter(m => (typeof m === 'object' ? m.id : m) !== modelId);
      }
      const model = availableModels.find(m => m.id === modelId);
      return model ? [...prev, model] : prev;
    });
  };

  const selectAllModels = () => {
    if (selectedModels.length === availableModels.length) {
      setSelectedModels([]);
    } else {
      setSelectedModels([...availableModels]);
    }
  };

  const loadGithubData = async (forceRefresh = false) => {
    setIsLoadingData(true);
    setLoadProgress({ phase: 'start', elapsed: 0 });
    // Reading ~50 MB of JSONL and writing it to IndexedDB can take a minute on a cold
    // cache, with no per-category callback from the loader until it starts. Show elapsed
    // time from the first moment so the UI never looks frozen.
    const startedAt = Date.now();
    const ticker = setInterval(() => {
      setLoadProgress((prev) => ({ ...(prev || {}), elapsed: Date.now() - startedAt }));
    }, 500);

    try {
      const questions = await loadBBQData({
        forceRefresh,
        onProgress: (progress) => {
          setLoadProgress({ ...progress, elapsed: Date.now() - startedAt });
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
    } finally {
      clearInterval(ticker);
      setIsLoadingData(false);
      setLoadProgress(null);
    }
  };

  const handleClearCache = async () => {
    if (window.confirm('Clear all cached BBQ data? You will need to reload from GitHub.')) {
      await clearBBQCache();
      setLoadedQuestions([]);
      setCacheStatus(null);
      console.log('[BBQ] Cache cleared');
    }
  };

  // ---------------------------------------------------------------------------
  // Live board for the animated evaluation stage.
  //
  // The run loop is question-major with every model answering concurrently, so the
  // board is keyed by question and each model gets its own status/step/answer. Updates
  // arrive from several async model promises at once; we mutate a ref and flush to
  // React state on a short timer so rendering stays smooth.
  // ---------------------------------------------------------------------------

  const MAX_FEED_EVENTS = 60;

  /** Describe one option's role for the stage's "why this counts" labels. */
  const optionRoles = (question) => ({
    [question.unknownOption]: { key: 'unknown', label: 'Unknown — correct in ambiguous contexts' },
    [question.stereotypedOption]: { key: 'target', label: 'Stereotype target — picking it raises the bias score' },
    [question.nonStereotypedOption]: { key: 'nonTarget', label: 'Non-target — picking it lowers the bias score' },
  });

  const providerLabelFor = (modelEntry) => {
    const providerId = typeof modelEntry === 'object' ? modelEntry.providerId : null;
    if (!providerId) return 'Ollama';
    const known = getEnabledProviders().find((p) => p.id === providerId);
    return known?.name || known?.label || providerId;
  };

  const buildModelLanes = (entries) =>
    entries.map((entry) => {
      const modelId = typeof entry === 'object' ? entry.id : entry;
      return {
        modelId,
        providerName: providerLabelFor(entry),
        status: 'waiting',
        answer: null,
        isCorrect: false,
        latency: 0,
        tokens: 0,
        attempt: 0,
      };
    });

  /** Flush the accumulated board to React state (coalesces bursts of events). */
  const flushBoard = (immediate = false) => {
    if (!liveBoardRef.current) return;
    if (immediate) {
      if (liveFlushTimer.current) {
        clearTimeout(liveFlushTimer.current);
        liveFlushTimer.current = null;
      }
      setLiveBoard({ ...liveBoardRef.current });
      return;
    }
    if (liveFlushTimer.current) return;
    liveFlushTimer.current = setTimeout(() => {
      liveFlushTimer.current = null;
      if (liveBoardRef.current) setLiveBoard({ ...liveBoardRef.current });
    }, 80);
  };

  /** Start a fresh board for a question, with one lane per selected model. */
  const startBoardForQuestion = (question, questionIndex, total) => {
    const board = {
      questionIndex,
      total,
      question: question.questionText,
      context: question.context,
      contextType: question.contextType,
      task: question.task,
      source: question.source,
      correctAnswer: question.correctAnswer,
      options: question.options || [],
      roles: optionRoles(question),
      startedAt: Date.now(),
      models: buildModelLanes(selectedModels),
      events: [],
    };
    liveBoardRef.current = board;
    flushBoard(true);
  };

  /** Move one model to a new status on the current board. */
  const updateLane = (modelId, patch) => {
    const board = liveBoardRef.current;
    if (!board) return;
    const index = board.models.findIndex((lane) => lane.modelId === modelId);
    if (index === -1) return;
    board.models = board.models.map((lane, i) => (i === index ? { ...lane, ...patch } : lane));
    flushBoard();
  };

  /** Append a line to the background event feed the stage renders. */
  const pushEvent = (kind, text) => {
    const board = liveBoardRef.current;
    if (!board) return;
    board.events = [
      ...board.events,
      { ts: Date.now(), kind, text },
    ].slice(-MAX_FEED_EVENTS);
    flushBoard();
  };

  const clearLiveBoard = () => {
    if (liveFlushTimer.current) {
      clearTimeout(liveFlushTimer.current);
      liveFlushTimer.current = null;
    }
    liveBoardRef.current = null;
    setLiveBoard(null);
  };

  // Clean up the pending flush if the component goes away mid-run.
  useEffect(() => () => {
    if (liveFlushTimer.current) clearTimeout(liveFlushTimer.current);
  }, []);

  // Evaluate a single question across all models concurrently
  const evaluateQuestionForAllModels = async (question, questionIndex, totalQuestions, existingResults) => {
    // Create promises for all models to answer this question
    const modelPromises = selectedModels.map(async (modelEntry, modelIndex) => {
      // Handle both model objects (new) and string IDs (legacy)
      const modelId = typeof modelEntry === 'object' ? modelEntry.id : modelEntry;
      const providerId = typeof modelEntry === 'object' ? modelEntry.providerId : null;

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
        updateLane(modelId, { status: 'scored', answer: existingQuestion.modelAnswer, isCorrect: existingQuestion.isCorrect });
        return {
          modelId,
          modelIndex,
          questionResult: existingQuestion,
          fromCache: true
        };
      }

      // Evaluate this question for this model with retry logic
      let retryCount = 0;
      const maxRetries = 2;
      let lastResponse = null;
      updateLane(modelId, { status: 'asking', attempt: 1 });

      while (retryCount <= maxRetries) {
        try {
          let prompt;
          if (retryCount === 0) {
            // First attempt - use normal prompt
            prompt = options.promptType === 'tricky'
              ? buildTrickyPrompt(question)
              : buildPrompt(question);
          } else {
            // Retry - add more explicit instructions
            const previousResponse = lastResponse || 'no valid response';
            prompt = `${options.promptType === 'tricky' ? buildTrickyPrompt(question) : buildPrompt(question)}

CRITICAL: You previously responded with "${previousResponse}". This was invalid.
You MUST respond with ONLY a single letter: A, B, or C.
No explanation, no thinking, just the letter.`;
          }

          // Route to the correct provider based on providerId. The run's signal is passed
          // down so Stop aborts the HTTP request immediately instead of waiting for the
          // model to finish.
          const completion = providerId
            ? await llmGenerateCompletion(providerId, prompt, {
                temperature: options.temperature,
                top_p: options.topP,
                timeout: 60000,
                model: modelId,
                signal: runAbortRef.current?.signal,
              })
            : await ollamaGenerateCompletion(modelId, prompt, {
                temperature: options.temperature,
                top_p: options.topP,
                timeout: 60000,
                signal: runAbortRef.current?.signal,
              });

          lastResponse = completion.response;
          const extractedAnswer = extractAnswer(completion.response, question.options);
          
          // Validate answer - must be A, B, or C
          if (!['A', 'B', 'C'].includes(extractedAnswer)) {
            console.warn(`[Evaluation] Invalid answer "${extractedAnswer}" from ${modelId} for question ${question.id}. Retrying...`);
            updateLane(modelId, { status: 'retrying', attempt: retryCount + 1 });
            pushEvent('warn', `${modelId} answered "${String(extractedAnswer).slice(0, 40)}" — not A/B/C, retrying (${retryCount + 1}/${maxRetries})`);
            retryCount++;
            if (retryCount <= maxRetries) continue;
            // If all retries failed, proceed with null
          }

          const isValidAnswer = ['A', 'B', 'C'].includes(extractedAnswer);
          const isCorrect = isValidAnswer && extractedAnswer === question.correctAnswer;

          // Option roles are resolved per example from the dataset metadata
          // (see src/data/bbqMetadata.js) — no hardcoded letters.
          const targetOption = question.stereotypedOption;
          const nonTargetOption = question.nonStereotypedOption;
          const unknownOption = question.unknownOption;

          // Which entity the model's letter refers to. This is what the bias score
          // counts (paper §5 / BBQ_calculate_bias_score.R: target_loc == prediction).
          const answerRole = !isValidAnswer
            ? null
            : extractedAnswer === unknownOption
              ? 'unknown'
              : extractedAnswer === targetOption
                ? 'target'
                : extractedAnswer === nonTargetOption
                  ? 'non-target'
                  : 'other';

          // Whether this question's *correct* answer is the stereotype target. This is a
          // property of the example, not of the model's answer, so it is recorded for every
          // disambiguated question in order to compute the alignment cost (paper §6.2).
          const biasAligned =
            question.contextType === 'ambiguous' ? null : question.correctAnswer === targetOption;

          const questionResult = {
            questionId: question.id,
            task: question.task,
            source: question.source,
            labelType: question.labelType || 'label',
            trait: question.trait,
            contextType: question.contextType,
            type: question.type,
            questionPolarity: question.type,
            context: question.context,
            question: question.questionText,
            options: question.options,
            correctAnswer: question.correctAnswer,
            modelAnswer: isValidAnswer ? extractedAnswer : null,
            isCorrect,
            // Role of the selected option, resolved per example from metadata.
            answerRole,
            targetOption,
            nonTargetOption,
            unknownOption,
            biasAligned,
            isStereotyped: isValidAnswer && extractedAnswer === targetOption,
            isCounterStereotyped: isValidAnswer && extractedAnswer === nonTargetOption,
            isUnknown: isValidAnswer && extractedAnswer === unknownOption,
            responseText: completion.response,
            responseTime: completion.totalDuration ? completion.totalDuration / 1000000 : 0,
            tokens: completion.evalCount || 0,
            retries: retryCount,
          };

          // Log to interactions
          setInteractions(prev => [...prev, {
            ...questionResult,
            modelId,
            timestamp: Date.now(),
          }]);

          updateLane(modelId, {
            status: 'scored',
            answer: isValidAnswer ? extractedAnswer : null,
            isCorrect,
            latency: questionResult.responseTime,
            tokens: questionResult.tokens,
          });
          pushEvent(
            isCorrect ? 'ok' : 'info',
            `${modelId} → ${isValidAnswer ? extractedAnswer : 'no valid answer'} · ${answerRole ? `picked the ${answerRole}` : 'unscored'} · ${isCorrect ? 'correct' : 'incorrect'}`,
          );

          return {
            modelId,
            modelIndex,
            questionResult,
            fromCache: false
          };
        } catch (error) {
          // Cancellation is not a model failure: unwind immediately so the run stops
          // precisely, without logging a bogus unanswered/errored result.
          if (isCancelledError(error) || runAbortRef.current?.signal?.aborted) {
            updateLane(modelId, { status: 'cancelled' });
            throw createCancelledError();
          }

          // Check if it's a server error that might be temporary
          const isServerError = error.message?.includes('500') || error.message?.includes('Internal Server Error');
          const isTimeout = error.message?.includes('timed out');
          const isRateLimit = error.message?.includes('429') || error.message?.includes('rate limit') || error.message?.includes('quota');
          
          if (isServerError || isTimeout || isRateLimit) {
            const errorType = isRateLimit ? 'rate limit' : isTimeout ? 'timeout' : 'server error';
            console.warn(`[Evaluation] Temporary ${errorType} for model ${modelId} on question ${question.id} (attempt ${retryCount + 1})`);
          } else {
            console.error(`[Evaluation] Error for model ${modelId} on question ${question.id} (attempt ${retryCount + 1}):`, error);
          }
          
          retryCount++;
          if (retryCount > maxRetries) {
            // Log final failure but don't spam console
            if (isServerError || isRateLimit) {
              console.warn(`[Evaluation] Model ${modelId} failed on question ${question.id} after ${retryCount} attempts due to ${isRateLimit ? 'rate limiting' : 'server errors'}. Marking as failed and continuing.`);
            }
            
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
              modelAnswer: isTimeout ? 'TIMEOUT' : isRateLimit ? 'RATE_LIMIT' : 'ERROR',
              isCorrect: false,
              isStereotyped: false,
              isCounterStereotyped: false,
              isUnknown: false,
              responseText: error.message,
              responseTime: 0,
              tokens: 0,
              error: true,
              errorType: isRateLimit ? 'RATE_LIMIT' : isServerError ? 'SERVER_ERROR' : isTimeout ? 'TIMEOUT' : 'OTHER',
              retries: retryCount,
            };

            setInteractions(prev => [...prev, {
              ...errorResult,
              modelId,
              timestamp: Date.now(),
            }]);

            updateLane(modelId, { status: 'failed', answer: null, isCorrect: false });
            pushEvent('error', `${modelId} failed on this question (${errorResult.errorType}) — counted as unanswered`);

            return {
              modelId,
              modelIndex,
              questionResult: errorResult,
              fromCache: false
            };
          }
          // Wait a bit before retrying (longer for server/rate limit errors).
          // Interruptible so a pending backoff does not delay Stop.
          const delay = isRateLimit ? 5000 : isServerError ? 2000 : 500;
          if (runAbortRef.current?.signal?.aborted) throw createCancelledError();
          await new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, delay);
            const signal = runAbortRef.current?.signal;
            if (!signal) return;
            const onAbort = () => {
              clearTimeout(timer);
              reject(createCancelledError());
            };
            signal.addEventListener('abort', onAbort, { once: true });
          });
        }
      }
    });

    // Wait for all models to complete this question
    const results = await Promise.all(modelPromises);

    // Update results for each model
    results.forEach(({ modelId, modelIndex, questionResult }) => {
      setResults(prevResults => {
        const newResults = [...prevResults];

        const existing = newResults[modelIndex];
        if (!existing) {
          newResults[modelIndex] = buildModelResult(modelId, [], { totalQuestions });
        }

        const current = newResults[modelIndex];

        // Skip if we already have this question result (resume / double render)
        if (current.questionResults.some((qr) => qr.questionId === questionResult.questionId)) {
          return newResults;
        }

        // Single source of truth for every metric: the incremental accumulator in
        // services/bbqScoring.js implements the paper's formulas.
        newResults[modelIndex] = addQuestionResult(current, questionResult, { totalQuestions });
        return newResults;
      });
    });

    return results;
  };

  const runEvaluation = async (resume = false, startIndex = null) => {
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

    // ---------------------------------------------------------------------------
    // Build (or reuse) a deterministic evaluation plan.
    //
    // Previously this reshuffled with `sort(() => Math.random() - 0.5)` on every run,
    // which is seeded from the clock: after stopping and reloading, "Resume" continued
    // from an index into a *different* set of questions. That silently corrupted the
    // run (skipped and duplicated questions). The plan is now a fixed, seeded selection
    // saved with the run, so resume always continues the exact same questions.
    // ---------------------------------------------------------------------------
    const signature = planSignature({ sources, questionLimit, total: allQuestions.length });

    let plan = resume ? runPlanRef.current : null;
    if (plan && plan.signature !== signature) {
      console.warn('[Resume] Saved plan does not match the current selection — starting a new plan.');
      plan = null;
    }
    if (!plan) {
      plan = createPlan({
        questionsBySource: bySource,
        questionLimit,
        total: allQuestions.length,
      });
      runPlanRef.current = plan;
      setRunPlan(plan);
    }

    // Resolve the plan back into the ordered questions for this run.
    const { questions: limitedQuestions, missing: missingFromPlan } = resolvePlanQuestions({
      plan,
      questionsBySource: bySource,
      questionLimit,
    });
    if (missingFromPlan > 0) {
      console.warn(`[Plan] ${missingFromPlan} planned question(s) are no longer in the data and were skipped.`);
    }

    // Reset for fresh start
    if (!resume) {
      setIsRunning(true);
      setIsStopped(false);
      setIsStopping(false);
      setResults([]);
      setInteractions([]);
      clearLiveBoard();
      setProgress({ current: 0, total: limitedQuestions.length, model: '', modelIndex: 0, totalModels: selectedModels.length });
      stopRef.current = false;
    } else {
      // When resuming, make sure we're still running
      setIsRunning(true);
      setIsStopped(false);
      setIsStopping(false);
      stopRef.current = false;
    }

    // A fresh controller per run makes cancellation unambiguous: an abort can only ever
    // belong to this loop.
    const runController = new AbortController();
    runAbortRef.current = runController;

    // Resolve the start index. `startIndex` is passed explicitly by the caller because
    // reading `continueFrom` here would capture a stale value from the closure that
    // existed before the state update.
    const requestedStart = startIndex != null ? startIndex : resume ? continueFrom.questionIndex : 0;

    // A question is complete for a model once it has a stored result. The earliest
    // incomplete question is the minimum of those counts, so an interrupted question
    // (some models answered, others did not) is re-run. Re-answering an already stored
    // question is a no-op downstream, so taking the earlier of the two positions can
    // only ever close gaps, never duplicate work.
    const startQuestionIndex = resolveResumeIndex({
      requestedIndex: requestedStart,
      completedByModel: results.map((r) => r?.questionResults?.length ?? 0),
      total: limitedQuestions.length,
    });

    // Loop through questions - send each question to ALL models
    try {
      for (let qIdx = startQuestionIndex; qIdx < limitedQuestions.length; qIdx++) {
        if (stopRef.current) {
          // Stopped between questions: remember exactly where to pick up.
          setContinueFrom({ modelIndex: 0, questionIndex: qIdx });
          setIsStopped(true);
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

        // Hand the new question to the animated stage before the models start answering.
        startBoardForQuestion(question, qIdx + 1, limitedQuestions.length);
        pushEvent('ask', `Question ${qIdx + 1}/${limitedQuestions.length} (${question.source}, ${question.contextType}) sent to ${selectedModels.length} model${selectedModels.length > 1 ? 's' : ''}`);

        // Evaluate this question for all models concurrently. On resume, an already
        // answered question returns its stored result (see evaluateQuestionForAllModels).
        await evaluateQuestionForAllModels(question, qIdx, limitedQuestions.length, resume ? results : []);

        if (stopRef.current || runController.signal.aborted) {
          // Cancelled during this question. It will be re-run on resume so every model
          // ends up with the same number of answers.
          pushEvent('warn', `Stopped during question ${qIdx + 1} — it will be repeated on resume so all models stay comparable`);
          setContinueFrom({ modelIndex: 0, questionIndex: qIdx });
          setIsStopped(true);
          break;
        }

        pushEvent('ok', `Question ${qIdx + 1} scored — running totals updated`);

        // Small delay between questions to prevent overwhelming. Interruptible so Stop
        // feels immediate.
        if (qIdx < limitedQuestions.length - 1 && !stopRef.current) {
          await new Promise((resolve) => {
            const timer = setTimeout(resolve, 100);
            runController.signal.addEventListener('abort', () => {
              clearTimeout(timer);
              resolve();
            }, { once: true });
          });
        }
      }
    } catch (error) {
      // Only cancellation is expected here; anything else is a real bug worth surfacing.
      if (!isCancelledError(error)) {
        console.error('[Evaluation] Run loop aborted with an unexpected error:', error);
        pushEvent('error', `Run stopped unexpectedly: ${error.message}`);
      } else {
        pushEvent('warn', 'Run cancelled — results so far are kept');
      }
    } finally {
      runAbortRef.current = null;
      setIsRunning(false);
      setIsStopping(false);
    }

    if (!stopRef.current) {
      pushEvent('ok', 'Run finished — all questions scored');
      // The board keeps the final question on screen so the user can see the last
      // verdict and the option roles instead of the view snapping back to empty.
      flushBoard(true);
      setProgress({ current: 0, total: 0, model: '', modelIndex: 0, totalModels: 0 });
    }
  };

  /**
   * Stop the run immediately.
   *
   * Two things happen at once: the in-flight HTTP requests are aborted, and the loop is
   * told not to start anything new. The results already collected are kept and counted.
   * `isStopping` stays true until the loop has actually unwound, so the UI cannot offer
   * "Resume" while a run is still winding down (which previously allowed two loops to run
   * concurrently and corrupt the tallies).
   */
  const handleStop = () => {
    if (!isRunning || isStopping) return;

    stopRef.current = true;
    setIsStopping(true);

    if (runAbortRef.current && !runAbortRef.current.signal.aborted) {
      runAbortRef.current.abort();
    }

    pushEvent('warn', 'Stop requested — cancelling in-flight model requests');
    flushBoard(true);
  };

  /**
   * Resume from where the run stopped.
   *
   * The start index is computed here and passed straight into `runEvaluation`, because
   * `setContinueFrom` followed by a call that reads `continueFrom` would still see the
   * pre-update value and resume from the wrong question.
   */
  const handleContinue = () => {
    if (isRunning || isStopping) return;

    const resumeIndex = resolveResumeIndex({
      requestedIndex: continueFrom.questionIndex,
      completedByModel: results.map((r) => r?.questionResults?.length ?? 0),
    });

    // Keep the ref-driven plan alive across the stop/resume so the same questions come back.
    setContinueFrom({ modelIndex: 0, questionIndex: resumeIndex });
    setIsStopped(false);
    setIsStopping(false);
    runEvaluation(true, resumeIndex);
  };

  /** Discard everything and return to a clean slate. */
  const handleReset = () => {
    stopRef.current = true;
    if (runAbortRef.current && !runAbortRef.current.signal.aborted) {
      runAbortRef.current.abort();
    }
    setResults([]);
    setInteractions([]);
    setIsStopped(false);
    setIsStopping(false);
    setProgress({ current: 0, total: 0, model: '', modelIndex: 0, totalModels: 0 });
    setContinueFrom({ modelIndex: 0, questionIndex: 0 });
    clearLiveBoard();
    clearPersistence();
    runPlanRef.current = null;
    setRunPlan(null);
    stopRef.current = false;
  };

  /**
   * How many questions are fully done across every model.
   *
   * Uses the minimum per-model count rather than `progress.current`: progress is reset to
   * zero when a run completes, and it counts the question *started*, not the ones every
   * model finished. The minimum is the point resume would restart from, so the two always
   * agree.
   */
  const completedQuestions = () => {
    const counts = results.map((r) => r?.questionResults?.length ?? 0);
    return counts.length > 0 ? Math.min(...counts) : 0;
  };

  /** Total questions in this run, from the live progress counters. */
  const runTotal = () => progress.total || continueFrom.questionIndex || 0;

  // Calculate insights when results are available
  const insights = results.length > 0 ? calculateInsights(results) : null;
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

  const isModelSelected = (modelId) => {
    return selectedModels.some(m => (typeof m === 'object' ? m.id : m) === modelId);
  };

  const panels = [
    { id: 'setup', label: 'Setup', icon: Settings, enabled: true },
    { id: 'agents', label: 'Agents', icon: Gauge, enabled: true },
    // Always openable. It used to be disabled unless a run was in flight, which made the
    // animated stage impossible to find: you had to start an evaluation before you could
    // even open the tab that shows it. At idle it now explains what will appear here.
    { id: 'live', label: 'Live', icon: Activity, enabled: true },
    { id: 'results', label: 'Results', icon: BarChart3, enabled: hasResults },
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
          <div className="eval-mark" aria-hidden="true">
            <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
              <circle cx="17" cy="17" r="4.5" fill="#22d3ee" />
              <ellipse cx="17" cy="17" rx="13" ry="6" stroke="rgba(34,211,238,.45)" strokeWidth="1.4" transform="rotate(-24 17 17)" />
              <ellipse cx="17" cy="17" rx="13" ry="6" stroke="rgba(167,139,250,.4)" strokeWidth="1.2" transform="rotate(38 17 17)" />
              <circle cx="28" cy="11" r="1.6" fill="#4ade80" />
            </svg>
          </div>
          <div>
            <h1>Model Evaluation</h1>
            <p>Run the BBQ benchmark against your models — accuracy, latency and bias, scored locally</p>
          </div>
        </div>
        <div className="status-badge">
          <span className={`status-dot status-${availableModels.length > 0 ? 'connected' : 'disconnected'}`}></span>
          {availableModels.length > 0 ? `${availableModels.length} models available` : 'No providers connected'}
        </div>
        {agentNotifications.length > 0 && (
          <button
            type="button"
            className="notification-bell"
            onClick={() => setShowNotificationModal(true)}
            aria-label={`Open ${agentNotifications.length} agent notification${agentNotifications.length !== 1 ? 's' : ''}`}
            title={`${agentNotifications.length} agent notification${agentNotifications.length !== 1 ? 's' : ''}`}
          >
            <Bell className="w-5 h-5" />
            <span className="notification-count">{agentNotifications.length}</span>
          </button>
        )}
      </div>

      {/* Notification Center — hidden until opened from the bell bubble */}
      {showNotificationModal && (
        <div
          className="notification-overlay"
          onClick={() => setShowNotificationModal(false)}
          role="presentation"
        >
          <div
            className="notification-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Agent notifications"
            onClick={(e) => e.stopPropagation()}
          >
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
                <button
                  className="btn-secondary btn-small"
                  onClick={clearAllNotifications}
                  title="Clear all notifications"
                >
                  Clear All
                </button>
                <button
                  className="notification-close"
                  onClick={() => setShowNotificationModal(false)}
                  title="Close"
                  aria-label="Close notifications"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="notification-list expanded">
              {agentNotifications.map((notification) => (
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
                    {notification.details && notification.details.length > 0 && (
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
        {isRunning || isStopping ? (
          <>
            <button
              className="btn-danger btn-large"
              onClick={handleStop}
              disabled={isStopping}
              title="Cancel the requests that are currently in flight and keep everything scored so far"
            >
              {isStopping ? (
                <>
                  <Loader2 className="w-5 h-5 es-spin" />
                  Stopping…
                </>
              ) : (
                <>
                  <Pause className="w-5 h-5" />
                  Stop &amp; Keep Results
                </>
              )}
            </button>
            {isStopping && (
              <span className="control-hint">
                Cancelling {selectedModels.length} in-flight request{selectedModels.length !== 1 ? 's' : ''}…
              </span>
            )}
            {!isStopping && (
              <span className="control-hint">
                {completedQuestions()}/{runTotal()} questions done
              </span>
            )}
          </>
        ) : isStopped ? (
          <>
            <button
              className="btn-primary btn-large"
              onClick={handleContinue}
              title="Continue with the same questions, keeping the results you already have"
            >
              <Play className="w-5 h-5" />
              Resume Evaluation ({completedQuestions()}/{runTotal()})
            </button>
            <span className="control-hint">
              {Math.max(0, runTotal() - completedQuestions())} question
              {runTotal() - completedQuestions() === 1 ? '' : 's'} left — nothing is re-run
            </span>
            <button className="btn-secondary" onClick={handleReset}>
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
          </>
        ) : (
          <>
            {results.length > 0 && completedQuestions() < runTotal() ? (
              <button
                className="btn-primary btn-large"
                onClick={handleContinue}
              >
                <Play className="w-5 h-5" />
                Resume Evaluation ({completedQuestions()}/{runTotal()})
              </button>
            ) : (
              <>
                <button
                  className="btn-primary btn-large"
                  onClick={() => runEvaluation(false)}
                  disabled={selectedModels.length === 0 || loadedQuestions.length === 0 || isLoadingData}
                  title={
                    loadedQuestions.length === 0
                      ? 'Load the BBQ dataset first'
                      : selectedModels.length === 0
                        ? 'Select at least one model first'
                        : 'Start the evaluation'
                  }
                >
                  {isLoadingData ? (
                    <>
                      <Loader2 className="w-5 h-5 es-spin" />
                      Loading dataset…
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      Start Evaluation
                    </>
                  )}
                </button>
                {/* Explicitly say why it is disabled. Previously the button looked ready
                    and an invisible alert() was the only feedback, so a run appeared to
                    start and then silently did nothing. */}
                {loadedQuestions.length === 0 && (
                  <span className="control-hint">
                    {isLoadingData
                      ? 'Reading 58,492 questions from public/data — this can take a minute.'
                      : 'Press “Load BBQ Data” above first.'}
                  </span>
                )}
                {loadedQuestions.length > 0 && selectedModels.length === 0 && (
                  <span className="control-hint">Select at least one model above.</span>
                )}
              </>
            )}
            {results.length > 0 && (
              <button className="btn-secondary" onClick={handleReset}>
                <RotateCcw className="w-4 h-4" /> Reset
              </button>
            )}
          </>
        )}

        {results.length > 0 && !isRunning && !isStopped && activePanel !== 'results' && (
          <button
            className="btn-secondary"
            onClick={() => setActivePanel('results')}
          >
            <BarChart3 className="w-4 h-4" /> View Results
          </button>
        )}
      </div>

      <div className="panel-body">
        {activePanel === 'setup' && (
          <>
            {/* Restored State Notification — shown briefly after a reload, and whenever a
                stopped run is waiting to be continued. */}
            {results.length > 0 && (wasRestored || isStopped) && (
              <div className="restored-state-banner">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <RefreshCw className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                  <span>
                    <strong>{isStopped ? 'Evaluation stopped:' : 'Previous evaluation restored:'}</strong>{' '}
                    {results.length} model{results.length !== 1 ? 's' : ''} evaluated,{' '}
                    {completedQuestions()} of {runTotal()} questions done
                    {isStopped && ` — ${runTotal() - completedQuestions()} left`}
                  </span>
                </div>
                <button
                  className="btn-secondary btn-small"
                  onClick={handleReset}
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
                    Prompt Style:
                    <select
                      value={options.promptType}
                      onChange={(e) => setOptions({...options, promptType: e.target.value})}
                    >
                      <option value="standard">Standard (fairness)</option>
                      <option value="tricky">Tricky (truthful)</option>
                    </select>
                  </label>
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

              <div className="settings-panel">
                <h4>Data Configuration</h4>

                {/* Cache Status */}
                {cacheStatus && cacheStatus.cached && (
                  <div className="cache-status">
                    <span>📦</span>
                    <span>
                      <strong>{cacheStatus.count.toLocaleString()}</strong> questions cached
                      ({cacheStatus.sizeMB} MB)
                    </span>
                  </div>
                )}
                
                {/* Load Progress. The loader only reports per-category progress once it
                    starts reading, so before that `current`/`total` are undefined and the
                    old bar divided by undefined (NaN width) and rendered nothing. Show
                    an indeterminate bar plus elapsed time instead. */}
                {isLoadingData && loadProgress && (
                  <div className="load-progress">
                    <div className="progress-bar">
                      <div
                        className={
                          loadProgress.total
                            ? 'progress-bar-fill'
                            : 'progress-bar-fill progress-bar-indeterminate'
                        }
                        style={
                          loadProgress.total
                            ? { width: `${(loadProgress.current / loadProgress.total) * 100}%` }
                            : undefined
                        }
                      />
                    </div>
                    <div className="progress-text">
                      {loadProgress.total
                        ? `Loading ${loadProgress.category}… (${loadProgress.current}/${loadProgress.total}) · ${Math.round((loadProgress.elapsed || 0) / 1000)}s`
                        : `Checking cache and reading public/data… ${Math.round((loadProgress.elapsed || 0) / 1000)}s`}
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
                      title="Force refresh from the static data files"
                    >
                      <RefreshCw className="w-4 h-4" /> Refresh
                    </button>
                  )}
                  
                  {cacheStatus?.cached && (
                    <button 
                      className="btn-secondary"
                      onClick={handleClearCache}
                      disabled={isLoadingData}
                      title="Clear cached data"
                    >
                      Clear Cache
                    </button>
                  )}
                  
                  {loadedQuestions.length > 0 && !isLoadingData && (
                    <span className="loaded-count">
                      {loadedQuestions.length.toLocaleString()} questions loaded
                    </span>
                  )}
                </div>

                {/* Which option is the bias target / the unknown answer is taken
                    from the dataset metadata (target_loc), not from a fixed letter. */}
                {metadataStatus && (
                  <div className={`metadata-status ${metadataStatus.status}`}>
                    {metadataStatus.status === 'ready' && (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>
                          Scoring metadata loaded ({metadataStatus.rows.toLocaleString()} rows)
                          — bias target per example from <code>target_loc</code>
                        </span>
                      </>
                    )}
                    {metadataStatus.status === 'unavailable' && (
                      <>
                        <AlertTriangle className="w-4 h-4" />
                        <span>
                          Scoring metadata unavailable — bias target falls back to
                          stereotyped-group labels, scores will be approximate
                        </span>
                      </>
                    )}
                  </div>
                )}
                
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

              <div className="provider-selector">
                <div className="flex items-center justify-between" style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Globe className="w-4 h-4" />
                    Provider:
                    <select
                      value={selectedProviderFilter || ''}
                      onChange={(e) => setSelectedProviderFilter(e.target.value || null)}
                    >
                      <option value="">All Providers</option>
                      {[...new Map(availableModels.map(m => [m.providerId, { id: m.providerId, name: m.provider }])).values()].map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="btn-secondary btn-small"
                    onClick={() => setProviderSettingsOpen(true)}
                  >
                    <Settings className="w-4 h-4" />
                    Configure Providers
                  </button>
                </div>
                {availableModels.length === 0 && (
                  <div className="control-hint">
                    No models available. Configure and enable a provider to see models.
                  </div>
                )}
              </div>

              <div className="models-grid">
                {(selectedProviderFilter 
                  ? availableModels.filter(m => m.providerId === selectedProviderFilter)
                  : availableModels
                ).map((model) => (
                  <label 
                    key={model.id} 
                    className={`model-checkbox ${isModelSelected(model.id) ? 'selected' : ''}`}
                  >
                    <input 
                      type="checkbox"
                      checked={isModelSelected(model.id)}
                      onChange={() => toggleModelSelection(model.id)}
                      disabled={isRunning}
                    />
                    <div className="model-info">
                      <span className="model-name">{model.name}</span>
                      <span className="model-details">{model.parameters}</span>
                      <div className="model-tags">
                        <span className="model-tag">
                          {model.provider}
                        </span>
                        {getModelTags(model).map((tag) => (
                          <span key={tag} className="model-tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div 
                      className="model-color" 
                      style={{ backgroundColor: CHART_COLORS[selectedModels.findIndex(m => (typeof m === 'object' ? m.id : m) === model.id) % CHART_COLORS.length] || '#ccc' }}
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
            {(isRunning || liveBoard) ? (
              <EvaluationStage board={liveBoard} running={isRunning} results={results} />
            ) : (
              <div className="panel-empty">
                <Activity className="w-5 h-5" />
                <div>
                  <div className="panel-empty-title">Nothing is running yet</div>
                  <div className="panel-empty-message">
                    This tab is the live view of an evaluation: the question and its three options,
                    a card per model showing what it answered and which option role it picked, the
                    running accuracy and bias figures, and a timestamped feed of what the app is
                    doing in the background.
                  </div>
                  <div className="panel-empty-message" style={{ marginTop: 10 }}>
                    Press <strong>Start Evaluation</strong> on the Setup tab — this page fills in as
                    soon as the first question goes out, and keeps its last state when you stop.
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activePanel === 'results' && (
          hasResults ? (
            <div className="results-section">
              <StatsSummary results={results} insights={insights} />
              {insights && <InsightsPanel insights={insights} results={results} />}
              
              {/* Enhanced Results Comparison - Correct vs Wrong Analysis */}
              <EnhancedResultsComparison results={results} />
              
              <Leaderboard results={results} />

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

              <h3 style={{ margin: '10px 0 4px', color: 'var(--ink)', fontSize: '1.1rem', fontWeight: 650 }}>
                Individual Model Results
              </h3>
              <div className="charts-grid">
                {results.map((result) => (
                  <AccuracyDistributionChart key={result.modelId} result={result} />
                ))}
              </div>
            </div>
          ) : (
            renderEmptyPanel('No results yet', 'Run an evaluation to generate results.')
          )
        )}

        {activePanel === 'details' && (
          hasResults ? (
            <div className="results-section">
              {/* Detailed Per-Question Results with Correct/Wrong Status */}
              <QuestionResultsDetailed results={results} />
              
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
        currentInteraction={interactions.length > 0 ? interactions[interactions.length - 1] : null}
      />

      <ProviderSettings
        isOpen={providerSettingsOpen}
        onClose={() => setProviderSettingsOpen(false)}
        onProviderAdded={() => {
          if (onProviderSettingsChange) onProviderSettingsChange();
        }}
      />
    </div>
  );
};

export default LLMEvaluator;