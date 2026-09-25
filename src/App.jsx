import React, { useState, useEffect } from 'react';
import {
  Brain,
  Bot,
  FileText,
  MessageCircle,
  Scale,
  Target,
  Scan,
  Gauge,
  GitCompareArrows,
  Radar,
  CircleDot
} from 'lucide-react';
import { t, useLang, setLang } from './services/i18n';
import LLMEvaluator from './components/LLMEvaluator';
import ReportView from './components/ReportView';
import ChatAssistant from './components/ChatAssistant';
import logo from './assets/bev-logo.svg';
import './index.css';

// ---------------------------------------------------------------------------
// ABOUT BBQ — the reference page inside the app.
// Everything here is derived from the BBQ paper (Parrish et al. 2021,
// https://arxiv.org/abs/2110.08193) and the dataset repo (github.com/nyu-mll/BBQ).
// ---------------------------------------------------------------------------

const CATEGORIES = [
  ['Age', '3,680'],
  ['Disability status', '1,556'],
  ['Gender identity', '5,672'],
  ['Nationality', '3,080'],
  ['Physical appearance', '1,576'],
  ['Race/ethnicity', '6,880'],
  ['Religion', '1,200'],
  ['Sexual orientation', '864'],
  ['Socio-economic status', '6,864'],
  ['Race × gender', '15,960'],
  ['Race × SES', '11,160'],
];

const STEPS = [
  ['01', 'info.s1t', 'info.s1b'],
  ['02', 'info.s2t', 'info.s2b'],
  ['03', 'info.s3t', 'info.s3b'],
  ['04', 'info.s4t', 'info.s4b'],
  ['05', 'info.s5t', 'info.s5b'],
  ['06', 'info.s6t', 'info.s6b'],
];

const PaperLink = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="link">{children}</a>
);

const BBQInfo = () => {
  return (
  <div className="page-narrow">
    {/* Hero board */}
    <div className="board board-hero">
      <div className="board-no">01</div>
      <span className="eyebrow"><span className="eyebrow-dot" />{t('info.eyebrow')}</span>
      <h2 className="hero-title">{t('info.heroTitle')}</h2>
      <p className="hero-lede">{t('info.heroLede')}</p>
      <p className="hero-links">
        <PaperLink href="https://arxiv.org/abs/2110.08193">arxiv.org/abs/2110.08193</PaperLink>
        {' · '}
        <PaperLink href="https://www.alphaxiv.org/abs/2110.08193">{t('info.discussion')}</PaperLink>
        {' · '}
        <PaperLink href="https://github.com/nyu-mll/BBQ">{t('info.dataset')}</PaperLink>
      </p>
    </div>

    {/* How the app works */}
    <section className="board">
      <div className="board-no">02</div>
      <div className="board-head">
        <Bot className="w-5 h-5 text-accent" />
        <h3>{t('info.howTitle')}</h3>
      </div>
      <p className="board-sub">{t('info.howSub')}</p>
      <ol className="step-list">
        {STEPS.map(([num, titleKey, bodyKey]) => (
          <li key={num} className="step-item">
            <span className="step-no">{num}</span>
            <div>
              <div className="step-title">{t(titleKey)}</div>
              <p className="step-body">{t(bodyKey)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>

    <div className="grid-2">
      {/* Two contexts */}
      <section className="board">
        <div className="board-no">03</div>
        <div className="board-head">
          <Target className="w-5 h-5 text-accent" />
          <h3>{t('info.contextsTitle')}</h3>
        </div>
        <p className="board-sub">{t('info.contextsSub')}</p>
        <div className="context-block context-ambig">
          <span className="micro-label">{t('info.ambig')}</span>
          <p>{t('info.ambigBody')}</p>
        </div>
        <div className="context-block context-dis">
          <span className="micro-label">{t('info.disambig')}</span>
          <p>{t('info.disambigBody')}</p>
        </div>
        <div className="note">{t('info.balanceNote')}</div>
      </section>

      {/* Categories */}
      <section className="board">
        <div className="board-no">04</div>
        <div className="board-head">
          <Scale className="w-5 h-5 text-accent-2" />
          <h3>{t('info.catTitle')}</h3>
        </div>
        <div className="category-grid">
          {CATEGORIES.map(([name, count]) => (
            <div key={name} className="category-row">
              <span className="category-dot" />
              <span className="category-name">{name}</span>
              <span className="category-count">{count}</span>
            </div>
          ))}
        </div>
        <p className="board-sub" style={{ marginTop: 14 }}>
          {t('info.catNote1')} <em>{t('info.catIntersectional')}</em>{t('info.catBody')}
        </p>
      </section>
    </div>

    {/* The two numbers */}
    <section className="board">
      <div className="board-no">05</div>
      <div className="board-head">
        <Scan className="w-5 h-5 text-accent" />
        <h3>{t('info.numbersTitle')}</h3>
      </div>

      <div className="metric-duo">
        <div className="metric-block">
          <span className="micro-label">{t('info.accuracy')}</span>
          <p>{t('info.accuracyBody')}</p>
          <code className="formula">accuracy = correct / answered</code>
          <p className="board-sub">{t('info.accuracyNote')}</p>
        </div>
        <div className="metric-block">
          <span className="micro-label">{t('info.biasLabel')}</span>
          <p>{t('info.biasBody')}</p>
          <code className="formula">s<sub>dis</sub> = 2 × (n<sub>biased</sub> / n<sub>non-unknown</sub>) − 1<br />s<sub>amb</sub> = (1 − accuracy<sub>amb</sub>) × s<sub>dis</sub></code>
          <p className="board-sub">{t('info.biasRange')}</p>
        </div>
      </div>

      <div className="reading-grid">
        <div className="reading-card reading-good">
          <div className="reading-value">≈ 0</div>
          <div className="reading-label">{t('info.read0')}</div>
        </div>
        <div className="reading-card reading-bad">
          <div className="reading-value">→ +1</div>
          <div className="reading-label">{t('info.readPlus')}</div>
        </div>
        <div className="reading-card reading-info">
          <div className="reading-value">→ −1</div>
          <div className="reading-label">{t('info.readMinus')}</div>
        </div>
      </div>
      <p className="board-sub" style={{ marginTop: 12 }}>{t('info.negativeNote')}</p>
    </section>

    <div className="grid-2">
      {/* Options & polarity */}
      <section className="board">
        <div className="board-no">06</div>
        <div className="board-head">
          <CircleDot className="w-5 h-5 text-accent" />
          <h3>{t('info.threeOptionsTitle')}</h3>
        </div>
        <div className="role-list">
          <div className="role-row"><span className="role-tag role-unknown">Unknown</span><span>{t('info.optUnknown')}</span></div>
          <div className="role-row"><span className="role-tag role-target">Person 1</span><span>{t('info.optP1')}</span></div>
          <div className="role-row"><span className="role-tag role-nontarget">Person 2</span><span>{t('info.optP2')}</span></div>
        </div>
        <p className="board-sub" style={{ marginTop: 12 }}>{t('info.threeOptionsNote')}</p>
      </section>

      <section className="board">
        <div className="board-no">07</div>
        <div className="board-head">
          <Radar className="w-5 h-5 text-accent-2" />
          <h3>{t('info.polarityTitle')}</h3>
        </div>
        <div className="role-list">
          <div className="role-row"><span className="role-tag role-target">Negative</span><span>{t('info.polNeg')}</span></div>
          <div className="role-row"><span className="role-tag role-nontarget">Non-negative</span><span>{t('info.polNonNeg')}</span></div>
        </div>
      </section>
    </div>

    {/* Extra signals + limits */}
    <section className="board">
      <div className="board-no">08</div>
      <div className="board-head">
        <GitCompareArrows className="w-5 h-5 text-amber" />
        <h3>{t('info.signalsTitle')}</h3>
      </div>
      <div className="grid-2" style={{ gap: 16 }}>
        <div className="metric-block">
          <span className="micro-label">{t('info.alignLabel')}</span>
          <p>{t('info.alignBody')}</p>
        </div>
        <div className="metric-block">
          <span className="micro-label">{t('info.distLabel')}</span>
          <p>{t('info.distBody')}</p>
        </div>
      </div>
    </section>

    <section className="board">
      <div className="board-no">09</div>
      <div className="board-head">
        <Brain className="w-5 h-5 text-muted" />
        <h3>{t('info.limitsTitle')}</h3>
      </div>
      <ul className="fact-list">
        <li dangerouslySetInnerHTML={{ __html: t('info.limit1') }} />
        <li>{t('info.limit2')}</li>
        <li>{t('info.limit3')}</li>
        <li>{t('info.limit4')}</li>
      </ul>
    </section>
  </div>
  );
};

// Main App Component
function App() {
  const lang = useLang();
  const [activeTab, setActiveTab] = useState('evaluate');
  const [chatOpen, setChatOpen] = useState(false);
  const [providerRefreshKey, setProviderRefreshKey] = useState(0);
  const [reportResults, setReportResults] = useState(() => {
    try {
      const saved = localStorage.getItem('kmail-bbq-report');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load saved report data.', error);
    }
    return [];
  });

  useEffect(() => {
    try {
      if (reportResults && reportResults.length > 0) {
        localStorage.setItem('kmail-bbq-report', JSON.stringify(reportResults));
      }
    } catch (error) {
      console.warn('Failed to persist report data.', error);
    }
  }, [reportResults]);

  const tabs = [
    { id: 'evaluate', label: t('tab.evaluate'), icon: Bot },
    { id: 'report', label: t('tab.report'), icon: FileText },
    { id: 'info', label: t('tab.info'), icon: Brain },
  ];

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <div className="app-nav-inner">
          <div className="app-brand">
            <img src={logo} alt="Bundesamt für Eich- und Vermessungswesen" className="nav-logo nav-logo-wide" />
            <span className="app-brand-name">BBQ Bias Benchmark</span>
          </div>
          <div className="app-tabs">
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`app-tab ${activeTab === tab.id ? 'active' : ''}`}
                >
                  <TabIcon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className={`app-tab app-tab-chat ${chatOpen ? 'active' : ''}`}
              title={t('tab.assistant')}
            >
              <MessageCircle className="w-4 h-4" />
              {t('tab.assistant')}
            </button>
            <button
              onClick={() => setLang(lang === 'de' ? 'en' : 'de')}
              className="app-tab app-tab-lang"
              title={t('app.langTitle')}
            >
              {lang === 'de' ? 'EN' : 'DE'}
            </button>
          </div>
        </div>
      </nav>

      <main className="app-main">
        {activeTab === 'evaluate' && (
          <LLMEvaluator
            key={providerRefreshKey}
            onResultsChange={setReportResults}
            onProviderSettingsChange={() => setProviderRefreshKey((k) => k + 1)}
          />
        )}
        {activeTab === 'report' && (
          <ReportView results={reportResults} />
        )}
        {activeTab === 'info' && (
          <BBQInfo />
        )}
      </main>

      <footer className="app-footer">
        <span>{t('footer.note')}</span>
        <a href="https://deepeval.com/docs/benchmarks-bbq" target="_blank" rel="noopener noreferrer">DeepEval BBQ</a>
        <a href="https://arxiv.org/abs/2110.08193" target="_blank" rel="noopener noreferrer">arXiv:2110.08193</a>
      </footer>

      <ChatAssistant
        results={reportResults}
        isOpen={chatOpen}
        onToggle={() => setChatOpen(!chatOpen)}
      />
    </div>
  );
}

export default App;