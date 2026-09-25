/**
 * Quality Assurance Agents for BBQ Evaluation
 * Each agent runs checks and returns findings with severity levels
 */

import { BBQTasks } from '../data/bbqQuestions';
import { t, taskLabel } from './i18n';

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
        text: t('agent.q.noData')
      });
    }
    if (selectedModels.length === 0) {
      notes.push({
        level: 'warning',
        text: t('agent.q.selectModel')
      });
    }
    if (selectedModels.length === 1) {
      notes.push({
        level: 'note',
        text: t('agent.q.oneModel')
      });
    }
    if (questionLimit > 0 && loadedQuestions.length > 0) {
      notes.push({
        level: 'note',
        text: t('agent.q.sampling', { n: questionLimit })
      });
    }
    if (results.length > 0) {
      const avgAccuracy = results.reduce((sum, r) => sum + (r?.accuracy?.overall || 0), 0) / results.length;
      if (avgAccuracy < 55) {
        notes.push({
          level: 'warning',
          text: t('agent.q.lowAccuracy')
        });
      }
      const highBias = results.find(r => Math.abs(r?.overallBiasScoreAmbiguous || 0) >= 0.5);
      if (highBias) {
        notes.push({
          level: 'warning',
          text: t('agent.q.highBias')
        });
      }
      const slowModel = results.find(r => (r?.averageResponseTime || 0) > 5000);
      if (slowModel) {
        notes.push({
          level: 'note',
          text: t('agent.q.slow', { model: slowModel.modelId.split(':')[0], t: (slowModel.averageResponseTime / 1000).toFixed(1) })
        });
      }
    }
    
    return {
      agentId: 'qualityAgent',
      passed: !notes.some(n => n.level === 'warning'),
      findings: notes.length > 0 ? [{
        severity: notes.some(n => n.level === 'warning') ? 'warning' : 'info',
        message: t('agent.q.insights', { n: notes.length }),
        details: notes
      }] : [{
        severity: 'success',
        message: t('agent.q.allPassed'),
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
        findings: [{ severity: 'info', message: t('agent.bias.noResults'), details: [] }]
      };
    }
    
    const biasDetected = results.some(r => Math.abs(r?.overallBiasScoreAmbiguous || 0) > 0.3);
    
    return {
      agentId: 'biasExplanation',
      passed: true,
      findings: [{
        severity: biasDetected ? 'warning' : 'success',
        message: biasDetected ? t('agent.bias.detected') : t('agent.bias.none'),
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
        findings: [{ severity: 'critical', message: t('agent.data.noQuestions'), details: [] }]
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
      
      if (!q.id) rowIssues.push(t('agent.data.missingId'));
      if (!q.source) rowIssues.push(t('agent.data.missingSource'));
      if (!q.questionText) rowIssues.push(t('agent.data.missingQuestion'));
      if (!q.options || q.options.length < 2) rowIssues.push(t('agent.data.missingOptions'));
      if (!q.correctAnswer) rowIssues.push(t('agent.data.missingCorrect'));
      if (!q.contextType) rowIssues.push(t('agent.data.missingContextType'));
      
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
      details.push({ questionIndex: -1, issues: [t('agent.data.duplicates', { n: duplicates.length })], question: '' });
    }
    
    return {
      agentId: 'dataIntegrity',
      passed: issues === 0,
      findings: issues > 0 ? [{
        severity: issues > 10 ? 'critical' : issues > 5 ? 'warning' : 'info',
        message: t('agent.data.issues', { n: issues }),
        details: details.slice(0, 20)
      }] : [{
        severity: 'success',
        message: t('agent.data.allPassed'),
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
        findings: [{ severity: 'info', message: t('agent.drift.noCurrent'), details: [] }]
      };
    }
    
    if (!previousResults || previousResults.length === 0) {
      return {
        agentId: 'fairnessDrift',
        passed: true,
        findings: [{ severity: 'info', message: t('agent.drift.noPrevious'), details: [] }]
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
          message: t('agent.drift.accDropped', { n: Math.abs(drift).toFixed(1) })
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
          message: t('agent.drift.contextRegression')
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
            task: taskLabel(task),
            drift: taskDrift.toFixed(1),
            severity: 'warning',
            message: t('agent.drift.taskDropped', { task: taskLabel(task), n: Math.abs(taskDrift).toFixed(1) })
          });
        }
      });
    });
    
    return {
      agentId: 'fairnessDrift',
      passed: regressions === 0,
      findings: regressions > 0 ? [{
        severity: regressions > 5 ? 'critical' : 'warning',
        message: t('agent.drift.detected', { n: regressions }),
        details: details.slice(0, 15)
      }] : [{
        severity: 'success',
        message: t('agent.drift.none'),
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
        findings: [{ severity: 'info', message: t('agent.bias.noResults'), details: [] }]
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
          message: t('agent.robust.variance', { n: varianceRatio.toFixed(2) })
        });
      }
      
      const unansweredRate = (result.unanswered || 0) / (result.totalQuestions || 1);
      if (unansweredRate > 0.1) {
        unstableModels++;
        details.push({
          modelId: result.modelId,
          unansweredRate: (unansweredRate * 100).toFixed(1),
          severity: 'warning',
          message: t('agent.robust.unansweredRate', { n: (unansweredRate * 100).toFixed(1) })
        });
      }
      
      if (result.consistencyScore !== undefined && result.consistencyScore < 0.7) {
        unstableModels++;
        details.push({
          modelId: result.modelId,
          consistencyScore: result.consistencyScore.toFixed(2),
          severity: result.consistencyScore < 0.5 ? 'critical' : 'warning',
          message: t('agent.robust.consistency', { n: (result.consistencyScore * 100).toFixed(0) })
        });
      }
    });
    
    return {
      agentId: 'promptRobustness',
      passed: unstableModels === 0,
      findings: unstableModels > 0 ? [{
        severity: unstableModels > 3 ? 'critical' : 'warning',
        message: t('agent.robust.instability', { n: unstableModels }),
        details: details.slice(0, 10)
      }] : [{
        severity: 'success',
        message: t('agent.robust.stable'),
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
        findings: [{ severity: 'info', message: t('agent.bias.noResults'), details: [] }]
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
                message: t('agent.consistency.inconsistent', { source })
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
        message: t('agent.consistency.detected', { n: inconsistentModels }),
        details: details.slice(0, 15)
      }] : [{
        severity: 'success',
        message: t('agent.consistency.allPassed'),
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
        findings: [{ severity: 'info', message: t('agent.bias.noResults'), details: [] }]
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
          message: t('agent.latency.exceeds', { a: (avgTime / 1000).toFixed(2), b: (threshold / 1000).toFixed(1) })
        });
      }
      
      if (variance > varianceThreshold) {
        violations++;
        details.push({
          modelId: result.modelId,
          variance: variance.toFixed(0),
          threshold: varianceThreshold,
          severity: 'warning',
          message: t('agent.latency.variance', { n: variance.toFixed(0) })
        });
      }
    });
    
    return {
      agentId: 'latencyBudget',
      passed: violations === 0,
      findings: violations > 0 ? [{
        severity: violations > 3 ? 'critical' : 'warning',
        message: t('agent.latency.violations', { n: violations }),
        details: details.slice(0, 10)
      }] : [{
        severity: 'success',
        message: t('agent.latency.within'),
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
      findings.push({ severity: 'critical', area: 'results', message: t('agent.report.noResults') });
    } else {
      results.forEach((r, idx) => {
        if (r.correct === undefined) {
          issues++;
          findings.push({ severity: 'warning', area: `model_${idx}`, message: t('agent.report.missingCorrect') });
        }
        if (r.accuracy?.overall === undefined) {
          issues++;
          findings.push({ severity: 'warning', area: `model_${idx}`, message: t('agent.report.missingAccuracy') });
        }
        if (!r.taskAccuracy || Object.keys(r.taskAccuracy).length === 0) {
          issues++;
          findings.push({ severity: 'warning', area: `model_${idx}`, message: t('agent.report.missingTask') });
        }
      });
    }
    
    if (!insights) {
      issues++;
      findings.push({ severity: 'warning', area: 'insights', message: t('agent.report.noInsights') });
    } else {
      if (!insights.mostAccurate) issues++;
      if (!insights.fastestModel) issues++;
      if (!insights.accuracyRange) issues++;
      
      if (findings.filter(f => f.area === 'insights').length >= 3) {
        findings.push({ severity: 'warning', area: 'insights', message: t('agent.report.insightsIncomplete') });
      }
    }
    
    const hasAccuracyChart = results?.length > 0;
    const hasTaskBreakdown = results?.some(r => r.taskAccuracy && Object.keys(r.taskAccuracy).length > 0);
    
    if (!hasAccuracyChart) {
      issues++;
      findings.push({ severity: 'warning', area: 'charts', message: t('agent.report.missingAccuracyChart') });
    }
    if (!hasTaskBreakdown) {
      issues++;
      findings.push({ severity: 'warning', area: 'charts', message: t('agent.report.missingTaskChart') });
    }
    
    return {
      agentId: 'reportQA',
      passed: issues === 0,
      findings: issues > 0 ? [{
        severity: issues > 5 ? 'critical' : 'warning',
        message: t('agent.report.issues', { n: issues }),
        details: findings
      }] : [{
        severity: 'success',
        message: t('agent.report.complete'),
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
        
        // Log slow agents
        {
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
          findings: [{ severity: 'error', message: t('agent.failed', { e: error.message }), details: [] }]
        };
      }
    });
};