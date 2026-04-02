import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './StockInput.css';

const CHART_TYPES = [
  // { value: 'tick', label: '틱' },
  { value: 'minute', label: '분봉' },
  { value: 'day', label: '일봉' },
  { value: 'week', label: '주봉' },
  // { value: 'month', label: '월' },
  // { value: 'year', label: '년' },
];

/**
 * txt 파일 로드 → { code, name, market } 배열 반환
 * 파일 형식: 앞 6자리 = 종목코드, 그 뒤 = 종목명
 */
async function loadStockList(url, market) {
  try {
    const res = await fetch(url);
    const text = await res.text();
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length >= 7)
      .map((line) => ({
        code: line.slice(0, 6),
        name: line.slice(6),
        market,
      }));
  } catch {
    console.warn(`종목 리스트 로드 실패: ${url}`);
    return [];
  }
}

export default function StockInput({
  stockCode,
  chartType,
  baseDate,
  includeNews,
  onStockCodeChange,
  onStockNameChange,
  onChartTypeChange,
  onBaseDateChange,
  onIncludeNewsChange,
  onSubmit,
  isDisabled,
  isLoading,
}) {
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const [stocks, setStocks] = useState([]);
  const [query, setQuery] = useState('');
  const [filtered, setFiltered] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const wrapperRef = useRef(null);
  const listRef = useRef(null);

  // 종목 리스트 로드 (최초 1회)
  useEffect(() => {
    Promise.all([
      loadStockList('/_jmast.txt', 'KOSPI'),
      loadStockList('/_qmast.txt', 'KOSDAQ'),
    ]).then(([kospi, kosdaq]) => {
      setStocks([...kospi, ...kosdaq]);
    });
  }, []);

  // 검색 필터
  useEffect(() => {
    if (!query.trim()) {
      setFiltered([]);
      return;
    }
    const q = query.trim().toLowerCase();
    const results = stocks
      .filter(
        (s) =>
          s.code.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q)
      )
      .slice(0, 50); // 최대 50개
    setFiltered(results);
    setHighlightIdx(-1);
  }, [query, stocks]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectStock = useCallback(
    (stock) => {
      onStockCodeChange(stock.code);
      if (onStockNameChange) onStockNameChange(stock.name);
      setQuery(`${stock.code} ${stock.name}`);
      setShowDropdown(false);
    },
    [onStockCodeChange, onStockNameChange]
  );

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setShowDropdown(true);

    // 순수 숫자 6자리면 바로 종목코드로 설정
    const numOnly = val.replace(/\D/g, '');
    if (numOnly.length <= 6) {
      onStockCodeChange(numOnly);
    }
  };

  const handleKeyDown = (e) => {
    if (!showDropdown || filtered.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((prev) => {
        const next = prev < filtered.length - 1 ? prev + 1 : 0;
        scrollToItem(next);
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((prev) => {
        const next = prev > 0 ? prev - 1 : filtered.length - 1;
        scrollToItem(next);
        return next;
      });
    } else if (e.key === 'Enter' && highlightIdx >= 0) {
      e.preventDefault();
      selectStock(filtered[highlightIdx]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const scrollToItem = (idx) => {
    if (listRef.current) {
      const items = listRef.current.children;
      if (items[idx]) {
        items[idx].scrollIntoView({ block: 'nearest' });
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <section className="stock-input">
      <div className="stock-input__header">
        <div className="stock-input__icon">📊</div>
        <h2 className="stock-input__title">종목 조회</h2>
      </div>

      <form className="stock-input__form" onSubmit={handleSubmit}>
        <div className="stock-input__field" ref={wrapperRef}>
          <label className="stock-input__label" htmlFor="stockCode">종목 검색</label>
          <div className="stock-search">
            <input
              id="stockCode"
              className="input stock-search__input"
              type="text"
              placeholder="종목코드 또는 종목명 입력 (예: 005930, 삼성전자)"
              value={query}
              onChange={handleInputChange}
              onFocus={() => query.trim() && setShowDropdown(true)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
            />
            {stockCode && (
              <span className="stock-search__selected">
                {stockCode}
              </span>
            )}

            {showDropdown && filtered.length > 0 && (
              <ul className="stock-search__dropdown" ref={listRef}>
                {filtered.map((s, idx) => (
                  <li
                    key={`${s.code}-${s.market}`}
                    className={`stock-search__item ${idx === highlightIdx ? 'stock-search__item--active' : ''}`}
                    onMouseDown={() => selectStock(s)}
                    onMouseEnter={() => setHighlightIdx(idx)}
                  >
                    <span className="stock-search__code">{s.code}</span>
                    <span className="stock-search__name">{s.name}</span>
                    <span className={`stock-search__market stock-search__market--${s.market.toLowerCase()}`}>
                      {s.market}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {showDropdown && query.trim() && filtered.length === 0 && (
              <div className="stock-search__dropdown stock-search__empty">
                검색 결과가 없습니다
              </div>
            )}
          </div>
        </div>

        <div className="stock-input__field">
          <label className="stock-input__label">차트 유형</label>
          <div className="stock-input__chart-types">
            {CHART_TYPES.map((ct) => (
              <button
                key={ct.value}
                type="button"
                className={`stock-input__chip ${chartType === ct.value ? 'stock-input__chip--active' : ''}`}
                onClick={() => onChartTypeChange(ct.value)}
              >
                {ct.label}
              </button>
            ))}
          </div>
        </div>

        <div className="stock-input__field">
          <label className="stock-input__label" htmlFor="baseDate">기준일자</label>
          <div className="stock-input__date-wrapper">
            <input
              id="baseDate"
              className="input stock-input__date-input"
              type="date"
              value={baseDate}
              onChange={(e) => onBaseDateChange(e.target.value)}
            />
            <label className="stock-input__today-toggle">
              <input
                type="checkbox"
                checked={baseDate === todayStr}
                onChange={(e) => {
                  if (e.target.checked) {
                    onBaseDateChange(todayStr);
                  } else {
                    onBaseDateChange('');
                  }
                }}
              />
              <span className="stock-input__today-pill">오늘</span>
            </label>
          </div>
        </div>

        <div className="stock-input__field">
          <label className="stock-input__label">뉴스</label>
          <label className="stock-input__news-label">
            <input
              type="checkbox"
              checked={!!includeNews}
              onChange={(e) => onIncludeNewsChange(e.target.checked)}
            />
            <span className="stock-input__news-check" />
            <span>📰 뉴스 포함</span>
          </label>
        </div>

        <button
          type="submit"
          className="btn btn--accent stock-input__submit"
          disabled={isDisabled || isLoading}
        >
          {isLoading ? (
            <>
              <span className="spinner" /> 조회 중…
            </>
          ) : (
            '🔍 데이터 조회 & 분석'
          )}
        </button>
      </form>
    </section>
  );
}
