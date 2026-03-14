import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Brain, 
  BarChart3,
  Info,
  ChevronRight,
  Target,
  Scale,
  Bot,
  FileText
} from 'lucide-react';
import { bbqQuestions, TaskLabels, BBQTasks, getQuestionsByTask } from './data/bbqQuestions';
import LLMEvaluator from './components/LLMEvaluator';
import ReportView from './components/ReportView';
import logo from './assets/logo.png';
import './index.css';

// BBQ Benchmark Evaluation Component
const BBQEvaluator = () => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [results, setResults] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);

  const filteredQuestions = selectedTask 
    ? getQuestionsByTask(selectedTask)
    : bbqQuestions;

  const currentQuestion = filteredQuestions[currentQuestionIndex];

  const handleAnswer = (answer) => {
    if (!showResult) {
      setSelectedAnswer(answer);
      setShowResult(true);
      
      const isCorrect = answer === currentQuestion.correctAnswer;
      setResults([...results, {
        questionId: currentQuestion.id,
        selected: answer,
        correct: currentQuestion.correctAnswer,
        isCorrect,
        task: currentQuestion.task,
        hasContext: currentQuestion.hasContext
      }]);
    }
  };

  const nextQuestion = () => {
    setSelectedAnswer(null);
    setShowResult(false);
    if (currentQuestionIndex < filteredQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const resetEvaluation = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setResults([]);
  };

  const calculateScore = () => {
    if (results.length === 0) return 0;
    const correct = results.filter(r => r.isCorrect).length;
    return (correct / results.length) * 100;
  };

  const score = calculateScore();
  const taskStats = results.reduce((acc, r) => {
    acc[r.task] = acc[r.task] || { correct: 0, total: 0 };
    acc[r.task].total++;
    if (r.isCorrect) acc[r.task].correct++;
    return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="glass-card p-6 mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <img src={logo} alt="Kmail BBQ Benchmarking" className="app-logo" />
          <h1 className="text-3xl font-bold text-gray-800">Kmail BBQ Benchmarking</h1>
        </div>
        <p className="text-gray-600">
          Bias Benchmark for Question Answering - Evaluate model responses for social biases
        </p>
      </div>

      {/* Task Filter */}
      <div className="glass-card p-4 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Filter by Bias Category:
        </label>
        <select
          value={selectedTask || ''}
          onChange={(e) => {
            setSelectedTask(e.target.value || null);
            setCurrentQuestionIndex(0);
            setResults([]);
            setSelectedAnswer(null);
            setShowResult(false);
          }}
          className="glass-input"
        >
          <option value="">All Categories</option>
          {Object.entries(TaskLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Progress */}
      <div className="glass-card p-4 mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Question {currentQuestionIndex + 1} of {filteredQuestions.length}</span>
          <span>Score: {results.length > 0 ? `${Math.round(score)}%` : 'N/A'}</span>
        </div>
        <div className="progress-bar">
          <div 
            className="progress-bar-fill"
            style={{ width: `${((currentQuestionIndex + 1) / filteredQuestions.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Question Card */}
      {currentQuestion && (
        <div className="question-card">
          {/* Context */}
          {currentQuestion.context && (
            <div className="alert alert-info mb-4">
              <div className="flex items-center gap-2 text-blue-800 mb-2">
                <Info className="w-5 h-5" />
                <span className="font-medium">Context Provided:</span>
              </div>
              <p className="text-blue-700 mt-1">{currentQuestion.context}</p>
            </div>
          )}

          {!currentQuestion.context && (
            <div className="alert alert-warning mb-4">
              <div className="flex items-center gap-2 text-orange-800 mb-2">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-medium">Insufficient Context</span>
              </div>
              <p className="text-orange-700 mt-1">
                This question tests for bias when context is insufficient
              </p>
            </div>
          )}

          {/* Task Badge */}
          <div className="mb-4">
            <span className="badge badge-blue">
              {TaskLabels[currentQuestion.task]}
            </span>
          </div>

          {/* Question */}
          <h2 className="text-xl font-semibold text-gray-800 mb-6">
            {currentQuestion.question}
          </h2>

          {/* Options */}
          <div className="flex flex-col gap-3">
            {currentQuestion.options.map((option, index) => {
              const letter = option.charAt(0);
              let buttonClass = 'option-btn ';
              
              if (showResult) {
                if (letter === currentQuestion.correctAnswer) {
                  buttonClass += 'correct';
                } else if (letter === selectedAnswer && letter !== currentQuestion.correctAnswer) {
                  buttonClass += 'incorrect';
                }
              } else {
                buttonClass += selectedAnswer === letter ? 'selected' : '';
              }

              return (
                <button
                  key={index}
                  onClick={() => handleAnswer(letter)}
                  disabled={showResult}
                  className={buttonClass}
                >
                  <div className="flex items-center gap-3">
                    {showResult && letter === currentQuestion.correctAnswer && (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                    {showResult && letter === selectedAnswer && letter !== currentQuestion.correctAnswer && (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    <span className="text-gray-700">{option}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Result Feedback */}
          {showResult && (
            <div className={`alert mt-6 ${selectedAnswer === currentQuestion.correctAnswer ? 'alert-success' : 'alert-warning'}`}>
              <div className="flex items-center gap-2 mb-2">
                {selectedAnswer === currentQuestion.correctAnswer ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-600" />
                )}
                <span className={`font-bold ${selectedAnswer === currentQuestion.correctAnswer ? 'text-green-700' : 'text-red-700'}`}>
                  {selectedAnswer === currentQuestion.correctAnswer ? 'Correct!' : 'Incorrect'}
                </span>
              </div>
              <p className="text-gray-700">
                The correct answer is: <strong>{currentQuestion.correctAnswer}</strong> - {currentQuestion.options.find(o => o.startsWith(currentQuestion.correctAnswer))}
              </p>
            </div>
          )}

          {/* Navigation */}
          {showResult && currentQuestionIndex < filteredQuestions.length - 1 && (
            <button
              onClick={nextQuestion}
              className="btn-primary mt-6 w-full flex items-center justify-center gap-2"
            >
              Next Question <ChevronRight className="w-5 h-5" />
            </button>
          )}

          {showResult && currentQuestionIndex === filteredQuestions.length - 1 && results.length > 0 && (
            <button
              onClick={resetEvaluation}
              className="btn-secondary mt-6 w-full"
            >
              Start Over
            </button>
          )}
        </div>
      )}

      {/* Results Summary */}
      {results.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-6 h-6" /> Evaluation Results
          </h3>
          
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="stat-card stat-card-blue">
              <div className="text-3xl font-bold text-blue-600">{results.length}</div>
              <div className="text-gray-600">Questions Answered</div>
            </div>
            <div className="stat-card stat-card-green">
              <div className="text-3xl font-bold text-green-600">
                {results.filter(r => r.isCorrect).length}
              </div>
              <div className="text-gray-600">Correct Answers</div>
            </div>
            <div className="stat-card stat-card-purple">
              <div className="text-3xl font-bold text-purple-600">{Math.round(score)}%</div>
              <div className="text-gray-600">Accuracy Score</div>
            </div>
          </div>

          {/* Task Breakdown */}
          <div className="mb-4">
            <h4 className="font-semibold text-gray-700 mb-3">Performance by Bias Category:</h4>
            <div className="flex flex-col gap-2">
              {Object.entries(taskStats).map(([task, stats]) => (
                <div key={task} className="flex items-center justify-between p-3 bg-gray-100 rounded-lg">
                  <span className="font-medium text-gray-700">{TaskLabels[task]}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">
                      {stats.correct}/{stats.total} ({Math.round((stats.correct / stats.total) * 100)}%)
                    </span>
                    <div className="progress-bar" style={{ width: '96px' }}>
                      <div 
                        className="progress-bar-fill"
                        style={{ 
                          width: `${(stats.correct / stats.total) * 100}%`,
                          backgroundColor: stats.correct / stats.total >= 0.8 ? '#22c55e' : stats.correct / stats.total >= 0.5 ? '#fbbf24' : '#ef4444'
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Context Analysis */}
          <div className="mt-6 p-4 bg-gray-100 rounded-lg">
            <h4 className="font-semibold text-gray-700 mb-2">Context Analysis:</h4>
            <p className="text-sm text-gray-600 mb-3">
              The BBQ benchmark evaluates bias at two levels based on context availability:
            </p>
            <ul className="text-sm text-gray-600">
              <li><strong>Insufficient context (ambiguous):</strong> Tests for social stereotyping biases</li>
              <li><strong>Sufficient context:</strong> Tests if bias overrides correct answer</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

// Info Component about BBQ Benchmark
const BBQInfo = () => (
  <div className="max-w-4xl mx-auto p-6">
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-8 text-white mb-8 glass-shimmer">
      <h2 className="text-3xl font-bold mb-4 flex items-center gap-3">
        <Brain className="w-8 h-8" />
        What is the BBQ Benchmark?
      </h2>
      <p className="text-lg" style={{ opacity: 0.9 }}>
        BBQ (Bias Benchmark for Question Answering) evaluates an LLM's ability to generate 
        unbiased responses across various attested social biases. It consists of 58K unique 
        trinary choice questions spanning 11 bias categories.
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Target className="w-8 h-8 text-blue-600" />
          <h3 className="text-xl font-bold text-gray-800">Two-Level Bias Evaluation</h3>
        </div>
        <ul className="space-y-3 text-gray-600">
          <li className="flex items-start gap-2">
            <span className="font-bold text-blue-600">1.</span>
            Responses reflect social biases given insufficient context
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-blue-600">2.</span>
            Model's bias overrides the correct choice given sufficient context
          </li>
        </ul>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Scale className="w-8 h-8 text-purple-600" />
          <h3 className="text-xl font-bold text-gray-800">11 Bias Categories</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
          {Object.values(TaskLabels).map((label) => (
            <span key={label} className="flex items-center gap-1">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>

    <div className="glass-card p-6">
      <h3 className="text-xl font-bold text-gray-800 mb-4">Scoring</h3>
      <p className="text-gray-600 mb-4">
        The overall score ranges from 0 to 1, where 1 signifies perfect performance and 0 
        indicates no correct answers. The score is calculated using <strong>exact matching</strong>, 
        determining the proportion of questions where the model produces the precise correct 
        multiple choice answer.
      </p>
      <div className="alert alert-warning">
        <div className="flex items-center gap-2 text-yellow-800 mb-2">
          <Info className="w-5 h-5" />
          <span className="font-medium">Tip</span>
        </div>
        <p className="text-yellow-700">
          Utilizing more few-shot prompts (n_shots) can greatly improve model robustness 
          in generating answers in the exact correct format.
        </p>
      </div>
    </div>

    <div className="glass-card p-6 mt-8">
      <h3 className="text-xl font-bold text-gray-800 mb-4">Techniques Used</h3>
      <div className="space-y-4 text-gray-600">
        <div>
          <h4 className="font-semibold text-gray-800 mb-1">Dataset Handling</h4>
          <p>
            Questions are loaded from the BBQ dataset and grouped by category. You can filter by
            category and cap the number of questions per category to build balanced test sets.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-gray-800 mb-1">Prompting Modes</h4>
          <p>
            Two prompt modes are supported: a standard fairness prompt and a tricky prompt. This
            allows side-by-side testing of robustness to misleading or ambiguous wording.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-gray-800 mb-1">Bias-Aware Evaluation</h4>
          <p>
            Each question is labeled as ambiguous or disambiguated. Ambiguous questions test for
            stereotyping under insufficient context, while disambiguated questions test correctness
            when the correct answer is explicitly identified.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-gray-800 mb-1">Accuracy and Bias Metrics</h4>
          <p>
            Accuracy is computed as exact-match correctness. Bias scoring follows the BBQ paper
            using stereotyped vs non-stereotyped answer distributions for ambiguous items, producing
            per-task and overall bias scores.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-gray-800 mb-1">Performance Analytics</h4>
          <p>
            Response times, per-task accuracy, and context impact are aggregated to create charts and
            comparative dashboards. Live evaluation updates support monitoring while a run is active.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-gray-800 mb-1">Reporting and Auditability</h4>
          <p>
            Results can be saved to a report view that produces print-ready summaries, AI commentary,
            and tabular model comparisons for sharing with stakeholders.
          </p>
        </div>
      </div>
    </div>
  </div>
);

// Main App Component
function App() {
  const [activeTab, setActiveTab] = useState('evaluate');
  const [reportResults, setReportResults] = useState([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('kmail-bbq-report');
      if (saved) {
        setReportResults(JSON.parse(saved));
      }
    } catch (error) {
      console.warn('Failed to load saved report data.', error);
    }
  }, []);

  useEffect(() => {
    try {
      if (reportResults && reportResults.length > 0) {
        localStorage.setItem('kmail-bbq-report', JSON.stringify(reportResults));
      }
    } catch (error) {
      console.warn('Failed to persist report data.', error);
    }
  }, [reportResults]);

  return (
    <div className="app-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 glass-nav">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <img src={logo} alt="Kmail BBQ Benchmarking" className="nav-logo" />
              <span className="text-xl font-bold text-gray-800">Kmail BBQ Benchmarking</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('evaluate')}
                className={`flex items-center gap-2 ${activeTab === 'evaluate' ? 'active' : ''}`}
              >
                <Bot className="w-4 h-4" />
                Evaluate
              </button>
              <button
                onClick={() => setActiveTab('report')}
                className={`flex items-center gap-2 ${activeTab === 'report' ? 'active' : ''}`}
              >
                <FileText className="w-4 h-4" />
                Report
              </button>
              <button
                onClick={() => setActiveTab('info')}
                className={activeTab === 'info' ? 'active' : ''}
              >
                About BBQ
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="py-8 glass-overlay min-h-screen">
        {activeTab === 'evaluate' && (
          <LLMEvaluator
            onResultsChange={setReportResults}
            onSaveReport={setReportResults}
          />
        )}
        {activeTab === 'report' && (
          <ReportView results={reportResults} />
        )}
        {activeTab === 'info' && (
          <BBQInfo />
        )}
      </main>

      {/* Footer */}
      <footer>
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-gray-400">
            Kmail BBQ Benchmarking - Based on{' '}
            <a 
              href="https://deepeval.com/docs/benchmarks-bbq" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              DeepEval BBQ
            </a>
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Reference: BBQ Paper (arxiv.org/pdf/2110.08193)
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;