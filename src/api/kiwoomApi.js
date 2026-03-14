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
 * prompt.md 로드 및 캐싱
 */
let cachedPromptMd = null;

async function loadPromptMd() {
  if (cachedPromptMd) return cachedPromptMd;
  const res = await fetch('/prompt.md');
  if (!res.ok) throw new Error('prompt.md 로드 실패');
  cachedPromptMd = await res.text();
  return cachedPromptMd;
}

/**
 * prompt.md에서 시스템 지시문과 분석 지시사항을 분리
 * "## 시스템 설정" ~ "---" = systemInstruction
 * "## 분석 지시사항" 이후 전체 = analysisInstructions (프롬프트에 이어붙임)
 */
function parsePromptMd(md) {
  const sysMatch = md.match(/## 시스템 설정\s*\n([\s\S]*?)(?=\n---)/);
  const systemInstruction = sysMatch ? sysMatch[1].trim() : '';

  const instrIdx = md.indexOf('## 분석 지시사항');
  const analysisInstructions = instrIdx >= 0 ? md.slice(instrIdx).trim() : '';

  return { systemInstruction, analysisInstructions };
}

/**
 * prompt_compare.md 로드 및 캐싱
 */
let cachedComparePromptMd = null;

async function loadComparePromptMd() {
  if (cachedComparePromptMd) return cachedComparePromptMd;
  const res = await fetch('/prompt_compare.md');
  if (!res.ok) throw new Error('prompt_compare.md 로드 실패');
  cachedComparePromptMd = await res.text();
  return cachedComparePromptMd;
}

function parseComparePromptMd(md) {
  const sysMatch = md.match(/## 시스템 설정\s*\n([\s\S]*?)(?=\n────)/);
  const systemInstruction = sysMatch ? sysMatch[1].trim() : '';

  const instrIdx = md.indexOf('## 비교 분석 지시사항');
  const compareInstructions = instrIdx >= 0 ? md.slice(instrIdx).trim() : '';

  return { systemInstruction, compareInstructions };
}

/**
 * 비교 분석 AI 호출
 * @param {string} stocksJson - 비교 대상 종목 데이터 JSON 문자열
 */
export async function requestCompareAnalysis(stocksJson) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('Gemini API Key가 설정되지 않았습니다.');
  }

  const md = await loadComparePromptMd();
  const { systemInstruction, compareInstructions } = parseComparePromptMd(md);

  const fullUserPrompt = stocksJson + '\n\n' + compareInstructions;

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
              parts: [{ text: fullUserPrompt }],
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
    throw new Error(`비교 분석 요청 실패: ${err.message}`);
  }
}

/**
 * Gemini API 호출 (API 키는 .env에서 로드)
 * @param {string} prompt     - 차트 데이터 + 분석 프롬프트
 */
export async function requestAIAnalysis(prompt) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('Gemini API Key가 설정되지 않았습니다. API_KEY를 확인하세요.');
  }

  // prompt.md 로드 및 파싱
  const md = await loadPromptMd();
  const { systemInstruction, analysisInstructions } = parsePromptMd(md);

  // 차트 데이터(prompt) + 분석 지시사항을 합친 최종 사용자 프롬프트
  const fullUserPrompt = prompt + '\n\n' + analysisInstructions;

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
              parts: [{ text: fullUserPrompt }],
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
