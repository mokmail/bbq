/**
 * Enhanced Results Comparison Component
 * Shows detailed Correct/Wrong breakdown with accuracy and bias metrics
 */

import React, { useMemo } from 'react';
import { CheckCircle, XCircle, HelpCircle, Scale, Trophy, Target, TrendingUp, AlertTriangle } from 'lucide-react';

// Color scheme for correct/wrong
const RESULT_COLORS = {
  correct: '#22C55E',
  wrong: '#EF4444',
  unanswered: '#6B7280',
  bias: '#F59E0B',
  neutral: '#3B82F6',
};

// Bias interpretation helper
const interpretBiasScore = (score) => {
  if (score >= 0.75) return { label: 'Severe Bias', color: '#DC2626', icon: AlertTriangle };
  if (score >= 0.5) return { label: 'Strong Bias', color: '#EA580C', icon: AlertTriangle };
  if (score >= 0.25) return { label: 'Moderate Bias', color: '#D97706', icon: AlertTriangle };
  if (score > -0.25 && score < 0.25) return { label: 'Fair / Neutral', color: '#16A34A', icon: CheckCircle };
  if (score <= -0.25) return { label: 'Counter-Bias', color: '#0891B2', icon: Scale };
  return { label: 'Unknown', color: '#6B7280', icon: HelpCircle };
};

// Calculate accuracy from correct/wrong counts
const calculateAccuracy = (correct, wrong, unanswered = 0) => {
  const total = correct + wrong + unanswered;
  return total > 0 ? ((correct / total) * 100).toFixed(1) : '0.0';
};

// Enhanced Results Comparison Table
export const EnhancedResultsComparison = ({ results }) => {
  const comparisonData = useMemo(() => {
    return results.map((result) => {
      const correct = result.correct || 0;
      const incorrect = result.incorrect || 0;
      const unanswered = result.unanswered || 0;
      const total = correct + incorrect + unanswered;

      const accuracy = calculateAccuracy(correct, incorrect, unanswered);
      const biasInterpretation = interpretBiasScore(result.overallBiasScore || 0);

      return {
        modelId: result.modelId,
        modelName: result.modelId.split(':')[0].substring(0, 20),
        correct,
        wrong: incorrect,
        unanswered,
        total,
        accuracy: parseFloat(accuracy),
        biasScore: result.overallBiasScore || 0,
        biasLabel: biasInterpretation.label,
        biasColor: biasInterpretation.color,
        biasIcon: biasInterpretation.icon,
        avgResponseTime: result.averageResponseTime || 0,
      };
    }).sort((a, b) => b.accuracy - a.accuracy); // Sort by accuracy descending
  }, [results]);

  const topPerformer = comparisonData[0];

  return (
    <div className="chart-container enhanced-comparison">
      <h3 className="chart-title">
        <Trophy className="w-5 h-5" style={{ display: 'inline', marginRight: '8px' }} />
        Model Performance Comparison - Correct vs Wrong Analysis
      </h3>
      <p className="text-sm text-gray-500 mb-4" style={{ paddingLeft: '20px', paddingRight: '20px' }}>
        Detailed breakdown showing correct answers, wrong answers, and calculated accuracy for each model.
        Results are sorted by accuracy (highest first).
      </p>

      {/* Top Performer Banner */}
      {topPerformer && (
        <div className="top-performer-banner" style={{
          background: `linear-gradient(135deg, ${RESULT_COLORS.correct}20, ${RESULT_COLORS.correct}05)`,
          borderLeft: `4px solid ${RESULT_COLORS.correct}`,
          padding: '16px',
          marginBottom: '20px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}>
          <Trophy className="w-8 h-8" style={{ color: RESULT_COLORS.correct }} />
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#111827' }}>
              Top Performer: {topPerformer.modelName}
            </div>
            <div style={{ color: '#6B7280', fontSize: '14px' }}>
              {topPerformer.correct} correct out of {topPerformer.total} questions ({topPerformer.accuracy}% accuracy)
            </div>
          </div>
        </div>
      )}

      {/* Comparison Table */}
      <div className="comparison-table-wrapper" style={{ overflowX: 'auto' }}>
        <table className="comparison-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#F3F4F6', borderBottom: '2px solid #E5E7EB' }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Rank</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Model</th>
              <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>
                <span style={{ color: RESULT_COLORS.correct }}>✓ Correct</span>
              </th>
              <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>
                <span style={{ color: RESULT_COLORS.wrong }}>✗ Wrong</span>
              </th>
              <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>
                <span style={{ color: RESULT_COLORS.unanswered }}>? Unanswered</span>
              </th>
              <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>
                <Target className="w-4 h-4" style={{ display: 'inline', marginRight: '4px' }} />
                Accuracy
              </th>
              <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>
                <Scale className="w-4 h-4" style={{ display: 'inline', marginRight: '4px' }} />
                Bias Score
              </th>
              <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>
                <TrendingUp className="w-4 h-4" style={{ display: 'inline', marginRight: '4px' }} />
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {comparisonData.map((model, index) => (
              <tr
                key={model.modelId}
                style={{
                  borderBottom: '1px solid #E5E7EB',
                  backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#F9FAFB',
                }}
              >
                <td style={{ padding: '12px' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: index === 0 ? '#FBBF24' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : '#E5E7EB',
                    color: index < 3 ? '#FFFFFF' : '#374151',
                    fontWeight: 'bold',
                    fontSize: '14px',
                  }}>
                    {index + 1}
                  </span>
                </td>
                <td style={{ padding: '12px', fontWeight: '500' }}>{model.modelName}</td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <span style={{
                    backgroundColor: `${RESULT_COLORS.correct}20`,
                    color: RESULT_COLORS.correct,
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontWeight: '600',
                  }}>
                    {model.correct}
                  </span>
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <span style={{
                    backgroundColor: `${RESULT_COLORS.wrong}20`,
                    color: RESULT_COLORS.wrong,
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontWeight: '600',
                  }}>
                    {model.wrong}
                  </span>
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <span style={{
                    backgroundColor: `${RESULT_COLORS.unanswered}15`,
                    color: RESULT_COLORS.unanswered,
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontWeight: '600',
                  }}>
                    {model.unanswered}
                  </span>
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <span style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: model.accuracy >= 80 ? RESULT_COLORS.correct : model.accuracy >= 50 ? RESULT_COLORS.bias : RESULT_COLORS.wrong,
                  }}>
                    {model.accuracy}%
                  </span>
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: model.biasColor,
                    fontWeight: '600',
                    fontSize: '14px',
                  }}>
                    <model.biasIcon className="w-4 h-4" />
                    {model.biasScore.toFixed(2)}
                  </span>
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: '600',
                    backgroundColor: model.biasColor + '20',
                    color: model.biasColor,
                  }}>
                    {model.biasLabel}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Stats */}
      <div className="summary-stats" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginTop: '24px',
        padding: '20px',
        backgroundColor: '#F9FAFB',
        borderRadius: '8px',
      }}>
        {comparisonData.map((model) => (
          <div key={model.modelId} className="stat-card" style={{
            backgroundColor: '#FFFFFF',
            padding: '16px',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>{model.modelName}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle className="w-4 h-4" style={{ color: RESULT_COLORS.correct }} />
              <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827' }}>{model.correct}</span>
              <span style={{ color: '#6B7280' }}>/</span>
              <XCircle className="w-4 h-4" style={{ color: RESULT_COLORS.wrong }} />
              <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827' }}>{model.wrong}</span>
            </div>
            <div style={{ marginTop: '8px', fontSize: '14px', color: '#6B7280' }}>
              Accuracy: <strong style={{ color: model.accuracy >= 80 ? RESULT_COLORS.correct : model.accuracy >= 50 ? RESULT_COLORS.bias : RESULT_COLORS.wrong }}>{model.accuracy}%</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Detailed per-question results with Correct/Wrong status
export const QuestionResultsDetailed = ({ results }) => {
  const questionAnalysis = useMemo(() => {
    if (!results || results.length === 0) return [];

    // Get all unique questions
    const questionMap = {};

    results.forEach((result) => {
      result.questionResults?.forEach((qr) => {
        if (!qr || !qr.questionId) return;

        if (!questionMap[qr.questionId]) {
          questionMap[qr.questionId] = {
            questionId: qr.questionId,
            question: qr.question,
            context: qr.context,
            options: qr.options,
            correctAnswer: qr.correctAnswer,
            task: qr.task,
            contextType: qr.contextType,
            modelResults: [],
          };
        }

        questionMap[qr.questionId].modelResults.push({
          modelId: result.modelId,
          modelName: result.modelId.split(':')[0].substring(0, 15),
          modelAnswer: qr.modelAnswer,
          isCorrect: qr.isCorrect,
          responseTime: qr.responseTime,
          responseText: qr.responseText,
        });
      });
    });

    return Object.values(questionMap).sort((a, b) => a.questionId - b.questionId);
  }, [results]);

  return (
    <div className="chart-container">
      <h3 className="chart-title">
        <CheckCircle className="w-5 h-5" style={{ display: 'inline', marginRight: '8px' }} />
        Per-Question Results - Correct vs Wrong Analysis
      </h3>
      <p className="text-sm text-gray-500 mb-4" style={{ paddingLeft: '20px', paddingRight: '20px' }}>
        Shows each question with the correct answer and how each model performed. Green checkmarks indicate correct answers,
        red X marks indicate wrong answers.
      </p>

      <div className="question-list" style={{ maxHeight: '600px', overflowY: 'auto' }}>
        {questionAnalysis.map((question) => {
          const correctCount = question.modelResults.filter(r => r.isCorrect).length;
          const wrongCount = question.modelResults.filter(r => !r.isCorrect && r.modelAnswer !== null).length;
          const totalModels = question.modelResults.length;

          return (
            <div key={question.questionId} className="question-card" style={{
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '16px',
              backgroundColor: '#FFFFFF',
            }}>
              {/* Question Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '12px',
                paddingBottom: '12px',
                borderBottom: '1px solid #E5E7EB',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px',
                  }}>
                    <span style={{
                      backgroundColor: '#3B82F6',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                    }}>
                      Q{question.questionId}
                    </span>
                    <span style={{
                      backgroundColor: '#F3F4F6',
                      color: '#6B7280',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                    }}>
                      {question.contextType}
                    </span>
                  </div>
                  {question.context && (
                    <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '4px' }}>
                      <strong>Context:</strong> {question.context}
                    </div>
                  )}
                  <div style={{ fontWeight: '600', color: '#111827' }}>{question.question}</div>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  backgroundColor: '#F0FDF4',
                  borderRadius: '6px',
                }}>
                  <span style={{ fontSize: '13px', color: '#6B7280' }}>Correct Answer:</span>
                  <span style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: RESULT_COLORS.correct,
                  }}>
                    {question.correctAnswer}
                  </span>
                </div>
              </div>

              {/* Options */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Options:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {question.options?.map((opt, idx) => {
                    const letter = opt.charAt(0);
                    const isCorrect = letter === question.correctAnswer;
                    return (
                      <div key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '4px 8px',
                        backgroundColor: isCorrect ? '#F0FDF4' : 'transparent',
                        borderRadius: '4px',
                      }}>
                        <span style={{
                          fontWeight: isCorrect ? 'bold' : 'normal',
                          color: isCorrect ? RESULT_COLORS.correct : '#374151',
                        }}>
                          {opt}
                        </span>
                        {isCorrect && (
                          <CheckCircle className="w-4 h-4" style={{ color: RESULT_COLORS.correct }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Model Results */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: '8px',
              }}>
                {question.modelResults.map((modelResult, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    backgroundColor: modelResult.isCorrect ? '#F0FDF4' : '#FEF2F2',
                    border: `1px solid ${modelResult.isCorrect ? RESULT_COLORS.correct : RESULT_COLORS.wrong}30`,
                    borderRadius: '6px',
                  }}>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: '500',
                      color: '#374151',
                    }}>
                      {modelResult.modelName}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {modelResult.isCorrect ? (
                        <>
                          <span style={{
                            fontWeight: 'bold',
                            color: RESULT_COLORS.correct,
                          }}>{modelResult.modelAnswer}</span>
                          <CheckCircle className="w-4 h-4" style={{ color: RESULT_COLORS.correct }} />
                        </>
                      ) : (
                        <>
                          <span style={{
                            fontWeight: 'bold',
                            color: RESULT_COLORS.wrong,
                          }}>{modelResult.modelAnswer || '?'}</span>
                          <XCircle className="w-4 h-4" style={{ color: RESULT_COLORS.wrong }} />
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div style={{
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: '1px solid #E5E7EB',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <span style={{ fontSize: '13px', color: '#6B7280' }}>
                    <strong style={{ color: RESULT_COLORS.correct }}>{correctCount}</strong> correct
                  </span>
                  <span style={{ fontSize: '13px', color: '#6B7280' }}>
                    <strong style={{ color: RESULT_COLORS.wrong }}>{wrongCount}</strong> wrong
                  </span>
                </div>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: correctCount === totalModels ? RESULT_COLORS.correct : correctCount === 0 ? RESULT_COLORS.wrong : RESULT_COLORS.bias,
                }}>
                  {((correctCount / totalModels) * 100).toFixed(0)}% models correct
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EnhancedResultsComparison;
