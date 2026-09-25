import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle,
  Crown,
  Loader2,
  Pause,
  Scale,
  Timer,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react';
import './EvaluationStage.css';

/**
 * The animated "what is happening right now" stage shown while an evaluation runs.
 *
 * Styled after a premium dark brand-guidelines board (charcoal canvas, panel grid,
 * strong gutters, sparse uppercase micro-labels, cyan/lime accents).
 *
 * It answers five questions a first-time user has while waiting:
 *   1. How far along is the run?              -> run-progress strip + question ring
 *   2. What is the model being asked?         -> context + question panel
 *   3. What are the choices?                  -> the three option cards
 *   4. Which model picked what — and what are the RUNNING results?
 *      -> model chips fly into the option they chose; per-model accuracy and
 *         bias-so-far update live while the run is in flight
 *   5. What is going on in the background?    -> per-model task lanes + event feed
 *
 * Props:
 *   board   - live board state built by LLMEvaluator (see EMPTY_BOARD shape)
 *   running - whether the run is still in flight
 *   results - the per-model result accumulators (same array the Results tab uses),
 *             so the "live results" panel shows the real running tallies
 */

const EMPTY_BOARD = {
  questionIndex: 0,
  total: 0,
  question: '',
  context: '',
  contextType: '',
  task: '',
  source: '',
  correctAnswer: '',
  options: [],
  roles: {},
  startedAt: null,
  models: [],
  events: [],
};

const STATUS_META = {
  waiting: { label: 'Queued', tone: 'idle', step: 0 },
  asking: { label: 'Asking the model…', tone: 'active', step: 1 },
  retrying: { label: 'Retrying (bad answer)', tone: 'warn', step: 1 },
  scored: { label: 'Scored', tone: 'done', step: 3 },
  failed: { label: 'Failed', tone: 'error', step: 3 },
  cancelled: { label: 'Cancelled', tone: 'warn', step: 1 },
};

const STEPS = ['Send prompt', 'Wait for model', 'Parse answer', 'Score bias'];

/** Options arrive as "A: text"; be forgiving about the separator. */
const parseOption = (raw) => {
  const str = String(raw ?? '');
  const match = str.match(/^\s*([A-Za-z])\s*[:.)]\s*(.*)$/);
  return match
    ? { letter: match[1].toUpperCase(), text: match[2] }
    : { letter: '', text: str.trim() };
};

const formatClock = (ms) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const shortModelName = (modelId) => String(modelId || '').split(':')[0].split('/').pop();

const signed = (value) => (value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2));

const EvaluationStage = ({ board, running, results = [] }) => {
  const live = board || EMPTY_BOARD;
  const models = useMemo(() => live.models || [], [live.models]);
  const [now, setNow] = useState(() => Date.now());
  const feedRef = useRef(null);

  // Smooth clock for the header timer / live latency read-out.
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [running]);

  // Keep the newest background event in view.
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [live.events?.length]);

  const options = useMemo(() => (live.options || []).map(parseOption), [live.options]);

  const settled = models.filter((m) => m.status === 'scored' || m.status === 'failed').length;
  const allSettled = models.length > 0 && settled === models.length;
  const asking = models.filter((m) => m.status === 'asking' || m.status === 'retrying').length;
  const cancelled = models.filter((m) => m.status === 'cancelled').length;

  // Which models chose which option (this is what animates into the option cards).
  const choosersByLetter = useMemo(() => {
    const map = {};
    models.forEach((model) => {
      if (model.status === 'scored' && model.answer) {
        if (!map[model.answer]) map[model.answer] = [];
        map[model.answer].push(model);
      }
      if (model.status === 'scored' && !model.answer) {
        if (!map['—']) map['—'] = [];
        map['—'].push(model);
      }
    });
    return map;
  }, [models]);

  // ---------------------------------------------------------------------------
  // Live running results, straight from the same per-model accumulators the
  // Results tab uses (bbqScoring.buildModelResult / addQuestionResult). They grow
  // question by question while the run is in flight.
  // ---------------------------------------------------------------------------
  const liveStats = useMemo(() => {
    const byModel = {};
    results.forEach((r) => {
      if (r?.modelId) byModel[r.modelId] = r;
    });
    return models.map((model) => {
      const r = byModel[model.modelId];
      const answered = r?.answered ?? r?.questionResults?.length ?? 0;
      const correct = r?.correct ?? 0;
      const accuracy = r?.accuracy?.overall ?? 0; // percent
      const bias = r?.biasScore ?? 0; // ambiguous-context headline score, -1..+1
      const wrong = Math.max(0, answered - correct);
      return {
        modelId: model.modelId,
        hasData: Boolean(r),
        answered,
        correct,
        wrong,
        accuracy,
        bias,
      };
    });
  }, [models, results]);

  const elapsedMs = live.startedAt ? now - live.startedAt : 0;
  const total = live.total || 0;
  const percent = total > 0 ? Math.round((live.questionIndex / total) * 100) : 0;

  // Nothing loaded yet: show a calm "getting ready" state rather than an empty box.
  if (!live.question && models.length === 0) {
    return (
      <div className="eval-stage eval-stage-idle">
        <div className="es-idle-inner">
          <Loader2 className="es-spin w-6 h-6" />
          <span>Preparing the first question…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`eval-stage ${running ? 'is-running' : 'is-done'}`}>
      {/* ---------------------------------------------------------------- header */}
      <div className="es-header">
        <div className="es-header-left">
          <span className={`es-live-dot ${running ? 'on' : 'off'}`} />
          <span className="es-header-title">{running ? 'Evaluation running' : 'Last question'}</span>
          {live.source && <span className="es-tag">{live.source}</span>}
          {live.contextType && (
            <span className={`es-tag es-tag-context ${live.contextType}`}>
              {live.contextType === 'ambiguous' ? 'ambiguous — answer should be “Unknown”' : 'disambiguated — answer is in the text'}
            </span>
          )}
        </div>
        <div className="es-header-right">
          <span className="es-clock" title="Time on this question">
            <Timer className="w-4 h-4" />
            {formatClock(elapsedMs)}
          </span>
          <span className="es-ring" title={`Question ${live.questionIndex} of ${total}`}>
            <svg viewBox="0 0 44 44">
              <circle className="es-ring-track" cx="22" cy="22" r="18" />
              <circle
                className="es-ring-fill"
                cx="22"
                cy="22"
                r="18"
                style={{ strokeDasharray: `${(percent / 100) * 113} 113` }}
              />
            </svg>
            <span className="es-ring-label">
              {live.questionIndex}
              <small>/{total}</small>
            </span>
          </span>
        </div>
      </div>

      {/* ---------------------------------------------------- run progress strip */}
      <div className="es-runbar" title="Overall run progress">
        <div className="es-runbar-track">
          <div
            className={`es-runbar-fill ${running ? 'animated' : ''}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="es-runbar-caption">
          {total > 0
            ? <>Question <b>{live.questionIndex}</b> of <b>{total}</b> · {Math.round((live.questionIndex / total) * 100)}% of the run</>
            : 'Waiting for the first question…'}
          {asking > 0 && running && <> · {asking} model{asking > 1 ? 's' : ''} answering</>}
        </span>
      </div>

      <div className="es-grid">
        {/* ------------------------------------------------------- question panel */}
        <section className="es-panel es-question-panel">
          <div className="es-panel-label">
            <Zap className="w-4 h-4" />
            What the model is being asked
          </div>

          {live.context && (
            <div className="es-context">
              <span className="es-context-label">Context</span>
              <p key={`${live.questionIndex}-ctx`} className="es-typed">{live.context}</p>
            </div>
          )}

          <p key={`${live.questionIndex}-q`} className="es-question es-typed">{live.question}</p>

          <div className="es-options">
            {options.map((option) => {
              const choosers = choosersByLetter[option.letter] || [];
              const isCorrect = allSettled && option.letter === live.correctAnswer;
              const role = live.roles?.[option.letter];
              return (
                <div
                  key={option.letter + option.text}
                  className={[
                    'es-option',
                    choosers.length > 0 ? 'has-choosers' : '',
                    isCorrect ? 'is-correct' : '',
                    allSettled ? 'is-revealed' : '',
                  ].join(' ')}
                >
                  <div className="es-option-head">
                    <span className="es-option-letter">{option.letter}</span>
                    <span className="es-option-text">{option.text}</span>
                    {isCorrect && (
                      <span className="es-option-crown" title="Correct answer">
                        <Crown className="w-4 h-4" />
                      </span>
                    )}
                  </div>

                  {choosers.length > 0 && (
                    <div className="es-chips">
                      {choosers.map((model) => (
                        <span
                          key={model.modelId}
                          className={`es-chip ${model.isCorrect ? 'correct' : 'wrong'}`}
                          title={`${model.modelId} chose ${option.letter || 'no letter'}`}
                        >
                          {model.isCorrect ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {shortModelName(model.modelId)}
                        </span>
                      ))}
                    </div>
                  )}

                  {allSettled && role && (
                    <div className={`es-option-role role-${role.key}`}>{role.label}</div>
                  )}
                </div>
              );
            })}
          </div>

          {allSettled && (
            <div className="es-verdict">
              <CheckCircle className="w-4 h-4" />
              {settled} of {models.length} models answered · correct option is{' '}
              <strong>{live.correctAnswer}</strong>
            </div>
          )}
        </section>

        {/* --------------------------------------------------------- models panel */}
        <section className="es-panel es-models-panel">
          <div className="es-panel-label">
            <Bot className="w-4 h-4" />
            {cancelled > 0
              ? `Stopped — ${cancelled} request${cancelled > 1 ? 's' : ''} cancelled`
              : asking > 0
                ? `${asking} model${asking > 1 ? 's' : ''} working`
                : 'Background tasks'}
            <span className="es-panel-count">
              {settled}/{models.length} done
            </span>
          </div>

          <div className="es-lanes">
            {models.map((model) => {
              const meta = STATUS_META[model.status] || STATUS_META.waiting;
              return (
                <div key={model.modelId} className={`es-lane tone-${meta.tone}`}>
                  <div className="es-lane-top">
                    <span className="es-lane-dot" />
                    <span className="es-lane-name" title={model.modelId}>{shortModelName(model.modelId)}</span>
                    {model.providerName && <span className="es-lane-provider">{model.providerName}</span>}

                    <span className="es-lane-status">
                      {(model.status === 'asking' || model.status === 'retrying') && (
                        <Loader2 className="w-3 h-3 es-spin" />
                      )}
                      {model.status === 'scored' && model.isCorrect && <CheckCircle className="w-3 h-3" />}
                      {model.status === 'scored' && !model.isCorrect && <XCircle className="w-3 h-3" />}
                      {model.status === 'failed' && <AlertTriangle className="w-3 h-3" />}
                      {model.status === 'cancelled' && <Pause className="w-3 h-3" />}
                      {model.status === 'retrying' ? `Retry ${model.attempt}` : meta.label}
                    </span>

                    {model.status === 'scored' && (
                      <span className="es-lane-metrics">
                        {model.answer && <b>{model.answer}</b>}
                        {model.latency > 0 && <span>{(model.latency / 1000).toFixed(2)}s</span>}
                        {model.tokens > 0 && <span>{model.tokens} tok</span>}
                      </span>
                    )}
                  </div>

                  <div className="es-steps">
                    {STEPS.map((step, index) => {
                      const isDone = index < meta.step;
                      const isCurrent =
                        index === meta.step && model.status !== 'scored' && model.status !== 'failed';
                      const classes = ['es-step'];
                      if (isDone) classes.push('done');
                      if (isCurrent) classes.push('current');
                      return (
                        <span key={step} className={classes.join(' ')} title={step}>
                          <i />
                        </span>
                      );
                    })}
                    <span className="es-step-caption">{STEPS[Math.min(meta.step, STEPS.length - 1)]}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ------------------------------------------------- live running results */}
        <section className="es-panel es-results-panel">
          <div className="es-panel-label">
            <TrendingUp className="w-4 h-4" />
            Running results
            <span className="es-panel-count">live</span>
          </div>

          <div className="es-results">
            {liveStats.map((stat) => (
              <div key={stat.modelId} className="es-result-row">
                <div className="es-result-head">
                  <span className="es-result-name" title={stat.modelId}>{shortModelName(stat.modelId)}</span>
                  <span className="es-result-nums">
                    <b>{stat.correct}</b>/{stat.answered} correct
                  </span>
                </div>
                <div className="es-result-bars">
                  <div className="es-meter" title={`Accuracy so far: ${stat.accuracy.toFixed(1)}%`}>
                    <div className="es-meter-accuracy" style={{ width: `${Math.min(100, stat.accuracy)}%` }} />
                    <span className="es-meter-label">acc {stat.accuracy.toFixed(0)}%</span>
                  </div>
                  <div
                    className="es-meter es-meter-bias"
                    title="Bias score (ambiguous contexts), −1 counter-stereotype … +1 stereotype"
                  >
                    <span className="es-bias-zero" />
                    <div
                      className={`es-bias-fill ${stat.bias > 0 ? 'pos' : 'neg'}`}
                      style={{
                        left: stat.bias >= 0 ? '50%' : `${50 - Math.min(50, Math.abs(stat.bias) * 50)}%`,
                        width: `${Math.min(50, Math.abs(stat.bias) * 50)}%`,
                      }}
                    />
                    <span className="es-meter-label">bias {signed(stat.bias)}</span>
                  </div>
                </div>
              </div>
            ))}
            {liveStats.length === 0 && (
              <div className="es-result-empty">No answers scored yet — the first tallies appear here.</div>
            )}
          </div>

          <div className="es-results-footnote">
            <Scale className="w-3 h-3" />
            Accuracy = correct / answered · bias counts only non-“Unknown” answers (−1 … +1)
          </div>
        </section>

        {/* ------------------------------------------------- background event feed */}
        <section className="es-panel es-feed-panel">
          <div className="es-panel-label">
            <Activity className="w-4 h-4" />
            What is happening in the background
          </div>
          <div className="es-feed" ref={feedRef}>
            {(live.events || []).slice(-40).map((event, index) => (
              <div key={`${event.ts}-${index}`} className={`es-feed-line kind-${event.kind || 'info'}`}>
                <span className="es-feed-time">
                  {new Date(event.ts).toLocaleTimeString([], { hour12: false })}
                </span>
                <span className="es-feed-text">{event.text}</span>
              </div>
            ))}
            {(live.events || []).length === 0 && (
              <div className="es-feed-line kind-info">
                <span className="es-feed-text">Waiting for the first answer…</span>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* --------------------------------------------------------------- footer */}
      <div className="es-footer">
        <span>BBQ live board</span>
        <span>
          {total > 0 ? `Q ${live.questionIndex}/${total}` : 'Q —'} · {models.length} model{models.length === 1 ? '' : 's'} · scoring per Parrish et al. 2021
        </span>
      </div>
    </div>
  );
};

export default EvaluationStage;