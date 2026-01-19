"use client"

import React from 'react'
import { Badge } from '@/components/ui/badge'

export interface SurveyResultsProps {
  survey: any
}

export default function SurveyResults({ survey }: SurveyResultsProps) {
  // Handle different survey data formats
  const results = survey?.results || survey?.responses || survey || {}
  const questions = survey?.questions || []
  const sentiment = survey?.sentiment || survey?.sentiment_analysis
  const overallScore = survey?.score || survey?.overall_score
  const dtmfResponses = Array.isArray(survey?.responses)
    ? survey.responses
    : Array.isArray(survey?.results?.responses)
      ? survey.results.responses
      : []
  const isDtmfSurvey = dtmfResponses.length > 0 && dtmfResponses[0]?.question_index !== undefined

  return (
    <section aria-labelledby="survey-results" className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h4 id="survey-results" className="text-lg font-medium text-gray-800">
          Survey Results
        </h4>
        {overallScore !== undefined && (
          <Badge variant={overallScore >= 4 ? 'success' : overallScore >= 3 ? 'warning' : 'error'}>
            Score: {overallScore}/5
          </Badge>
        )}
      </div>

      {sentiment && (
        <div className="p-4 bg-white rounded-md border border-gray-200">
          <div className="text-sm font-medium text-gray-800 mb-2">Sentiment Analysis</div>
          <div className="flex items-center gap-2">
            <Badge variant={sentiment === 'positive' ? 'success' : sentiment === 'negative' ? 'error' : 'warning'}>
              {sentiment}
            </Badge>
            {survey?.sentiment_score && (
              <span className="text-sm text-gray-500">
                Confidence: {(survey.sentiment_score * 100).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      )}

      {isDtmfSurvey ? (
        <div className="space-y-4">
          {dtmfResponses.map((r: any) => (
            <div key={`${r.question_index}-${r.digit || r.value}`} className="p-4 bg-white rounded-md border border-gray-200">
              <div className="text-sm font-medium text-gray-800 mb-2">
                Q{r.question_index}: {r.question || 'Question'}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{r.value || r.digit || 'No response'}</span>
                {r.digit && (
                  <Badge variant="info">DTMF: {r.digit}</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : questions.length > 0 ? (
        <div className="space-y-4">
          {questions.map((q: any, idx: number) => (
            <div key={idx} className="p-4 bg-white rounded-md border border-gray-200">
              <div className="text-sm font-medium text-gray-800 mb-2">{q.question || q.text}</div>
              <div className="text-sm text-gray-600 mb-2">
                Response: {q.response || q.answer || 'No response'}
              </div>
              {q.score !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Score:</span>
                  <Badge variant={q.score >= 4 ? 'success' : q.score >= 3 ? 'warning' : 'error'}>
                    {q.score}/5
                  </Badge>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 bg-white rounded-md border border-gray-200">
          <div className="text-sm text-gray-500 mb-2">Survey Responses:</div>
          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
            {JSON.stringify(results, null, 2)}
          </pre>
        </div>
      )}

      {survey?.breakdown && (
        <div className="p-4 bg-white rounded-md border border-gray-200">
          <div className="text-sm font-medium text-gray-800 mb-2">Score Breakdown</div>
          <div className="space-y-2">
            {Object.entries(survey.breakdown).map(([key, value]: [string, any]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-slate-300">{key}</span>
                <Badge variant="default">{value}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
