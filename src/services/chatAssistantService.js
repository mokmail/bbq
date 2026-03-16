/**
 * Chat Assistant Service for BBQ Evaluation Results
 * Provides intelligent responses about evaluation results, insights, and recommendations
 */

import { TaskLabels } from '../data/bbqQuestions';
import { calculateInsights, interpretBiasScore, generateComparison } from './evaluationEngine';

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
      content: "I don't have any evaluation results to analyze yet. Please run an evaluation first, and then I'll be able to answer your questions about the results.",
      suggestions: ["How do I run an evaluation?", "What is BBQ benchmark?"]
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
    return handleBiasQuery(insights, results);
  }
  
  if (lowerQuery.includes('accuracy') || lowerQuery.includes('score')) {
    return handleAccuracyQuery(insights, results);
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
    return handleRecommendationQuery(insights, results);
  }
  
  if (lowerQuery.includes('improve') || lowerQuery.includes('better')) {
    return handleImprovementQuery(insights, results);
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
    content: `I can help you understand your BBQ evaluation results. You have ${results.length} model(s) evaluated. What would you like to know?`,
    suggestions: [
      "Which model performed best?",
      "Show me bias analysis",
      "What are the main concerns?",
      "Give me recommendations",
      "Compare all models"
    ]
  };
};

/**
 * Handle queries about the best performing model
 */
const handleBestModelQuery = (insights, results) => {
  const bestModel = insights?.mostAccurate;
  const fastestModel = insights?.fastestModel;
  const leastBiased = insights?.leastBiased;
  
  let content = "";
  
  if (bestModel) {
    content += `**Best Overall Performance:** ${bestModel.modelId} achieved the highest accuracy of **${bestModel.accuracy.toFixed(1)}%**.\n\n`;
  }
  
  if (fastestModel && fastestModel.modelId !== bestModel?.modelId) {
    content += `**Fastest Model:** ${fastestModel.modelId} with an average response time of **${(fastestModel.avgTime / 1000).toFixed(2)}s**.\n\n`;
  }
  
  if (leastBiased && leastBiased.modelId !== bestModel?.modelId) {
    content += `**Least Biased:** ${leastBiased.modelId} with a bias score of **${leastBiased.biasScore.toFixed(2)}** (${leastBiased.interpretation}).`;
  }
  
  return {
    type: MessageTypes.ASSISTANT,
    content: content || "I couldn't determine the best model from the current results.",
    suggestions: ["What about the worst model?", "Show bias analysis", "Give me recommendations"]
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
    content += `**Lowest Accuracy:** ${worstModel.modelId} achieved **${(worstModel.accuracy?.overall || 0).toFixed(1)}%** accuracy.\n\n`;
  }
  
  if (mostBiased) {
    content += `**Highest Bias:** ${mostBiased.modelId} shows **${mostBiased.interpretation}** with a score of **${mostBiased.biasScore.toFixed(2)}**.`;
  }
  
  return {
    type: MessageTypes.ASSISTANT,
    content: content || "I couldn't determine the worst performing model from the current results.",
    suggestions: ["Which model is best?", "How can I improve results?", "Show risk analysis"]
  };
};

/**
 * Handle bias-related queries
 */
const handleBiasQuery = (insights, results) => {
  const { biasRange, leastBiased, mostBiased } = insights || {};
  
  let content = "## Bias Analysis\n\n";
  
  if (biasRange) {
    content += `**Bias Score Range:** ${biasRange.min.toFixed(2)} to ${biasRange.max.toFixed(2)} (spread: ${biasRange.spread.toFixed(2)})\n\n`;
  }
  
  if (leastBiased) {
    content += `✅ **Least Biased:** ${leastBiased.modelId} (${leastBiased.biasScore.toFixed(2)} - ${leastBiased.interpretation})\n`;
  }
  
  if (mostBiased) {
    content += `⚠️ **Most Biased:** ${mostBiased.modelId} (${mostBiased.biasScore.toFixed(2)} - ${mostBiased.interpretation})\n\n`;
  }
  
  // Add task-level bias insights
  const taskInsights = insights?.taskInsights || [];
  const biasedTasks = taskInsights.filter(t => Math.abs(t.averageBias) > 0.2);
  
  if (biasedTasks.length > 0) {
    content += "**Tasks with Notable Bias:**\n";
    biasedTasks.slice(0, 5).forEach(task => {
      const direction = task.averageBias > 0 ? "pro-stereotype" : "counter-stereotype";
      content += `- ${task.task}: ${task.averageBias.toFixed(2)} (${direction})\n`;
    });
  }
  
  return {
    type: MessageTypes.ASSISTANT,
    content: content || "No significant bias data available.",
    suggestions: ["What does bias score mean?", "How to reduce bias?", "Show accuracy analysis"]
  };
};

/**
 * Handle accuracy-related queries
 */
const handleAccuracyQuery = (insights, results) => {
  const { accuracyRange, mostAccurate, taskInsights } = insights || {};
  
  let content = "## Accuracy Analysis\n\n";
  
  if (accuracyRange) {
    content += `**Accuracy Range:** ${accuracyRange.min.toFixed(1)}% to ${accuracyRange.max.toFixed(1)}%\n`;
    content += `**Spread:** ${accuracyRange.spread.toFixed(1)} percentage points\n\n`;
  }
  
  if (mostAccurate) {
    content += `🏆 **Highest Accuracy:** ${mostAccurate.modelId} with **${mostAccurate.accuracy.toFixed(1)}%**\n\n`;
  }
  
  // Task difficulty analysis
  if (taskInsights?.length > 0) {
    const hardTasks = taskInsights.filter(t => t.difficulty === 'Hard');
    const easyTasks = taskInsights.filter(t => t.difficulty === 'Easy');
    
    if (hardTasks.length > 0) {
      content += "**Most Challenging Tasks:**\n";
      hardTasks.slice(0, 3).forEach(task => {
        content += `- ${task.task}: ${task.averageAccuracy.toFixed(1)}% avg accuracy\n`;
      });
      content += "\n";
    }
    
    if (easyTasks.length > 0) {
      content += "**Easiest Tasks:**\n";
      easyTasks.slice(0, 3).forEach(task => {
        content += `- ${task.task}: ${task.averageAccuracy.toFixed(1)}% avg accuracy\n`;
      });
    }
  }
  
  return {
    type: MessageTypes.ASSISTANT,
    content: content || "No accuracy data available.",
    suggestions: ["Why is accuracy low?", "Compare models", "Show task breakdown"]
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
  
  let content = "## Response Time Analysis\n\n";
  
  if (fastestModel) {
    content += `⚡ **Fastest Model:** ${fastestModel.modelId}\n`;
    content += `**Average Latency:** ${(fastestModel.avgTime / 1000).toFixed(2)}s\n\n`;
  }
  
  content += `**Overall Average:** ${(avgTime / 1000).toFixed(2)}s across all models\n\n`;
  
  // Sort by speed
  const sortedBySpeed = [...results].sort((a, b) => 
    (a.averageResponseTime || Infinity) - (b.averageResponseTime || Infinity)
  );
  
  content += "**Speed Ranking:**\n";
  sortedBySpeed.slice(0, 5).forEach((model, idx) => {
    const time = (model.averageResponseTime || 0) / 1000;
    content += `${idx + 1}. ${model.modelId}: ${time.toFixed(2)}s\n`;
  });
  
  return {
    type: MessageTypes.ASSISTANT,
    content: content,
    suggestions: ["Is speed important?", "Accuracy vs speed trade-off", "Show all metrics"]
  };
};

/**
 * Handle task/category-specific queries
 */
const handleTaskQuery = (insights, results, query) => {
  const taskInsights = insights?.taskInsights || [];
  
  // Try to find a specific task mentioned
  const taskNames = Object.values(TaskLabels);
  const mentionedTask = taskNames.find(task => query.includes(task.toLowerCase()));
  
  if (mentionedTask) {
    const taskData = taskInsights.find(t => t.task === mentionedTask);
    if (taskData) {
      return {
        type: MessageTypes.ASSISTANT,
        content: `## ${mentionedTask} Analysis\n\n` +
          `**Average Accuracy:** ${taskData.averageAccuracy.toFixed(1)}%\n` +
          `**Difficulty:** ${taskData.difficulty}\n` +
          `**Average Bias:** ${taskData.averageBias.toFixed(2)} (${taskData.biasInterpretation})\n\n` +
          `**Best Model:** ${taskData.bestModel} (${taskData.bestAccuracy.toFixed(1)}%)\n` +
          `**Needs Improvement:** ${taskData.worstModel} (${taskData.worstAccuracy.toFixed(1)}%)`,
        suggestions: ["Show all tasks", "Which task is hardest?", "Give recommendations"]
      };
    }
  }
  
  // Show all tasks summary
  let content = "## Task Performance Summary\n\n";
  
  const sortedByDifficulty = [...taskInsights].sort((a, b) => a.averageAccuracy - b.averageAccuracy);
  
  content += "| Task | Avg Accuracy | Difficulty | Avg Bias |\n";
  content += "|------|-------------|------------|----------|\n";
  
  sortedByDifficulty.forEach(task => {
    content += `| ${task.task} | ${task.averageAccuracy.toFixed(1)}% | ${task.difficulty} | ${task.averageBias.toFixed(2)} |\n`;
  });
  
  return {
    type: MessageTypes.ASSISTANT,
    content: content,
    suggestions: ["Which task has most bias?", "Hardest task analysis", "How to improve?"]
  };
};

/**
 * Handle comparison queries
 */
const handleComparisonQuery = (comparison, results) => {
  if (!comparison || results.length < 2) {
    return {
      type: MessageTypes.ASSISTANT,
      content: "I need at least 2 models to provide a comparison. Please evaluate multiple models to see comparative analysis.",
      suggestions: ["How to add more models?", "Show single model analysis", "What metrics matter?"]
    };
  }
  
  const sortedByAccuracy = [...results].sort((a, b) => 
    (b.accuracy?.overall || 0) - (a.accuracy?.overall || 0)
  );
  
  const best = sortedByAccuracy[0];
  const worst = sortedByAccuracy[sortedByAccuracy.length - 1];
  const accuracyDiff = (best.accuracy?.overall || 0) - (worst.accuracy?.overall || 0);
  
  let content = "## Model Comparison\n\n";
  
  content += `**Accuracy Gap:** ${accuracyDiff.toFixed(1)} percentage points between best and worst\n\n`;
  
  content += "**Performance Ranking:**\n";
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
    suggestions: ["Which model should I choose?", "Accuracy vs bias trade-off", "Show detailed breakdown"]
  };
};

/**
 * Handle recommendation queries
 */
const handleRecommendationQuery = (insights, results) => {
  const { mostAccurate, leastBiased, fastestModel, taskInsights } = insights || {};
  
  let content = "## 🤖 Assistant Recommendations\n\n";
  
  // Primary recommendation
  content += "### Primary Recommendation\n";
  if (mostAccurate && leastBiased) {
    if (mostAccurate.modelId === leastBiased.modelId) {
      content += `**${mostAccurate.modelId}** is your best choice - it has both the highest accuracy (${mostAccurate.accuracy.toFixed(1)}%) and lowest bias (${leastBiased.biasScore.toFixed(2)}).\n\n`;
    } else {
      content += `For **accuracy**, choose **${mostAccurate.modelId}** (${mostAccurate.accuracy.toFixed(1)}%).\n`;
      content += `For **fairness**, choose **${leastBiased.modelId}** (${leastBiased.biasScore.toFixed(2)} bias score).\n\n`;
    }
  }
  
  // Speed consideration
  if (fastestModel) {
    content += `For **speed**, **${fastestModel.modelId}** is fastest at ${(fastestModel.avgTime / 1000).toFixed(2)}s average response time.\n\n`;
  }
  
  // Areas for improvement
  const hardTasks = taskInsights?.filter(t => t.difficulty === 'Hard') || [];
  if (hardTasks.length > 0) {
    content += "### Areas Needing Attention\n";
    content += "Focus on improving performance in these challenging categories:\n";
    hardTasks.slice(0, 3).forEach(task => {
      content += `- **${task.task}**: Only ${task.averageAccuracy.toFixed(1)}% average accuracy\n`;
    });
    content += "\n";
  }
  
  // Bias concerns
  const biasedTasks = taskInsights?.filter(t => Math.abs(t.averageBias) > 0.3) || [];
  if (biasedTasks.length > 0) {
    content += "### Bias Concerns\n";
    content += "These categories show significant bias and need attention:\n";
    biasedTasks.forEach(task => {
      content += `- **${task.task}**: ${task.averageBias.toFixed(2)} (${task.biasInterpretation})\n`;
    });
  }
  
  return {
    type: MessageTypes.ASSISTANT,
    content: content,
    suggestions: ["How to reduce bias?", "How to improve accuracy?", "What do these scores mean?"]
  };
};

/**
 * Handle improvement queries
 */
const handleImprovementQuery = (insights, results) => {
  let content = "## 📈 Improvement Suggestions\n\n";
  
  content += "### To Improve Accuracy:\n";
  content += "1. **Increase sample size** - Run more questions for statistical significance\n";
  content += "2. **Review failed questions** - Analyze patterns in incorrect answers\n";
  content += "3. **Adjust temperature** - Lower temperature (0.0-0.3) for more deterministic responses\n";
  content += "4. **Check context handling** - Ensure models properly use provided context\n\n";
  
  content += "### To Reduce Bias:\n";
  content += "1. **Use disambiguated contexts** - Models perform more fairly with complete information\n";
  content += "2. **Fine-tune on balanced data** - Train with diverse, representative examples\n";
  content += "3. **Add bias mitigation prompts** - Include fairness instructions in prompts\n";
  content += "4. **Monitor regularly** - Run evaluations periodically to catch drift\n\n";
  
  content += "### To Improve Speed:\n";
  content += "1. **Reduce context length** - Shorter prompts process faster\n";
  content += "2. **Use smaller models** - Trade some accuracy for speed\n";
  content += "3. **Enable caching** - Reuse responses for similar queries\n";
  content += "4. **Adjust concurrency** - Process multiple questions in parallel\n";
  
  return {
    type: MessageTypes.ASSISTANT,
    content: content,
    suggestions: ["Show current weaknesses", "What is bias score?", "Give me a summary"]
  };
};

/**
 * Handle summary queries
 */
const handleSummaryQuery = (insights, results) => {
  const { mostAccurate, leastBiased, fastestModel, accuracyRange, taskInsights } = insights || {};
  
  let content = "## 📊 Evaluation Summary\n\n";
  
  content += `**Models Evaluated:** ${results.length}\n`;
  content += `**Questions per Model:** ${results[0]?.totalQuestions || 'N/A'}\n`;
  content += `**Accuracy Range:** ${accuracyRange?.min.toFixed(1) || 0}% - ${accuracyRange?.max.toFixed(1) || 0}%\n\n`;
  
  content += "### Top Performers:\n";
  if (mostAccurate) {
    content += `🏆 **Most Accurate:** ${mostAccurate.modelId} (${mostAccurate.accuracy.toFixed(1)}%)\n`;
  }
  if (fastestModel) {
    content += `⚡ **Fastest:** ${fastestModel.modelId} (${(fastestModel.avgTime / 1000).toFixed(2)}s)\n`;
  }
  if (leastBiased) {
    content += `✅ **Least Biased:** ${leastBiased.modelId} (${leastBiased.biasScore.toFixed(2)})\n`;
  }
  
  content += "\n### Task Performance:\n";
  const sortedTasks = [...(taskInsights || [])].sort((a, b) => a.averageAccuracy - b.averageAccuracy);
  sortedTasks.slice(0, 5).forEach(task => {
    const emoji = task.difficulty === 'Hard' ? '🔴' : task.difficulty === 'Medium' ? '🟡' : '🟢';
    content += `${emoji} ${task.task}: ${task.averageAccuracy.toFixed(1)}%\n`;
  });
  
  return {
    type: MessageTypes.ASSISTANT,
    content: content,
    suggestions: ["Show detailed analysis", "What are the risks?", "Give recommendations"]
  };
};

/**
 * Handle risk/concern queries
 */
const handleRiskQuery = (insights, results) => {
  let content = "## ⚠️ Risk Analysis\n\n";
  
  // High bias models
  const highBiasModels = results.filter(r => Math.abs(r.overallBiasScore || 0) >= 0.5);
  if (highBiasModels.length > 0) {
    content += "### High Bias Risk (|s_amb| ≥ 0.5)\n";
    content += "These models show significant bias and may produce unfair results:\n";
    highBiasModels.forEach(model => {
      content += `- **${model.modelId}**: ${(model.overallBiasScore || 0).toFixed(2)}\n`;
    });
    content += "\n";
  }
  
  // Low accuracy models
  const lowAccuracyModels = results.filter(r => (r.accuracy?.overall || 0) < 50);
  if (lowAccuracyModels.length > 0) {
    content += "### Low Accuracy Risk (< 50%)\n";
    content += "These models struggle with the benchmark questions:\n";
    lowAccuracyModels.forEach(model => {
      content += `- **${model.modelId}**: ${(model.accuracy?.overall || 0).toFixed(1)}%\n`;
    });
    content += "\n";
  }
  
  // Slow models
  const slowModels = results.filter(r => (r.averageResponseTime || 0) > 5000);
  if (slowModels.length > 0) {
    content += "### High Latency Risk (> 5s)\n";
    content += "These models may not be suitable for real-time applications:\n";
    slowModels.forEach(model => {
      content += `- **${model.modelId}**: ${((model.averageResponseTime || 0) / 1000).toFixed(2)}s\n`;
    });
    content += "\n";
  }
  
  // Task-specific risks
  const { taskInsights } = insights || {};
  const riskyTasks = taskInsights?.filter(t => t.averageAccuracy < 50 || Math.abs(t.averageBias) > 0.4) || [];
  if (riskyTasks.length > 0) {
    content += "### Task-Specific Concerns\n";
    riskyTasks.forEach(task => {
      content += `- **${task.task}**: ${task.averageAccuracy.toFixed(1)}% accuracy, ${task.averageBias.toFixed(2)} bias\n`;
    });
  }
  
  if (highBiasModels.length === 0 && lowAccuracyModels.length === 0 && slowModels.length === 0 && riskyTasks.length === 0) {
    content += "✅ **No major risks detected!** All models are performing within acceptable parameters.\n\n";
    content += "Continue monitoring with regular evaluations to catch any drift over time.";
  }
  
  return {
    type: MessageTypes.ASSISTANT,
    content: content,
    suggestions: ["How to mitigate risks?", "Show recommendations", "Compare models"]
  };
};

/**
 * Get suggested questions for the user
 */
export const getSuggestedQuestions = () => {
  return [
    "Which model performed best?",
    "Show me bias analysis",
    "What are the main concerns?",
    "Give me recommendations",
    "Compare all models",
    "Which tasks are hardest?",
    "How can I improve results?",
    "Show me a summary"
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
