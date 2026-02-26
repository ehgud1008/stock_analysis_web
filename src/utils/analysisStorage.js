/**
 * Express API 기반 분석 기록 저장 유틸리티
 * Express 서버(server/index.js)의 /api/history 엔드포인트와 통신
 */

const BASE = '/api/history';

/**
 * 분석 결과 저장
 * @param {object} record - { stockCode, currentPrice, chartType, decision, ... , aiResult }
 * @returns {object} 저장된 레코드
 */
export async function saveAnalysis(record) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  });
  if (!res.ok) throw new Error(`저장 실패: ${res.status}`);
  return res.json();
}

/**
 * 전체 기록 조회 (최신순)
 * @returns {object[]}
 */
export async function getAnalysisList() {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error(`조회 실패: ${res.status}`);
  return res.json();
}

/**
 * 단건 조회
 * @param {string} id - MongoDB ObjectId
 * @returns {object|null}
 */
export async function getAnalysisById(id) {
  const res = await fetch(`${BASE}/${id}`);
  if (!res.ok) throw new Error(`조회 실패: ${res.status}`);
  return res.json();
}

/**
 * 단건 삭제
 * @param {string} id - MongoDB ObjectId
 */
export async function deleteAnalysis(id) {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`삭제 실패: ${res.status}`);
}

/**
 * 전체 삭제
 */
export async function clearAllAnalyses() {
  const res = await fetch(BASE, { method: 'DELETE' });
  if (!res.ok) throw new Error(`전체 삭제 실패: ${res.status}`);
}
