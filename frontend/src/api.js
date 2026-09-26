/**
 * API Service for Hackathon AI Analysis
 *
 * Supports switching between Demo Mode (instant realistic mock data)
 * and Live API (POST http://localhost:8000/api/analyze).
 *
 * Failsafe: If Live API is selected but the backend server is unreachable
 * or returns an error, it gracefully falls back to mock data with a warning flag
 * to ensure presentations to judges run flawlessly without breaking.
 */

const API_BASE_URL = 'http://localhost:8000';

export const MOCK_ANALYSIS_RESULT = {
  kpis: {
    timeSaved: { value: '42.8 hrs', change: '+18.4%', trend: 'up', label: 'Time Saved / Week' },
    costReduction: { value: '$12,450', change: '+32.1%', trend: 'up', label: 'Est. Cost Reduction' },
    confidenceScore: { value: '98.4%', change: '+4.2%', trend: 'up', label: 'Model Confidence' },
  },
  chartData: [
    { period: 'Sprint 1', baseline: 120, aiOptimized: 45, savings: 75 },
    { period: 'Sprint 2', baseline: 140, aiOptimized: 50, savings: 90 },
    { period: 'Sprint 3', baseline: 165, aiOptimized: 55, savings: 110 },
    { period: 'Sprint 4', baseline: 190, aiOptimized: 60, savings: 130 },
    { period: 'Sprint 5', baseline: 210, aiOptimized: 68, savings: 142 },
    { period: 'Sprint 6', baseline: 245, aiOptimized: 72, savings: 173 },
  ],
  insights: {
    executiveSummary:
      'The multi-modal AI model identified high-impact optimization vectors across existing workflows, projecting an immediate 62% latency cut and $12.4k monthly infrastructure savings.',
    keyFindings: [
      'Identified 4 critical bottlenecks in data processing pipelines that can be parallelized.',
      'Automated semantic categorization achieved 98.4% precision against manual baseline.',
      'Resource reallocation frees up an estimated 42.8 engineering hours per sprint.',
    ],
    recommendedActions: [
      'Deploy real-time inference cache on top-tier queries to shave ~220ms per invocation.',
      'Activate autonomous pipeline triage for edge failure detection.',
      'Integrate webhook notification triggers for anomaly scores exceeding 0.85.',
    ],
    riskScore: 'Low (12/100)',
    latencyMs: 142,
    timestamp: new Date().toISOString(),
  },
};

/**
 * Run AI Analysis
 * @param {Object} params
 * @param {string} params.prompt - Input text/prompt
 * @param {File|null} params.file - Attached file if any
 * @param {boolean} params.isLiveApi - Whether to attempt live backend call
 * @returns {Promise<{data: Object, isFallback: boolean, source: string}>}
 */
export async function runAIAnalysis({ prompt, file = null, isLiveApi = false }) {
  // If Demo Mode is explicitly active, return mock data with simulated realistic network delay
  if (!isLiveApi) {
    await new Promise((resolve) => setTimeout(resolve, 850)); // simulate brief AI processing
    return {
      success: true,
      data: {
        ...MOCK_ANALYSIS_RESULT,
        insights: {
          ...MOCK_ANALYSIS_RESULT.insights,
          timestamp: new Date().toLocaleTimeString(),
        },
      },
      isFallback: false,
      source: 'Mock Data (Demo Mode)',
    };
  }

  // Attempt Live API call
  try {
    const formData = new FormData();
    formData.append('prompt', prompt || '');
    if (file) {
      formData.append('file', file);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const response = await fetch(`${API_BASE_URL}/api/analyze`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      success: true,
      data: result,
      isFallback: false,
      source: 'Live API (http://localhost:8000)',
    };
  } catch (error) {
    console.warn(
      '[Hackathon UI] Live API failed or unreachable. Seamlessly activating demo fallback:',
      error.message
    );

    // Graceful fallback to guarantee zero demo crashes
    return {
      success: true,
      data: {
        ...MOCK_ANALYSIS_RESULT,
        insights: {
          ...MOCK_ANALYSIS_RESULT.insights,
          timestamp: new Date().toLocaleTimeString(),
        },
      },
      isFallback: true,
      source: 'Demo Fallback (Live API unreachable at localhost:8000)',
      error: error.message,
    };
  }
}
