import { useState, useCallback } from 'react';
import './ApiTestPanel.css';

const DEFAULT_REQUEST = `{
  "header": {
    "api-id": "",
    "authorization": "",
    "cont-yn": "N",
    "next-key": ""
  },
  "body": {
  }
}`;

const API_JSON_URL = '/api/json';

export default function ApiTestPanel({ token }) {
  const [requestJson, setRequestJson] = useState(DEFAULT_REQUEST);
  const [responseJson, setResponseJson] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(null);

  const handleQuery = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResponseJson(null);
    setElapsed(null);

    try {
      // JSON 파싱 검증
      let parsed;
      try {
        parsed = JSON.parse(requestJson);
      } catch (e) {
        throw new Error(`요청 JSON 형식 오류: ${e.message}`);
      }

      // 토큰 자동 주입 (authorization이 비어있으면)
      if (token && (!parsed.header?.authorization || parsed.header.authorization === '')) {
        parsed.header = { ...parsed.header, authorization: token };
      }

      const start = performance.now();

      const response = await fetch(API_JSON_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        redirect: 'manual',
        body: JSON.stringify(parsed),
      });

      const end = performance.now();
      setElapsed(Math.round(end - start));

      if (response.status === 302 || response.type === 'opaqueredirect') {
        throw new Error('키움증권 서버가 점검 중입니다.');
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setResponseJson(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [requestJson, token]);

  const handleCopyResponse = useCallback(() => {
    if (responseJson) {
      navigator.clipboard.writeText(JSON.stringify(responseJson, null, 2));
    }
  }, [responseJson]);

  const handleClearAll = useCallback(() => {
    setResponseJson(null);
    setError(null);
    setElapsed(null);
  }, []);

  // 응답에서 배열 키를 찾아 테이블로 렌더링
  const renderResponseTable = (data) => {
    if (!data || typeof data !== 'object') return null;

    const arrayEntries = Object.entries(data).filter(
      ([, v]) => Array.isArray(v) && v.length > 0 && typeof v[0] === 'object'
    );

    if (arrayEntries.length === 0) return null;

    return arrayEntries.map(([key, rows]) => {
      const columns = Object.keys(rows[0]);
      return (
        <div key={key} className="api-test__table-wrap">
          <div className="api-test__table-header">
            <span className="api-test__table-key">📋 {key}</span>
            <span className="api-test__table-count">{rows.length}건</span>
          </div>
          <div className="api-test__table-scroll">
            <table className="api-test__table">
              <thead>
                <tr>
                  <th className="api-test__th">#</th>
                  {columns.map((col) => (
                    <th key={col} className="api-test__th">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="api-test__tr">
                    <td className="api-test__td api-test__td--idx">{i + 1}</td>
                    {columns.map((col) => (
                      <td key={col} className="api-test__td">
                        {formatCellValue(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    });
  };

  return (
    <section className="api-test">
      <div className="api-test__header">
        <span className="api-test__icon">🔧</span>
        <h2 className="api-test__title">전문 테스트</h2>
      </div>

      {/* Request Area */}
      <div className="api-test__section">
        <div className="api-test__section-label">
          <span>📤</span> Request JSON
          {token && <span className="api-test__token-hint">💡 authorization 비어있으면 토큰 자동 주입</span>}
        </div>
        <textarea
          className="api-test__editor"
          value={requestJson}
          onChange={(e) => setRequestJson(e.target.value)}
          spellCheck={false}
          rows={14}
        />
      </div>

      {/* Action Buttons */}
      <div className="api-test__actions">
        <button
          className="api-test__btn api-test__btn--primary"
          onClick={handleQuery}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="api-test__spinner" />
              조회 중…
            </>
          ) : (
            '🚀 조회'
          )}
        </button>
        <button
          className="api-test__btn api-test__btn--secondary"
          onClick={handleClearAll}
          disabled={loading}
        >
          🗑️ 초기화
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="api-test__error">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* Response Area */}
      {responseJson && (
        <div className="api-test__section">
          <div className="api-test__section-label">
            <span>📥</span> Response
            <div className="api-test__response-meta">
              {elapsed != null && <span className="api-test__elapsed">⏱️ {elapsed}ms</span>}
              <button className="api-test__copy-btn" onClick={handleCopyResponse}>📋 복사</button>
            </div>
          </div>

          {/* Table View */}
          {renderResponseTable(responseJson)}

          {/* Raw JSON */}
          <details className="api-test__raw-toggle">
            <summary className="api-test__raw-summary">Raw JSON 보기</summary>
            <pre className="api-test__raw">{JSON.stringify(responseJson, null, 2)}</pre>
          </details>
        </div>
      )}
    </section>
  );
}

function formatCellValue(val) {
  if (val === null || val === undefined) return '-';
  if (typeof val === 'object') return JSON.stringify(val);
  const str = String(val);
  // 부호 포맷 (+ / -)
  if (/^[+-]\d/.test(str)) {
    const isPositive = str.startsWith('+');
    return (
      <span className={isPositive ? 'api-test__val--up' : 'api-test__val--down'}>
        {str}
      </span>
    );
  }
  return str;
}
