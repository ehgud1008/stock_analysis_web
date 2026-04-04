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
 * POST http://140.238.15.94:8080/api/auth
 */
export async function fetchToken() {
  try {
    const response = await fetch(API_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      redirect: 'manual',
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

    if (response.status === 302 || response.type === 'opaqueredirect') {
      return { success: false, error: '키움증권 서버가 점검 중입니다. 잠시 후 다시 시도해주세요.' };
    }

    if (!response.ok) {
      return { success: false, error: '키움증권 서버가 점검 중입니다. 잠시 후 다시 시도해주세요.' };
    }

    const data = await response.json();
    const token = data.token || data.access_token || data.authorization || JSON.stringify(data);
    return { success: true, token };
  } catch (err) {
    return { success: false, error: '키움증권 서버가 점검 중입니다. 잠시 후 다시 시도해주세요.' };
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
      redirect: 'manual',
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

    if (response.status === 302 || response.type === 'opaqueredirect') {
      throw new Error('키움증권 서버가 점검 중입니다. 잠시 후 다시 시도해주세요.');
    }

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
 * 종목 기본 정보 조회
 * POST /api/json (api-id: ka10001)
 * @param {string} token     - 인증 토큰
 * @param {string} stockCode - 종목코드 (e.g. "005930")
 */
export async function fetchStockInfo(token, stockCode) {
  try {
    const response = await fetch(API_JSON_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      redirect: 'manual',
      body: JSON.stringify({
        header: {
          'api-id': 'ka10001',
          authorization: token,
          'cont-yn': 'N',
          'next-key': '',
        },
        body: {
          stk_cd: stockCode,
        },
      }),
    });

    if (response.status === 302 || response.type === 'opaqueredirect') {
      throw new Error('키움증권 서버가 점검 중입니다. 잠시 후 다시 시도해주세요.');
    }

    if (!response.ok) {
      throw new Error(`종목 정보 조회 실패: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error('종목 정보 조회 실패:', err.message);
    throw new Error(`종목 정보 조회 실패: ${err.message}`);
  }
}

/**
 * 비교 분석 AI 호출 (서버사이드 Serverless Function 경유)
 * @param {string} stocksJson - 비교 대상 종목 데이터 JSON 문자열
 */
export async function requestCompareAnalysis(stocksJson) {
  try {
    const response = await fetch('/api/ai/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stocksJson }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `API 오류: ${response.status}`);
    }

    const data = await response.json();
    return data.text;
  } catch (err) {
    throw new Error(`비교 분석 요청 실패: ${err.message}`);
  }
}

/**
 * Gemini AI 분석 호출 (서버사이드 Serverless Function 경유)
 * @param {string} prompt - 차트 데이터 + 분석 프롬프트
 */
export async function requestAIAnalysis(prompt) {
  try {
    const response = await fetch('/api/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `API 오류: ${response.status}`);
    }

    const data = await response.json();
    return data.text;
  } catch (err) {
    throw new Error(`AI 분석 요청 실패: ${err.message}`);
  }
}

// ── 유틸 ─────────────────────────────────────────────────
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
