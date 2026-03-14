/**
 * 비교 분석 기록 저장 유틸리티
 * Express 서버의 /api/compare 엔드포인트와 통신
 */

const BASE = '/api/compare';

/** 비교 분석 결과 저장 */
export async function saveCompare(record)  {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  });
  if (!res.ok) throw new Error(`저장 실패: ${res.status}`);
  return res.json();
}

/** 전체 비교 기록 조회 */
export async function getCompareList() {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error(`조회 실패: ${res.status}`);
  return res.json();
}

/** 단건 삭제 */
export async function deleteCompare(id) {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`삭제 실패: ${res.status}`);
}
