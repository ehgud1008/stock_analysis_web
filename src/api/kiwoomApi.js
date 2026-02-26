/**
 * 키움증권 API 래퍼 모듈
 * - 현재는 mock 데이터 반환
 * - 추후 실제 백엔드(Spring Boot) 연동 시 BASE_URL만 변경
 */

const BASE_URL = '/api';
const API_AUTH_URL = '/api/auth';
const API_JSON_URL = '/api/json';
// ── API 함수 ─────────────────────────────────────────────

/**
 * 토큰 조회
 * POST http://localhost:8080/api/auth
 */
export async function fetchToken() {
  try {
    const response = await fetch(API_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        header: {
          'api-id': 'au10001',
          authorization: '',
          'cont-yn': '',
          'next-key': '',
        },
        body: {
          grant_type: '',
          appkey: '',
          secretkey: '',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`토큰 발급 실패: ${response.status}`);
    }

    const data = await response.json();
    const token = data.token || data.access_token || data.authorization || JSON.stringify(data);
    return { success: true, token };
  } catch (err) {
    console.warn('백엔드 연결 실패, mock 토큰 사용:', err.message);
    await delay(500);
    return { success: true, token: '' };
  }
}

/**
 * 차트 데이터 조회
 * POST /api/json
 * @param {string} token      - 인증 토큰
 * @param {string} stockCode  - 종목코드 (e.g. "005930")
 * @param {string} chartType  - 차트 유형 (tick|minute|day|week|month|year)
 * @param {string} baseDate   - 기준일자 (YYYY-MM-DD 또는 YYYYMMDD)
 */
export async function fetchChartData(token, stockCode, chartType, baseDate) {
  // 차트 유형별 api-id 매핑
  const apiIdMap = {
    tick: 'ka10079',
    minute: 'ka10080',
    day: 'ka10081',
    week: 'ka10082',
    month: 'ka10083',
    year: 'ka10094',
  };
  const apiId = apiIdMap[chartType] || 'ka10081';

  // 기준일자 포맷: YYYYMMDD
  const formattedDate = baseDate
    ? baseDate.replace(/-/g, '')
    : new Date().toISOString().slice(0, 10).replace(/-/g, '');

  try {
    const response = await fetch(API_JSON_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        header: {
          'api-id': apiId,
          authorization: token,
          'cont-yn': 'N',
          'next-key': '',
        },
        body: {
          stk_cd: stockCode,
          base_dt: formattedDate,
          upd_stkpc_tp: '1',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`차트 조회 실패: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error('차트 데이터 조회 실패:', err.message);
    throw new Error(`데이터 조회 실패: ${err.message}`);
  }
}

/**
 * Gemini API 호출 (API 키는 .env에서 로드)
 * @param {string} prompt     - 분석 프롬프트
 */
export async function requestAIAnalysis(prompt) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('Gemini API Key가 설정되지 않았습니다. API_KEY를 확인하세요.');
  }

  const systemInstruction = `당신은 한국 주식 시장 전문 기술적 분석가입니다.
사용자가 제공하는 데이터는 아래 프레임워크의 2️⃣, 3️⃣ 분석 결과입니다.
당신은 이 데이터를 기반으로 4️⃣, 5️⃣, 6️⃣, 7️⃣ 항목을 분석해야 합니다.

────────────────────
2️⃣ 기술적 구조 분석 (사용자 제공)
────────────────────
(1) 추세 구조 - HH/HL/LH/LL 판별, 20MA/60MA 계산, 추세 방향, 추세 강도
(2) 지지/저항 - 스윙 고점/저점, 최근 거래량 집중 구간, 최근 돌파 여부
(3) 거래량 분석 - 최근 5일 평균 대비 증감률, 돌파 시 거래량 동반 여부, 거래량 감소 추세 여부
(4) 변동성 - 최근 14일 ATR 계산, 최근 3봉 변동성 급증 여부

────────────────────
3️⃣ 매매 전략 도출 (사용자 제공)
────────────────────
[매수 조건] 상승 추세 + 20MA 위 / 저항 돌파 후 지지 확인 / 거래량 동반 고점 돌파
[매도 조건] 직전 저점 이탈 / 20MA 하향 이탈 / 음봉 + 거래량 급증

────────────────────
4️⃣ 기대값 분석 (Expectancy) - 당신이 분석
────────────────────
1. 최근 유사 패턴 N회 탐색
2. 평균 상승폭 (%)
3. 평균 하락폭 (%)
4. 승률 추정
5. 기대값 계산: Expectancy = (승률 × 평균이익) - ((1-승률) × 평균손실)
6. 기대값이 0 이하이면 신호 약화 표시

────────────────────
5️⃣ 리스크 관리 설계 - 당신이 분석
────────────────────
1. 손절가 설정 (최근 스윙 저점 또는 ATR 기반)
2. 1차/2차 목표가
3. 리스크 대비 보상비 (R:R)
4. Kelly Fraction 계산 (보수적으로 0.5 Kelly 적용)
5. 권장 포지션 비중 %

────────────────────
6️⃣ 시나리오 확률 - 당신이 분석
────────────────────
- 상승세(bullish) %
- 하락세(bearish) %
- 횡보세(sideways) %
합계 100%

────────────────────
7️⃣  보유/진입 전략
────────────────────
- 신규진입일 경우 신규진입에 대한 의견
- 보유 중이라면 현재 보유주식수와 평단가에 대한 의견

────────────────────
8️⃣ 총 요약 - 당신이 분석
────────────────────
- 위 4️⃣~7️⃣ 분석 결과를 종합한 요약 (3~5문장)
- 실제 AI로서 투자한다면 매수/매도/관망 중 무엇을 할 것인지 판단 및 근거
- 너의 성향은 리스크를 감수하더라도 수익을 추구하는 성향이야. (리스크:안정 비율은 7:3 정도로 설정)
- 단기(1~2주 이하), 중기(1~3개월 이하), 장기(3개월 이상)로 나누어서 의견을 제시해줘.

[규칙]
- 반드시 숫자와 구체적 근거를 제시하세요
- 한국어로 답변하세요`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4000,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `API 오류: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Gemini 응답에서 텍스트를 추출할 수 없습니다.');
    }
    return text;
  } catch (err) {
    throw new Error(`AI 분석 요청 실패: ${err.message}`);
  }
}

// ── 유틸 ─────────────────────────────────────────────────
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
