import { useState, useEffect, useCallback, useMemo } from 'react';
import { getAnalysisList, deleteAnalysis, clearAllAnalyses } from '../../utils/analysisStorage';
import { saveCompare, getCompareList, deleteCompare } from '../../utils/compareStorage';
import { requestCompareAnalysis } from '../../api/kiwoomApi';
import './HistoryPanel.css';

// ── 종목명 조회용 리스트 로드 ─────────────────────────────
async function loadStockMap() {
  const map = {};
  try {
    const [jRes, qRes] = await Promise.all([
      fetch('/_jmast.txt').then(r => r.text()),
      fetch('/_qmast.txt').then(r => r.text()),
    ]);
    [jRes, qRes].forEach(text => {
      text.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed.length >= 7) {
          map[trimmed.slice(0, 6)] = trimmed.slice(6);
        }
      });
    });
  } catch (err) {
    console.warn('종목 리스트 로드 실패:', err);
  }
  return map;
}

// ── 날짜 포맷 ────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}.${m}.${day} ${h}:${min}`;
}

// ── 판단 스타일 ──────────────────────────────────────────
const DECISION_STYLE = {
  buy: { emoji: '🟢', color: 'var(--green)', bg: 'rgba(34, 197, 94, 0.08)', label: '매수' },
  sell: { emoji: '🔴', color: 'var(--red)', bg: 'rgba(239, 68, 68, 0.08)', label: '매도' },
  hold: { emoji: '🟡', color: 'var(--yellow)', bg: 'rgba(234, 179, 8, 0.08)', label: '관망' },
};

function getDecisionStyle(decision) {
  return DECISION_STYLE[decision] || { emoji: '⚪', color: 'var(--text-muted)', bg: 'var(--surface-2)', label: decision || '-' };
}

// ── 차트 유형 레이블 ────────────────────────────────────
const CHART_TYPE_LABEL = {
  tick: '틱봉',
  minute: '분봉',
  day: '일봉',
  week: '주봉',
  month: '월봉',
  year: '년봉',
};

function formatBaseDate(bd) {
  if (!bd) return '';
  const cleaned = bd.replace(/-/g, '');
  if (cleaned.length >= 8) return `${cleaned.slice(0,4)}.${cleaned.slice(4,6)}.${cleaned.slice(6,8)}`;
  return bd;
}

// ── 레코드 ID 추출 (MongoDB _id 또는 fallback) ──────────
function getRecordId(r) {
  if (r._id) return typeof r._id === 'object' ? r._id.$oid || r._id : r._id;
  return r.id;
}

// ── 메인 컴포넌트 ────────────────────────────────────────
export default function HistoryPanel() {
  const [records, setRecords] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [stockMap, setStockMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [historyTab, setHistoryTab] = useState('analysis'); // 'analysis' | 'compare'
  const [compareRecords, setCompareRecords] = useState([]);
  const [selectedCompareRecord, setSelectedCompareRecord] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAnalysisList();
      setRecords(data);
    } catch (err) {
      console.error('기록 로드 실패:', err);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const reloadCompare = useCallback(async () => {
    try {
      const data = await getCompareList();
      setCompareRecords(data);
    } catch (err) {
      console.error('비교 기록 로드 실패:', err);
      setCompareRecords([]);
    }
  }, []);

  useEffect(() => {
    reload();
    reloadCompare();
    loadStockMap().then(setStockMap);
  }, [reload, reloadCompare]);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('이 기록을 삭제하시겠습니까?')) return;
    try {
      await deleteAnalysis(id);
      if (selectedId === id) setSelectedId(null);
      await reload();
    } catch (err) {
      alert('삭제 실패: ' + err.message);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('모든 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    try {
      await clearAllAnalyses();
      setSelectedId(null);
      await reload();
    } catch (err) {
      alert('전체 삭제 실패: ' + err.message);
    }
  };

  // 종목명 조회 헬퍼
  const getStockName = useCallback(
    (code) => stockMap[code] || '',
    [stockMap]
  );

  const selectedRecord = records.find((r) => getRecordId(r) === selectedId);

  // ── 비교 모드 ──
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState(new Set());
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareResult, setCompareResult] = useState(null);
  const [compareError, setCompareError] = useState(null);

  const MAX_COMPARE = 3;

  const toggleCompareId = (rid) => {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(rid)) {
        next.delete(rid);
      } else if (next.size < MAX_COMPARE) {
        next.add(rid);
      }
      return next;
    });
  };

  const handleExitCompare = () => {
    setCompareMode(false);
    setCompareIds(new Set());
    setCompareResult(null);
    setCompareError(null);
  };

  const handleCompareExecute = async () => {
    const selected = records.filter((r) => compareIds.has(getRecordId(r)));
    // 종목코드 중복 시 최신(먼저 나온) 데이터만 사용
    const deduped = [];
    const seenCodes = new Set();
    for (const r of selected) {
      if (!seenCodes.has(r.stockCode)) {
        seenCodes.add(r.stockCode);
        deduped.push(r);
      }
    }
    if (deduped.length < 2) {
      setCompareError('중복 종목을 제외하면 2개 이상이어야 합니다.');
      return;
    }

    setCompareLoading(true);
    setCompareError(null);
    setCompareResult(null);

    try {
      const stocksPayload = JSON.stringify({
        stocks: deduped.map((r) => ({
          code: r.stockCode,
          name: r.stockName || getStockName(r.stockCode) || r.stockCode,
          chartType: r.chartType || 'day',
          currentPrice: r.currentPrice,
          multiTimeframe: r.multiTimeframe || null,
          aiResult: r.aiResult,
        })),
      });

      const raw = await requestCompareAnalysis(stocksPayload);
      const parsed = JSON.parse(raw);
      setCompareResult(parsed);

      // 자동 저장
      try {
        await saveCompare({
          comparedStocks: deduped.map((r) => r.stockCode),
          comparedNames: deduped.map((r) => r.stockName || getStockName(r.stockCode) || r.stockCode),
          bestPick: parsed.best_pick?.code || null,
          compareResult: parsed,
        });
        await reloadCompare();
      } catch (saveErr) {
        console.warn('비교 결과 저장 실패:', saveErr);
      }
    } catch (err) {
      setCompareError(err.message);
    } finally {
      setCompareLoading(false);
    }
  };

  // ── 비교 결과 뷰 ──
  if (compareResult) {
    return <CompareResultView result={compareResult} onBack={handleExitCompare} />;
  }

  // ── 비교 기록 상세 ──
  if (selectedCompareRecord) {
    return <CompareResultView result={selectedCompareRecord.compareResult} onBack={() => setSelectedCompareRecord(null)} />;
  }

  // ── 상세 뷰 ──
  if (selectedRecord) {
    return <DetailView record={selectedRecord} onBack={() => setSelectedId(null)} onDelete={handleDelete} getStockName={getStockName} />;
  }

  // ── 목록 뷰 ──
  return (
    <section className="history-panel">
      <div className="history-panel__header">
        <div className="history-panel__header-left">
          <span className="history-panel__icon">📋</span>
          <h2 className="history-panel__title">기록</h2>
        </div>
        <div className="history-panel__header-right">
          {historyTab === 'analysis' && records.length >= 2 && (
            <button
              className={`btn ${compareMode ? 'btn--accent' : 'btn--ghost'} history-panel__compare-btn`}
              onClick={() => compareMode ? handleExitCompare() : setCompareMode(true)}
            >
              {compareMode ? '✕ 비교 모드 해제' : '🏆 비교 모드'}
            </button>
          )}
          {historyTab === 'analysis' && records.length > 0 && !compareMode && (
            <button className="btn btn--ghost history-panel__clear-btn" onClick={handleClearAll}>
              🗑️ 전체 삭제
            </button>
          )}
        </div>
      </div>

      {/* 서브 탭 */}
      <nav className="history-panel__sub-tabs">
        <button
          className={`history-panel__sub-tab ${historyTab === 'analysis' ? 'history-panel__sub-tab--active' : ''}`}
          onClick={() => { setHistoryTab('analysis'); handleExitCompare(); }}
        >
          📊 분석 기록 <span className="history-panel__sub-tab-count">{records.length}</span>
        </button>
        <button
          className={`history-panel__sub-tab ${historyTab === 'compare' ? 'history-panel__sub-tab--active' : ''}`}
          onClick={() => { setHistoryTab('compare'); handleExitCompare(); }}
        >
          🏆 비교 기록 <span className="history-panel__sub-tab-count">{compareRecords.length}</span>
        </button>
      </nav>

      {historyTab === 'analysis' ? (
        <>
          {loading ? (
            <div className="history-panel__empty">
              <div className="spinner" style={{ margin: '0 auto 12px' }} />
              <p>기록을 불러오는 중...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="history-panel__empty">
              <span className="history-panel__empty-icon">📄</span>
              <p>아직 저장된 분석 기록이 없습니다.</p>
              <p className="history-panel__empty-hint">AI 분석을 실행하면 자동으로 기록됩니다.</p>
            </div>
          ) : (
            <div className="history-panel__list">
              {records.map((r) => {
                const rid = getRecordId(r);
                const ds = getDecisionStyle(r.decision);
                const isChecked = compareIds.has(rid);
                return (
                  <div
                    key={rid}
                    className={`history-card ${compareMode && isChecked ? 'history-card--checked' : ''}`}
                    onClick={() => compareMode ? toggleCompareId(rid) : setSelectedId(rid)}
                  >
                    {compareMode && (
                      <span className={`history-card__checkbox ${isChecked ? 'history-card__checkbox--checked' : ''}`}>
                        {isChecked ? '✓' : ''}
                      </span>
                    )}
                    <div className="history-card__top">
                      <span className="history-card__code">
                        {(r.stockName || getStockName(r.stockCode)) && (
                          <span className="history-card__name">{r.stockName || getStockName(r.stockCode)}</span>
                        )}
                        {r.stockCode}
                      </span>
                      <span
                        className="history-card__badge"
                        style={{ color: ds.color, background: ds.bg }}
                      >
                        {ds.emoji} {r.decision_label || ds.label}
                      </span>
                    </div>
                    <div className="history-card__meta">
                      <span className="history-card__date">{formatDate(r.analyzedAt)}</span>
                      {r.chartType && (
                        <span
                          className="history-card__chart-type"
                          title={r.baseDate ? `기준일자: ${formatBaseDate(r.baseDate)}` : ''}
                        >
                          {CHART_TYPE_LABEL[r.chartType] || r.chartType}
                        </span>
                      )}
                      <span className={`history-card__tf-mode ${r.multiTimeframe ? 'history-card__tf-mode--multi' : 'history-card__tf-mode--single'}`}>
                        {r.multiTimeframe ? '🔀 멀티' : '📊 싱글'}
                      </span>
                      {r.positionType && (
                        <span className={`history-card__position history-card__position--${r.positionType}`}>
                          {r.positionType === 'holding' ? '📦 보유종목' : '🆕 신규매수'}
                        </span>
                      )}
                      {r.currentPrice && (
                        <span className="history-card__price">{Number(r.currentPrice).toLocaleString()}원</span>
                      )}
                      {r.confidence_pct != null && (
                        <span className="history-card__confidence">확신도 {r.confidence_pct}%</span>
                      )}
                    </div>
                    {!compareMode && (
                      <button
                        className="history-card__delete"
                        onClick={(e) => handleDelete(rid, e)}
                        title="삭제"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* 비교 기록 탭 */
        compareRecords.length === 0 ? (
          <div className="history-panel__empty">
            <span className="history-panel__empty-icon">🏆</span>
            <p>아직 저장된 비교 기록이 없습니다.</p>
            <p className="history-panel__empty-hint">분석 기록에서 비교 모드로 종목을 선택하세요.</p>
          </div>
        ) : (
          <div className="history-panel__list">
            {compareRecords.map((cr) => {
              const crid = getRecordId(cr);
              const bestName = cr.comparedNames?.find((_, i) => cr.comparedStocks?.[i] === cr.bestPick) || cr.bestPick;
              return (
                <div
                  key={crid}
                  className="history-card history-card--compare"
                  onClick={() => setSelectedCompareRecord(cr)}
                >
                  <div className="history-card__top">
                    <span className="history-card__code">
                      🏆 {cr.comparedNames?.join(' vs ') || cr.comparedStocks?.join(' vs ')}
                    </span>
                    {cr.bestPick && (
                      <span className="history-card__badge" style={{ color: 'var(--green)', background: 'rgba(34,197,94,0.08)' }}>
                        ⭐ {bestName}
                      </span>
                    )}
                  </div>
                  <div className="history-card__meta">
                    <span className="history-card__date">{formatDate(cr.analyzedAt)}</span>
                    <span className="history-card__confidence">{cr.comparedStocks?.length || 0}개 종목 비교</span>
                  </div>
                  <button
                    className="history-card__delete"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm('이 비교 기록을 삭제하시겠습니까?')) return;
                      try {
                        await deleteCompare(crid);
                        await reloadCompare();
                      } catch (err) {
                        alert('삭제 실패: ' + err.message);
                      }
                    }}
                    title="삭제"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* 비교 모드 플로팅 바 */}
      {compareMode && (
        <div className="compare-bar">
          <span className="compare-bar__count">
            {compareIds.size}개 선택됨 <span className="compare-bar__max">(최대 {MAX_COMPARE}개)</span>
          </span>
          {compareError && (
            <span className="compare-bar__error">⚠️ {compareError}</span>
          )}
          <button
            className="compare-bar__btn"
            onClick={handleCompareExecute}
            disabled={compareIds.size < 2 || compareLoading}
          >
            {compareLoading ? (
              <><span className="compare-bar__spinner" /> 비교 분석 중…</>
            ) : (
              `🚀 비교 분석 실행`
            )}
          </button>
        </div>
      )}
    </section>
  );
}

// ── 상세 보기 ────────────────────────────────────────────
function DetailView({ record, onBack, onDelete, getStockName }) {
  const r = record;
  const ai = r.aiResult;
  const rid = getRecordId(r);

  if (!ai) {
    return (
      <section className="history-panel">
        <button className="btn btn--ghost" onClick={onBack}>← 목록으로</button>
        <p style={{ marginTop: 16, color: 'var(--text-muted)' }}>저장된 AI 분석 데이터가 없습니다.</p>
      </section>
    );
  }

  const ds = getDecisionStyle(r.decision);

  return (
    <section className="history-panel">
      <div className="history-detail__header">
        <button className="btn btn--ghost" onClick={onBack}>← 목록으로</button>
        <button className="btn btn--ghost history-detail__delete-btn" onClick={(e) => onDelete(rid, e)}>
          🗑️ 삭제
        </button>
      </div>

      <div className="history-detail__title-row">
        <h2 className="history-detail__stock-code">
          {(r.stockName || getStockName(r.stockCode)) && (
            <span className="history-detail__stock-name">{r.stockName || getStockName(r.stockCode)}</span>
          )}
          {r.stockCode}
        </h2>
        <div className="history-detail__title-meta">
          {r.chartType && (
            <span
              className="history-detail__chart-type"
              title={r.baseDate ? `기준일자: ${formatBaseDate(r.baseDate)}` : ''}
            >
              {CHART_TYPE_LABEL[r.chartType] || r.chartType}
              {r.baseDate && (
                <span className="history-detail__base-date"> ({formatBaseDate(r.baseDate)})</span>
              )}
            </span>
          )}
          {r.multiTimeframe ? (
            <span className="history-detail__multi-tf">🔀 멀티 타임프레임 ({r.multiTimeframe.replace('+', ' + ')})</span>
          ) : (
            <span className="history-detail__single-tf">📊 싱글 타임프레임</span>
          )}
          <span className="history-detail__date">{formatDate(r.analyzedAt)}</span>
        </div>
      </div>

      <div className="history-detail__summary-row">
        {r.currentPrice && (
          <span className="history-detail__price">현재가 {Number(r.currentPrice).toLocaleString()}원</span>
        )}
        <span
          className="history-detail__decision"
          style={{ color: ds.color, background: ds.bg }}
        >
          {ds.emoji} {r.decision_label || ds.label}
        </span>
        {r.confidence_pct != null && (
          <span className="history-detail__confidence">확신도 {r.confidence_pct}%</span>
        )}
      </div>

      {/* 포지션 정보 */}
      {r.positionType && (
        <div className="history-detail__position">
          <span className={`history-detail__position-badge history-detail__position-badge--${r.positionType}`}>
            {r.positionType === 'holding' ? '📦 보유종목' : '🆕 신규매수'}
          </span>
          {r.positionType === 'holding' && r.holdingShares && (
            <>
              <span className="history-detail__position-info">
                보유 {Number(r.holdingShares).toLocaleString()}주
              </span>
              {r.holdingAvgPrice && (
                <span className="history-detail__position-info">
                  평단가 {Number(r.holdingAvgPrice).toLocaleString()}원
                </span>
              )}
              {r.holdingAvgPrice && r.currentPrice && (
                <span className="history-detail__position-info" style={{
                  color: Number(r.currentPrice) >= Number(r.holdingAvgPrice) ? 'var(--green)' : 'var(--red)'
                }}>
                  수익률 {(((Number(r.currentPrice) - Number(r.holdingAvgPrice)) / Number(r.holdingAvgPrice)) * 100).toFixed(2)}%
                </span>
              )}
            </>
          )}
        </div>
      )}

      {/* 총 요약 */}
      {ai.summary && (
        <div className="history-detail__section">
          <h3 className="history-detail__section-title">📝 총 요약</h3>
          <p className="history-detail__text">{ai.summary.overall}</p>
          {ai.summary.reasoning && (
            <p className="history-detail__reasoning">💬 {ai.summary.reasoning}</p>
          )}

          {/* 기간별 의견 */}
          {(ai.summary.short_term || ai.summary.mid_term || ai.summary.long_term) && (
            <div className="history-detail__timeframes">
              {[
                { key: 'short_term', label: '단기', period: '1~2주', icon: '⚡' },
                { key: 'mid_term', label: '중기', period: '1~3개월', icon: '📈' },
                { key: 'long_term', label: '장기', period: '3개월+', icon: '🎯' },
              ].map(({ key, label, period, icon }) => {
                const tf = ai.summary[key];
                if (!tf) return null;
                const tds = getDecisionStyle(tf.decision);
                return (
                  <div key={key} className="history-detail__tf-card" style={{ borderLeftColor: tds.color }}>
                    <div className="history-detail__tf-header">
                      <span>{icon} {label} ({period})</span>
                      <span style={{ color: tds.color, fontWeight: 700 }}>{tds.emoji} {tf.decision_label}</span>
                    </div>
                    <p className="history-detail__tf-text">{tf.reasoning}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 기대값 분석 */}
      {ai.expectancy && (
        <div className="history-detail__section">
          <h3 className="history-detail__section-title">📊 기대값 분석</h3>
          <div className="history-detail__stats">
            <div className="history-detail__stat">
              <span className="history-detail__stat-label">유사패턴</span>
              <span className="history-detail__stat-value">{ai.expectancy.pattern_count}회</span>
            </div>
            <div className="history-detail__stat">
              <span className="history-detail__stat-label">평균 상승</span>
              <span className="history-detail__stat-value" style={{ color: 'var(--green)' }}>+{ai.expectancy.avg_gain_pct}%</span>
            </div>
            <div className="history-detail__stat">
              <span className="history-detail__stat-label">평균 하락</span>
              <span className="history-detail__stat-value" style={{ color: 'var(--red)' }}>-{ai.expectancy.avg_loss_pct}%</span>
            </div>
            <div className="history-detail__stat">
              <span className="history-detail__stat-label">승률</span>
              <span className="history-detail__stat-value">{ai.expectancy.win_rate_pct}%</span>
            </div>
            <div className="history-detail__stat">
              <span className="history-detail__stat-label">기대값</span>
              <span className="history-detail__stat-value" style={{ color: ai.expectancy.expectancy_value > 0 ? 'var(--green)' : 'var(--red)' }}>
                {ai.expectancy.expectancy_value > 0 ? '+' : ''}{typeof ai.expectancy.expectancy_value === 'number' ? ai.expectancy.expectancy_value.toFixed(2) : ai.expectancy.expectancy_value}
              </span>
            </div>
          </div>
          {ai.expectancy.signal_weakened && (
            <div className="history-detail__warning">
              ⚠️ 기대값 0 이하 — 신호 약화. 매매에 주의가 필요합니다.
            </div>
          )}
          {ai.expectancy.description && <p className="history-detail__text">{ai.expectancy.description}</p>}
          {ai.expectancy.reasoning && <p className="history-detail__reasoning">💬 {ai.expectancy.reasoning}</p>}
        </div>
      )}

      {/* 리스크 관리 */}
      {ai.risk_management && (() => {
        const cp = Number(r.currentPrice) || 0;
        const calcPct = (price) => cp ? (((price - cp) / cp) * 100).toFixed(1) : null;
        return (
          <div className="history-detail__section">
            <h3 className="history-detail__section-title">🛡️ 리스크 관리</h3>
            <div className="history-detail__stats">
              <div className="history-detail__stat">
                <span className="history-detail__stat-label">손절가</span>
                <span className="history-detail__stat-value" style={{ color: 'var(--red)' }}>
                  {Number(ai.risk_management.stop_loss).toLocaleString()}원
                  {cp > 0 && <span className="history-detail__stat-pct"> ({calcPct(ai.risk_management.stop_loss)}%)</span>}
                </span>
              </div>
              <div className="history-detail__stat">
                <span className="history-detail__stat-label">1차 목표</span>
                <span className="history-detail__stat-value" style={{ color: 'var(--green)' }}>
                  {Number(ai.risk_management.target_1).toLocaleString()}원
                  {cp > 0 && <span className="history-detail__stat-pct"> (+{calcPct(ai.risk_management.target_1)}%)</span>}
                </span>
              </div>
              <div className="history-detail__stat">
                <span className="history-detail__stat-label">2차 목표</span>
                <span className="history-detail__stat-value" style={{ color: 'var(--green)' }}>
                  {Number(ai.risk_management.target_2).toLocaleString()}원
                  {cp > 0 && <span className="history-detail__stat-pct"> (+{calcPct(ai.risk_management.target_2)}%)</span>}
                </span>
              </div>
              <div className="history-detail__stat">
                <span className="history-detail__stat-label">R:R</span>
                <span className="history-detail__stat-value">{ai.risk_management.risk_reward_ratio}</span>
              </div>
              <div className="history-detail__stat">
                <span className="history-detail__stat-label">Kelly (0.5x)</span>
                <span className="history-detail__stat-value">{ai.risk_management.half_kelly?.toFixed(1) ?? ai.risk_management.kelly_fraction?.toFixed(1) ?? '-'}%</span>
              </div>
              <div className="history-detail__stat">
                <span className="history-detail__stat-label">권장 비중</span>
                <span className="history-detail__stat-value" style={{ color: 'var(--accent)' }}>{ai.risk_management.recommended_position_pct}%</span>
              </div>
            </div>
            {ai.risk_management.stop_loss_reason && (
              <p className="history-detail__note">📌 손절 근거: {ai.risk_management.stop_loss_reason}</p>
            )}
            {ai.risk_management.description && <p className="history-detail__text">{ai.risk_management.description}</p>}
            {ai.risk_management.reasoning && <p className="history-detail__reasoning">💬 {ai.risk_management.reasoning}</p>}
          </div>
        );
      })()}

      {/* 시나리오 */}
      {ai.scenarios && (
        <div className="history-detail__section">
          <h3 className="history-detail__section-title">🎲 시나리오 확률</h3>
          <div className="history-detail__scenarios">
            <ScenarioRow label="📈 상승" pct={ai.scenarios.bullish_pct} desc={ai.scenarios.bullish_desc} color="var(--green)" />
            <ScenarioRow label="📉 하락" pct={ai.scenarios.bearish_pct} desc={ai.scenarios.bearish_desc} color="var(--red)" />
            <ScenarioRow label="➡️ 횡보" pct={ai.scenarios.sideways_pct} desc={ai.scenarios.sideways_desc} color="var(--yellow)" />
          </div>
        </div>
      )}
    </section>
  );
}

function ScenarioRow({ label, pct, desc, color }) {
  return (
    <div className="history-scenario">
      <div className="history-scenario__header">
        <span>{label}</span>
        <span style={{ color, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{pct}%</span>
      </div>
      <div className="history-scenario__bar">
        <div className="history-scenario__fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      {desc && <p className="history-scenario__desc">{desc}</p>}
    </div>
  );
}

// ── 비교 결과 뷰 ──────────────────────────────────────────
function CompareResultView({ result, onBack }) {
  const r = result;
  const ranking = r.ranking || [];
  const best = r.best_pick || {};
  const table = r.comparison_table || {};
  const portfolio = r.portfolio || {};

  return (
    <section className="history-panel compare-result">
      <div className="history-detail__back-row">
        <button className="btn btn--ghost" onClick={onBack}>← 기록 목록</button>
      </div>

      <div className="compare-result__header">
        <span className="compare-result__icon">🏆</span>
        <h2 className="compare-result__title">종목 비교 분석 결과</h2>
      </div>

      {/* 종합 요약 */}
      {r.overall_summary && (
        <div className="compare-result__summary">
          <p>{r.overall_summary}</p>
        </div>
      )}

      {/* 최적 종목 */}
      {best.code && (
        <div className="compare-result__best">
          <div className="compare-result__best-header">
            <span className="compare-result__best-badge">⭐ 최적 매수 종목</span>
            <span className="compare-result__best-name">{best.name} ({best.code})</span>
          </div>
          {best.reasoning && <p className="compare-result__best-reasoning">{best.reasoning}</p>}
          {best.entry_strategy && (
            <div className="compare-result__best-entry">
              <strong>진입 전략:</strong> {best.entry_strategy}
            </div>
          )}
          {best.risk_note && (
            <div className="compare-result__best-risk">
              <strong>⚠️ 리스크:</strong> {best.risk_note}
            </div>
          )}
        </div>
      )}

      {/* 랭킹 */}
      {ranking.length > 0 && (
        <div className="compare-result__section">
          <h3 className="compare-result__section-title">📊 종목 랭킹</h3>
          <div className="compare-result__ranking">
            {ranking.map((item, i) => (
              <div key={item.code} className={`compare-rank-card ${i === 0 ? 'compare-rank-card--first' : ''}`}>
                <div className="compare-rank-card__header">
                  <span className="compare-rank-card__rank">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} {item.rank}위
                  </span>
                  <span className="compare-rank-card__name">{item.name} ({item.code})</span>
                  <span className="compare-rank-card__score">{item.score}점</span>
                </div>
                {item.strengths?.length > 0 && (
                  <div className="compare-rank-card__tags">
                    {item.strengths.map((s, j) => (
                      <span key={j} className="compare-rank-card__tag compare-rank-card__tag--green">✅ {s}</span>
                    ))}
                  </div>
                )}
                {item.weaknesses?.length > 0 && (
                  <div className="compare-rank-card__tags">
                    {item.weaknesses.map((w, j) => (
                      <span key={j} className="compare-rank-card__tag compare-rank-card__tag--red">⚠️ {w}</span>
                    ))}
                  </div>
                )}
                {item.reasoning && <p className="compare-rank-card__reasoning">{item.reasoning}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 비교표 */}
      {table.stocks?.length > 0 && (
        <div className="compare-result__section">
          <h3 className="compare-result__section-title">📋 핵심 지표 비교</h3>
          <div className="compare-table-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>지표</th>
                  {table.stocks.map((s) => (
                    <th key={s.code}>{s.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {['expectancy', 'win_rate', 'rr_ratio', 'bullish_pct', 'confidence', 'kelly'].map((metric) => (
                  <tr key={metric}>
                    <td className="compare-table__metric">{
                      {expectancy:'기대값', win_rate:'승률(%)', rr_ratio:'R:R', bullish_pct:'상승확률(%)', confidence:'확신도(%)', kelly:'Kelly(%)'}[metric]
                    }</td>
                    {table.stocks.map((s) => (
                      <td key={s.code} className="compare-table__value">
                        {s.values?.[metric] ?? '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 포트폴리오 */}
      {portfolio.allocations?.length > 0 && (
        <div className="compare-result__section">
          <h3 className="compare-result__section-title">💼 포트폴리오 배분</h3>
          {portfolio.recommendation && (
            <p className="compare-result__portfolio-desc">{portfolio.recommendation}</p>
          )}
          <div className="compare-result__allocations">
            {portfolio.allocations.map((a) => (
              <div key={a.code} className="compare-alloc">
                <div className="compare-alloc__header">
                  <span className="compare-alloc__name">{a.name}</span>
                  <span className="compare-alloc__weight">{a.weight_pct}%</span>
                </div>
                <div className="compare-alloc__bar-track">
                  <div className="compare-alloc__bar-fill" style={{ width: `${Math.min(a.weight_pct, 100)}%` }} />
                </div>
                {a.reasoning && <p className="compare-alloc__reasoning">{a.reasoning}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
