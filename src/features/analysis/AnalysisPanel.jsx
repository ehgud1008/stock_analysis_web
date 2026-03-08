import './AnalysisPanel.css';

// ── 툴팁 설명 ────────────────────────────────────────────
const TOOLTIPS = {
  ma: '이동평균선은 일정 기간의 평균 주가를 이은 선입니다. 단기선이 장기선 위에 있으면 상승 추세(골든크로스), 아래에 있으면 하락 추세(데드크로스)로 판단합니다.',
  rsi: 'RSI(상대강도지수)는 0~100 범위의 모멘텀 지표입니다. 70 이상이면 과매수(고점 주의), 30 이하면 과매도(반등 기대) 구간으로 봅니다.',
  bollinger: '볼린저 밴드는 20일 이동평균 ± 2표준편차로 구성됩니다. 주가가 상단에 가까우면 과열, 하단에 가까우면 반등 가능성을 시사합니다.',
  ichimoku: '일목균형표는 전환선·기준선·구름대 등으로 추세와 지지/저항을 분석합니다. 주가가 구름 위이면 상승 추세, 아래이면 하락 추세로 봅니다.',
  volume: '거래량은 매매 참여 강도를 나타냅니다. 거래량 급증은 추세 전환이나 추세 지속의 신호이며, 거래량 감소는 관망세를 의미합니다.',
  macd: 'MACD는 단기(12일)와 장기(26일) 지수이동평균의 차이를 이용한 추세 추종 지표입니다. MACD Line이 Signal Line(9일 EMA) 위로 올라가면 매수 신호(골든크로스), 아래로 내려가면 매도 신호(데드크로스)입니다. 히스토그램은 두 선의 차이로, 양수가 커질수록 상승 모멘텀이 강하고, 음수가 커질수록 하락 모멘텀이 강합니다.',
  stochastic: '스토캐스틱은 일정 기간(14일) 중 현재가가 최고가·최저가 범위에서 어디에 위치하는지를 나타내는 지표입니다. %K가 80 이상이면 과매수, 20 이하면 과매도로 판단합니다. %K가 %D(3일 평균) 위로 교차하면 매수, 아래로 교차하면 매도 신호입니다.',
};

// ── 시그널별 해석 텍스트 ──────────────────────────────────
function getMaInterpretation(trend) {
  const map = {
    bullish: '✅ 긍정적 — 단기 이평선이 장기 이평선 위에 위치해 상승 추세가 유지되고 있습니다. 매수 관점에서 유리한 구간입니다.',
    bearish: '⛔ 부정적 — 단기 이평선이 장기 이평선 아래에 위치해 하락 추세입니다. 신규 매수에 주의가 필요합니다.',
    mixed: '⚠️ 중립 — 이평선 간 혼조세로 뚜렷한 추세가 없습니다. 추가 확인 후 판단이 필요합니다.',
  };
  return map[trend.type] || map.mixed;
}

function getRsiInterpretation(signal, value) {
  if (signal.level === 'overbought') {
    return `⛔ 주의 — RSI ${value?.toFixed(1)}로 과매수 구간입니다. 단기 조정 가능성이 높아 매수에 신중해야 합니다.`;
  }
  if (signal.level === 'oversold') {
    return `✅ 기회 — RSI ${value?.toFixed(1)}로 과매도 구간입니다. 기술적 반등을 기대할 수 있는 구간입니다.`;
  }
  return `⚠️ 보통 — RSI ${value?.toFixed(1)}로 중립 구간입니다. 특별한 과열/침체 신호는 없습니다.`;
}

function getBollingerInterpretation(signal) {
  const pos = signal.position;
  if (pos === 'above' || pos === 'near_upper') {
    return '⛔ 주의 — 주가가 볼린저 상단 근처로 과열 상태입니다. 단기 하락 조정 가능성에 대비하세요.';
  }
  if (pos === 'below' || pos === 'near_lower') {
    return '✅ 기회 — 주가가 볼린저 하단 근처로 저평가 상태입니다. 기술적 반등을 노려볼 수 있습니다.';
  }
  return '⚠️ 보통 — 주가가 밴드 중간에 위치해 있어 뚜렷한 방향성이 없습니다.';
}

function getIchimokuInterpretation(signal) {
  const map = {
    bullish: '✅ 긍정적 — 주가가 구름대 위에 있고 전환선이 기준선 위에 있어 강한 상승 신호입니다.',
    bearish: '⛔ 부정적 — 주가가 구름대 아래에 있어 하락 추세가 지속되고 있습니다. 매수에 주의하세요.',
    mixed: '⚠️ 중립 — 구름대 근처에서 횡보 중이며 추세 전환 여부를 관찰해야 합니다.',
  };
  return map[signal.signal] || map.mixed;
}

function getVolumeInterpretation(volume) {
  if (volume.trend === 'high') {
    return '✅ 활발 — 최근 거래량이 평균 대비 높아 시장 관심이 집중되고 있습니다. 추세 지속 가능성이 높습니다.';
  }
  if (volume.trend === 'low') {
    return '⛔ 부진 — 거래량이 평균보다 낮아 관망세가 강합니다. 급변동에 대비하세요.';
  }
  return '⚠️ 보통 — 거래량이 평균 수준으로, 뚜렷한 매매 신호를 동반하지 않습니다.';
}

function getMacdInterpretation(macd) {
  if (macd.cross === 'golden') {
    return '✅ 매수 신호 — MACD 골든크로스 발생! MACD Line이 Signal Line을 상향 돌파하여 상승 추세 전환이 예상됩니다.';
  }
  if (macd.cross === 'dead') {
    return '⛔ 매도 신호 — MACD 데드크로스 발생! MACD Line이 Signal Line을 하향 돌파하여 하락 추세 전환에 주의해야 합니다.';
  }
  if (macd.histogram > 0) {
    return '✅ 긍정적 — 히스토그램이 양수로 상승 모멘텀이 유지되고 있습니다. MACD Line이 Signal Line 위에 있어 매수 우위입니다.';
  }
  return '⛔ 부정적 — 히스토그램이 음수로 하락 모멘텀이 유지되고 있습니다. MACD Line이 Signal Line 아래에 있어 매도 압력이 우세합니다.';
}

function getStochasticInterpretation(stochastic) {
  if (stochastic.cross === 'golden') {
    return '✅ 매수 신호 — %K가 %D를 상향 돌파(골든크로스)하여 단기 반등 가능성이 높습니다.';
  }
  if (stochastic.cross === 'dead') {
    return '⛔ 매도 신호 — %K가 %D를 하향 돌파(데드크로스)하여 단기 조정 가능성에 주의하세요.';
  }
  if (stochastic.signal.level === 'overbought') {
    return '⛔ 주의 — 스토캐스틱이 과매수 구간(80 이상)에 있습니다. 단기 고점 형성 후 조정이 올 수 있습니다.';
  }
  if (stochastic.signal.level === 'oversold') {
    return '✅ 기회 — 스토캐스틱이 과매도 구간(20 이하)에 있습니다. 기술적 반등을 기대할 수 있는 구간입니다.';
  }
  return '⚠️ 보통 — 스토캐스틱이 중립 구간으로, 뚜렷한 과열/침체 신호는 없습니다.';
}

// ── Tooltip 컴포넌트 ─────────────────────────────────────
function Tooltip({ text }) {
  return (
    <span className="tooltip-wrapper">
      <span className="tooltip-trigger">?</span>
      <span className="tooltip-content">{text}</span>
    </span>
  );
}

// ── 해석 텍스트 컴포넌트 ─────────────────────────────────
function Interpretation({ text }) {
  return <p className="analysis-card__interpretation">{text}</p>;
}

// ── 메인 컴포넌트 ────────────────────────────────────────
export default function AnalysisPanel({ analysis }) {
  if (!analysis) return null;

  const { summary, ma, rsi, bollinger, ichimoku, macd, stochastic, maCross, volume } = analysis;

  return (
    <section className="analysis-panel">
      <div className="analysis-panel__header">
        <div className="analysis-panel__icon">📈</div>
        <h2 className="analysis-panel__title">기술적 분석 결과</h2>
        <span className="analysis-panel__badge">{summary.stockCode}</span>
      </div>

      <div className="analysis-cards">
        {/* 데이터 요약 */}
        <div className="analysis-card">
          <h3 className="analysis-card__title">
            <span className="analysis-card__emoji">📋</span>
            데이터 요약
          </h3>
          <div className="analysis-card__grid">
            <div className="stat">
              <span className="stat__label">현재가</span>
              <span className="stat__value stat__value--highlight">
                {summary.currentPrice.toLocaleString()}원
              </span>
            </div>
            <div className="stat">
              <span className="stat__label">기간 최고가</span>
              <span className="stat__value stat__value--up">
                {summary.highestPrice.toLocaleString()}원
              </span>
            </div>
            <div className="stat">
              <span className="stat__label">기간 최저가</span>
              <span className="stat__value stat__value--down">
                {summary.lowestPrice.toLocaleString()}원
              </span>
            </div>
            <div className="stat">
              <span className="stat__label">데이터 수</span>
              <span className="stat__value">{summary.dataCount}개</span>
            </div>
            <div className="stat stat--wide">
              <span className="stat__label">기간</span>
              <span className="stat__value">
                {formatDate(summary.dateRange.from)} ~ {formatDate(summary.dateRange.to)}
              </span>
            </div>
          </div>
        </div>

        {/* 추세 분석 (이동평균선) */}
        <div className="analysis-card">
          <h3 className="analysis-card__title">
            <span className="analysis-card__emoji">📐</span>
            추세 분석 (이동평균선)
            <Tooltip text={TOOLTIPS.ma} />
          </h3>
          <div className={`analysis-card__signal analysis-card__signal--${ma.trend.type}`}>
            {ma.trend.label}
          </div>
          <Interpretation text={getMaInterpretation(ma.trend)} />
          <div className="analysis-card__details">
            {Object.entries(ma.values).map(([key, val]) =>
              val !== null ? (
                <div className="detail-row" key={key}>
                  <span className="detail-row__label">{key.toUpperCase()}</span>
                  <span className="detail-row__value">{Math.round(val).toLocaleString()}원</span>
                </div>
              ) : null
            )}
          </div>
        </div>

        {/* RSI */}
        <div className="analysis-card">
          <h3 className="analysis-card__title">
            <span className="analysis-card__emoji">⚡</span>
            모멘텀 (RSI)
            <Tooltip text={TOOLTIPS.rsi} />
          </h3>
          <div
            className={`analysis-card__signal analysis-card__signal--${
              rsi.signal.level === 'overbought'
                ? 'bearish'
                : rsi.signal.level === 'oversold'
                ? 'bullish'
                : 'mixed'
            }`}
          >
            {rsi.signal.label}
          </div>
          <Interpretation text={getRsiInterpretation(rsi.signal, rsi.value)} />
          {rsi.value !== null && (
            <div className="rsi-bar">
              <div className="rsi-bar__track">
                <div
                  className="rsi-bar__fill"
                  style={{ width: `${rsi.value}%` }}
                />
                <div className="rsi-bar__marker" style={{ left: `${rsi.value}%` }} />
              </div>
              <div className="rsi-bar__labels">
                <span>과매도 (30)</span>
                <span>과매수 (70)</span>
              </div>
            </div>
          )}
        </div>

        {/* 볼린저 밴드 */}
        <div className="analysis-card">
          <h3 className="analysis-card__title">
            <span className="analysis-card__emoji">🎯</span>
            변동성 (볼린저 밴드)
            <Tooltip text={TOOLTIPS.bollinger} />
          </h3>
          <div
            className={`analysis-card__signal analysis-card__signal--${
              bollinger.signal.position === 'above' || bollinger.signal.position === 'near_upper'
                ? 'bearish'
                : bollinger.signal.position === 'below' || bollinger.signal.position === 'near_lower'
                ? 'bullish'
                : 'mixed'
            }`}
          >
            {bollinger.signal.label}
          </div>
          <Interpretation text={getBollingerInterpretation(bollinger.signal)} />
          {bollinger.bands && (
            <div className="analysis-card__details">
              <div className="detail-row">
                <span className="detail-row__label">상단</span>
                <span className="detail-row__value">{Math.round(bollinger.bands.upper).toLocaleString()}원</span>
              </div>
              <div className="detail-row">
                <span className="detail-row__label">중단 (MA20)</span>
                <span className="detail-row__value">{Math.round(bollinger.bands.middle).toLocaleString()}원</span>
              </div>
              <div className="detail-row">
                <span className="detail-row__label">하단</span>
                <span className="detail-row__value">{Math.round(bollinger.bands.lower).toLocaleString()}원</span>
              </div>
              <div className="detail-row">
                <span className="detail-row__label">밴드폭</span>
                <span className="detail-row__value">{bollinger.bands.bandwidth.toFixed(2)}%</span>
              </div>
            </div>
          )}
        </div>

        {/* 일목균형표 */}
        <div className="analysis-card">
          <h3 className="analysis-card__title">
            <span className="analysis-card__emoji">☁️</span>
            일목균형표
            <Tooltip text={TOOLTIPS.ichimoku} />
          </h3>
          <div className={`analysis-card__signal analysis-card__signal--${ichimoku.signal.signal}`}>
            {ichimoku.signal.label}
          </div>
          <Interpretation text={getIchimokuInterpretation(ichimoku.signal)} />
          <ul className="analysis-card__list">
            {ichimoku.signal.details.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
          {ichimoku.values && (
            <div className="analysis-card__details">
              <div className="detail-row">
                <span className="detail-row__label">전환선 (9)</span>
                <span className="detail-row__value">{Math.round(ichimoku.values.tenkanSen).toLocaleString()}원</span>
              </div>
              <div className="detail-row">
                <span className="detail-row__label">기준선 (26)</span>
                <span className="detail-row__value">{Math.round(ichimoku.values.kijunSen).toLocaleString()}원</span>
              </div>
              <div className="detail-row">
                <span className="detail-row__label">구름 상단</span>
                <span className="detail-row__value">{Math.round(ichimoku.values.cloudTop).toLocaleString()}원</span>
              </div>
              <div className="detail-row">
                <span className="detail-row__label">구름 하단</span>
                <span className="detail-row__value">{Math.round(ichimoku.values.cloudBottom).toLocaleString()}원</span>
              </div>
            </div>
          )}
        </div>

        {/* 거래량 */}
        <div className="analysis-card">
          <h3 className="analysis-card__title">
            <span className="analysis-card__emoji">📊</span>
            거래량 분석
            <Tooltip text={TOOLTIPS.volume} />
          </h3>
          <div
            className={`analysis-card__signal analysis-card__signal--${
              volume.trend === 'high' ? 'bullish' : volume.trend === 'low' ? 'bearish' : 'mixed'
            }`}
          >
            {volume.label}
          </div>
          <Interpretation text={getVolumeInterpretation(volume)} />
          <div className="analysis-card__details">
            <div className="detail-row">
              <span className="detail-row__label">5일 평균</span>
              <span className="detail-row__value">{Math.round(volume.avg5).toLocaleString()}</span>
            </div>
            <div className="detail-row">
              <span className="detail-row__label">20일 평균</span>
              <span className="detail-row__value">{Math.round(volume.avg20).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* MACD */}
        {macd && (
          <div className="analysis-card">
            <h3 className="analysis-card__title">
              <span className="analysis-card__emoji">📉</span>
              MACD (12, 26, 9)
              <Tooltip text={TOOLTIPS.macd} />
            </h3>
            <div className={`analysis-card__signal analysis-card__signal--${macd.histogram > 0 ? 'bullish' : 'bearish'}`}>
              {macd.label}
            </div>
            <Interpretation text={getMacdInterpretation(macd)} />
            <div className="analysis-card__details">
              <div className="detail-row">
                <span className="detail-row__label">MACD Line</span>
                <span className="detail-row__value">{macd.macdLine.toFixed(2)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-row__label">Signal Line</span>
                <span className="detail-row__value">{macd.signalLine.toFixed(2)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-row__label">히스토그램</span>
                <span className={`detail-row__value detail-row__value--${macd.histogram > 0 ? 'green' : 'red'}`}>
                  {macd.histogram > 0 ? '+' : ''}{macd.histogram.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 스토캐스틱 */}
        {stochastic && (
          <div className="analysis-card">
            <h3 className="analysis-card__title">
              <span className="analysis-card__emoji">⚡</span>
              스토캐스틱 (14, 3)
              <Tooltip text={TOOLTIPS.stochastic} />
            </h3>
            <div className={`analysis-card__signal analysis-card__signal--${
              stochastic.signal.level === 'overbought' ? 'bearish'
                : stochastic.signal.level === 'oversold' ? 'bullish' : 'mixed'
            }`}>
              {stochastic.signal.label}
            </div>
            <Interpretation text={getStochasticInterpretation(stochastic)} />
            <div className="analysis-card__details">
              <div className="detail-row">
                <span className="detail-row__label">%K</span>
                <span className="detail-row__value">{stochastic.k.toFixed(1)}%</span>
              </div>
              <div className="detail-row">
                <span className="detail-row__label">%D</span>
                <span className="detail-row__value">{stochastic.d.toFixed(1)}%</span>
              </div>
              {stochastic.cross && (
                <div className="detail-row">
                  <span className="detail-row__label">크로스</span>
                  <span className={`detail-row__value detail-row__value--${stochastic.cross === 'golden' ? 'green' : 'red'}`}>
                    {stochastic.cross === 'golden' ? '⚡ 골든크로스' : '⚡ 데드크로스'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function formatDate(dt) {
  if (!dt || dt.length < 8) return dt || '';
  return `${dt.slice(0, 4)}.${dt.slice(4, 6)}.${dt.slice(6, 8)}`;
}
