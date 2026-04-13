/**
 * Gemini API responseSchema - 종목 비교 분석 응답 스키마
 * prompt_compare.md의 JSON 형식 섹션을 대체하여 API 레벨에서 구조를 강제합니다.
 */

const compareResponseSchema = {
  type: 'object',
  properties: {
    ranking: {
      type: 'array',
      description: '종목별 랭킹 (1위~N위, 종합 점수 기준)',
      items: {
        type: 'object',
        properties: {
          rank: { type: 'number', description: '순위' },
          code: { type: 'string', description: '종목코드' },
          name: { type: 'string', description: '종목명' },
          score: { type: 'number', description: '100점 만점 종합 점수' },
          strengths: {
            type: 'array',
            description: '강점 목록',
            items: { type: 'string' },
          },
          weaknesses: {
            type: 'array',
            description: '약점 목록',
            items: { type: 'string' },
          },
          reasoning: { type: 'string', description: '이 순위를 매긴 핵심 근거' },
        },
        required: ['rank', 'code', 'name', 'score', 'strengths', 'weaknesses', 'reasoning'],
      },
    },
    best_pick: {
      type: 'object',
      description: '최적 매수 종목 선정',
      properties: {
        code: { type: 'string', description: '종목코드' },
        name: { type: 'string', description: '종목명' },
        reasoning: { type: 'string', description: '최적 종목으로 선정한 상세 근거 3~5문장' },
        entry_strategy: { type: 'string', description: '진입 전략: 언제, 어떻게 매수할지' },
        risk_note: { type: 'string', description: '주의할 리스크 요인' },
      },
      required: ['code', 'name', 'reasoning', 'entry_strategy', 'risk_note'],
    },
    comparison_table: {
      type: 'object',
      description: '종목 비교 테이블',
      properties: {
        metrics: {
          type: 'array',
          description: '비교 지표 목록',
          items: { type: 'string' },
        },
        stocks: {
          type: 'array',
          description: '각 종목별 지표 값',
          items: {
            type: 'object',
            properties: {
              code: { type: 'string', description: '종목코드' },
              name: { type: 'string', description: '종목명' },
              values: {
                type: 'object',
                description: '지표별 값',
                properties: {
                  expectancy: { type: 'number', description: '기대값' },
                  win_rate: { type: 'number', description: '승률 (%)' },
                  rr_ratio: { type: 'string', description: '손익비 (R:R)' },
                  bullish_pct: { type: 'number', description: '상승 확률 (%)' },
                  confidence: { type: 'number', description: '확신도 (%)' },
                  kelly: { type: 'number', description: 'Half-Kelly 비중 (%)' },
                },
                required: ['expectancy', 'win_rate', 'rr_ratio', 'bullish_pct', 'confidence', 'kelly'],
              },
            },
            required: ['code', 'name', 'values'],
          },
        },
      },
      required: ['metrics', 'stocks'],
    },
    portfolio: {
      type: 'object',
      description: '포트폴리오 비중 배분',
      properties: {
        recommendation: { type: 'string', description: '포트폴리오 비중 배분 전략 설명' },
        allocations: {
          type: 'array',
          description: '종목별 비중 배분',
          items: {
            type: 'object',
            properties: {
              code: { type: 'string', description: '종목코드' },
              name: { type: 'string', description: '종목명' },
              weight_pct: { type: 'number', description: '추천 비중 (%)' },
              reasoning: { type: 'string', description: '비중 근거' },
            },
            required: ['code', 'name', 'weight_pct', 'reasoning'],
          },
        },
      },
      required: ['recommendation', 'allocations'],
    },
    overall_summary: {
      type: 'string',
      description: '전체 비교 분석 종합 요약 3~5문장',
    },
  },
  required: ['ranking', 'best_pick', 'comparison_table', 'portfolio', 'overall_summary'],
};

export default compareResponseSchema;
