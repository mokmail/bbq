/**
 * Evaluation Statistics and Visualization Component
 * Generates charts, graphs, and insights from evaluation results
 */

/* eslint-disable react-refresh/only-export-components */
import React, { useMemo } from 'react';
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
import { t, taskLabel, useLang } from '../services/i18n';

const CHART_COLORS = [
  '#0063a3', // Cyan — brand signal
  '#471d70', // Violet — models
  '#5fb564', // Lime — verdict
  '#f59c00', // Amber — warning
  '#2dd4bf', // Teal
  '#f472b6', // Pink
  '#60a5fa', // Blue
  '#fb923c', // Orange
  '#94a3b8', // Slate
  '#a3e635', // Lime bright
];

// Format milliseconds to readable time
const formatTime = (ms) => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

// Overall Accuracy Comparison Chart
const AccuracyComparisonChart = ({ results }) => {
  useLang();
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
      <h3 className="chart-title">{t('chart.overallAccuracy.title')}</h3>
      <p className="text-sm text-gray-500 mb-4" style={{ paddingLeft: '20px', paddingRight: '20px' }}>
        {t('chart.overallAccuracy.desc')}
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,49,102,.16)" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 13, fill: '#33415c' }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            formatter={(value) => [value + '%', t('chart.accuracy')]}
            contentStyle={{ borderRadius: '8px', border: '1px solid rgba(22,35,58,.16)', background: '#fffdf8', color: '#33415c' }}
          />
          <Bar dataKey="accuracy" name={t('chart.accuracy')} fill="#0063a3" radius={[6, 6, 0, 0]}
            label={{ position: 'top', fontSize: 12.5, fontWeight: 600, fill: '#33415c', formatter: (v) => `${v}%` }}>
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
  useLang();
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
        const label = taskLabel(task);
        const entry = { task: label };
        results.forEach((result) => {
          entry[result.modelId.split(':')[0]] = parseFloat((result.taskAccuracy?.[task] || 0).toFixed(1));
        });
        return entry;
      });
  }, [results]);

  const keys = results.map(r => r.modelId.split(':')[0]);

  return (
    <div className="chart-container">
      <h3 className="chart-title">{t('chart.radar.title')}</h3>
      <p className="text-sm text-gray-500 mb-4" style={{ paddingLeft: '20px', paddingRight: '20px' }}>
        {t('chart.radar.desc')}
      </p>
      <ResponsiveContainer width="100%" height={350}>
        <RadarChart data={data}>
          <PolarGrid stroke="rgba(0,49,102,.16)" />
          <PolarAngleAxis dataKey="task" tick={{ fontSize: 12.5, fill: '#33415c' }} />
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
            formatter={(value) => value ? `${value}%` : t('chart.na')}
            contentStyle={{ borderRadius: '8px', border: '1px solid rgba(22,35,58,.16)', background: '#fffdf8', color: '#33415c' }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Response Time Comparison
const ResponseTimeChart = ({ results }) => {
  useLang();
  const data = useMemo(() => {
    if (!results || results.length === 0) return [];
    
    const times = results.map(r => r.averageResponseTime || 0).filter(t => t > 0);
    const medianTime = times.length > 0 ? times.sort((a, b) => a - b)[Math.floor(times.length / 2)] : 0;
    
    return results.map(result => {
      const avgTime = result.averageResponseTime != null ? parseFloat(result.averageResponseTime.toFixed(0)) : 0;
      const totalTime = result.totalTime != null ? parseFloat((result.totalTime / 1000).toFixed(1)) : 0;
      const totalQuestions = result.totalQuestions || 0;
      const questionCount = result.questionResults?.length || 0;
      
      let color = '#8B5CF6';
      if (medianTime > 0) {
        const ratio = avgTime / medianTime;
        if (ratio < 0.7) color = '#22C55E';
        else if (ratio < 1.0) color = '#3B82F6';
        else if (ratio < 1.5) color = '#F59E0B';
        else color = '#EF4444';
      }
      
      return {
        name: result.modelId.split(':')[0].substring(0, 15),
        fullName: result.modelId,
        avgTime,
        totalTime,
        totalQuestions,
        questionCount,
        color,
        percentile: medianTime > 0 ? Math.round((avgTime / medianTime) * 100) : 100,
      };
    });
  }, [results]);

  const stats = useMemo(() => {
    if (!results || results.length === 0) return null;
    const times = results.map(r => r.averageResponseTime || 0).filter(t => t > 0).sort((a, b) => a - b);
    if (times.length === 0) return null;
    
    const sum = times.reduce((a, b) => a + b, 0);
    const avg = sum / times.length;
    const median = times[Math.floor(times.length / 2)];
    const min = times[0];
    const max = times[times.length - 1];
    
    return { avg, median, min, max };
  }, [results]);

  const sortedData = [...data].sort((a, b) => b.avgTime - a.avgTime);

  return (
    <div className="chart-container">
      <h3 className="chart-title">{t('chart.respTime.title')}</h3>
      <p className="text-sm text-gray-500 mb-4" style={{ paddingLeft: '20px', paddingRight: '20px' }}>
        {t('chart.respTime.desc')}
      </p>
      
      {stats && (
        <div className="flex gap-4 mb-4" style={{ paddingLeft: '20px', paddingRight: '20px' }}>
          <div className="stat-mini">
            <span className="stat-mini-label">{t('chart.respTime.fastest')}</span>
            <span className="stat-mini-value" style={{ color: '#22C55E' }}>{formatTime(stats.min)}</span>
          </div>
          <div className="stat-mini">
            <span className="stat-mini-label">{t('chart.respTime.median')}</span>
            <span className="stat-mini-value" style={{ color: '#3B82F6' }}>{formatTime(stats.median)}</span>
          </div>
          <div className="stat-mini">
            <span className="stat-mini-label">{t('chart.respTime.slowest')}</span>
            <span className="stat-mini-value" style={{ color: '#EF4444' }}>{formatTime(stats.max)}</span>
          </div>
          <div className="stat-mini">
            <span className="stat-mini-label">{t('chart.respTime.avg')}</span>
            <span className="stat-mini-value">{formatTime(stats.avg)}</span>
          </div>
        </div>
      )}
      
      <ResponsiveContainer width="100%" height={Math.max(300, data.length * 50)}>
        <BarChart data={sortedData} layout="vertical" margin={{ top: 20, right: 30, left: 80, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,49,102,.16)" />
          <XAxis type="number" tickFormatter={(value) => formatTime(value)} />
          <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12.5, fill: '#33415c' }} />
          <Tooltip
            formatter={(value, name) => {
              if (name === 'avgTime') return [formatTime(value), t('chart.respTime.avgResponse')];
              if (name === 'totalTime') return [`${value}s`, t('chart.respTime.totalTime')];
              if (name === 'questionCount') return [value, t('chart.respTime.questions')];
              return [value, name];
            }}
            labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
            contentStyle={{ borderRadius: '8px', border: '1px solid rgba(22,35,58,.16)', background: '#fffdf8', color: '#33415c' }}
          />
          <ReferenceLine x={stats?.median || 0} stroke="#5b6b85" strokeDasharray="5 5" label={{ value: t('chart.respTime.medianLine'), position: 'top', fontSize: 12, fill: '#5b6b85' }} />
          <Bar dataKey="avgTime" name={t('chart.respTime.avgResponse')} radius={[0, 4, 4, 0]}>
            {sortedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Context Impact Analysis
const ContextImpactChart = ({ results }) => {
  useLang();
  const data = useMemo(() => {
    return results.map(result => {
      let ambCorrect = 0;
      let ambTotal = 0;
      let disCorrect = 0;
      let disTotal = 0;

      if (result.questionResults && result.questionResults.length > 0) {
        result.questionResults.forEach(qr => {
          if (qr.contextType === 'ambiguous') {
            ambTotal++;
            if (qr.isCorrect) ambCorrect++;
          } else {
            disTotal++;
            if (qr.isCorrect) disCorrect++;
          }
        });
      }

      return {
        name: result.modelId.split(':')[0].substring(0, 12),
        withContext: disTotal > 0 ? parseFloat(((disCorrect / disTotal) * 100).toFixed(1)) : 0,
        withoutContext: ambTotal > 0 ? parseFloat(((ambCorrect / ambTotal) * 100).toFixed(1)) : 0,
      };
    });
  }, [results]);

  return (
    <div className="chart-container">
      <h3 className="chart-title">{t('chart.contextImpact.title')}</h3>
      <p className="text-sm text-gray-500 mb-4" style={{ paddingLeft: '20px', paddingRight: '20px' }}>
        {t('chart.contextImpact.desc')}
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,49,102,.16)" />
          <XAxis dataKey="name" tick={{ fontSize: 12.5, fill: '#33415c' }} angle={-45} textAnchor="end" />
          <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
          <Tooltip
            formatter={(value) => `${value}%`}
            contentStyle={{ borderRadius: '8px', border: '1px solid rgba(22,35,58,.16)', background: '#fffdf8', color: '#33415c' }}
          />
          <Legend />
          <Bar dataKey="withContext" name={t('chart.contextImpact.withContext')} fill="#5fb564" radius={[4, 4, 0, 0]} />
          <Bar dataKey="withoutContext" name={t('chart.contextImpact.withoutContext')} fill="#f59c00" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Bias Score Comparison (Ambiguous vs Disambiguated) - Reimplemented
const BiasScoreComparisonChart = ({ results }) => {
  useLang();
  const data = useMemo(() => {
    return results.map(result => ({
      name: result.modelId.split(':')[0].substring(0, 12),
      sAmb: result.overallBiasScoreAmbiguous || 0,
      sDis: result.overallBiasScoreDisambiguated || 0,
    }));
  }, [results]);

  return (
    <div className="chart-container">
      <h3 className="chart-title">{t('chart.biasCompare.title')}</h3>
      <p className="text-sm text-gray-500 mb-4" style={{ paddingLeft: '20px', paddingRight: '20px' }}>
        {t('chart.biasCompare.desc')}
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,49,102,.16)" />
          <XAxis dataKey="name" tick={{ fontSize: 12.5, fill: '#33415c' }} angle={-45} textAnchor="end" />
          <YAxis domain={[-1, 1]} tickFormatter={(value) => value.toFixed(1)} />
          <Tooltip
            formatter={(value, name) => [value.toFixed(2), name === 'sAmb' ? 's_amb' : 's_dis']}
            contentStyle={{ borderRadius: '8px', border: '1px solid rgba(22,35,58,.16)', background: '#fffdf8', color: '#33415c' }}
          />
          <Legend />
          <Bar dataKey="sAmb" name="s_amb" fill="#0063a3" radius={[4, 4, 0, 0]} />
          <Bar dataKey="sDis" name="s_dis" fill="#471d70" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Accuracy vs Response Time Scatter
const AccuracyLatencyScatter = ({ results }) => {
  useLang();
  const data = useMemo(() => {
    return results.map(result => ({
      model: result.modelId.split(':')[0],
      accuracy: result.accuracy?.overall || 0,
      latency: result.averageResponseTime || 0,
    }));
  }, [results]);

  return (
    <div className="chart-container">
      <h3 className="chart-title">{t('chart.scatter.title')}</h3>
      <p className="text-sm text-gray-500 mb-4" style={{ paddingLeft: '20px', paddingRight: '20px' }}>
        {t('chart.scatter.desc')}
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,49,102,.16)" />
          <XAxis type="number" dataKey="accuracy" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
          <YAxis type="number" dataKey="latency" tickFormatter={(v) => formatTime(v)} />
          <Tooltip
            formatter={(value, name) => {
              if (name === 'accuracy') return [`${value.toFixed(1)}%`, t('chart.accuracy')];
              if (name === 'latency') return [formatTime(value), t('chart.scatter.avgResponse')];
              return [value, name];
            }}
            labelFormatter={(label, payload) => payload?.[0]?.payload?.model || ''}
            contentStyle={{ borderRadius: '8px', border: '1px solid rgba(22,35,58,.16)', background: '#fffdf8', color: '#33415c' }}
          />
          <Scatter data={data} fill="#471d70" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};

// Task Breakdown Bar Chart
const TaskBreakdownChart = ({ results }) => {
  useLang();
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
        const label = taskLabel(task);
        const entry = {
          task: label.length > 12 ? label.substring(0, 10) + '...' : label,
          fullTask: label
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
      <h3 className="chart-title">{t('chart.taskBreakdown.title')}</h3>
      <p className="text-sm text-gray-500 mb-4" style={{ paddingLeft: '20px', paddingRight: '20px' }}>
        {t('chart.taskBreakdown.desc')}
      </p>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,49,102,.16)" />
          <XAxis dataKey="task" tick={{ fontSize: 12, fill: '#33415c' }} angle={-45} textAnchor="end" height={80} />
          <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
          <Tooltip
            formatter={(value, name) => [value ? `${value}%` : t('chart.na'), name]}
            contentStyle={{ borderRadius: '8px', border: '1px solid rgba(22,35,58,.16)', background: '#fffdf8', color: '#33415c' }}
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

const BiasScoreTooltip = ({ active, payload, label }) => {
  useLang();
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: '#fffdf8',
        border: '1px solid rgba(22,35,58,.16)', color: '#33415c',
        borderRadius: '8px',
        padding: '12px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ margin: '4px 0', color: entry.color }}>
            {entry.name}: {entry.value !== null ? entry.value.toFixed(3) : t('chart.na')}
          </p>
        ))}
        <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#666', borderTop: '1px solid #eee', paddingTop: '8px' }}>
          {t('chart.biasScoreRange')}
        </p>
      </div>
    );
  }
  return null;
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

    const allTasks = Array.from(tasks);
    const filteredTasks = allTasks.filter(task => results.some(r => r.byTask?.[task]?.total > 0));
    const tasksToShow = filteredTasks.length > 0 ? filteredTasks : allTasks;

    return tasksToShow.map(task => {
      const label = taskLabel(task);
      const entry = {
        task: label.length > 12 ? label.substring(0, 10) + '...' : label,
        fullTask: label
      };
      results.forEach((result) => {
        const biasScore = result.biasScores?.[task];
        const modelKey = result.modelId.split(':')[0].substring(0, 10);
        const safeScore = Number.isFinite(biasScore) ? biasScore : 0;
        entry[modelKey] = parseFloat(safeScore.toFixed(3));
      });
      return entry;
    });
  }, [results]);

  const keys = results.map(r => r.modelId.split(':')[0].substring(0, 10));

  return (
    <div className="chart-container">
      <h3 className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Scale style={{ width: '20px', height: '20px', flexShrink: 0 }} />
        {t('chart.biasScore.title')}
      </h3>
      <p style={{ fontSize: '13px', color: '#666', margin: '4px 20px 12px 20px' }}>
        {t('chart.biasScore.desc')}
      </p>
      <div style={{ fontSize: '12px', color: '#6B7280', margin: '0 20px 12px 20px', padding: '10px', background: '#F9FAFB', borderRadius: '6px' }}>
        <strong>{t('chart.biasScore.methodTitle')}</strong><br/>
        <em>Disambiguated: sDIS = 2 × (nbiased_ans / nnon-UNKNOWN) - 1</em><br/>
        <em>Ambiguous: sAMB = (1 - Accuracy) × sDIS</em><br/>
        <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
          {t('chart.biasScore.methodNote')}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,49,102,.16)" />
          <XAxis dataKey="task" tick={{ fontSize: 12, fill: '#33415c' }} angle={-45} textAnchor="end" height={80} />
          <YAxis domain={[-1, 1]} tickFormatter={(value) => `${value > 0 ? '+' : ''}${value}`} />
          <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
          <Tooltip content={<BiasScoreTooltip />} />
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

const BiasCategoryTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: '#fffdf8',
        border: '1px solid rgba(22,35,58,.16)', color: '#33415c',
        borderRadius: '8px',
        padding: '12px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>{label}</p>
        {payload.map((entry, idx) => {
          const value = entry.value;
          let interpretation = t('chart.biasCat.neutral');
          let color = '#6B7280';
          if (value >= 0.75) { interpretation = t('chart.biasCat.severePro'); color = '#DC2626'; }
          else if (value >= 0.5) { interpretation = t('chart.biasCat.strongPro'); color = '#EF4444'; }
          else if (value >= 0.25) { interpretation = t('chart.biasCat.moderatePro'); color = '#F97316'; }
          else if (value > -0.25) { interpretation = t('chart.biasCat.fair'); color = '#22C55E'; }
          else { interpretation = t('chart.biasCat.counter'); color = '#3B82F6'; }

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

// Bias by Category Chart - Shows bias scores per category for each model
const BiasByCategoryChart = ({ results }) => {
  useLang();
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
        const label = taskLabel(task);
        const entry = {
          task: label.length > 15 ? label.substring(0, 12) + '...' : label,
          fullTask: label
        };
        results.forEach((result) => {
          const biasScore = result.biasScores?.[task];
          const safeScore = Number.isFinite(biasScore) ? biasScore : 0;
          entry[result.modelId.split(':')[0].substring(0, 10)] = parseFloat(safeScore.toFixed(3));
        });
        return entry;
      });
  }, [results]);

  const keys = results.map(r => r.modelId.split(':')[0].substring(0, 10));

  return (
    <div className="chart-container">
      <h3 className="chart-title">{t('chart.biasByCategory.title')}</h3>
      <p style={{ fontSize: '13px', color: '#6B7280', margin: '4px 20px 12px 20px' }}>
        {t('chart.biasByCategory.desc')}
      </p>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,49,102,.16)" />
          <XAxis dataKey="task" tick={{ fontSize: 12, fill: '#33415c' }} angle={-45} textAnchor="end" height={80} />
          <YAxis domain={[-1, 1]} tickFormatter={(value) => value.toFixed(1)} />
          <ReferenceLine y={0} stroke="#64748b" strokeDasharray="2 2" />
          <ReferenceLine y={0.25} stroke="#b45309" strokeDasharray="3 3" strokeOpacity={0.5} label={{ value: t('chart.biasByCategory.moderate'), position: 'right', fontSize: 12, fill: '#b45309' }} />
          <ReferenceLine y={-0.25} stroke="#0063a3" strokeDasharray="3 3" strokeOpacity={0.5} label={{ value: t('chart.biasByCategory.counter'), position: 'right', fontSize: 12, fill: '#0063a3' }} />
          <Tooltip content={<BiasCategoryTooltip />} />
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
  useLang();
  const data = useMemo(() => {
    return [
      { name: t('chart.distribution.correct'), value: result.correct, color: '#22C55E' },
      { name: t('chart.distribution.incorrect'), value: result.incorrect, color: '#EF4444' },
      { name: t('chart.distribution.unanswered'), value: result.unanswered, color: '#6B7280' },
    ].filter(d => d.value > 0);
  }, [result]);

  return (
    <div className="chart-container">
      <h3 className="chart-title">{t('chart.distribution.title', { model: result.modelId?.split(':')[0] })}</h3>
      <p className="text-sm text-gray-500 mb-4" style={{ paddingLeft: '20px', paddingRight: '20px' }}>
        {t('chart.distribution.desc')}
      </p>
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
  useLang();
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
        {t('chart.unified.title')}
      </h3>
      <p className="text-sm text-gray-500 mb-4" style={{ paddingLeft: '20px', paddingRight: '20px' }}>
        {t('chart.unified.desc')}
      </p>
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
  useLang();
  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => (b.accuracy?.overall || 0) - (a.accuracy?.overall || 0));
  }, [results]);

  return (
    <div className="chart-container">
      <h3 className="chart-title">{t('chart.leaderboard.title')}</h3>
      <p className="text-sm text-gray-500 mb-4" style={{ paddingLeft: '20px', paddingRight: '20px' }}>
        {t('chart.leaderboard.desc')}
      </p>
      <div className="overflow-x-auto">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>{t('chart.leaderboard.rank')}</th>
              <th>{t('chart.leaderboard.model')}</th>
              <th>{t('chart.leaderboard.accuracy')}</th>
              <th>{t('chart.leaderboard.correctTotal')}</th>
              <th>{t('chart.leaderboard.avgResponse')}</th>
              <th>{t('chart.leaderboard.score')}</th>
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
  useLang();
  const getBiasExplanation = (qr) => {
    if (!qr) return t('chart.details.noExplanation');
    const label = taskLabel(qr.task);
    if (qr.contextType === 'ambiguous') {
      if (qr.isUnknown) {
        return t('chart.details.exp.ambUnknown', { task: label });
      }
      if (qr.isStereotyped) {
        return t('chart.details.exp.ambStereotyped', { task: label });
      }
      if (qr.isCounterStereotyped) {
        return t('chart.details.exp.ambCounter', { task: label });
      }
      return t('chart.details.exp.ambAnswered', { task: label });
    }
    if (qr.isCorrect) {
      return t('chart.details.exp.disCorrect', { task: label });
    }
    if (qr.isUnknown) {
      return t('chart.details.exp.disUnknown', { task: label });
    }
    if (qr.isStereotyped) {
      return t('chart.details.exp.disStereotyped', { task: label });
    }
    if (qr.isCounterStereotyped) {
      return t('chart.details.exp.disCounter', { task: label });
    }
    return t('chart.details.exp.disIncorrect', { task: label });
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
      <h3 className="chart-title">{t('chart.details.title')}</h3>
      <p className="text-sm text-gray-500 mb-4" style={{ paddingLeft: '20px', paddingRight: '20px' }}>
        {t('chart.details.desc')}
      </p>
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
                <span className="category-badge">{taskLabel(group.task)}</span>
                {group.hasContext && (
                  <span className="context-badge">
                    <FileText className="w-3 h-3" />
                    {t('chart.details.contextBadge')}
                  </span>
                )}
              </div>
              <div className="correct-answer-header">
                <span className="correct-answer-label">{t('chart.details.correctAnswer')}</span>
                <span className="correct-answer-value">{group.correctAnswer}</span>
              </div>
            </div>

            {/* Context */}
            {group.context && (
              <div className="question-context">
                <strong>{t('chart.details.context')}</strong> {group.context}
              </div>
            )}

            {/* Question */}
            <div className="question-full">
              <strong>{t('chart.details.question')}</strong> {group.question}
            </div>

            {/* Options - Show once */}
            <div className="question-options">
              <strong>{t('chart.details.options')}</strong>
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
                      {isCorrect && <span className="correct-answer-badge">{t('chart.details.correct')}</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* All Models' Answers Side by Side */}
            <div className="models-answers-section">
              <strong className="models-answers-title">{t('chart.details.modelAnswers')}</strong>
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
                        <span className="answer-label">{t('chart.details.answer')}</span>
                        <span className={`answer-value ${modelAns.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                          {modelAns.modelAnswer || t('chart.details.noAnswer')}
                        </span>
                      </div>
                      <div className="model-answer-row">
                        <span className="answer-label">{t('chart.details.time')}</span>
                        <span className="answer-value">{formatTime(modelAns.responseTime || 0)}</span>
                      </div>
                      {enableBiasAgent && modelAns.biasExplanation && (
                        <div className="model-answer-explanation">
                          <div className="agent-note-header">
                            <span className="agent-icon bias-agent">BX</span>
                            <span className="answer-label">{t('chart.details.agentNote')}</span>
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

const StatsSummary = ({ results }) => {
  useLang();
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
        <div className="stat-label">{t('chart.stats.bestOverall')}</div>
        <div className="stat-value stat-value-green">{(bestModel.accuracy?.overall || 0).toFixed(1)}%</div>
        <div className="stat-subtitle">{bestModel.modelId.split(':')[0]}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">{t('chart.stats.fastestModel')}</div>
        <div className="stat-value stat-value-blue">{formatTime(fastestModel.averageResponseTime || 0)}</div>
        <div className="stat-subtitle">{fastestModel.modelId.split(':')[0]}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">{t('chart.stats.avgAccuracy')}</div>
        <div className="stat-value stat-value-purple">{avgAccuracy.toFixed(1)}%</div>
        <div className="stat-subtitle">{t('chart.stats.acrossModels', { n: validResults.length })}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">{t('chart.stats.questionsTested')}</div>
        <div className="stat-value stat-value-amber">{totalQuestions}</div>
        <div className="stat-subtitle">{t('chart.stats.benchmark')}</div>
      </div>
    </div>
  );
};

// Insights Panel
const InsightsPanel = ({ insights }) => {
  useLang();
  if (!insights || !insights.mostAccurate || !insights.fastestModel) return null;

  return (
    <div className="insights-panel">
      <h3 className="chart-title mb-2">
        <Sparkles className="title-icon" />
        {t('chart.insights.title')}
      </h3>
      <p className="text-sm text-gray-500 mb-4" style={{ paddingLeft: '20px', paddingRight: '20px' }}>
        {t('chart.insights.desc')}
      </p>

      <div className="insight-section">
        <h4 className="section-title">
          <Trophy className="section-icon" />
          {t('chart.insights.highlights')}
        </h4>
        <ul>
          <li>
            <strong>{t('chart.insights.mostAccurate')}</strong> {insights.mostAccurate?.modelId?.split(':')[0] || t('chart.na')}
            ({insights.mostAccurate?.accuracy?.toFixed(1) || 0}%)
          </li>
          <li>
            <strong>{t('chart.insights.fastestResponse')}</strong> {insights.fastestModel?.modelId?.split(':')[0] || t('chart.na')}
            ({formatTime(insights.fastestModel?.avgTime || 0)})
          </li>
          <li>
            <strong>{t('chart.insights.accuracySpread')}</strong> {insights.accuracyRange?.spread?.toFixed(1) || 0}%
            ({t('chart.insights.from')} {insights.accuracyRange?.min?.toFixed(1) || 0}% {t('chart.insights.to')} {insights.accuracyRange?.max?.toFixed(1) || 0}%)
          </li>
        </ul>
      </div>

      <div className="insight-section">
        <h4 className="section-title">
          <TrendingUp className="section-icon" />
          {t('chart.insights.taskDifficulty')}
        </h4>
        <div className="task-difficulty-list">
          {(insights.taskInsights || []).slice(0, 5).map((task, index) => (
            <div key={index} className={`difficulty-item difficulty-${task.difficulty?.toLowerCase() || 'unknown'}`}>
              <span className="difficulty-label">{taskLabel(task.task) || t('cmp.bias.unknown')}</span>
              <span className="difficulty-badge">{task.difficulty ? t(`difficulty.${task.difficulty}`) : t('chart.na')}</span>
              <span className="difficulty-accuracy">{(task.averageAccuracy || 0).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="insight-section">
        <h4 className="section-title">
          <AlertTriangle className="section-icon" />
          {t('chart.insights.biasConcerns')}
        </h4>
        {Object.entries(insights.biasAnalysis || {}).map(([model, concerns]) => {
          if (!concerns || concerns.length === 0) return null;
          return (
            <div key={model} className="bias-concern">
              <strong>{model.split(':')[0]}:</strong>
              <ul>
                {concerns.map((concern, idx) => (
                  <li key={idx} className={`concern-${concern.concern?.toLowerCase() || 'unknown'}`}>
                    {t('chart.insights.concern', {
                      task: taskLabel(concern.task) || t('cmp.bias.unknown'),
                      level: concern.concern,
                      pct: ((concern.score || 0) * 100).toFixed(1),
                    })}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {Object.values(insights.biasAnalysis).every(arr => arr.length === 0) && (
          <p className="no-concerns">
            <CheckCircle className="w-4 h-4" />
            {t('chart.insights.noConcerns')}
          </p>
        )}
      </div>
    </div>
  );
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
  StatsSummary,
  InsightsPanel,
  formatTime,
  CHART_COLORS
};

// Import and re-export enhanced comparison components
export { EnhancedResultsComparison, QuestionResultsDetailed } from './EnhancedResultsComparison';