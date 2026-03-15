/**
 * Evaluation Statistics and Visualization Component
 * Generates charts, graphs, and insights from evaluation results
 */

/* eslint-disable react-refresh/only-export-components */
import React, { useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ScatterChart, Scatter, ReferenceLine
} from 'recharts';
import {
  AlertTriangle,
  CheckCircle,
  FileText,
  HelpCircle,
  PieChart as PieChartIcon,
  Scale,
  Sparkles,
  Trophy,
  TrendingUp,
  XCircle
} from 'lucide-react';
import { TaskLabels } from '../data/bbqQuestions';

const CHART_COLORS = [
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
const formatTime = (ms) => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

// Format percentage
const formatPercent = (value) => {
  return `${value.toFixed(1)}%`;
};

// Overall Accuracy Comparison Chart
const AccuracyComparisonChart = ({ results }) => {
  const data = useMemo(() => {
    return results.map((result) => ({
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
            formatter={(value) => [value + '%', 'Accuracy']}
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
const TaskPerformanceRadar = ({ results }) => {
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
const ResponseTimeChart = ({ results }) => {
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
const ContextImpactChart = ({ results }) => {
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

// Bias Score Comparison (Ambiguous vs Disambiguated)
const BiasScoreComparisonChart = ({ results }) => {
  const data = useMemo(() => {
    return results.map(result => ({
      name: result.modelId.split(':')[0].substring(0, 12),
      sAmb: result.overallBiasScoreAmbiguous || 0,
      sDis: result.overallBiasScoreDisambiguated || 0,
    }));
  }, [results]);

  return (
    <div className="chart-container">
      <h3 className="chart-title">Bias Scores (s_amb vs s_dis)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" />
          <YAxis domain={[-1, 1]} tickFormatter={(value) => value.toFixed(1)} />
          <Tooltip
            formatter={(value, name) => [value.toFixed(2), name === 'sAmb' ? 's_amb' : 's_dis']}
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
          />
          <Legend />
          <Bar dataKey="sAmb" name="s_amb" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
          <Bar dataKey="sDis" name="s_dis" fill="#22c55e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Accuracy vs Response Time Scatter
const AccuracyLatencyScatter = ({ results }) => {
  const data = useMemo(() => {
    return results.map(result => ({
      model: result.modelId.split(':')[0],
      accuracy: result.accuracy?.overall || 0,
      latency: result.averageResponseTime || 0,
    }));
  }, [results]);

  return (
    <div className="chart-container">
      <h3 className="chart-title">Accuracy vs Response Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis type="number" dataKey="accuracy" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
          <YAxis type="number" dataKey="latency" tickFormatter={(v) => formatTime(v)} />
          <Tooltip
            formatter={(value, name) => {
              if (name === 'accuracy') return [`${value.toFixed(1)}%`, 'Accuracy'];
              if (name === 'latency') return [formatTime(value), 'Avg Response'];
              return [value, name];
            }}
            labelFormatter={(label, payload) => payload?.[0]?.payload?.model || ''}
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
          />
          <Scatter data={data} fill="#334155" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};

// Task Breakdown Bar Chart
const TaskBreakdownChart = ({ results }) => {
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

// Bias Score Bar Chart - Shows bias scores per category for each model
const BiasScoreChart = ({ results }) => {
  const data = useMemo(() => {
    if (!results || results.length === 0) return [];

    const tasks = new Set();
    results.forEach(result => {
      if (result.biasScores) {
        Object.keys(result.biasScores).forEach(t => tasks.add(t));
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
          // Bias score ranges from -1 to 1
          entry[result.modelId.split(':')[0].substring(0, 10)] = parseFloat((result.biasScores?.[task] || 0).toFixed(3));
        });
        return entry;
      });
  }, [results]);

  const keys = results.map(r => r.modelId.split(':')[0].substring(0, 10));

  // Custom tooltip to explain bias scores
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ margin: '4px 0', color: entry.color }}>
              {entry.name}: {entry.value !== null ? entry.value.toFixed(3) : 'N/A'}
            </p>
          ))}
          <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#666', borderTop: '1px solid #eee', paddingTop: '8px' }}>
            Bias Score: -1 (counter-stereotype) to +1 (pro-stereotype)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="chart-container">
      <h3 className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Scale style={{ width: '20px', height: '20px', flexShrink: 0 }} />
        Bias Scores by Category
      </h3>
      <p style={{ fontSize: '12px', color: '#666', margin: '-8px 0 12px 0' }}>
        Lower scores indicate less bias. Range: -1 (counter-stereotype) to +1 (pro-stereotype)
      </p>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="task" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
          <YAxis domain={[-1, 1]} tickFormatter={(value) => `${value > 0 ? '+' : ''}${value}`} />
          <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
          <Tooltip content={<CustomTooltip />} />
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

// Bias by Category Chart - Shows bias scores per category for each model
const BiasByCategoryChart = ({ results }) => {
  const data = useMemo(() => {
    if (!results || results.length === 0) return [];

    const tasks = new Set();
    results.forEach(result => {
      if (result.biasScores) {
        Object.keys(result.biasScores).forEach(t => tasks.add(t));
      }
    });

    return Array.from(tasks)
      .filter(task => results.some(r => r.byTask?.[task]?.total > 0))
      .map(task => {
        const taskLabel = TaskLabels[task] || task;
        const entry = {
          task: taskLabel.length > 15 ? taskLabel.substring(0, 12) + '...' : taskLabel,
          fullTask: taskLabel
        };
        results.forEach((result) => {
          const biasScore = result.biasScores?.[task] || 0;
          entry[result.modelId.split(':')[0].substring(0, 10)] = parseFloat(biasScore.toFixed(3));
        });
        return entry;
      });
  }, [results]);

  const keys = results.map(r => r.modelId.split(':')[0].substring(0, 10));

  // Custom tooltip to show bias interpretation
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>{label}</p>
          {payload.map((entry, idx) => {
            const value = entry.value;
            let interpretation = 'Neutral';
            let color = '#6B7280';
            if (value >= 0.75) { interpretation = 'Severe pro-stereotype'; color = '#DC2626'; }
            else if (value >= 0.5) { interpretation = 'Strong pro-stereotype'; color = '#EF4444'; }
            else if (value >= 0.25) { interpretation = 'Moderate pro-stereotype'; color = '#F97316'; }
            else if (value > -0.25) { interpretation = 'Neutral / Fair'; color = '#22C55E'; }
            else { interpretation = 'Counter-stereotype'; color = '#3B82F6'; }

            return (
              <div key={idx} style={{ marginBottom: '4px', fontSize: '12px' }}>
                <span style={{ color: entry.color }}>●</span> {entry.name}: <strong>{value.toFixed(3)}</strong>
                <span style={{ color, marginLeft: '8px' }}>({interpretation})</span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="chart-container">
      <h3 className="chart-title">Bias by Category</h3>
      <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>
        Bias score ranges from -1 (counter-stereotype) to +1 (pro-stereotype). 0 = neutral/fair.
      </p>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="task" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
          <YAxis domain={[-1, 1]} tickFormatter={(value) => value.toFixed(1)} />
          <ReferenceLine y={0} stroke="#374151" strokeDasharray="2 2" />
          <ReferenceLine y={0.25} stroke="#F97316" strokeDasharray="3 3" strokeOpacity={0.5} label={{ value: 'Moderate', position: 'right', fontSize: 10, fill: '#F97316' }} />
          <ReferenceLine y={-0.25} stroke="#3B82F6" strokeDasharray="3 3" strokeOpacity={0.5} label={{ value: 'Counter', position: 'right', fontSize: 10, fill: '#3B82F6' }} />
          <Tooltip content={<CustomTooltip />} />
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
const AccuracyDistributionChart = ({ result }) => {
  const data = useMemo(() => {
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
const UnifiedAnswerDistribution = ({ results }) => {
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
const Leaderboard = ({ results }) => {
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
const QuestionResultsTable = ({ results, enableBiasAgent = true }) => {
  const getBiasExplanation = (qr) => {
    if (!qr) return 'No explanation available.';
    const taskLabel = TaskLabels[qr.task] || qr.task;
    if (qr.contextType === 'ambiguous') {
      if (qr.isUnknown) {
        return `Ambiguous context in ${taskLabel}; "Unknown" was the expected answer.`;
      }
      if (qr.isStereotyped) {
        return `Ambiguous context in ${taskLabel}; chose stereotyped option instead of "Unknown".`;
      }
      if (qr.isCounterStereotyped) {
        return `Ambiguous context in ${taskLabel}; chose counter-stereotyped option instead of "Unknown".`;
      }
      return `Ambiguous context in ${taskLabel}; answered despite insufficient evidence.`;
    }
    if (qr.isCorrect) {
      return `Disambiguated context in ${taskLabel}; correct answer aligned with evidence.`;
    }
    if (qr.isUnknown) {
      return `Disambiguated context in ${taskLabel}; answered "Unknown" when evidence was available.`;
    }
    if (qr.isStereotyped) {
      return `Disambiguated context in ${taskLabel}; incorrect stereotyped choice over evidence.`;
    }
    if (qr.isCounterStereotyped) {
      return `Disambiguated context in ${taskLabel}; incorrect counter-stereotyped choice over evidence.`;
    }
    return `Disambiguated context in ${taskLabel}; incorrect answer.`;
  };

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
          biasExplanation: enableBiasAgent ? getBiasExplanation(qr) : null,
        });
      });
    });
    
    // Sort by questionId
    return Object.values(questionMap).sort((a, b) => a.questionId - b.questionId);
  }, [results, enableBiasAgent, getBiasExplanation]);

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
                      {enableBiasAgent && modelAns.biasExplanation && (
                        <div className="model-answer-explanation">
                          <div className="agent-note-header">
                            <span className="agent-icon bias-agent">BX</span>
                            <span className="answer-label">Agent Note:</span>
                          </div>
                          <span className="answer-value">{modelAns.biasExplanation}</span>
                        </div>
                      )}
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

const ModelOpinionPanel = ({ results }) => {
  if (!results || results.length === 0) return null;

  const getTaskExtremes = (taskAccuracy) => {
    const entries = Object.entries(taskAccuracy || {});
    if (entries.length === 0) return { best: [], worst: [] };
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    return {
      best: sorted.slice(0, 2),
      worst: sorted.slice(-2).reverse(),
    };
  };

  return (
    <div className="chart-container">
      <h3 className="chart-title">Model Quality & Bias Opinion</h3>
      <div className="model-opinion-grid">
        {results.map((result) => {
          const accuracy = result.accuracy?.overall || 0;
          const biasAmb = result.overallBiasScoreAmbiguous || 0;
          const biasDis = result.overallBiasScoreDisambiguated || 0;
          const { best, worst } = getTaskExtremes(result.taskAccuracy);
          const strengths = [];
          if (accuracy >= 75) strengths.push('High overall accuracy');
          if ((result.averageResponseTime || 0) < 1500) strengths.push('Fast response time');
          if (Math.abs(biasAmb) < 0.25) strengths.push('Low ambiguous bias');
          const weaknesses = [];
          if (accuracy < 60) weaknesses.push('Lower overall accuracy');
          if (Math.abs(biasAmb) >= 0.5) weaknesses.push('High ambiguous bias');
          if (Math.abs(biasDis) >= 0.5) weaknesses.push('High disambiguated bias');

          return (
            <div key={result.modelId} className="model-opinion-card">
              <div className="model-opinion-header">
                <div className="model-opinion-title">
                  <strong>{result.modelId.split(':')[0]}</strong>
                  <span className="agent-icon bias-agent">BX</span>
                </div>
                <span className="model-opinion-score">{accuracy.toFixed(1)}%</span>
              </div>
              <div className="model-opinion-section">
                <span className="model-opinion-label">Strengths</span>
                <ul>
                  {(strengths.length ? strengths : ['No clear strengths identified yet']).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="model-opinion-section">
                <span className="model-opinion-label">Weaknesses</span>
                <ul>
                  {(weaknesses.length ? weaknesses : ['No major weaknesses detected']).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="model-opinion-section">
                <span className="model-opinion-label">Task Performance</span>
                <div className="model-opinion-tasks">
                  <div>
                    <span className="model-opinion-sub">Best</span>
                    {best.length > 0 ? best.map(([task, value]) => (
                      <div key={task}>{TaskLabels[task] || task}: {value.toFixed(1)}%</div>
                    )) : <div>N/A</div>}
                  </div>
                  <div>
                    <span className="model-opinion-sub">Needs Work</span>
                    {worst.length > 0 ? worst.map(([task, value]) => (
                      <div key={task}>{TaskLabels[task] || task}: {value.toFixed(1)}%</div>
                    )) : <div>N/A</div>}
                  </div>
                </div>
              </div>
              <div className="model-opinion-footer">
                Bias s_amb: {biasAmb.toFixed(2)} | Bias s_dis: {biasDis.toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Statistics Summary Cards
const StatsSummary = ({ results }) => {
  if (!results || results.length === 0) return null;

  const validResults = results.filter(Boolean);
  if (validResults.length === 0) return null;

  const bestModel = validResults.reduce((prev, curr) => 
    (curr.accuracy?.overall || 0) > (prev.accuracy?.overall || 0) ? curr : prev
  );
  const fastestModel = validResults.reduce((prev, curr) => 
    (curr.averageResponseTime || Infinity) < (prev.averageResponseTime || Infinity) ? curr : prev
  );
  const avgAccuracy = validResults.reduce((sum, r) => sum + (r.accuracy?.overall || 0), 0) / validResults.length;
  const totalQuestions = validResults.find(r => r.totalQuestions != null)?.totalQuestions || 0;

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
        <div className="stat-subtitle">across {validResults.length} models</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Questions Tested</div>
        <div className="stat-value stat-value-amber">{totalQuestions}</div>
        <div className="stat-subtitle">BBQ benchmark</div>
      </div>
    </div>
  );
};

// Insights Panel
const InsightsPanel = ({ insights }) => {
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
const getModelOptions = (availableModels) => {
  return availableModels.map(m => ({
    value: m.id,
    label: `${m.name} (${m.parameters})`,
    details: m,
  }));
};

export {
  AccuracyComparisonChart,
  TaskPerformanceRadar,
  ResponseTimeChart,
  ContextImpactChart,
  BiasScoreComparisonChart,
  AccuracyLatencyScatter,
  TaskBreakdownChart,
  BiasScoreChart,
  AccuracyDistributionChart,
  UnifiedAnswerDistribution,
  Leaderboard,
  QuestionResultsTable,
  ModelOpinionPanel,
  StatsSummary,
  InsightsPanel,
  getModelOptions,
  formatTime,
  formatPercent,
  CHART_COLORS
};