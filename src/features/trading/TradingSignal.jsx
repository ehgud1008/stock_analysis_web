import { useState } from 'react';
import './TradingSignal.css';

const INDICATOR_OPTIONS = [
  { id: 'ma', label: '이동평균선' },
  { id: 'rsi', label: 'RSI' },
  { id: 'bollinger', label: '볼린저 밴드' },
  { id: 'ichimoku', label: '일목균형표' },
  { id: 'volume', label: '거래량' },
];

export default function TradingSignal({
  analysis,
  apiKey,
  onApiKeyChange,
  selectedIndicators,
  onIndicatorsChange,
  onRequestAI,
  aiResult,
  status,
  error,
}) {
  const [showApiKey, setShowApiKey] = useState(false);
  const isRequesting = status === 'ai_requesting';

  const toggleIndicator = (id) => {
    if (selectedIndicators.includes(id)) {
      onIndicatorsChange(selectedIndicators.filter((i) => i !== id));
    } else {
      onIndicatorsChange([...selectedIndicators, id]);
    }
  };

  return (
    <section className="trading-signal">
      <div className="trading-signal__header">
        <div className="trading-signal__icon">🤖</div>
        <h2 className="trading-signal__title">AI 매매 시그널</h2>
        <span className="trading-signal__subtitle">ChatGPT 기반 분석</span>
      </div>

      {/* API Key 입력 */}
      <div className="trading-signal__api-key">
        <label className="trading-signal__label">OpenAI API Key</label>
        <div className="trading-signal__key-input">
          <input
            className="input"
            type={showApiKey ? 'text' : 'password'}
            placeholder="sk-..."
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
          />
          <button
            className="btn btn--ghost"
            onClick={() => setShowApiKey(!showApiKey)}
            type="button"
          >
            {showApiKey ? '🙈' : '👁️'}
          </button>
        </div>
      </div>

      {/* 지표 선택 */}
      <div className="trading-signal__indicators">
        <label className="trading-signal__label">분석에 포함할 지표</label>
        <p className="trading-signal__hint">
          💡 지표를 정확히 파악하기 어려워요. 포함된 지표를 선택하면 분석 정확도가 올라갑니다.
        </p>
        <div className="trading-signal__checkboxes">
          {INDICATOR_OPTIONS.map((opt) => (
            <label key={opt.id} className="checkbox-label">
              <input
                type="checkbox"
                checked={selectedIndicators.includes(opt.id)}
                onChange={() => toggleIndicator(opt.id)}
              />
              <span className="checkbox-label__text">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 분석 요청 버튼 */}
      <button
        className="btn btn--gradient trading-signal__submit"
        onClick={onRequestAI}
        disabled={!analysis || !apiKey || isRequesting}
      >
        {isRequesting ? (
          <>
            <span className="spinner" /> AI 분석 중…
          </>
        ) : (
          '🚀 분석 요청'
        )}
      </button>

      {/* 에러 */}
      {error && (
        <div className="trading-signal__error">
          ⚠️ {error}
        </div>
      )}

      {/* AI 결과 */}
      {aiResult && (
        <div className="trading-signal__result">
          <div className="trading-signal__result-header">
            <span className="trading-signal__result-icon">✨</span>
            <h3>AI 분석 결과 — 최적 매매 타이밍</h3>
          </div>
          <div className="trading-signal__result-body">
            {renderMarkdown(aiResult)}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * 간단한 마크다운 → HTML 변환 (## 헤더, **볼드**, - 리스트, 줄바꿈)
 */
function renderMarkdown(text) {
  const lines = text.split('\n');
  const elements = [];
  let listItems = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="md-list">
          {listItems.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('### ')) {
      flushList();
      elements.push(<h4 key={i} className="md-h4" dangerouslySetInnerHTML={{ __html: inlineFormat(line.slice(4)) }} />);
    } else if (line.startsWith('## ')) {
      flushList();
      elements.push(<h3 key={i} className="md-h3" dangerouslySetInnerHTML={{ __html: inlineFormat(line.slice(3)) }} />);
    } else if (line.startsWith('# ')) {
      flushList();
      elements.push(<h2 key={i} className="md-h2" dangerouslySetInnerHTML={{ __html: inlineFormat(line.slice(2)) }} />);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      listItems.push(line.slice(2));
    } else if (/^\d+\.\s/.test(line)) {
      listItems.push(line.replace(/^\d+\.\s/, ''));
    } else if (line === '---') {
      flushList();
      elements.push(<hr key={i} className="md-hr" />);
    } else if (line === '') {
      flushList();
    } else {
      flushList();
      elements.push(<p key={i} className="md-p" dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />);
    }
  }
  flushList();

  return elements;
}

function inlineFormat(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}
