import { useState } from 'react';
import './TokenPanel.css';

export default function TokenPanel({ token, onFetchToken, onTokenChange, status }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback */
    }
  };

  const isLoading = status === 'loading_token';

  return (
    <section className="token-panel">
      <div className="token-panel__header">
        <div className="token-panel__icon">🔑</div>
        <h2 className="token-panel__title">API 토큰</h2>
      </div>

      <div className="token-panel__body">
        <button
          className="btn btn--primary token-panel__fetch-btn"
          onClick={onFetchToken}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <span className="spinner" /> 조회 중…
            </>
          ) : (
            '토큰 조회'
          )}
        </button>

        <div className="token-panel__input-group">
          <input
            type="text"
            className="input token-panel__input"
            placeholder="토큰을 조회하거나 직접 입력하세요"
            value={token}
            onChange={(e) => onTokenChange(e.target.value)}
          />
          {token && (
            <button
              className="btn btn--ghost token-panel__copy-btn"
              onClick={handleCopy}
              title="복사"
            >
              {copied ? '✓ 복사됨' : '📋 복사'}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
