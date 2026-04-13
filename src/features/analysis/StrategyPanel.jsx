import './StrategyPanel.css';

function formatDate(dt) {
  if (!dt || dt.length < 8) return dt || '';
  return `${dt.slice(0, 4)}.${dt.slice(4, 6)}.${dt.slice(6, 8)}`;
}

// ── 카테고리 그룹핑 헬퍼 ──
const CATEGORY_LABELS = {
  trend: '📐 추세',
  breakout: '🚀 돌파 · 지지',
  volume: '📊 거래량',
  indicator: '📈 보조지표',
};

function groupByCategory(conditions) {
  const groups = {};
  conditions.forEach(c => {
    if (!groups[c.category]) groups[c.category] = [];
    groups[c.category].push(c);
  });
  return Object.entries(groups).map(([category, items]) => ({
    category,
    label: CATEGORY_LABELS[category] || category,
    items,
  }));
}

export default function StrategyPanel({ analysis }) {
  if (!analysis?.structure || !analysis?.strategy) return null;

  const { structure, strategy, summary } = analysis;
  const { trendStructure, atr, volumeAdvanced, supportResistance } = structure;

  return (
    <section className="strategy-panel">
      {/* ── A. 기술적 구조 분석 ── */}
      <div className="strategy-panel__section">
        <div className="strategy-panel__section-header">
          <span className="strategy-panel__section-icon">🔬</span>
          <h2 className="strategy-panel__section-title">기술적 구조 분석</h2>
        </div>

        <div className="strategy-grid">
          {/* (1) 추세 구조 */}
          <div className="strategy-card">
            <h3 className="strategy-card__title">📐 추세 구조</h3>
            <div className="strategy-card__row">
              <span className="strategy-card__label">패턴</span>
              <span className={`strategy-card__badge strategy-card__badge--${
                trendStructure.direction === '상승' ? 'bull' : trendStructure.direction === '하락' ? 'bear' : 'neutral'
              }`}>
                {trendStructure.pattern || '—'} ({trendStructure.direction})
              </span>
            </div>
            <div className="strategy-card__row">
              <span className="strategy-card__label">추세 강도</span>
              <span className="strategy-card__value">{trendStructure.strength || '—'}</span>
            </div>
            <ul className="strategy-card__details">
              {trendStructure.details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>

          {/* (2) 지지/저항 */}
          <div className="strategy-card">
            <h3 className="strategy-card__title">🧱 지지 / 저항</h3>

            {supportResistance.nearestResistance && (
              <div className="strategy-card__row">
                <span className="strategy-card__label">최근접 저항</span>
                <span className="strategy-card__value strategy-card__value--red">
                  {supportResistance.nearestResistance.price.toLocaleString()}원
                  <small> ({formatDate(supportResistance.nearestResistance.dt)})</small>
                </span>
              </div>
            )}
            {supportResistance.resistance.length > 1 && (
              <div className="strategy-card__row">
                <span className="strategy-card__label">추가 저항</span>
                <span className="strategy-card__value">
                  {supportResistance.resistance.slice(1).map(r => r.price.toLocaleString() + '원').join(', ')}
                </span>
              </div>
            )}

            {supportResistance.nearestSupport && (
              <div className="strategy-card__row">
                <span className="strategy-card__label">최근접 지지</span>
                <span className="strategy-card__value strategy-card__value--green">
                  {supportResistance.nearestSupport.price.toLocaleString()}원
                  <small> ({formatDate(supportResistance.nearestSupport.dt)})</small>
                </span>
              </div>
            )}
            {supportResistance.support.length > 1 && (
              <div className="strategy-card__row">
                <span className="strategy-card__label">추가 지지</span>
                <span className="strategy-card__value">
                  {supportResistance.support.slice(1).map(s => s.price.toLocaleString() + '원').join(', ')}
                </span>
              </div>
            )}

            {supportResistance.recentBreakout && (
              <div className="strategy-card__breakout">
                🚀 {supportResistance.recentBreakout.type}: {supportResistance.recentBreakout.level.toLocaleString()}원 돌파
              </div>
            )}
            {!supportResistance.recentBreakout && (
              <div className="strategy-card__no-breakout">
                최근 돌파 없음
              </div>
            )}
          </div>

          {/* (3) 거래량 분석 */}
          <div className="strategy-card">
            <h3 className="strategy-card__title">📊 거래량 분석</h3>
            <div className="strategy-card__row">
              <span className="strategy-card__label">5일 vs 20일 평균</span>
              <span className={`strategy-card__value ${volumeAdvanced.changeRate > 0 ? 'strategy-card__value--green' : 'strategy-card__value--red'}`}>
                {volumeAdvanced.changeRate > 0 ? '+' : ''}{volumeAdvanced.changeRate.toFixed(1)}%
              </span>
            </div>
            <div className="strategy-card__row">
              <span className="strategy-card__label">거래량 동반 돌파</span>
              <span className="strategy-card__value">
                {volumeAdvanced.breakoutVolume ? '✅ 확인' : '❌ 미확인'}
              </span>
            </div>
            <div className="strategy-card__row">
              <span className="strategy-card__label">거래량 감소 추세</span>
              <span className="strategy-card__value">
                {volumeAdvanced.decreasingTrend ? '⚠️ 5일 연속 감소' : '정상'}
              </span>
            </div>
          </div>

          {/* (4) 변동성 */}
          <div className="strategy-card">
            <h3 className="strategy-card__title">📈 변동성 (ATR)</h3>
            {atr ? (
              <>
                <div className="strategy-card__row">
                  <span className="strategy-card__label">14일 ATR</span>
                  <span className="strategy-card__value">{Math.round(atr.atr).toLocaleString()}원</span>
                </div>
                <div className="strategy-card__row">
                  <span className="strategy-card__label">ATR 대비 현재가</span>
                  <span className="strategy-card__value">
                    {((atr.atr / summary.currentPrice) * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="strategy-card__row">
                  <span className="strategy-card__label">최근 3봉 급증</span>
                  <span className="strategy-card__value">
                    {atr.volatilitySpike ? '⚠️ 변동성 급증' : '정상 범위'}
                  </span>
                </div>
              </>
            ) : (
              <p className="strategy-card__empty">데이터 부족</p>
            )}
          </div>
        </div>
      </div>

      {/* ── B. 매매 전략 도출 ── */}
      <div className="strategy-panel__section">
        <div className="strategy-panel__section-header">
          <span className="strategy-panel__section-icon">🎯</span>
          <h2 className="strategy-panel__section-title">매매 전략 도출</h2>
          <span className={`strategy-panel__overall strategy-panel__overall--${strategy.overallSignal}`}>
            {strategy.overallLabel}
          </span>
        </div>

        {/* 점수 오버뷰 */}
        <div className="strategy-score-overview">
          <div className="strategy-score-bar">
            <div className="strategy-score-bar__header">
              <span className="strategy-score-bar__label">📗 매수 점수</span>
              <span className="strategy-score-bar__value strategy-score-bar__value--buy">{strategy.buyScore}</span>
            </div>
            <div className="strategy-score-bar__track">
              <div className="strategy-score-bar__fill strategy-score-bar__fill--buy" style={{ width: `${strategy.buyScore}%` }} />
            </div>
          </div>
          <div className="strategy-score-bar">
            <div className="strategy-score-bar__header">
              <span className="strategy-score-bar__label">📕 매도 점수</span>
              <span className="strategy-score-bar__value strategy-score-bar__value--sell">{strategy.sellScore}</span>
            </div>
            <div className="strategy-score-bar__track">
              <div className="strategy-score-bar__fill strategy-score-bar__fill--sell" style={{ width: `${strategy.sellScore}%` }} />
            </div>
          </div>
          <div className="strategy-score-net">
            순점수: <span className={`strategy-score-net__value ${strategy.netScore > 0 ? 'strategy-score-net__value--positive' : strategy.netScore < 0 ? 'strategy-score-net__value--negative' : ''}`}>{strategy.netScore > 0 ? '+' : ''}{strategy.netScore}</span>
          </div>
        </div>

        <div className="strategy-conditions">
          {/* 매수 조건 */}
          <div className="strategy-conditions__group">
            <h3 className="strategy-conditions__heading strategy-conditions__heading--buy">
              📗 매수 조건 ({strategy.buyScore}/100점)
            </h3>
            {groupByCategory(strategy.buyConditions).map(({ category, label, items }) => (
              <div key={category} className="strategy-category">
                <h4 className="strategy-category__title">{label}</h4>
                {items.map((c, i) => (
                  <div key={i} className={`condition-item ${c.met ? 'condition-item--met' : 'condition-item--unmet'}`}>
                    <div className="condition-item__header">
                      <span className="condition-item__icon">{c.met ? '✅' : '❌'}</span>
                      <span className="condition-item__label">{c.label}</span>
                      <span className={`condition-item__weight ${c.met ? 'condition-item__weight--active' : ''}`}>
                        {c.met ? `+${c.weight}` : `+0`}
                      </span>
                    </div>
                    <p className="condition-item__desc">{c.desc}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* 매도 조건 */}
          <div className="strategy-conditions__group">
            <h3 className="strategy-conditions__heading strategy-conditions__heading--sell">
              📕 매도 조건 ({strategy.sellScore}/100점)
            </h3>
            {groupByCategory(strategy.sellConditions).map(({ category, label, items }) => (
              <div key={category} className="strategy-category">
                <h4 className="strategy-category__title">{label}</h4>
                {items.map((c, i) => (
                  <div key={i} className={`condition-item ${c.met ? 'condition-item--met-sell' : 'condition-item--unmet'}`}>
                    <div className="condition-item__header">
                      <span className="condition-item__icon">{c.met ? '🔴' : '⚪'}</span>
                      <span className="condition-item__label">{c.label}</span>
                      <span className={`condition-item__weight ${c.met ? 'condition-item__weight--active-sell' : ''}`}>
                        {c.met ? `+${c.weight}` : `+0`}
                      </span>
                    </div>
                    <p className="condition-item__desc">{c.desc}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
