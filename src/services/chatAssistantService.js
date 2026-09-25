/**
 * Chat Assistant Service for BBQ Evaluation Results
 * Provides intelligent responses about evaluation results, insights, and recommendations
 */

import { TaskLabels } from '../data/bbqQuestions';
import { calculateInsights, generateComparison } from './evaluationEngine';
import { t, taskLabel } from './i18n';

/**
 * Message types for chat
 */
export const MessageTypes = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system'
};

/**
 * Context about the current evaluation
 */
let evaluationContext = {
  results: null,
  insights: null,
  comparison: null,
  questions: []
};

/**
 * Set the evaluation context for the chat assistant
 */
export const setEvaluationContext = (results, questions = []) => {
  evaluationContext.results = results;
  evaluationContext.questions = questions;
  evaluationContext.insights = results?.length ? calculateInsights(results) : null;
  evaluationContext.comparison = results?.length ? generateComparison(results) : null;
};

/**
 * Get current evaluation context
 */
export const getEvaluationContext = () => evaluationContext;

/**
 * Analyze a user query and generate a contextual response
 */
export const processUserQuery = (query) => {
  const lowerQuery = query.toLowerCase().trim();
  
  if (!evaluationContext.results || evaluationContext.results.length === 0) {
    return {
      type: MessageTypes.ASSISTANT,
      content: t('chat.noResults'),
      suggestions: [t('chat.suggest.runEval'), t('chat.suggest.whatIsBBQ')]
    };
  }

  const { results, insights, comparison } = evaluationContext;

  // Check for specific question patterns
  if (lowerQuery.includes('best') || lowerQuery.includes('top')) {
    return handleBestModelQuery(insights, results);
  }
  
  if (lowerQuery.includes('worst') || lowerQuery.includes('lowest')) {
    return handleWorstModelQuery(insights, results);
  }
  
  if (lowerQuery.includes('bias') || lowerQuery.includes('fair')) {
    return handleBiasQuery(insights);
  }
  
  if (lowerQuery.includes('accuracy') || lowerQuery.includes('score')) {
    return handleAccuracyQuery(insights);
  }
  
  if (lowerQuery.includes('speed') || lowerQuery.includes('fast') || lowerQuery.includes('latency')) {
    return handleSpeedQuery(insights, results);
  }
  
  if (lowerQuery.includes('task') || lowerQuery.includes('category')) {
    return handleTaskQuery(insights, results, lowerQuery);
  }
  
  if (lowerQuery.includes('compare') || lowerQuery.includes('difference')) {
    return handleComparisonQuery(comparison, results);
  }
  
  if (lowerQuery.includes('recommend') || lowerQuery.includes('suggest') || lowerQuery.includes('advice')) {
    return handleRecommendationQuery(insights);
  }
  
  if (lowerQuery.includes('improve') || lowerQuery.includes('better')) {
    return handleImprovementQuery();
  }
  
  if (lowerQuery.includes('summary') || lowerQuery.includes('overview')) {
    return handleSummaryQuery(insights, results);
  }
  
  if (lowerQuery.includes('risk') || lowerQuery.includes('concern')) {
    return handleRiskQuery(insights, results);
  }

  // Default response with helpful suggestions
  return {
    type: MessageTypes.ASSISTANT,
    content: t('chat.resultsCount', { n: results.length }),
    suggestions: [
      t('chat.s.best'),
      t('chat.s.bias'),
      t('chat.s.concerns'),
      t('chat.s.recs'),
      t('chat.s.compare')
    ]
  };
};

/**
 * Handle queries about the best performing model
 */
const handleBestModelQuery = (insights) => {
  const bestModel = insights?.mostAccurate;
  const fastestModel = insights?.fastestModel;
  const leastBiased = insights?.leastBiased;
  
  let content = "";
  
  if (bestModel) {
    content += t('chat.best.title', { model: bestModel.modelId, acc: bestModel.accuracy.toFixed(1) });
  }
  
  if (fastestModel && fastestModel.modelId !== bestModel?.modelId) {
    content += t('chat.best.fastest', { model: fastestModel.modelId, t: (fastestModel.avgTime / 1000).toFixed(2) });
  }
  
  if (leastBiased && leastBiased.modelId !== bestModel?.modelId) {
    content += t('chat.best.leastBiased', { model: leastBiased.modelId, score: leastBiased.biasScore.toFixed(2), interp: leastBiased.interpretation });
  }
  
  return {
    type: MessageTypes.ASSISTANT,
    content: content || t('chat.best.none'),
    suggestions: [t('chat.s.worst'), t('chat.s.bias'), t('chat.s.recs')]
  };
};

/**
 * Handle queries about the worst performing model
 */
const handleWorstModelQuery = (insights, results) => {
  const sortedByAccuracy = [...results].sort((a, b) => (a.accuracy?.overall || 0) - (b.accuracy?.overall || 0));
  const worstModel = sortedByAccuracy[0];
  const mostBiased = insights?.mostBiased;
  
  let content = "";
  
  if (worstModel) {
    content += t('chat.worst.title', { model: worstModel.modelId, acc: (worstModel.accuracy?.overall || 0).toFixed(1) });
  }
  
  if (mostBiased) {
    content += t('chat.worst.biased', { model: mostBiased.modelId, interp: mostBiased.interpretation, score: mostBiased.biasScore.toFixed(2) });
  }
  
  return {
    type: MessageTypes.ASSISTANT,
    content: content || t('chat.worst.none'),
    suggestions: [t('chat.s.best'), t('chat.s.improve'), t('chat.s.risk')]
  };
};

/**
 * Handle bias-related queries
 */
const handleBiasQuery = (insights) => {
  const { biasRange, leastBiased, mostBiased } = insights || {};
  
  let content = t('chat.bias.header');
  
  if (biasRange) {
    content += t('chat.bias.range', { min: biasRange.min.toFixed(2), max: biasRange.max.toFixed(2), spread: biasRange.spread.toFixed(2) });
  }
  
  if (leastBiased) {
    content += t('chat.bias.least', { model: leastBiased.modelId, score: leastBiased.biasScore.toFixed(2), interp: leastBiased.interpretation });
  }
  
  if (mostBiased) {
    content += t('chat.bias.most', { model: mostBiased.modelId, score: mostBiased.biasScore.toFixed(2), interp: mostBiased.interpretation });
  }
  
  // Add task-level bias insights
  const taskInsights = insights?.taskInsights || [];
  const biasedTasks = taskInsights.filter(t => Math.abs(t.averageBias) > 0.2);
  
  if (biasedTasks.length > 0) {
    content += t('chat.bias.tasks');
    biasedTasks.slice(0, 5).forEach(task => {
      const direction = task.averageBias > 0 ? t('chat.bias.pro') : t('chat.bias.counter');
      content += `- ${taskLabel(task.task)}: ${task.averageBias.toFixed(2)} (${direction})\n`;
    });
  }
  
  return {
    type: MessageTypes.ASSISTANT,
    content: content || t('chat.bias.none'),
    suggestions: [t('chat.s.biasDef'), t('chat.s.reduceBias'), t('chat.s.accspeed')]
  };
};

/**
 * Handle accuracy-related queries
 */
const handleAccuracyQuery = (insights) => {
  const { accuracyRange, mostAccurate, taskInsights } = insights || {};
  
  let content = t('chat.acc.header');
  
  if (accuracyRange) {
    content += t('chat.acc.range', { min: accuracyRange.min.toFixed(1), max: accuracyRange.max.toFixed(1) });
    content += t('chat.acc.spread', { n: accuracyRange.spread.toFixed(1) });
  }
  
  if (mostAccurate) {
    content += t('chat.acc.highest', { model: mostAccurate.modelId, acc: mostAccurate.accuracy.toFixed(1) });
  }
  
  // Task difficulty analysis
  if (taskInsights?.length > 0) {
    const hardTasks = taskInsights.filter(t => t.difficulty === 'Hard');
    const easyTasks = taskInsights.filter(t => t.difficulty === 'Easy');
    
    if (hardTasks.length > 0) {
      content += t('chat.acc.hardTasks');
      hardTasks.slice(0, 3).forEach(task => {
        content += t('chat.acc.taskLine', { task: taskLabel(task.task), acc: task.averageAccuracy.toFixed(1) });
      });
      content += "\n";
    }
    
    if (easyTasks.length > 0) {
      content += t('chat.acc.easyTasks');
      easyTasks.slice(0, 3).forEach(task => {
        content += t('chat.acc.taskLine', { task: taskLabel(task.task), acc: task.averageAccuracy.toFixed(1) });
      });
    }
  }
  
  return {
    type: MessageTypes.ASSISTANT,
    content: content || t('chat.acc.none'),
    suggestions: [t('chat.s.weak'), t('chat.s.compare'), t('chat.s.breakdown')]
  };
};

/**
 * Handle speed/latency queries
 */
const handleSpeedQuery = (insights, results) => {
  const { fastestModel } = insights || {};
  
  // Calculate speed stats
  const responseTimes = results.map(r => r.averageResponseTime || 0).filter(t => t > 0);
  const avgTime = responseTimes.length > 0 
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
    : 0;
  
  let content = t('chat.speed.header');
  
  if (fastestModel) {
    content += t('chat.speed.fastest', { model: fastestModel.modelId });
    content += t('chat.speed.avg', { t: (fastestModel.avgTime / 1000).toFixed(2) });
  }
  
  content += t('chat.speed.overall', { t: (avgTime / 1000).toFixed(2) });
  
  // Sort by speed
  const sortedBySpeed = [...results].sort((a, b) => 
    (a.averageResponseTime || Infinity) - (b.averageResponseTime || Infinity)
  );
  
  content += t('chat.speed.ranking');
  sortedBySpeed.slice(0, 5).forEach((model, idx) => {
    const time = (model.averageResponseTime || 0) / 1000;
    content += `${idx + 1}. ${model.modelId}: ${time.toFixed(2)}s\n`;
  });
  
  return {
    type: MessageTypes.ASSISTANT,
    content: content,
    suggestions: [t('chat.s.speed'), t('chat.s.accspeed'), t('chat.s.allMetrics')]
  };
};

/**
 * Handle task/category-specific queries
 */
const handleTaskQuery = (insights, results, query) => {
  const taskInsights = insights?.taskInsights || [];
  
  // Try to find a specific task mentioned
  const taskNames = Object.values(TaskLabels);
  const mentionedTask = taskNames.find(task => query.toLowerCase().includes(task.toLowerCase())
    || query.toLowerCase().includes(taskLabel(task).toLowerCase()));
  
  if (mentionedTask) {
    const taskData = taskInsights.find(t => t.task === mentionedTask);
    if (taskData) {
      return {
        type: MessageTypes.ASSISTANT,
        content: t('chat.task.analysis', { task: mentionedTask }) +
          t('chat.task.avgAcc', { v: taskData.averageAccuracy.toFixed(1) }) +
          t('chat.task.difficulty', { v: taskData.difficulty }) +
          t('chat.task.avgBias', { v: taskData.averageBias.toFixed(2), interp: taskData.biasInterpretation }) +
          t('chat.task.bestModel', { model: taskData.bestModel, acc: taskData.bestAccuracy.toFixed(1) }) +
          t('chat.task.weakModel', { model: taskData.worstModel, acc: taskData.worstAccuracy.toFixed(1) }),
        suggestions: [t('chat.s.tasks'), t('chat.s.hardestTask'), t('chat.s.recs')]
      };
    }
  }
  
  // Show all tasks summary
  let content = t('chat.task.summaryHeader');
  
  const sortedByDifficulty = [...taskInsights].sort((a, b) => a.averageAccuracy - b.averageAccuracy);
  
  content += t('chat.task.tableHeader');
  
  sortedByDifficulty.forEach(task => {
    content += `| ${taskLabel(task.task)} | ${task.averageAccuracy.toFixed(1)}% | ${t(`difficulty.${task.difficulty}`)} | ${task.averageBias.toFixed(2)} |\n`;
  });
  
  return {
    type: MessageTypes.ASSISTANT,
    content: content,
    suggestions: [t('chat.s.mostBias'), t('chat.s.hardAnalysis'), t('chat.s.howImprove')]
  };
};

/**
 * Handle comparison queries
 */
const handleComparisonQuery = (comparison, results) => {
  if (!comparison || results.length < 2) {
    return {
      type: MessageTypes.ASSISTANT,
      content: t('chat.comp.needTwo'),
      suggestions: [t('chat.s.addModels'), t('chat.s.single'), t('chat.s.metrics')]
    };
  }
  
  const sortedByAccuracy = [...results].sort((a, b) => 
    (b.accuracy?.overall || 0) - (a.accuracy?.overall || 0)
  );
  
  const best = sortedByAccuracy[0];
  const worst = sortedByAccuracy[sortedByAccuracy.length - 1];
  const accuracyDiff = (best.accuracy?.overall || 0) - (worst.accuracy?.overall || 0);
  
  let content = t('chat.comp.header');
  
  content += t('chat.comp.gap', { n: accuracyDiff.toFixed(1) });
  
  content += t('chat.comp.ranking');
  sortedByAccuracy.forEach((model, idx) => {
    const acc = model.accuracy?.overall || 0;
    const bias = model.overallBiasScore || 0;
    content += `${idx + 1}. **${model.modelId}**\n`;
    content += `   - Accuracy: ${acc.toFixed(1)}%\n`;
    content += `   - Bias: ${bias.toFixed(2)}\n`;
    content += `   - Avg Time: ${((model.averageResponseTime || 0) / 1000).toFixed(2)}s\n\n`;
  });
  
  return {
    type: MessageTypes.ASSISTANT,
    content: content,
    suggestions: [t('chat.s.choose'), t('chat.s.tradeoff'), t('chat.s.breakdown')]
  };
};

/**
 * Handle recommendation queries
 */
const handleRecommendationQuery = (insights) => {
  const { mostAccurate, leastBiased, fastestModel, taskInsights } = insights || {};
  
  let content = t('chat.rec.header');
  
  // Primary recommendation
  content += t('chat.rec.primary');
  if (mostAccurate && leastBiased) {
    if (mostAccurate.modelId === leastBiased.modelId) {
      content += t('chat.rec.bestChoice', { model: mostAccurate.modelId, acc: mostAccurate.accuracy.toFixed(1), bias: leastBiased.biasScore.toFixed(2) });
    } else {
      content += t('chat.rec.forAccuracy', { model: mostAccurate.modelId, acc: mostAccurate.accuracy.toFixed(1) });
      content += t('chat.rec.forFairness', { model: leastBiased.modelId, bias: leastBiased.biasScore.toFixed(2) });
    }
  }
  
  // Speed consideration
  if (fastestModel) {
    content += t('chat.rec.forSpeed', { model: fastestModel.modelId, t: (fastestModel.avgTime / 1000).toFixed(2) });
  }
  
  // Areas for improvement
  const hardTasks = taskInsights?.filter(t => t.difficulty === 'Hard') || [];
  if (hardTasks.length > 0) {
    content += t('chat.rec.attention');
    content += t('chat.rec.focus');
    hardTasks.slice(0, 3).forEach(task => {
      content += t('chat.rec.taskAcc', { task: taskLabel(task.task), acc: task.averageAccuracy.toFixed(1) });
    });
    content += "\n";
  }
  
  // Bias concerns
  const biasedTasks = taskInsights?.filter(t => Math.abs(t.averageBias) > 0.3) || [];
  if (biasedTasks.length > 0) {
    content += t('chat.rec.biasConcerns');
    content += t('chat.rec.biasIntro');
    biasedTasks.forEach(task => {
      content += t('chat.rec.biasTask', { task: taskLabel(task.task), bias: task.averageBias.toFixed(2), interp: task.biasInterpretation });
    });
  }
  
  return {
    type: MessageTypes.ASSISTANT,
    content: content,
    suggestions: [t('chat.s.reduceBias'), t('chat.s.improveAcc'), t('chat.s.meaning')]
  };
};

/**
 * Handle improvement queries
 */
const handleImprovementQuery = () => {
  let content = t('chat.improve.header');
  
  content += t('chat.improve.accTitle');
  content += t('chat.improve.acc1');
  content += t('chat.improve.acc2');
  content += t('chat.improve.acc3');
  content += t('chat.improve.acc4');
  
  content += t('chat.improve.biasTitle');
  content += t('chat.improve.bias1');
  content += t('chat.improve.bias2');
  content += t('chat.improve.bias3');
  content += t('chat.improve.bias4');
  
  content += t('chat.improve.speedTitle');
  content += t('chat.improve.speed1');
  content += t('chat.improve.speed2');
  content += t('chat.improve.speed3');
  content += t('chat.improve.speed4');
  
  return {
    type: MessageTypes.ASSISTANT,
    content: content,
    suggestions: [t('chat.s.weak'), t('chat.s.biasDef'), t('chat.s.summary')]
  };
};

/**
 * Handle summary queries
 */
const handleSummaryQuery = (insights, results) => {
  const { mostAccurate, leastBiased, fastestModel, accuracyRange, taskInsights } = insights || {};
  
  let content = t('chat.summary.header');
  
  content += t('chat.summary.models', { n: results.length });
  content += t('chat.summary.questionsPer', { n: results[0]?.totalQuestions || t('chart.na') });
  content += t('chat.summary.accRange', { a: accuracyRange?.min.toFixed(1) || 0, b: accuracyRange?.max.toFixed(1) || 0 });
  
  content += t('chat.summary.top');
  if (mostAccurate) {
    content += t('chat.summary.mostAcc', { model: mostAccurate.modelId, acc: mostAccurate.accuracy.toFixed(1) });
  }
  if (fastestModel) {
    content += t('chat.summary.fastest', { model: fastestModel.modelId, t: (fastestModel.avgTime / 1000).toFixed(2) });
  }
  if (leastBiased) {
    content += t('chat.summary.leastBiased', { model: leastBiased.modelId, bias: leastBiased.biasScore.toFixed(2) });
  }
  
  content += t('chat.summary.taskPerf');
  const sortedTasks = [...(taskInsights || [])].sort((a, b) => a.averageAccuracy - b.averageAccuracy);
  sortedTasks.slice(0, 5).forEach(task => {
    const emoji = task.difficulty === 'Hard' ? '🔴' : task.difficulty === 'Medium' ? '🟡' : '🟢';
    content += `${emoji} ${taskLabel(task.task)}: ${task.averageAccuracy.toFixed(1)}%\n`;
  });
  
  return {
    type: MessageTypes.ASSISTANT,
    content: content,
    suggestions: [t('chat.s.detailed'), t('chat.s.risks'), t('chat.s.recs')]
  };
};

/**
 * Handle risk/concern queries
 */
const handleRiskQuery = (insights, results) => {
  let content = t('chat.risk.header');
  
  // High bias models
  const highBiasModels = results.filter(r => Math.abs(r.overallBiasScore || 0) >= 0.5);
  if (highBiasModels.length > 0) {
    content += t('chat.risk.highBias');
    content += t('chat.risk.highBiasIntro');
    highBiasModels.forEach(model => {
      content += `- **${model.modelId}**: ${(model.overallBiasScore || 0).toFixed(2)}\n`;
    });
    content += "\n";
  }
  
  // Low accuracy models
  const lowAccuracyModels = results.filter(r => (r.accuracy?.overall || 0) < 50);
  if (lowAccuracyModels.length > 0) {
    content += t('chat.risk.lowAcc');
    content += t('chat.risk.lowAccIntro');
    lowAccuracyModels.forEach(model => {
      content += `- **${model.modelId}**: ${(model.accuracy?.overall || 0).toFixed(1)}%\n`;
    });
    content += "\n";
  }
  
  // Slow models
  const slowModels = results.filter(r => (r.averageResponseTime || 0) > 5000);
  if (slowModels.length > 0) {
    content += t('chat.risk.slow');
    content += t('chat.risk.slowIntro');
    slowModels.forEach(model => {
      content += `- **${model.modelId}**: ${((model.averageResponseTime || 0) / 1000).toFixed(2)}s\n`;
    });
    content += "\n";
  }
  
  // Task-specific risks
  const { taskInsights } = insights || {};
  const riskyTasks = taskInsights?.filter(t => t.averageAccuracy < 50 || Math.abs(t.averageBias) > 0.4) || [];
  if (riskyTasks.length > 0) {
    content += t('chat.risk.taskConcerns');
    riskyTasks.forEach(task => {
      content += t('chat.risk.taskLine', { task: taskLabel(task.task), acc: task.averageAccuracy.toFixed(1), bias: task.averageBias.toFixed(2) });
    });
  }
  
  if (highBiasModels.length === 0 && lowAccuracyModels.length === 0 && slowModels.length === 0 && riskyTasks.length === 0) {
    content += t('chat.risk.none');
  }
  
  return {
    type: MessageTypes.ASSISTANT,
    content: content,
    suggestions: [t('chat.s.mitigate'), t('chat.s.recs'), t('chat.s.compare')]
  };
};

/**
 * Get suggested questions for the user
 */
export const getSuggestedQuestions = () => {
  return [
    t('chat.s.best'),
    t('chat.s.bias'),
    t('chat.s.concerns'),
    t('chat.s.recs'),
    t('chat.s.compare'),
    t('chat.s.hardest'),
    t('chat.s.improve'),
    t('chat.s.summary')
  ];
};

/**
 * Format message content with markdown-like styling
 */
export const formatMessageContent = (content) => {
  // Convert markdown-style formatting to HTML
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/## (.*)/g, '<h3>$1</h3>')
    .replace(/### (.*)/g, '<h4>$1</h4>')
    .replace(/- (.*)/g, '• $1')
    .replace(/\n/g, '<br/>');
};
