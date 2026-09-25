import React, { useMemo, useState } from 'react';
import {
  FileText,
  Printer,
  Download,
  Calendar,
  Database,
  Users,
  BarChart3,
  Activity,
  ListChecks,
  Target,
  Shield,
} from 'lucide-react';
import { calculateInsights } from '../services/evaluationEngine';
import { TaskLabels } from '../data/bbqQuestions';
import { buildReportHtml, reportFilename } from '../services/reportHtml';
import {
  AccuracyComparisonChart,
  ResponseTimeChart,
  ContextImpactChart,
  TaskBreakdownChart,
  UnifiedAnswerDistribution,
  Leaderboard,
  StatsSummary
} from './EvaluationCharts';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell
} from 'recharts';
import './ReportView.css';

const formatDate = (value) => {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const ReportView = ({ results }) => {
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState('');
  const insights = useMemo(() => (results?.length ? calculateInsights(results) : null), [results]);
  const reportDate = formatDate();
  const modelCount = results?.length || 0;
  const questionCount = results?.[0]?.totalQuestions || 0;
  const bestModelName = insights?.mostAccurate?.modelId?.split(':')[0] || 'N/A';
  const accuracySpread = insights?.accuracyRange?.spread ?? 0;
  const topTasks = (insights?.taskInsights || []).slice(0, 3);
  const hasBiasFindings = insights && Object.values(insights.biasAnalysis || {}).some((arr) => arr.length > 0);
  const sortedModels = useMemo(() => {
    return [...(results || [])].sort((a, b) => (b.accuracy?.overall || 0) - (a.accuracy?.overall || 0));
  }, [results]);
  const medianAccuracy = useMemo(() => {
    const values = sortedModels.map((r) => r.accuracy?.overall || 0).sort((a, b) => a - b);
    if (values.length === 0) return 0;
    const mid = Math.floor(values.length / 2);
    return values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
  }, [sortedModels]);

  const biasRiskCounts = useMemo(() => {
    return sortedModels.reduce(
      (acc, result) => {
        const score = Math.abs(result.overallBiasScoreAmbiguous || 0);
        if (score >= 0.5) acc.high += 1;
        else if (score >= 0.25) acc.moderate += 1;
        else acc.low += 1;
        return acc;
      },
      { high: 0, moderate: 0, low: 0 }
    );
  }, [sortedModels]);
  const biasScatterData = useMemo(() => {
    return sortedModels.map((result) => ({
      model: result.modelId.split(':')[0],
      sAmb: result.overallBiasScoreAmbiguous || 0,
      sDis: result.overallBiasScoreDisambiguated || 0,
    }));
  }, [sortedModels]);
  const taskBiasTable = useMemo(() => {
    if (!insights?.taskInsights || insights.taskInsights.length === 0) return [];
    const taskSet = new Set(insights.taskInsights.map((t) => t.task));
    return Array.from(taskSet).map((task) => {
      const row = { task };
      sortedModels.forEach((result) => {
        const taskKey = Object.keys(result.biasScoresAmbiguous || {}).find(
          (key) => (TaskLabels[key] || key) === task
        );
        const amb = taskKey ? result.biasScoresAmbiguous?.[taskKey] ?? 0 : 0;
        const dis = taskKey ? result.biasScoresDisambiguated?.[taskKey] ?? 0 : 0;
        row[result.modelId] = `${amb.toFixed(2)} / ${dis.toFixed(2)}`;
      });
      return row;
    });
  }, [insights, sortedModels]);

  /**
   * Build a self-contained HTML report and download it.
   *
   * The generator is synchronous string building over data already in memory, so the
   * only real cost is serialising the blob. Yielding once before the heavy work lets the
   * button paint its "building" state instead of the click appearing to do nothing.
   */
  const handleExportHtml = async () => {
    if (exporting) return;
    setExporting(true);
    setExportNote('Building a self-contained HTML report…');
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const html = buildReportHtml({ results, insights });
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = reportFilename();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke on the next tick: revoking synchronously can cancel the download in
      // some browsers before it has started reading the blob.
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      const kb = Math.max(1, Math.round(blob.size / 1024));
      setExportNote(`Saved ${a.download} (${kb.toLocaleString()} KB) — offline-ready, open it with any browser.`);
    } catch (error) {
      console.error('[Report] HTML export failed:', error);
      setExportNote(`Export failed: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  if (!results || results.length === 0) {
    return (
      <div className="report-empty">
        <FileText className="w-5 h-5" />
        <div>
          <div className="report-empty-title">No report data yet</div>
          <div className="report-empty-message">
            Run an evaluation first to generate a shareable report.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="report-page">
      <header className="report-header">
        <div className="report-title">
          <FileText className="w-6 h-6" />
          <div>
            <h1>Kmail BBQ Benchmarking Report</h1>
            <p>Share-ready summary of model evaluation results.</p>
          </div>
        </div>
        <div className="report-actions">
          <button
            className="report-export"
            onClick={handleExportHtml}
            disabled={exporting}
            title="Download a single self-contained HTML file that opens offline"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Building…' : 'Export HTML'}
          </button>
          <button className="report-print" onClick={() => window.print()}>
            <Printer className="w-4 h-4" />
            Print Report
          </button>
          {exportNote && <span className="report-export-note">{exportNote}</span>}
        </div>
      </header>

      <section className="report-meta">
        <div className="report-meta-card">
          <Calendar className="w-4 h-4" />
          <div>
            <span className="report-meta-label">Generated</span>
            <span className="report-meta-value">{reportDate}</span>
          </div>
        </div>
        <div className="report-meta-card">
          <Users className="w-4 h-4" />
          <div>
            <span className="report-meta-label">Models</span>
            <span className="report-meta-value">{modelCount}</span>
          </div>
        </div>
        <div className="report-meta-card">
          <Database className="w-4 h-4" />
          <div>
            <span className="report-meta-label">Questions</span>
            <span className="report-meta-value">{questionCount}</span>
          </div>
        </div>
      </section>

      <section className="report-section">
        <div className="report-section-title">
          <Shield className="w-4 h-4" />
          Bias Risk Summary
        </div>
        <div className="report-risk-grid">
          <div className="report-risk-card risk-low">
            <div className="report-risk-label">Low Risk</div>
            <div className="report-risk-value">{biasRiskCounts.low}</div>
            <div className="report-risk-meta">|s_amb| &lt; 0.25</div>
          </div>
          <div className="report-risk-card risk-moderate">
            <div className="report-risk-label">Moderate Risk</div>
            <div className="report-risk-value">{biasRiskCounts.moderate}</div>
            <div className="report-risk-meta">0.25 to 0.49</div>
          </div>
          <div className="report-risk-card risk-high">
            <div className="report-risk-label">High Risk</div>
            <div className="report-risk-value">{biasRiskCounts.high}</div>
            <div className="report-risk-meta">|s_amb| ≥ 0.50</div>
          </div>
        </div>
      </section>

      <section className="report-section">
        <div className="report-section-title">
          <Target className="w-4 h-4" />
          Methodology
        </div>
        <div className="report-methodology">
          <div>
            <div className="report-method-label">Benchmark</div>
            <div className="report-method-value">BBQ Bias Benchmark (selected categories)</div>
          </div>
          <div>
            <div className="report-method-label">Evaluation Size</div>
            <div className="report-method-value">{questionCount} questions</div>
          </div>
          <div>
            <div className="report-method-label">Models Evaluated</div>
            <div className="report-method-value">{modelCount} models</div>
          </div>
          <div>
            <div className="report-method-label">Scoring</div>
            <div className="report-method-value">Exact-match multiple choice accuracy</div>
          </div>
        </div>
      </section>

      <section className="report-section">
        <div className="report-section-title">
          <Shield className="w-4 h-4" />
          Key Findings
        </div>
        <div className="report-findings">
          <div className="report-finding">
            <div className="report-finding-label">Top Performer</div>
            <div className="report-finding-value">{bestModelName}</div>
            <div className="report-finding-meta">Overall accuracy: {(insights?.mostAccurate?.accuracy || 0).toFixed(1)}% · fastest response: {((insights?.fastestModel?.avgTime || 0) / 1000).toFixed(2)}s</div>
          </div>
          <div className="report-finding">
            <div className="report-finding-label">Accuracy Landscape</div>
            <div className="report-finding-value">
              {accuracySpread.toFixed(1)}% spread
            </div>
            <div className="report-finding-meta">
              Median {medianAccuracy.toFixed(1)}% across {modelCount} models
            </div>
          </div>
          <div className="report-finding">
            <div className="report-finding-label">Most Challenging Tasks</div>
            <div className="report-finding-value">
              {topTasks.length > 0 ? topTasks.map((task) => task.task).join(', ') : 'N/A'}
            </div>
            <div className="report-finding-meta">
              Lowest average accuracy across selected categories
            </div>
          </div>
        </div>
        <p className="report-summary-text">
          {hasBiasFindings
            ? 'Bias-related findings were detected and should be reviewed in the bias diagnostics below.'
            : 'No significant bias concerns were detected for the selected categories.'}
          {' '}Bias is reported for both ambiguous (s_amb) and disambiguated (s_dis) contexts: whether models make
          stereotyped errors when the correct answer is available, and when context is insufficient.
        </p>
      </section>

      <section className="report-section">
        <div className="report-section-title">
          <ListChecks className="w-4 h-4" />
          Model Summary Table
        </div>
        <div className="report-table-wrapper">
          <table className="report-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Accuracy</th>
                <th>Correct</th>
                <th>Avg Latency</th>
                <th>Bias s_amb</th>
                <th>Bias s_dis</th>
                <th>Risk Flag</th>
              </tr>
            </thead>
            <tbody>
              {sortedModels.map((result) => {
                const accuracy = result.accuracy?.overall || 0;
                const biasScoreAmb = result.overallBiasScoreAmbiguous || 0;
                const biasScoreDis = result.overallBiasScoreDisambiguated || 0;
                const biasScore = biasScoreAmb;
                const risk = Math.abs(biasScore) >= 0.5 ? 'High' : Math.abs(biasScore) >= 0.25 ? 'Moderate' : 'Low';
                return (
                  <tr key={result.modelId}>
                    <td>{result.modelId.split(':')[0]}</td>
                    <td>{accuracy.toFixed(1)}%</td>
                    <td>{result.correct || 0}/{result.totalQuestions || 0}</td>
                    <td>{((result.averageResponseTime || 0) / 1000).toFixed(2)}s</td>
                    <td>{biasScoreAmb.toFixed(2)}</td>
                    <td>{biasScoreDis.toFixed(2)}</td>
                    <td className={`risk-${risk.toLowerCase()}`}>{risk}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="report-section">
        <div className="report-section-title">
          <BarChart3 className="w-4 h-4" />
          Summary
        </div>
        <StatsSummary results={results} insights={insights} />
      </section>

      <section className="report-section">
        <div className="report-section-title">
          <ListChecks className="w-4 h-4" />
          Leaderboard
        </div>
        <Leaderboard results={results} />
      </section>

      <section className="report-section">
        <div className="report-section-title">
          <Activity className="w-4 h-4" />
          Bias Scatter (s_amb vs s_dis)
        </div>
        <p className="text-sm text-gray-500 mb-4" style={{ paddingLeft: '20px', paddingRight: '20px' }}>
          Plots bias tendency in ambiguous contexts against disambiguated contexts. Ideal models cluster near the center (0,0), demonstrating zero bias regardless of evidence availability.
        </p>
        <div className="report-chart-shell">
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="sAmb" type="number" domain={[-1, 1]} tickFormatter={(v) => v.toFixed(1)} />
              <YAxis dataKey="sDis" type="number" domain={[-1, 1]} tickFormatter={(v) => v.toFixed(1)} />
              <Tooltip
                formatter={(value, name) => {
                  if (name === 'sAmb') return [value.toFixed(2), 's_amb'];
                  if (name === 'sDis') return [value.toFixed(2), 's_dis'];
                  return [value, name];
                }}
                labelFormatter={(label, payload) => payload?.[0]?.payload?.model || ''}
              />
              <Scatter data={biasScatterData} fill="#0ea5e9">
                {biasScatterData.map((entry, index) => (
                  <Cell key={entry.model} fill={index % 2 === 0 ? '#0ea5e9' : '#22c55e'} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="report-section">
        <div className="report-section-title">
          <Activity className="w-4 h-4" />
          Core Performance
        </div>
        <div className="report-grid">
          <AccuracyComparisonChart results={results} />
          <ResponseTimeChart results={results} />
        </div>
      </section>

      <section className="report-section">
        <div className="report-section-title">
          <Activity className="w-4 h-4" />
          Bias Diagnostics
        </div>
        <div className="report-grid">
          <ContextImpactChart results={results} />
          <TaskBreakdownChart results={results} />
        </div>
      </section>

      <section className="report-section">
        <div className="report-section-title">
          <BarChart3 className="w-4 h-4" />
          Answer Distribution
        </div>
        <UnifiedAnswerDistribution results={results} />
      </section>

      <section className="report-section">
        <div className="report-section-title">
          <ListChecks className="w-4 h-4" />
          Task Bias Table (s_amb / s_dis)
        </div>
        <div className="report-table-wrapper">
          <table className="report-table">
            <thead>
              <tr>
                <th>Task</th>
                {sortedModels.map((model) => (
                  <th key={model.modelId}>{model.modelId.split(':')[0]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {taskBiasTable.map((row) => (
                <tr key={row.task}>
                  <td>{row.task}</td>
                  {sortedModels.map((model) => (
                    <td key={model.modelId}>{row[model.modelId]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="report-footer">
        Generated by Kmail BBQ Benchmarking for sharing and print.
      </footer>
    </div>
  );
};

export default ReportView;
