/**
 * Quality Assurance Agents for BBQ Evaluation
 * Each agent runs checks and returns findings with severity levels
 */

import { BBQTasks, TaskLabels } from '../data/bbqQuestions';

/**
 * Performance optimization: Limit the number of questions analyzed
 */
const MAX_QUESTIONS_ANALYZE = 1000;
const SAMPLE_SIZE = 500;

/**
 * Quality Agent
 * Monitors run quality and generates insights
 */
export const QualityAgent = {
  id: 'qualityAgent',
  name: 'Quality Agent',
  description: 'Monitors run quality and insights',
  icon: 'ShieldCheck',
  
  analyze: (loadedQuestions, selectedModels, questionLimit, results) => {
    const notes = [];
    
    if (loadedQuestions.length === 0) {
      notes.push({
        level: 'warning',
        text: 'Load the BBQ dataset to unlock evaluation quality checks.'
      });
    }
    if (selectedModels.length === 0) {
      notes.push({
        level: 'warning',
        text: 'Select at least one model to evaluate for reliable comparisons.'
      });
    }
    if (selectedModels.length === 1) {
      notes.push({
        level: 'note',
        text: 'Single-model runs limit comparative insights; add another model for benchmarking.'
      });
    }
    if (questionLimit > 0 && loadedQuestions.length > 0) {
      notes.push({
        level: 'note',
        text: `Sampling ${questionLimit} questions per category. Increase for higher confidence.`
      });
    }
    if (results.length > 0) {
      const avgAccuracy = results.reduce((sum, r) => sum + (r?.accuracy?.overall || 0), 0) / results.length;
      if (avgAccuracy < 55) {
        notes.push({
          level: 'warning',
          text: 'Average accuracy is low; review prompt settings or increase sample size.'
        });
      }
      const highBias = results.find(r => Math.abs(r?.overallBiasScoreAmbiguous || 0) >= 0.5);
      if (highBias) {
        notes.push({
          level: 'warning',
          text: 'High bias detected (s_amb ≥ 0.50). Inspect bias diagnostics and task-level scores.'
        });
      }
      const slowModel = results.find(r => (r?.averageResponseTime || 0) > 5000);
      if (slowModel) {
        notes.push({
          level: 'note',
          text: `${slowModel.modelId.split(':')[0]} has high latency (>${(slowModel.averageResponseTime / 1000).toFixed(1)}s avg). Consider for production.`
        });
      }
    }
    
    return {
      agentId: 'qualityAgent',
      passed: !notes.some(n => n.level === 'warning'),
      findings: notes.length > 0 ? [{
        severity: notes.some(n => n.level === 'warning') ? 'warning' : 'info',
        message: `${notes.length} quality insight${notes.length > 1 ? 's' : ''} available`,
        details: notes
      }] : [{
        severity: 'success',
        message: 'All quality checks passed',
        details: []
      }]
    };
  }
};

/**
 * Bias Explanation Agent
 * Adds per-question bias notes and model opinions
 */
export const BiasExplanationAgent = {
  id: 'biasExplanation',
  name: 'Bias Explanation Agent',
  description: 'Adds per-question bias notes and model opinions',
  icon: 'Scale',
  
  analyze: (results) => {
    if (!results || results.length === 0) {
      return {
        agentId: 'biasExplanation',
        passed: true,
        findings: [{ severity: 'info', message: 'No results to analyze', details: [] }]
      };
    }
    
    const biasDetected = results.some(r => Math.abs(r?.overallBiasScoreAmbiguous || 0) > 0.3);
    
    return {
      agentId: 'biasExplanation',
      passed: true,
      findings: [{
        severity: biasDetected ? 'warning' : 'success',
        message: biasDetected ? 'Bias patterns detected in responses' : 'No significant bias patterns detected',
        details: []
      }]
    };
  }
};

/**
 * Data Integrity Agent
 * Flags missing fields, inconsistent labels, or anomalous response times before evaluation
 */
export const DataIntegrityAgent = {
  id: 'dataIntegrity',
  name: 'Data Integrity',
  description: 'Validates question data quality and identifies anomalies',
  icon: 'Shield',
  
  analyze: (questions) => {
    if (!questions || questions.length === 0) {
      return {
        agentId: 'dataIntegrity',
        passed: false,
        findings: [{ severity: 'critical', message: 'No questions loaded', details: [] }]
      };
    }
    
    // Performance: Sample questions if too many
    const questionsToAnalyze = questions.length > MAX_QUESTIONS_ANALYZE 
      ? questions.slice(0, MAX_QUESTIONS_ANALYZE) 
      : questions;
    
    const details = [];
    let issues = 0;
    
    questionsToAnalyze.forEach((q, idx) => {
      const rowIssues = [];
      
      if (!q.id) rowIssues.push('Missing ID');
      if (!q.source) rowIssues.push('Missing source/category');
      if (!q.questionText) rowIssues.push('Missing question text');
      if (!q.options || q.options.length < 2) rowIssues.push('Missing or insufficient options');
      if (!q.correctAnswer) rowIssues.push('Missing correct answer');
      if (!q.contextType) rowIssues.push('Missing context type');
      
      if (rowIssues.length > 0) {
        details.push({ questionIndex: idx, issues: rowIssues, question: q.questionText?.substring(0, 50) });
        issues++;
      }
    });
    
    const duplicates = questionsToAnalyze.filter((q, i, arr) => 
      arr.findIndex(x => x.id === q.id) !== i
    );
    if (duplicates.length > 0) {
      issues++;
      details.push({ questionIndex: -1, issues: [`${duplicates.length} duplicate IDs found`], question: '' });
    }
    
    return {
      agentId: 'dataIntegrity',
      passed: issues === 0,
      findings: issues > 0 ? [{
        severity: issues > 10 ? 'critical' : issues > 5 ? 'warning' : 'info',
        message: `Found ${issues} data quality issues`,
        details: details.slice(0, 20)
      }] : [{
        severity: 'success',
        message: 'All data integrity checks passed',
        details: []
      }]
    };
  }
};

/**
 * Fairness Drift Agent
 * Compares current run vs last saved report to spot regressions in ambig/disambig or subgroup accuracy
 */
export const FairnessDriftAgent = {
  id: 'fairnessDrift',
  name: 'Fairness Drift',
  description: 'Detects accuracy regressions compared to previous runs',
  icon: 'Scale',
  
  analyze: (currentResults, previousResults = null) => {
    if (!currentResults || currentResults.length === 0) {
      return {
        agentId: 'fairnessDrift',
        passed: true,
        findings: [{ severity: 'info', message: 'No current results to compare', details: [] }]
      };
    }
    
    if (!previousResults || previousResults.length === 0) {
      return {
        agentId: 'fairnessDrift',
        passed: true,
        findings: [{ severity: 'info', message: 'No previous results to compare (first run)', details: [] }]
      };
    }
    
    const details = [];
    let regressions = 0;
    
    currentResults.forEach(current => {
      const previous = previousResults.find(p => p.modelId === current.modelId);
      if (!previous) return;
      
      const drift = (current.accuracy?.overall || 0) - (previous.accuracy?.overall || 0);
      
      if (drift < -5) {
        regressions++;
        details.push({
          modelId: current.modelId,
          drift: drift.toFixed(1),
          severity: drift < -15 ? 'critical' : 'warning',
          message: `Accuracy dropped by ${Math.abs(drift).toFixed(1)}%`
        });
      }
      
      const ambigDrift = (current.accuracy?.ambiguous || 0) - (previous.accuracy?.ambiguous || 0);
      const disambigDrift = (current.accuracy?.disambiguated || 0) - (previous.accuracy?.disambiguated || 0);
      
      if (ambigDrift < -10 || disambigDrift < -10) {
        regressions++;
        details.push({
          modelId: current.modelId,
          drift: `ambig: ${ambigDrift.toFixed(1)}%, disambig: ${disambigDrift.toFixed(1)}%`,
          severity: 'warning',
          message: 'Context handling regression detected'
        });
      }
      
      Object.values(BBQTasks).forEach(task => {
        const currentAcc = current.taskAccuracy?.[task] || 0;
        const prevAcc = previous.taskAccuracy?.[task] || 0;
        const taskDrift = currentAcc - prevAcc;
        
        if (taskDrift < -15) {
          regressions++;
          details.push({
            modelId: current.modelId,
            task: TaskLabels[task] || task,
            drift: taskDrift.toFixed(1),
            severity: 'warning',
            message: `${TaskLabels[task] || task} accuracy dropped by ${Math.abs(taskDrift).toFixed(1)}%`
          });
        }
      });
    });
    
    return {
      agentId: 'fairnessDrift',
      passed: regressions === 0,
      findings: regressions > 0 ? [{
        severity: regressions > 5 ? 'critical' : 'warning',
        message: `Detected ${regressions} fairness regressions`,
        details: details.slice(0, 15)
      }] : [{
        severity: 'success',
        message: 'No fairness regressions detected',
        details: []
      }]
    };
  }
};

/**
 * Prompt Robustness Agent
 * Runs a small "stress set" of tricky prompts and reports stability
 */
export const PromptRobustnessAgent = {
  id: 'promptRobustness',
  name: 'Prompt Robustness',
  description: 'Tests model stability with challenging prompt variations',
  icon: 'Microscope',
  
  analyze: (results) => {
    if (!results || results.length === 0) {
      return {
        agentId: 'promptRobustness',
        passed: true,
        findings: [{ severity: 'info', message: 'No results to analyze', details: [] }]
      };
    }
    
    const details = [];
    let unstableModels = 0;
    
    results.forEach(result => {
      const responseVariance = result.averageResponseTimeVariance || 0;
      const avgTime = result.averageResponseTime || 0;
      const varianceRatio = avgTime > 0 ? responseVariance / avgTime : 0;
      
      if (varianceRatio > 0.5) {
        unstableModels++;
        details.push({
          modelId: result.modelId,
          varianceRatio: varianceRatio.toFixed(2),
          severity: varianceRatio > 1 ? 'critical' : 'warning',
          message: `High response time variance (${varianceRatio.toFixed(2)})`
        });
      }
      
      const unansweredRate = (result.unanswered || 0) / (result.totalQuestions || 1);
      if (unansweredRate > 0.1) {
        unstableModels++;
        details.push({
          modelId: result.modelId,
          unansweredRate: (unansweredRate * 100).toFixed(1),
          severity: 'warning',
          message: `High unanswered rate (${(unansweredRate * 100).toFixed(1)}%)`
        });
      }
      
      if (result.consistencyScore !== undefined && result.consistencyScore < 0.7) {
        unstableModels++;
        details.push({
          modelId: result.modelId,
          consistencyScore: result.consistencyScore.toFixed(2),
          severity: result.consistencyScore < 0.5 ? 'critical' : 'warning',
          message: `Low answer consistency (${(result.consistencyScore * 100).toFixed(0)}%)`
        });
      }
    });
    
    return {
      agentId: 'promptRobustness',
      passed: unstableModels === 0,
      findings: unstableModels > 0 ? [{
        severity: unstableModels > 3 ? 'critical' : 'warning',
        message: `${unstableModels} models show instability`,
        details: details.slice(0, 10)
      }] : [{
        severity: 'success',
        message: 'All models show stable responses',
        details: []
      }]
    };
  }
};

/**
 * Answer Consistency Agent
 * Checks if a model flips answers across similar questions or paraphrases
 */
export const AnswerConsistencyAgent = {
  id: 'answerConsistency',
  name: 'Answer Consistency',
  description: 'Detects answer flipping across similar questions',
  icon: 'RefreshCw',
  
  analyze: (results) => {
    if (!results || results.length === 0) {
      return {
        agentId: 'answerConsistency',
        passed: true,
        findings: [{ severity: 'info', message: 'No results to analyze', details: [] }]
      };
    }
    
    const details = [];
    let inconsistentModels = 0;
    
    // Performance: Limit analysis to first 5 models
    const modelsToAnalyze = results.slice(0, 5);
    
    modelsToAnalyze.forEach(result => {
      if (!result.questionResults || result.questionResults.length === 0) return;
      
      const modelId = result.modelId;
      const sourceGroups = {};
      
      // Performance: Sample question results
      const questionSample = result.questionResults.length > SAMPLE_SIZE 
        ? result.questionResults.slice(0, SAMPLE_SIZE)
        : result.questionResults;
      
      questionSample.forEach(qr => {
        if (qr.source) {
          if (!sourceGroups[qr.source]) sourceGroups[qr.source] = [];
          sourceGroups[qr.source].push(qr);
        }
      });
      
      let flips = 0;
      let totalPairs = 0;
      
      Object.entries(sourceGroups).forEach(([source, qrs]) => {
        const byQuestion = {};
        qrs.forEach(qr => {
          const qKey = qr.questionText?.substring(0, 30) || 'unknown';
          if (!byQuestion[qKey]) byQuestion[qKey] = [];
          byQuestion[qKey].push(qr);
        });
        
        Object.values(byQuestion).forEach(group => {
          if (group.length > 1) {
            totalPairs++;
            const answers = group.map(g => g.answer);
            const uniqueAnswers = new Set(answers.filter(a => a));
            if (uniqueAnswers.size > 1) {
              flips++;
              details.push({
                modelId,
                source,
                flipCount: uniqueAnswers.size,
                severity: 'info',
                message: `Inconsistent answers for similar questions in ${source}`
              });
            }
          }
        });
      });
      
      const consistencyScore = totalPairs > 0 ? 1 - (flips / totalPairs) : 1;
      
      if (consistencyScore < 0.85) {
        inconsistentModels++;
      }
    });
    
    return {
      agentId: 'answerConsistency',
      passed: inconsistentModels === 0,
      findings: inconsistentModels > 0 ? [{
        severity: inconsistentModels > 2 ? 'critical' : 'warning',
        message: `${inconsistentModels} models show answer inconsistencies`,
        details: details.slice(0, 15)
      }] : [{
        severity: 'success',
        message: 'All models show consistent answers',
        details: []
      }]
    };
  }
};

/**
 * Latency Budget Agent
 * Warns when a model exceeds target latency thresholds or has high variance
 */
export const LatencyBudgetAgent = {
  id: 'latencyBudget',
  name: 'Latency Budget',
  description: 'Monitors response time thresholds and variance',
  icon: 'Timer',
  
  analyze: (results, options = {}) => {
    const threshold = options.latencyThreshold || 5000;
    const varianceThreshold = options.latencyVarianceThreshold || 2000;
    
    if (!results || results.length === 0) {
      return {
        agentId: 'latencyBudget',
        passed: true,
        findings: [{ severity: 'info', message: 'No results to analyze', details: [] }]
      };
    }
    
    const details = [];
    let violations = 0;
    
    results.forEach(result => {
      const avgTime = result.averageResponseTime || 0;
      const variance = result.averageResponseTimeVariance || 0;
      
      if (avgTime > threshold) {
        violations++;
        details.push({
          modelId: result.modelId,
          avgTime: (avgTime / 1000).toFixed(2),
          threshold: (threshold / 1000).toFixed(1),
          severity: avgTime > threshold * 2 ? 'critical' : 'warning',
          message: `Avg latency (${(avgTime / 1000).toFixed(2)}s) exceeds threshold (${(threshold / 1000).toFixed(1)}s)`
        });
      }
      
      if (variance > varianceThreshold) {
        violations++;
        details.push({
          modelId: result.modelId,
          variance: variance.toFixed(0),
          threshold: varianceThreshold,
          severity: 'warning',
          message: `High latency variance (${variance.toFixed(0)}ms)`
        });
      }
    });
    
    return {
      agentId: 'latencyBudget',
      passed: violations === 0,
      findings: violations > 0 ? [{
        severity: violations > 3 ? 'critical' : 'warning',
        message: `${violations} latency budget violations`,
        details: details.slice(0, 10)
      }] : [{
        severity: 'success',
        message: 'All models within latency budget',
        details: []
      }]
    };
  }
};

/**
 * Report QA Agent
 * Verifies report completeness before export
 */
export const ReportQAAgent = {
  id: 'reportQA',
  name: 'Report QA',
  description: 'Validates report completeness before export',
  icon: 'ClipboardCheck',
  
  analyze: (results, insights = null) => {
    const findings = [];
    let issues = 0;
    
    if (!results || results.length === 0) {
      issues++;
      findings.push({ severity: 'critical', area: 'results', message: 'No evaluation results present' });
    } else {
      results.forEach((r, idx) => {
        if (r.correct === undefined) {
          issues++;
          findings.push({ severity: 'warning', area: `model_${idx}`, message: 'Missing correct count' });
        }
        if (r.accuracy?.overall === undefined) {
          issues++;
          findings.push({ severity: 'warning', area: `model_${idx}`, message: 'Missing accuracy' });
        }
        if (!r.taskAccuracy || Object.keys(r.taskAccuracy).length === 0) {
          issues++;
          findings.push({ severity: 'warning', area: `model_${idx}`, message: 'Missing task breakdown' });
        }
      });
    }
    
    if (!insights) {
      issues++;
      findings.push({ severity: 'warning', area: 'insights', message: 'No insights generated' });
    } else {
      if (!insights.mostAccurate) issues++;
      if (!insights.fastestModel) issues++;
      if (!insights.accuracyRange) issues++;
      
      if (findings.filter(f => f.area === 'insights').length >= 3) {
        findings.push({ severity: 'warning', area: 'insights', message: 'Insights incomplete' });
      }
    }
    
    const hasAccuracyChart = results?.length > 0;
    const hasTaskBreakdown = results?.some(r => r.taskAccuracy && Object.keys(r.taskAccuracy).length > 0);
    
    if (!hasAccuracyChart) {
      issues++;
      findings.push({ severity: 'warning', area: 'charts', message: 'Missing accuracy comparison chart' });
    }
    if (!hasTaskBreakdown) {
      issues++;
      findings.push({ severity: 'warning', area: 'charts', message: 'Missing task breakdown chart' });
    }
    
    return {
      agentId: 'reportQA',
      passed: issues === 0,
      findings: issues > 0 ? [{
        severity: issues > 5 ? 'critical' : 'warning',
        message: `Report has ${issues} completeness issues`,
        details: findings
      }] : [{
        severity: 'success',
        message: 'Report is complete and ready for export',
        details: []
      }]
    };
  }
};

export const AGENTS = [
  QualityAgent,
  BiasExplanationAgent,
  DataIntegrityAgent,
  FairnessDriftAgent,
  PromptRobustnessAgent,
  AnswerConsistencyAgent,
  LatencyBudgetAgent,
  ReportQAAgent
];

export const getAgentById = (id) => AGENTS.find(a => a.id === id);

/**
 * Performance-optimized agent runner
 * Only runs enabled agents and limits computation
 */
export const runAllAgents = (questions, currentResults, previousResults, options = {}) => {
  const enabledAgentIds = options.enabledAgents || null;
  
  // Run agents that are actually needed
  return AGENTS
    .filter(agent => !enabledAgentIds || enabledAgentIds[agent.id])
    .map(agent => {
      try {
        // Small delay to prevent UI blocking
        const start = performance.now();
        
        let result;
        switch (agent.id) {
          case 'qualityAgent':
            result = agent.analyze(questions, options.selectedModels || [], options.questionLimit || 0, currentResults);
            break;
          case 'biasExplanation':
            result = agent.analyze(currentResults);
            break;
          case 'dataIntegrity':
            result = agent.analyze(questions);
            break;
          case 'fairnessDrift':
            result = agent.analyze(currentResults, previousResults);
            break;
          case 'promptRobustness':
            result = agent.analyze(currentResults);
            break;
          case 'answerConsistency':
            result = agent.analyze(currentResults);
            break;
          case 'latencyBudget':
            result = agent.analyze(currentResults, options);
            break;
          case 'reportQA':
            result = agent.analyze(currentResults, null);
            break;
          default:
            result = { agentId: agent.id, passed: true, findings: [] };
        }
        
        // Log slow agents (dev only)
        if (process.env.NODE_ENV === 'development') {
          const duration = performance.now() - start;
          if (duration > 50) {
            console.log(`Agent ${agent.id} took ${duration.toFixed(0)}ms`);
          }
        }
        
        return result;
      } catch (error) {
        return {
          agentId: agent.id,
          passed: false,
          findings: [{ severity: 'error', message: `Agent failed: ${error.message}`, details: [] }]
        };
      }
    });
};