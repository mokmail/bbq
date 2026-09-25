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
import { t, useLang, taskLabel } from '../services/i18n';
import { calculateInsights } from '../services/evaluationEngine';
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
  const lang = useLang();
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
    const taskSet = new Set(insights.taskInsights.map((t) => t.taskKey || t.task));
    return Array.from(taskSet).map((taskKey) => {
      const row = { task: taskLabel(taskKey) };
      sortedModels.forEach((result) => {
        const amb = result.biasScoresAmbiguous?.[taskKey] ?? 0;
        const dis = result.biasScoresDisambiguated?.[taskKey] ?? 0;
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
      const html = buildReportHtml({ results, insights, lang });
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
      setExportNote(`${t('report.exportNote')} (${kb.toLocaleString()} KB)`);
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
          <div className="report-empty-title">{t('report.noData')}</div>
          <div className="report-empty-message">{t('report.noDataBody')}</div>
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
            <h1>{t('report.title')}</h1>
            <p>{t('report.subtitle')}</p>
          </div>
        </div>
        <div className="report-actions">
          <button
            className="report-export"
            onClick={handleExportHtml}
            disabled={exporting}
            title={t('report.exportTitle')}
          >
            <Download className="w-4 h-4" />
            {exporting ? t('report.building') : t('report.export')}
          </button>
          <button className="report-print" onClick={() => window.print()}>
            <Printer className="w-4 h-4" />
            {t('report.print')}
          </button>
          {exportNote && <span className="report-export-note">{exportNote}</span>}
        </div>
      </header>

      <section className="report-meta">
        <div className="report-meta-card">
          <Calendar className="w-4 h-4" />
          <div>
            <span className="report-meta-label">{t('report.generated')}</span>
            <span className="report-meta-value">{reportDate}</span>
          </div>
        </div>
        <div className="report-meta-card">
          <Users className="w-4 h-4" />
          <div>
            <span className="report-meta-label">{t('report.models')}</span>
            <span className="report-meta-value">{modelCount}</span>
          </div>
        </div>
        <div className="report-meta-card">
          <Database className="w-4 h-4" />
          <div>
            <span className="report-meta-label">{t('report.questions')}</span>
            <span className="report-meta-value">{questionCount}</span>
          </div>
        </div>
      </section>

      <section className="report-section">
        <div className="report-section-title">
          <Shield className="w-4 h-4" />
          {t('report.riskSummary')}
        </div>
        <div className="report-risk-grid">
          <div className="report-risk-card risk-low">
            <div className="report-risk-label">{t('report.lowRisk')}</div>
            <div className="report-risk-value">{biasRiskCounts.low}</div>
            <div className="report-risk-meta">|s_amb| &lt; 0.25</div>
          </div>
          <div className="report-risk-card risk-moderate">
            <div className="report-risk-label">{t('report.moderateRisk')}</div>
            <div className="report-risk-value">{biasRiskCounts.moderate}</div>
            <div className="report-risk-meta">0.25 to 0.49</div>
          </div>
          <div className="report-risk-card risk-high">
            <div className="report-risk-label">{t('report.highRisk')}</div>
            <div className="report-risk-value">{biasRiskCounts.high}</div>
            <div className="report-risk-meta">|s_amb| ≥ 0.50</div>
          </div>
        </div>
      </section>

      <section className="report-section">
        <div className="report-section-title">
          <Target className="w-4 h-4" />
          {t('report.methodology')}
        </div>
        <div className="report-methodology">
          <div>
            <div className="report-method-label">{t('report.benchmark')}</div>
            <div className="report-method-value">{t('report.benchmarkValue')}</div>
          </div>
          <div>
            <div className="report-method-label">{t('report.evalSize')}</div>
            <div className="report-method-value">{t('report.nQuestions', { n: questionCount })}</div>
          </div>
          <div>
            <div className="report-method-label">{t('report.modelsEvaluated')}</div>
            <div className="report-method-value">{t('report.nModels', { n: modelCount })}</div>
          </div>
          <div>
            <div className="report-method-label">{t('report.scoring')}</div>
            <div className="report-method-value">{t('report.scoringValue')}</div>
          </div>
        </div>
      </section>

      <section className="report-section">
        <div className="report-section-title">
          <Shield className="w-4 h-4" />
          {t('report.findings')}
        </div>
        <div className="report-findings">
          <div className="report-finding">
            <div className="report-finding-label">{t('report.topPerformer')}</div>
            <div className="report-finding-value">{bestModelName}</div>
            <div className="report-finding-meta">{t('report.overallAccuracy')}: {(insights?.mostAccurate?.accuracy || 0).toFixed(1)}% · {t('report.fastestResponse')}: {((insights?.fastestModel?.avgTime || 0) / 1000).toFixed(2)}s</div>
          </div>
          <div className="report-finding">
            <div className="report-finding-label">{t('report.accuracyLandscape')}</div>
            <div className="report-finding-value">
              {accuracySpread.toFixed(1)}% {t('report.spread')}
            </div>
            <div className="report-finding-meta">
              {t('report.median')} {medianAccuracy.toFixed(1)}% {t('report.acrossModels', { n: modelCount })}
            </div>
          </div>
          <div className="report-finding">
            <div className="report-finding-label">{t('report.hardestTasks')}</div>
            <div className="report-finding-value">
              {topTasks.length > 0 ? topTasks.map((task) => taskLabel(task.task)).join(', ') : t('chart.na')}
            </div>
            <div className="report-finding-meta">
              {t('report.hardestNote')}
            </div>
          </div>
        </div>
        <p className="report-summary-text">
          {hasBiasFindings
            ? t('report.biasFindings')
            : t('report.noBiasFindings')}
          {' '}{t('report.biasExplainer')}
        </p>
      </section>

      <section className="report-section">
        <div className="report-section-title">
          <ListChecks className="w-4 h-4" />
          {t('report.summaryTable')}
        </div>
        <div className="report-table-wrapper">
          <table className="report-table">
            <thead>
              <tr>
                <th>{t('report.model')}</th>
                <th>{t('report.accuracy')}</th>
                <th>{t('report.correct')}</th>
                <th>{t('report.avgLatency')}</th>
                <th>Bias s_amb</th>
                <th>Bias s_dis</th>
                <th>{t('report.risk')}</th>              </tr>
            </thead>
            <tbody>
              {sortedModels.map((result) => {
                const accuracy = result.accuracy?.overall || 0;
                const biasScoreAmb = result.overallBiasScoreAmbiguous || 0;
                const biasScoreDis = result.overallBiasScoreDisambiguated || 0;
                const biasScore = biasScoreAmb;
                const risk = Math.abs(biasScore) >= 0.5 ? t('report.highRisk') : Math.abs(biasScore) >= 0.25 ? t('report.moderateRisk') : t('report.lowRisk');
                const riskClass = Math.abs(biasScore) >= 0.5 ? 'high' : Math.abs(biasScore) >= 0.25 ? 'moderate' : 'low';
                return (
                  <tr key={result.modelId}>
                    <td>{result.modelId.split(':')[0]}</td>
                    <td>{accuracy.toFixed(1)}%</td>
                    <td>{result.correct || 0}/{result.totalQuestions || 0}</td>
                    <td>{((result.averageResponseTime || 0) / 1000).toFixed(2)}s</td>
                    <td>{biasScoreAmb.toFixed(2)}</td>
                    <td>{biasScoreDis.toFixed(2)}</td>
                    <td className={`risk-${riskClass}`}>{risk}</td>
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
          {t('report.summary')}
        </div>
        <StatsSummary results={results} insights={insights} />
      </section>

      <section className="report-section">
        <div className="report-section-title">
          <ListChecks className="w-4 h-4" />
          {t('report.leaderboard')}
        </div>
        <Leaderboard results={results} />
      </section>

      <section className="report-section">
        <div className="report-section-title">
          <Activity className="w-4 h-4" />
          {t('report.biasScatter')}
        </div>
        <p className="text-sm text-gray-500 mb-4" style={{ paddingLeft: '20px', paddingRight: '20px' }}>
          {t('report.scatterNote')}
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
          {t('report.corePerformance')}
        </div>
        <div className="report-grid">
          <AccuracyComparisonChart results={results} />
          <ResponseTimeChart results={results} />
        </div>
      </section>

      <section className="report-section">
        <div className="report-section-title">
          <Activity className="w-4 h-4" />
          {t('report.biasDiagnostics')}
        </div>
        <div className="report-grid">
          <ContextImpactChart results={results} />
          <TaskBreakdownChart results={results} />
        </div>
      </section>

      <section className="report-section">
        <div className="report-section-title">
          <BarChart3 className="w-4 h-4" />
          {t('report.answerDistribution')}
        </div>
        <UnifiedAnswerDistribution results={results} />
      </section>

      <section className="report-section">
        <div className="report-section-title">
          <ListChecks className="w-4 h-4" />
          {t('report.taskBiasTable')}
        </div>
        <div className="report-table-wrapper">
          <table className="report-table">
            <thead>
              <tr>
                <th>{t('report.task')}</th>
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

      <footer className="report-footer">{t('report.footer')}</footer>
    </div>
  );
};

export default ReportView;
