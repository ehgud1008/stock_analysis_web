import { useState, useEffect, useCallback } from 'react';
import { getAnalysisList, deleteAnalysis, clearAllAnalyses } from '../../utils/analysisStorage';
import './HistoryPanel.css';

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

// ── 레코드 ID 추출 (MongoDB _id 또는 fallback) ──────────
function getRecordId(r) {
  if (r._id) return typeof r._id === 'object' ? r._id.$oid || r._id : r._id;
  return r.id;
}

// ── 메인 컴포넌트 ────────────────────────────────────────
export default function HistoryPanel() {
  const [records, setRecords] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    reload();
  }, [reload]);

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

  const selectedRecord = records.find((r) => getRecordId(r) === selectedId);

  // ── 상세 뷰 ──
  if (selectedRecord) {
    return <DetailView record={selectedRecord} onBack={() => setSelectedId(null)} onDelete={handleDelete} />;
  }

  // ── 목록 뷰 ──
  return (
    <section className="history-panel">
      <div className="history-panel__header">
        <div className="history-panel__header-left">
          <span className="history-panel__icon">📋</span>
          <h2 className="history-panel__title">분석 기록</h2>
          <span className="history-panel__count">{records.length}건</span>
        </div>
        {records.length > 0 && (
          <button className="btn btn--ghost history-panel__clear-btn" onClick={handleClearAll}>
            🗑️ 전체 삭제
          </button>
        )}
      </div>

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
            return (
              <div
                key={rid}
                className="history-card"
                onClick={() => setSelectedId(rid)}
              >
                <div className="history-card__top">
                  <span className="history-card__code">{r.stockCode}</span>
                  <span
                    className="history-card__badge"
                    style={{ color: ds.color, background: ds.bg }}
                  >
                    {ds.emoji} {r.decision_label || ds.label}
                  </span>
                </div>
                <div className="history-card__meta">
                  <span className="history-card__date">{formatDate(r.analyzedAt)}</span>
                  {r.currentPrice && (
                    <span className="history-card__price">{Number(r.currentPrice).toLocaleString()}원</span>
                  )}
                  {r.confidence_pct != null && (
                    <span className="history-card__confidence">확신도 {r.confidence_pct}%</span>
                  )}
                </div>
                <button
                  className="history-card__delete"
                  onClick={(e) => handleDelete(rid, e)}
                  title="삭제"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── 상세 보기 ────────────────────────────────────────────
function DetailView({ record, onBack, onDelete }) {
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
        <h2 className="history-detail__stock-code">{r.stockCode}</h2>
        <span className="history-detail__date">{formatDate(r.analyzedAt)}</span>
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
          {ai.expectancy.description && <p className="history-detail__text">{ai.expectancy.description}</p>}
        </div>
      )}

      {/* 리스크 관리 */}
      {ai.risk_management && (
        <div className="history-detail__section">
          <h3 className="history-detail__section-title">🛡️ 리스크 관리</h3>
          <div className="history-detail__stats">
            <div className="history-detail__stat">
              <span className="history-detail__stat-label">손절가</span>
              <span className="history-detail__stat-value" style={{ color: 'var(--red)' }}>{Number(ai.risk_management.stop_loss).toLocaleString()}원</span>
            </div>
            <div className="history-detail__stat">
              <span className="history-detail__stat-label">1차 목표</span>
              <span className="history-detail__stat-value" style={{ color: 'var(--green)' }}>{Number(ai.risk_management.target_1).toLocaleString()}원</span>
            </div>
            <div className="history-detail__stat">
              <span className="history-detail__stat-label">2차 목표</span>
              <span className="history-detail__stat-value" style={{ color: 'var(--green)' }}>{Number(ai.risk_management.target_2).toLocaleString()}원</span>
            </div>
            <div className="history-detail__stat">
              <span className="history-detail__stat-label">R:R</span>
              <span className="history-detail__stat-value">{ai.risk_management.risk_reward_ratio}</span>
            </div>
            <div className="history-detail__stat">
              <span className="history-detail__stat-label">권장 비중</span>
              <span className="history-detail__stat-value" style={{ color: 'var(--accent)' }}>{ai.risk_management.recommended_position_pct}%</span>
            </div>
          </div>
          {ai.risk_management.description && <p className="history-detail__text">{ai.risk_management.description}</p>}
        </div>
      )}

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
