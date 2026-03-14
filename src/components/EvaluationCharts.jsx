/**
 * Evaluation Statistics and Visualization Component
 * Generates charts, graphs, and insights from evaluation results
 */

import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import {
  AlertTriangle,
  CheckCircle,
  FileText,
  HelpCircle,
  PieChart as PieChartIcon,
  Sparkles,
  Trophy,
  TrendingUp,
  XCircle
} from 'lucide-react';
import { TaskLabels } from '../data/bbqQuestions';

// Color palette for charts
export const CHART_COLORS = [
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#22C55E', // Green
  '#F59E0B', // Amber
  '#0D9488', // Teal
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#F97316', // Orange
  '#334155', // Slate
  '#84CC16', // Lime
];

// Format milliseconds to readable time
export const formatTime = (ms) => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

// Format percentage
export const formatPercent = (value) => {
  return `${value.toFixed(1)}%`;
};

// Overall Accuracy Comparison Chart
export const AccuracyComparisonChart = ({ results }) => {
  const data = useMemo(() => {
    return results.map((result, index) => ({
      name: result.modelId.split(':')[0].substring(0, 15),
      fullName: result.modelId,
      accuracy: result.accuracy?.overall != null ? parseFloat(result.accuracy.overall.toFixed(1)) : 0,
      correct: result.correct || 0,
      total: result.totalQuestions || 0,
    }));
  }, [results]);

  return (
    <div className="chart-container">
      <h3 className="chart-title">Overall Accuracy Comparison</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis 
            domain={[0, 100]} 
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip 
            formatter={(value, name) => [value + '%', 'Accuracy']}
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
          />
          <Bar dataKey="accuracy" name="Accuracy" fill="#3B82F6" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={CHART_COLORS[index % CHART_COLORS.length]} 
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Task Performance Radar Chart
export const TaskPerformanceRadar = ({ results }) => {
  const data = useMemo(() => {
    if (!results || results.length === 0) return [];
    
    // Dynamically identify evaluated tasks
    const tasks = new Set();
    results.forEach(result => {
      if (result.taskAccuracy) {
        Object.keys(result.taskAccuracy).forEach(t => tasks.add(t));
      }
    });

    return Array.from(tasks)
      // Only include tasks that actually have been evaluated
      .filter(task => results.some(r => (r.taskAccuracy?.[task] !== undefined && r.byTask?.[task]?.total > 0)))
      .map(task => {
        const taskLabel = TaskLabels[task] || task;
        const entry = { task: taskLabel };
        results.forEach((result) => {
          entry[result.modelId.split(':')[0]] = parseFloat((result.taskAccuracy?.[task] || 0).toFixed(1));
        });
        return entry;
      });
  }, [results]);

  const keys = results.map(r => r.modelId.split(':')[0]);

  return (
    <div className="chart-container">
      <h3 className="chart-title">Performance by Bias Category</h3>
      <ResponsiveContainer width="100%" height={350}>
        <RadarChart data={data}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis dataKey="task" tick={{ fontSize: 11 }} />
          <PolarRadiusAxis 
            angle={30} 
            domain={[0, 100]} 
            tickFormatter={(value) => `${value}%`}
          />
          {keys.map((key, index) => (
            <Radar
              key={key}
              name={key}
              dataKey={key}
              stroke={CHART_COLORS[index % CHART_COLORS.length]}
              fill={CHART_COLORS[index % CHART_COLORS.length]}
              fillOpacity={0.2}
            />
          ))}
          <Legend />
          <Tooltip 
            formatter={(value) => value ? `${value}%` : 'N/A'}
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Response Time Comparison
export const ResponseTimeChart = ({ results }) => {
  const data = useMemo(() => {
    return results.map(result => ({
      name: result.modelId.split(':')[0].substring(0, 15),
      avgTime: result.averageResponseTime != null ? parseFloat(result.averageResponseTime.toFixed(0)) : 0,
      totalTime: result.totalTime != null ? parseFloat((result.totalTime / 1000).toFixed(1)) : 0,
    }));
  }, [results]);

  return (
    <div className="chart-container">
      <h3 className="chart-title">Average Response Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ top: 20, right: 30, left: 80, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis type="number" tickFormatter={(value) => formatTime(value)} />
          <YAxis dataKey="name" type="category" width={75} tick={{ fontSize: 11 }} />
          <Tooltip 
            formatter={(value, name) => [
              name === 'avgTime' ? formatTime(value) : `${value}s`, 
              name === 'avgTime' ? 'Avg Response Time' : 'Total Time'
            ]}
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
          />
          <Bar dataKey="avgTime" name="Avg Response Time" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Context Impact Analysis
export const ContextImpactChart = ({ results }) => {
  const data = useMemo(() => {
    return results.map(result => ({
      name: result.modelId.split(':')[0].substring(0, 12),
      withContext: result.accuracy?.disambiguated != null ? parseFloat(result.accuracy.disambiguated.toFixed(1)) : 0,
      withoutContext: result.accuracy?.ambiguous != null ? parseFloat(result.accuracy.ambiguous.toFixed(1)) : 0,
    }));
  }, [results]);

  return (
    <div className="chart-container">
      <h3 className="chart-title">Context Impact on Accuracy</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" />
          <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
          <Tooltip 
            formatter={(value) => `${value}%`}
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
          />
          <Legend />
          <Bar dataKey="withContext" name="With Context" fill="#22C55E" radius={[4, 4, 0, 0]} />
          <Bar dataKey="withoutContext" name="Without Context" fill="#F59E0B" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Task Breakdown Bar Chart
export const TaskBreakdownChart = ({ results }) => {
  const data = useMemo(() => {
    if (!results || results.length === 0) return [];
    
    const tasks = new Set();
    results.forEach(result => {
      if (result.taskAccuracy) {
        Object.keys(result.taskAccuracy).forEach(t => tasks.add(t));
      }
    });

    return Array.from(tasks)
      .filter(task => results.some(r => r.byTask?.[task]?.total > 0))
      .map(task => {
        const taskLabel = TaskLabels[task] || task;
        const entry = { 
          task: taskLabel.length > 12 ? taskLabel.substring(0, 10) + '...' : taskLabel,
          fullTask: taskLabel
        };
        results.forEach((result) => {
          entry[result.modelId.split(':')[0].substring(0, 10)] = parseFloat((result.taskAccuracy?.[task] || 0).toFixed(1));
        });
        return entry;
      });
  }, [results]);

  const keys = results.map(r => r.modelId.split(':')[0].substring(0, 10));

  return (
    <div className="chart-container">
      <h3 className="chart-title">Task-by-Task Performance</h3>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="task" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
          <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
          <Tooltip 
            formatter={(value, name) => [value ? `${value}%` : 'N/A', name]}
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
          />
          <Legend wrapperStyle={{ fontSize: '12px' }} />
          {keys.map((key, index) => (
            <Bar 
              key={key} 
              dataKey={key} 
              fill={CHART_COLORS[index % CHART_COLORS.length]} 
              radius={[2, 2, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Accuracy Distribution Pie Chart
export const AccuracyDistributionChart = ({ result }) => {
  const data = useMemo(() => {
    const total = result.totalQuestions;
    return [
      { name: 'Correct', value: result.correct, color: '#22C55E' },
      { name: 'Incorrect', value: result.incorrect, color: '#EF4444' },
      { name: 'Unanswered', value: result.unanswered, color: '#6B7280' },
    ].filter(d => d.value > 0);
  }, [result]);

  return (
    <div className="chart-container">
      <h3 className="chart-title">Answer Distribution</h3>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={80}
            dataKey="value"
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

// Unified Answer Distribution for All Models
export const UnifiedAnswerDistribution = ({ results }) => {
  const data = useMemo(() => {
    return results.map((result, idx) => ({
      model: result.modelId.split(':')[0],
      correct: result.correct || 0,
      incorrect: result.incorrect || 0,
      unanswered: result.unanswered || 0,
      total: result.totalQuestions || 1,
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }));
  }, [results]);

  return (
    <div className="chart-container unified-distribution">
      <h3 className="chart-title">
        <PieChartIcon className="title-icon" />
        Answer Distribution - All Models
      </h3>
      <div className="distribution-grid">
        {data.map((item, idx) => (
          <div key={idx} className="distribution-card" style={{ borderLeftColor: item.color }}>
            <div className="distribution-header">
              <strong>{item.model}</strong>
            </div>
            <div className="distribution-bars">
              <div className="dist-bar correct" style={{ width: `${(item.correct / item.total) * 100}%` }}>
                <span>{item.correct}</span>
              </div>
              <div className="dist-bar incorrect" style={{ width: `${(item.incorrect / item.total) * 100}%` }}>
                <span>{item.incorrect}</span>
              </div>
              <div className="dist-bar unanswered" style={{ width: `${(item.unanswered / item.total) * 100}%` }}>
                <span>{item.unanswered}</span>
              </div>
            </div>
            <div className="distribution-legend">
              <span className="legend-item correct">
                <CheckCircle className="legend-icon" />
                {((item.correct / item.total) * 100).toFixed(1)}%
              </span>
              <span className="legend-item incorrect">
                <XCircle className="legend-icon" />
                {((item.incorrect / item.total) * 100).toFixed(1)}%
              </span>
              <span className="legend-item unanswered">
                <HelpCircle className="legend-icon" />
                {((item.unanswered / item.total) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Leaderboard Table
export const Leaderboard = ({ results }) => {
  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => (b.accuracy?.overall || 0) - (a.accuracy?.overall || 0));
  }, [results]);

  return (
    <div className="chart-container">
      <h3 className="chart-title">Model Leaderboard</h3>
      <div className="overflow-x-auto">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Model</th>
              <th>Accuracy</th>
              <th>Correct/Total</th>
              <th>Avg Response</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {sortedResults.map((result, index) => (
              <tr key={result.modelId} className={index === 0 ? 'winner-row' : ''}>
                <td>
                  <span className={`rank-badge rank-${index + 1}`}>
                    {index + 1}
                  </span>
                </td>
                <td className="font-medium">{result.modelId}</td>
                <td>
                  <span className="accuracy-value" style={{ 
                    color: (result.accuracy?.overall || 0) >= 80 ? '#22C55E' : (result.accuracy?.overall || 0) >= 60 ? '#F59E0B' : '#EF4444'
                  }}>
                    {(result.accuracy?.overall || 0).toFixed(1)}%
                  </span>
                </td>
                <td>{(result.correct || 0)}/{(result.totalQuestions || 0)}</td>
                <td>{formatTime(result.averageResponseTime || 0)}</td>
                <td>
                  <div className="score-bar">
                    <div 
                      className="score-bar-fill" 
                      style={{ 
                        width: `${result.accuracy?.overall || 0}%`,
                        backgroundColor: (result.accuracy?.overall || 0) >= 80 ? '#22C55E' : (result.accuracy?.overall || 0) >= 60 ? '#F59E0B' : '#EF4444'
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Question Details Table - Enhanced with ALL models' answers side by side
export const QuestionResultsTable = ({ results }) => {
  // Group questions by questionId and aggregate all model answers
  const groupedQuestions = useMemo(() => {
    if (!results || results.length === 0) return [];
    
    const questionMap = {};
    
    // Get all question results from all models
    results.forEach((result, modelIndex) => {
      if (!result || !result.modelId || !result.questionResults) return;
      
      const modelName = result.modelId.split(':')[0];
      const modelColor = CHART_COLORS[modelIndex % CHART_COLORS.length];
      
      result.questionResults.forEach((qr) => {
        if (!qr || !qr.questionId) return;
        
        if (!questionMap[qr.questionId]) {
          questionMap[qr.questionId] = {
            questionId: qr.questionId,
            task: qr.task,
            hasContext: qr.hasContext,
            context: qr.context,
            question: qr.question,
            options: qr.options,
            correctAnswer: qr.correctAnswer,
            modelAnswers: [],
          };
        }
        
        questionMap[qr.questionId].modelAnswers.push({
          modelName: modelName,
          modelId: result.modelId,
          modelAnswer: qr.modelAnswer,
          isCorrect: qr.isCorrect,
          responseTime: qr.responseTime,
          color: modelColor,
        });
      });
    });
    
    // Sort by questionId
    return Object.values(questionMap).sort((a, b) => a.questionId - b.questionId);
  }, [results]);

  return (
    <div className="chart-container">
      <h3 className="chart-title">Detailed Question Results - All Models</h3>
      <div className="question-details-list">
        {groupedQuestions.map((group, index) => (
          <div 
            key={index} 
            className="question-detail-card-combined"
          >
            {/* Header */}
            <div className="question-detail-header">
              <div className="question-detail-meta">
                <span className="question-number">Q{group.questionId}</span>
                <span className="category-badge">{TaskLabels[group.task] || group.task}</span>
                {group.hasContext && (
                  <span className="context-badge">
                    <FileText className="w-3 h-3" />
                    Context
                  </span>
                )}
              </div>
              <div className="correct-answer-header">
                <span className="correct-answer-label">Correct Answer:</span>
                <span className="correct-answer-value">{group.correctAnswer}</span>
              </div>
            </div>

            {/* Context */}
            {group.context && (
              <div className="question-context">
                <strong>Context:</strong> {group.context}
              </div>
            )}

            {/* Question */}
            <div className="question-full">
              <strong>Question:</strong> {group.question}
            </div>

            {/* Options - Show once */}
            <div className="question-options">
              <strong>Options:</strong>
              <div className="options-grid">
                {group.options && group.options.map((opt, optIdx) => {
                  const letter = opt.charAt(0);
                  const isCorrect = letter === group.correctAnswer;
                  
                  return (
                    <div 
                      key={optIdx} 
                      className={`option-item ${isCorrect ? 'option-correct' : ''}`}
                    >
                      <span className="option-marker">
                        {isCorrect && <CheckCircle className="option-check" />}
                        {letter}:
                      </span>
                      <span className="option-text">{opt.substring(3)}</span>
                      {isCorrect && <span className="correct-answer-badge">Correct</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* All Models' Answers Side by Side */}
            <div className="models-answers-section">
              <strong className="models-answers-title">Model Answers:</strong>
              <div className="models-answers-grid">
                {group.modelAnswers.map((modelAns, modelIdx) => (
                  <div 
                    key={modelIdx}
                    className={`model-answer-card ${modelAns.isCorrect ? 'model-correct' : 'model-incorrect'}`}
                    style={{ borderLeftColor: modelAns.color }}
                  >
                    <div className="model-answer-header" style={{ backgroundColor: `${modelAns.color}15` }}>
                      <span className="model-name" style={{ color: modelAns.color }}>{modelAns.modelName}</span>
                      <span className={`model-result-badge ${modelAns.isCorrect ? 'correct' : 'incorrect'}`}>
                        {modelAns.isCorrect ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                      </span>
                    </div>
                    <div className="model-answer-body">
                      <div className="model-answer-row">
                        <span className="answer-label">Answer:</span>
                        <span className={`answer-value ${modelAns.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                          {modelAns.modelAnswer || 'No Answer'}
                        </span>
                      </div>
                      <div className="model-answer-row">
                        <span className="answer-label">Time:</span>
                        <span className="answer-value">{formatTime(modelAns.responseTime || 0)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Statistics Summary Cards
export const StatsSummary = ({ results, insights }) => {
  if (!results || results.length === 0) return null;

  const bestModel = results.reduce((prev, curr) => 
    (curr.accuracy?.overall || 0) > (prev.accuracy?.overall || 0) ? curr : prev
  );
  const fastestModel = results.reduce((prev, curr) => 
    (curr.averageResponseTime || Infinity) < (prev.averageResponseTime || Infinity) ? curr : prev
  );
  const avgAccuracy = results.reduce((sum, r) => sum + (r.accuracy?.overall || 0), 0) / results.length;

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-label">Best Overall</div>
        <div className="stat-value stat-value-green">{(bestModel.accuracy?.overall || 0).toFixed(1)}%</div>
        <div className="stat-subtitle">{bestModel.modelId.split(':')[0]}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Fastest Model</div>
        <div className="stat-value stat-value-blue">{formatTime(fastestModel.averageResponseTime || 0)}</div>
        <div className="stat-subtitle">{fastestModel.modelId.split(':')[0]}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Average Accuracy</div>
        <div className="stat-value stat-value-purple">{avgAccuracy.toFixed(1)}%</div>
        <div className="stat-subtitle">across {results.length} models</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Questions Tested</div>
        <div className="stat-value stat-value-amber">{results[0].totalQuestions || 0}</div>
        <div className="stat-subtitle">BBQ benchmark</div>
      </div>
    </div>
  );
};

// Insights Panel
export const InsightsPanel = ({ insights, results }) => {
  if (!insights || !insights.mostAccurate || !insights.fastestModel) return null;

  return (
    <div className="insights-panel">
      <h3 className="chart-title">
        <Sparkles className="title-icon" />
        Key Insights
      </h3>
      
      <div className="insight-section">
        <h4 className="section-title">
          <Trophy className="section-icon" />
          Performance Highlights
        </h4>
        <ul>
          <li>
            <strong>Most Accurate:</strong> {insights.mostAccurate?.modelId?.split(':')[0] || 'N/A'} 
            ({insights.mostAccurate?.accuracy?.toFixed(1) || 0}%)
          </li>
          <li>
            <strong>Fastest Response:</strong> {insights.fastestModel?.modelId?.split(':')[0] || 'N/A'} 
            ({formatTime(insights.fastestModel?.avgTime || 0)} avg)
          </li>
          <li>
            <strong>Accuracy Spread:</strong> {insights.accuracyRange?.spread?.toFixed(1) || 0}% 
            (from {insights.accuracyRange?.min?.toFixed(1) || 0}% to {insights.accuracyRange?.max?.toFixed(1) || 0}%)
          </li>
        </ul>
      </div>

      <div className="insight-section">
        <h4 className="section-title">
          <TrendingUp className="section-icon" />
          Task Difficulty Analysis
        </h4>
        <div className="task-difficulty-list">
          {(insights.taskInsights || []).slice(0, 5).map((task, index) => (
            <div key={index} className={`difficulty-item difficulty-${task.difficulty?.toLowerCase() || 'unknown'}`}>
              <span className="difficulty-label">{task.task || 'Unknown'}</span>
              <span className="difficulty-badge">{task.difficulty || 'N/A'}</span>
              <span className="difficulty-accuracy">{(task.averageAccuracy || 0).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="insight-section">
        <h4 className="section-title">
          <AlertTriangle className="section-icon" />
          Potential Bias Concerns
        </h4>
        {Object.entries(insights.biasAnalysis || {}).map(([model, concerns]) => {
          if (!concerns || concerns.length === 0) return null;
          return (
            <div key={model} className="bias-concern">
              <strong>{model.split(':')[0]}:</strong>
              <ul>
          {concerns.map((concern, idx) => (
                    <li key={idx} className={`concern-${concern.concern?.toLowerCase() || 'unknown'}`}>
                      {concern.task || 'Unknown'} - {concern.concern} concern ({((concern.score || 0) * 100).toFixed(1)}% bias)
                    </li>
                  ))}
              </ul>
            </div>
          );
        })}
        {Object.values(insights.biasAnalysis).every(arr => arr.length === 0) && (
          <p className="no-concerns">
            <CheckCircle className="w-4 h-4" />
            No significant bias concerns detected.
          </p>
        )}
      </div>
    </div>
  );
};

// Model Selector Component Data
export const getModelOptions = (availableModels) => {
  return availableModels.map(m => ({
    value: m.id,
    label: `${m.name} (${m.parameters})`,
    details: m,
  }));
};