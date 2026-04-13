/**
 * Gemini API responseSchema - 단일 종목 AI 분석 응답 스키마
 * prompt.md의 JSON 형식 섹션을 대체하여 API 레벨에서 구조를 강제합니다.
 */

const analysisResponseSchema = {
  type: 'object',
  properties: {
    expectancy: {
      type: 'object',
      description: '기대값 분석 (Expectancy)',
      properties: {
        pattern_count: { type: 'number', description: '유사 패턴 횟수 추정 (최근 데이터 기반)' },
        avg_gain_pct: { type: 'number', description: '평균 상승폭 (%)' },
        avg_loss_pct: { type: 'number', description: '평균 하락폭 (%)' },
        win_rate_pct: { type: 'number', description: '승률 추정 (%)' },
        expectancy_value: {
          type: 'number',
          description: '기대값 = (승률 × 평균이익) - ((1-승률) × 평균손실)',
        },
        signal_weakened: {
          type: 'boolean',
          description: '기대값이 0 이하이면 true (신호 약화)',
        },
        reasoning: { type: 'string', description: '기대값 도출에 대한 논리적 근거' },
        description: { type: 'string', description: '기대값 분석에 대한 상세 설명 3~5문장' },
      },
      required: [
        'pattern_count',
        'avg_gain_pct',
        'avg_loss_pct',
        'win_rate_pct',
        'expectancy_value',
        'signal_weakened',
        'reasoning',
        'description',
      ],
    },
    risk_management: {
      type: 'object',
      description: '리스크 관리 설계',
      properties: {
        stop_loss: { type: 'number', description: '손절가 (원, 최근 스윙 저점 또는 ATR 기반)' },
        stop_loss_reason: { type: 'string', description: '손절가 설정 근거' },
        target_1: { type: 'number', description: '1차 목표가 (원)' },
        target_2: { type: 'number', description: '2차 목표가 (원)' },
        risk_reward_ratio: { type: 'string', description: '리스크 대비 보상비 (R:R)' },
        kelly_fraction: {
          type: 'number',
          description: 'Kelly Fraction: f* = (p(b+1)-1)/b',
        },
        half_kelly: { type: 'number', description: '0.5 Kelly (Half-Kelly) 적용 값' },
        recommended_position_pct: {
          type: 'number',
          description: 'Half-Kelly 기반 권장 포지션 비중 (%)',
        },
        reasoning: { type: 'string', description: '비중 및 목표가 설정에 대한 논리적 근거' },
        description: { type: 'string', description: '리스크 관리 설계에 대한 상세 설명 3~5문장' },
      },
      required: [
        'stop_loss',
        'stop_loss_reason',
        'target_1',
        'target_2',
        'risk_reward_ratio',
        'kelly_fraction',
        'half_kelly',
        'recommended_position_pct',
        'reasoning',
        'description',
      ],
    },
    scenarios: {
      type: 'object',
      description: '시나리오 확률 (상승/하락/횡보 합계 100%)',
      properties: {
        bullish_pct: { type: 'number', description: '상승 확률 (%)' },
        bearish_pct: { type: 'number', description: '하락 확률 (%)' },
        sideways_pct: { type: 'number', description: '횡보 확률 (%)' },
        bullish_desc: { type: 'string', description: '상승 시나리오 예상 흐름 및 근거' },
        bearish_desc: { type: 'string', description: '하락 시나리오 예상 흐름 및 근거' },
        sideways_desc: { type: 'string', description: '횡보 시나리오 예상 흐름 및 근거' },
      },
      required: [
        'bullish_pct',
        'bearish_pct',
        'sideways_pct',
        'bullish_desc',
        'bearish_desc',
        'sideways_desc',
      ],
    },
    summary: {
      type: 'object',
      description: '총 요약 및 최종 판단',
      properties: {
        overall: { type: 'string', description: 'C/D/E 분석 결과를 종합한 총 요약 3~5문장' },
        decision: {
          type: 'string',
          enum: ['buy', 'sell', 'hold'],
          description: '최종 판단',
        },
        decision_label: {
          type: 'string',
          description: '매수/매도/관망 한글 라벨',
        },
        confidence_pct: { type: 'number', description: '최종 판단 확신도 (0~100)' },
        reasoning: { type: 'string', description: '최종 판단에 대한 핵심 근거' },
        short_term: {
          type: 'object',
          description: '단기(1~2주 이하) 대응 전략',
          properties: {
            decision: { type: 'string', enum: ['buy', 'sell', 'hold'] },
            decision_label: { type: 'string', description: '매수/매도/관망 한글' },
            reasoning: {
              type: 'string',
              description: '단기 모멘텀 및 변동성 중심 의견',
            },
          },
          required: ['decision', 'decision_label', 'reasoning'],
        },
        mid_term: {
          type: 'object',
          description: '중기(1~3개월) 대응 전략',
          properties: {
            decision: { type: 'string', enum: ['buy', 'sell', 'hold'] },
            decision_label: { type: 'string', description: '매수/매도/관망 한글' },
            reasoning: {
              type: 'string',
              description: '중기 추세 및 지지/저항 중심 의견',
            },
          },
          required: ['decision', 'decision_label', 'reasoning'],
        },
        long_term: {
          type: 'object',
          description: '장기(3개월 이상) 대응 전략',
          properties: {
            decision: { type: 'string', enum: ['buy', 'sell', 'hold'] },
            decision_label: { type: 'string', description: '매수/매도/관망 한글' },
            reasoning: {
              type: 'string',
              description: '장기 구조적/싸이클 관점 의견',
            },
          },
          required: ['decision', 'decision_label', 'reasoning'],
        },
      },
      required: [
        'overall',
        'decision',
        'decision_label',
        'confidence_pct',
        'reasoning',
        'short_term',
        'mid_term',
        'long_term',
      ],
    },
    holding_strategy: {
      type: 'object',
      description: '보유종목 전략 (보유 포지션 정보가 제공된 경우에만 유효한 분석)',
      properties: {
        action: {
          type: 'string',
          enum: ['add_buy', 'hold', 'partial_sell', 'full_sell'],
          description: '보유종목 액션: 추가매수(add_buy), 보유유지(hold), 부분매도(partial_sell), 전량매도(full_sell)',
        },
        action_label: {
          type: 'string',
          description: '추가매수/보유유지/부분매도/전량매도 한글 라벨',
        },
        pnl_assessment: {
          type: 'string',
          description: '현재 평균 매수가 대비 수익/손실 상태 평가 및 향후 전략에 미치는 영향 분석 (2~3문장)',
        },
        position_adjustment: {
          type: 'string',
          description: '비중 조정 전략: 추가 매수 시 적정 매수 비중, 부분 매도 시 매도 비율 등 구체적 비중 제시',
        },
        revised_stop_loss: {
          type: 'number',
          description: '보유 포지션 기준 재설정 손절가 (원, 평균 매수가 고려)',
        },
        revised_target: {
          type: 'number',
          description: '보유 포지션 기준 재설정 목표가 (원, 수익 극대화 관점)',
        },
        reasoning: {
          type: 'string',
          description: '보유종목 전략의 구체적이고 논리적인 근거 3~5문장',
        },
      },
      required: [
        'action',
        'action_label',
        'pnl_assessment',
        'position_adjustment',
        'revised_stop_loss',
        'revised_target',
        'reasoning',
      ],
    },
  },
  required: ['expectancy', 'risk_management', 'scenarios', 'summary', 'holding_strategy'],
};

export default analysisResponseSchema;

