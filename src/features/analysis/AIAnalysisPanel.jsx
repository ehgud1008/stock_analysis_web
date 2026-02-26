import { useState, useCallback } from 'react';
import { requestAIAnalysis } from '../../api/kiwoomApi';
import { saveAnalysis } from '../../utils/analysisStorage';
import './AIAnalysisPanel.css';

// ── 툴팁 설명 ────────────────────────────────────────────
const AI_TOOLTIPS = {
  patternCount: '현재 차트와 비슷한 가격/거래량 패턴이 과거에 몇 번 나타났는지를 추정한 수치입니다. 많을수록 통계적 신뢰도가 높습니다.',
  avgGain: '유사 패턴 발생 후 주가가 상승했을 때의 평균 상승 폭(%)입니다. 높을수록 상승 시 기대 수익이 큽니다.',
  avgLoss: '유사 패턴 발생 후 주가가 하락했을 때의 평균 하락 폭(%)입니다. 높을수록 손실 리스크가 큽니다.',
  winRate: '유사 패턴에서 주가가 상승한 비율(%)입니다. 50% 이상이면 상승 확률이 높다는 의미입니다.',
  expectancy: '기대값 = (승률 × 평균이익) - ((1-승률) × 평균손실). 양수이면 매매 시 기대 수익이 있고, 0 이하이면 손실이 예상됩니다.',
  riskReward: '리스크 대비 보상비(R:R)는 손절 시 손실 대비 목표가 도달 시 이익의 비율입니다. 1:2 이상이면 유리한 매매로 판단합니다.',
  kelly: 'Kelly Criterion은 자산의 최적 투자 비율을 계산하는 공식입니다. 0.5x(Half Kelly)는 보수적 접근으로, 변동성 리스크를 줄이면서 적정 비중을 추천합니다.',
  positionPct: '전체 투자금 대비 해당 종목에 투자하기를 권장하는 비중(%)입니다. 리스크와 기대값을 종합하여 산출됩니다.',
};

// ── Tooltip 컴포넌트 ─────────────────────────────────────
function Tip({ text }) {
  return (
    <span className="tooltip-wrapper tooltip-wrapper--inline">
      <span className="tooltip-trigger">?</span>
      <span className="tooltip-content">{text}</span>
    </span>
  );
}

/**
 * CDE 분석용 프롬프트 생성
 */
function buildCDEPrompt(analysis, positionInfo) {
  const { summary, ma, rsi, bollinger, ichimoku, volume, structure, strategy } = analysis;
  const { trendStructure, atr, volumeAdvanced, supportResistance } = structure;

  const lines = [];
  lines.push(`## 종목 기본 정보`);
  lines.push(`- 종목코드: ${summary.stockCode}`);
  lines.push(`- 현재가: ${summary.currentPrice.toLocaleString()}원`);
  lines.push(`- 기간 최고가: ${summary.highestPrice.toLocaleString()}원`);
  lines.push(`- 기간 최저가: ${summary.lowestPrice.toLocaleString()}원`);
  lines.push(`- 데이터 수: ${summary.dataCount}개`);
  lines.push('');

  // 포지션 정보
  if (positionInfo.type === 'holding') {
    lines.push(`## 보유 포지션 정보`);
    lines.push(`- 포지션 유형: 보유종목 (기존 매수 상태)`);
    lines.push(`- 보유 주식수: ${Number(positionInfo.shares).toLocaleString()}주`);
    lines.push(`- 평균 매수가: ${Number(positionInfo.avgPrice).toLocaleString()}원`);
    const pnlPct = ((summary.currentPrice - positionInfo.avgPrice) / positionInfo.avgPrice * 100).toFixed(2);
    lines.push(`- 현재 수익률: ${pnlPct}%`);
    lines.push(`- 평가 손익: ${((summary.currentPrice - positionInfo.avgPrice) * positionInfo.shares).toLocaleString()}원`);
    lines.push('');
    lines.push(`> 이 투자자는 이미 해당 종목을 보유하고 있습니다.`);
    lines.push(`> 추가매수, 보유유지, 부분매도, 전량매도 중 가장 적절한 전략을 판단해 주세요.`);
    lines.push('');
  } else {
    lines.push(`## 포지션 정보`);
    lines.push(`- 포지션 유형: 신규매수 검토`);
    lines.push(`> 이 투자자는 아직 해당 종목을 보유하지 않고 있으며, 신규 진입을 검토 중입니다.`);
    lines.push('');
  }

  lines.push(`## A. 기술적 구조 분석 결과`);
  lines.push(`### 추세 구조`);
  lines.push(`- 패턴: ${trendStructure.pattern} (${trendStructure.direction})`);
  lines.push(`- 추세 강도: ${trendStructure.strength}`);
  trendStructure.details.forEach(d => lines.push(`- ${d}`));
  lines.push('');

  lines.push(`### 지지/저항`);
  if (supportResistance.nearestResistance) {
    lines.push(`- 최근접 저항: ${supportResistance.nearestResistance.price.toLocaleString()}원`);
  }
  if (supportResistance.nearestSupport) {
    lines.push(`- 최근접 지지: ${supportResistance.nearestSupport.price.toLocaleString()}원`);
  }
  if (supportResistance.recentBreakout) {
    lines.push(`- 최근 돌파: ${supportResistance.recentBreakout.type} (${supportResistance.recentBreakout.level.toLocaleString()}원)`);
  }
  lines.push('');

  if (atr) {
    lines.push(`### 변동성`);
    lines.push(`- ATR(14): ${Math.round(atr.atr).toLocaleString()}원 (현재가 대비 ${((atr.atr / summary.currentPrice) * 100).toFixed(2)}%)`);
    lines.push(`- 3봉 변동성 급증: ${atr.volatilitySpike ? '예' : '아니오'}`);
    lines.push('');
  }

  lines.push(`### 거래량`);
  lines.push(`- 5일/20일 평균 증감률: ${volumeAdvanced.changeRate.toFixed(1)}%`);
  lines.push(`- 거래량 동반 돌파: ${volumeAdvanced.breakoutVolume ? '예' : '아니오'}`);
  lines.push(`- 거래량 감소 추세: ${volumeAdvanced.decreasingTrend ? '예' : '아니오'}`);
  lines.push('');

  lines.push(`### 이동평균선`);
  lines.push(`- MA배열: ${ma.trend.label}`);
  Object.entries(ma.values).forEach(([key, val]) => {
    if (val !== null) lines.push(`- ${key.toUpperCase()}: ${Math.round(val).toLocaleString()}원`);
  });
  lines.push('');

  lines.push(`### RSI: ${rsi.signal.label}`);
  if (bollinger.bands) {
    lines.push(`### 볼린저: ${bollinger.signal.label} (상단 ${Math.round(bollinger.bands.upper).toLocaleString()}, 하단 ${Math.round(bollinger.bands.lower).toLocaleString()})`);
  }
  lines.push('');

  lines.push(`## B. 매매 전략 도출 결과`);
  lines.push(`- 종합 판단: ${strategy.overallLabel}`);
  lines.push(`- 매수 조건 충족: ${strategy.buyScore}/3`);
  strategy.buyConditions.forEach(c => lines.push(`  - ${c.met ? '✅' : '❌'} ${c.label}: ${c.desc}`));
  lines.push(`- 매도 조건 충족: ${strategy.sellScore}/3`);
  strategy.sellConditions.forEach(c => lines.push(`  - ${c.met ? '🔴' : '⚪'} ${c.label}: ${c.desc}`));
  lines.push('');

  lines.push(`---`);
  lines.push(`위 분석 데이터를 바탕으로 아래 C, D, E, F 항목을 분석하세요.`);
  lines.push('');
  lines.push(`## C. 기대값 분석 (Expectancy)`);
  lines.push(`아래 형식으로 분석:`);
  lines.push(`1. 유사 패턴 횟수 추정 (최근 데이터 기반)`);
  lines.push(`2. 평균 상승폭 (%)`);
  lines.push(`3. 평균 하락폭 (%)`);
  lines.push(`4. 승률 추정 (%)`);
  lines.push(`5. 기대값 = (승률 × 평균이익) - ((1-승률) × 평균손실)`);
  lines.push(`6. 기대값이 0 이하이면 신호 약화로 판단`);
  lines.push(`7. 위 분석 결과를 종합하여 기대값에 대한 상세 설명을 3~5문장으로 작성`);
  lines.push('');
  lines.push(`## D. 리스크 관리 설계`);
  lines.push(`1. 손절가 설정 (최근 스윙 저점 또는 ATR 기반, 구체적 가격)`);
  lines.push(`2. 1차/2차 목표가 (구체적 가격)`);
  lines.push(`3. 리스크 대비 보상비 (R:R)`);
  lines.push(`4. Kelly Fraction 계산 (보수적으로 0.5 Kelly 적용)`);
  lines.push(`5. 권장 포지션 비중 (%)`);
  lines.push(`6. 위 리스크 관리 설계를 종합하여 리스크에 대한 상세 설명을 3~5문장으로 작성`);
  lines.push('');
  lines.push(`## E. 시나리오 확률`);
  lines.push(`아래 3가지 시나리오의 확률을 합계 100%로 제시:`);
  lines.push(`- 상승세 (bullish) %`);
  lines.push(`- 하락세 (bearish) %`);
  lines.push(`- 횡보세 (sideways) %`);
  lines.push('');
  lines.push(`## F. 총 요약`);
  lines.push(`1. 위 C/D/E 분석 결과를 종합한 총 요약 (3~5문장)`);
  lines.push(`2. AI로서 이 종목에 실제 투자한다면 매수할 것인지, 매도할 것인지, 관망할 것인지 판단`);
  lines.push(`3. 판단 근거를 구체적으로 설명`);
  lines.push(`4. 단기(1~2주 이하), 중기(1~3개월 이하), 장기(3개월 이상)로 나누어서 각각 의견을 제시`);
  lines.push('');
  lines.push(`반드시 아래 JSON 형식으로 응답하세요:`);
  lines.push('```json');
  lines.push(`{`);
  lines.push(`  "expectancy": {`);
  lines.push(`    "pattern_count": number,`);
  lines.push(`    "avg_gain_pct": number,`);
  lines.push(`    "avg_loss_pct": number,`);
  lines.push(`    "win_rate_pct": number,`);
  lines.push(`    "expectancy_value": number,`);
  lines.push(`    "signal_weakened": boolean,`);
  lines.push(`    "reasoning": "string",`);
  lines.push(`    "description": "string (기대값 분석에 대한 상세 설명 3~5문장)"`);
  lines.push(`  },`);
  lines.push(`  "risk_management": {`);
  lines.push(`    "stop_loss": number,`);
  lines.push(`    "stop_loss_reason": "string",`);
  lines.push(`    "target_1": number,`);
  lines.push(`    "target_2": number,`);
  lines.push(`    "risk_reward_ratio": "string",`);
  lines.push(`    "kelly_fraction": number,`);
  lines.push(`    "half_kelly": number,`);
  lines.push(`    "recommended_position_pct": number,`);
  lines.push(`    "reasoning": "string",`);
  lines.push(`    "description": "string (리스크 관리 설계에 대한 상세 설명 3~5문장)"`);
  lines.push(`  },`);
  lines.push(`  "scenarios": {`);
  lines.push(`    "bullish_pct": number,`);
  lines.push(`    "bearish_pct": number,`);
  lines.push(`    "sideways_pct": number,`);
  lines.push(`    "bullish_desc": "string",`);
  lines.push(`    "bearish_desc": "string",`);
  lines.push(`    "sideways_desc": "string"`);
  lines.push(`  },`);
  lines.push(`  "summary": {`);
  lines.push(`    "overall": "string (3~5문장 종합 요약)",`);
  lines.push(`    "decision": "buy | sell | hold",`);
  lines.push(`    "decision_label": "string (매수/매도/관망 한글)",`);
  lines.push(`    "confidence_pct": number,`);
  lines.push(`    "reasoning": "string (판단 근거)",`);
  lines.push(`    "short_term": {`);
  lines.push(`      "decision": "buy | sell | hold",`);
  lines.push(`      "decision_label": "string",`);
  lines.push(`      "reasoning": "string (단기 1~2주 이하 의견)"`);
  lines.push(`    },`);
  lines.push(`    "mid_term": {`);
  lines.push(`      "decision": "buy | sell | hold",`);
  lines.push(`      "decision_label": "string",`);
  lines.push(`      "reasoning": "string (중기 1~3개월 이하 의견)"`);
  lines.push(`    },`);
  lines.push(`    "long_term": {`);
  lines.push(`      "decision": "buy | sell | hold",`);
  lines.push(`      "decision_label": "string",`);
  lines.push(`      "reasoning": "string (장기 3개월 이상 의견)"`);
  lines.push(`    }`);
  lines.push(`  }`);
  lines.push(`}`);
  lines.push('```');

  return lines.join('\n');
}

// ── 메인 컴포넌트 ────────────────────────────────────────
export default function AIAnalysisPanel({ analysis }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null); // null | 'success' | 'error'
  const [positionType, setPositionType] = useState('new'); // 'new' | 'holding'
  const [holdingShares, setHoldingShares] = useState('');
  const [holdingAvgPrice, setHoldingAvgPrice] = useState('');

  const handleRequest = useCallback(async () => {
    if (!analysis?.structure || !analysis?.strategy) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setSaved(null);

    try {
      const positionInfo = {
        type: positionType,
        shares: Number(holdingShares) || 0,
        avgPrice: Number(holdingAvgPrice) || 0,
      };
      const prompt = buildCDEPrompt(analysis, positionInfo);
      const raw = await requestAIAnalysis(prompt);
      const parsed = JSON.parse(raw);
      setResult(parsed);

      // 자동 저장
      try {
        await saveAnalysis({
          stockCode: analysis.summary.stockCode,
          currentPrice: analysis.summary.currentPrice,
          chartType: analysis.summary.chartType || '',
          decision: parsed.summary?.decision,
          decision_label: parsed.summary?.decision_label,
          confidence_pct: parsed.summary?.confidence_pct,
          aiResult: parsed,
        });
        setSaved('success');
      } catch {
        setSaved('error');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [analysis, positionType, holdingShares, holdingAvgPrice]);

  if (!analysis?.structure || !analysis?.strategy) return null;

  return (
    <section className="ai-analysis-panel">
      <div className="ai-analysis-panel__header">
        <span className="ai-analysis-panel__icon">🤖</span>
        <h2 className="ai-analysis-panel__title">AI 고급 분석</h2>
      </div>

      {/* 포지션 유형 선택 */}
      <div className="ai-position">
        <label className="ai-position__radio">
          <input
            type="radio"
            name="positionType"
            value="new"
            checked={positionType === 'new'}
            onChange={() => setPositionType('new')}
          />
          <span className="ai-position__radio-mark" />
          <span>신규매수</span>
        </label>
        <label className="ai-position__radio">
          <input
            type="radio"
            name="positionType"
            value="holding"
            checked={positionType === 'holding'}
            onChange={() => setPositionType('holding')}
          />
          <span className="ai-position__radio-mark" />
          <span>보유종목</span>
        </label>

        {positionType === 'holding' && (
          <div className="ai-position__holding-inputs">
            <div className="ai-position__field">
              <label className="ai-position__label">보유주식수</label>
              <input
                className="input ai-position__input"
                type="number"
                min="1"
                placeholder="예: 100"
                value={holdingShares}
                onChange={(e) => setHoldingShares(e.target.value)}
              />
            </div>
            <div className="ai-position__field">
              <label className="ai-position__label">평균매수가 (원)</label>
              <input
                className="input ai-position__input"
                type="number"
                min="0"
                placeholder="예: 65000"
                value={holdingAvgPrice}
                onChange={(e) => setHoldingAvgPrice(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      <button
        className="ai-analysis-panel__btn"
        onClick={handleRequest}
        disabled={loading || (positionType === 'holding' && (!holdingShares || !holdingAvgPrice))}
        style={{ width: '100%' }}
      >
        {loading ? (
          <>
            <span className="ai-analysis-panel__spinner" />
            분석 중…
          </>
        ) : result ? '🔄 재분석' : '🚀 AI 분석 실행'}
      </button>

      {error && (
        <div className="ai-analysis-panel__error">
          <span>⚠️</span> {error}
        </div>
      )}

      {saved === 'success' && (
        <div className="ai-analysis-panel__saved">
          ✅ 분석 결과가 기록에 저장되었습니다.
        </div>
      )}
      {saved === 'error' && (
        <div className="ai-analysis-panel__saved ai-analysis-panel__saved--error">
          ⚠️ 기록 저장에 실패했습니다.
        </div>
      )}

      {loading && (
        <div className="ai-analysis-panel__loading">
          <div className="ai-analysis-panel__loading-bar" />
          <p>Gemini가 기대값, 리스크 관리, 시나리오, 총 요약을 분석하고 있습니다…</p>
        </div>
      )}

      {result && (
        <div className="ai-analysis-panel__results">
          {/* C. 기대값 분석 */}
          {result.expectancy && <ExpectancyCard data={result.expectancy} currentPrice={analysis.summary.currentPrice} />}

          {/* D. 리스크 관리 */}
          {result.risk_management && <RiskCard data={result.risk_management} currentPrice={analysis.summary.currentPrice} />}

          {/* E. 시나리오 확률 */}
          {result.scenarios && <ScenarioCard data={result.scenarios} />}

          {/* F. 총 요약 */}
          {result.summary && <SummaryCard data={result.summary} />}
        </div>
      )}
    </section>
  );
}

// ── C. 기대값 분석 카드 ──────────────────────────────────
function ExpectancyCard({ data }) {
  const isPositive = data.expectancy_value > 0;

  return (
    <div className="cde-card">
      <h3 className="cde-card__title">
        <span>📊</span> 기대값 분석 (Expectancy)
      </h3>
      <div className="cde-card__grid">
        <div className="cde-stat">
          <span className="cde-stat__label">유사 패턴 수 <Tip text={AI_TOOLTIPS.patternCount} /></span>
          <span className="cde-stat__value">{data.pattern_count}회</span>
        </div>
        <div className="cde-stat">
          <span className="cde-stat__label">평균 상승폭 <Tip text={AI_TOOLTIPS.avgGain} /></span>
          <span className="cde-stat__value cde-stat__value--green">+{data.avg_gain_pct}%</span>
        </div>
        <div className="cde-stat">
          <span className="cde-stat__label">평균 하락폭 <Tip text={AI_TOOLTIPS.avgLoss} /></span>
          <span className="cde-stat__value cde-stat__value--red">-{data.avg_loss_pct}%</span>
        </div>
        <div className="cde-stat">
          <span className="cde-stat__label">승률 <Tip text={AI_TOOLTIPS.winRate} /></span>
          <span className="cde-stat__value">{data.win_rate_pct}%</span>
        </div>
      </div>

      <div className={`cde-card__highlight ${isPositive ? 'cde-card__highlight--positive' : 'cde-card__highlight--negative'}`}>
        <div className="cde-card__highlight-header">
          <span className="cde-card__highlight-label">기대값 (Expectancy) <Tip text={AI_TOOLTIPS.expectancy} /></span>
          <span className="cde-card__highlight-value">
            {isPositive ? '+' : ''}{typeof data.expectancy_value === 'number' ? data.expectancy_value.toFixed(2) : data.expectancy_value}
          </span>
        </div>
        {data.signal_weakened && (
          <div className="cde-card__warning">
            ⚠️ 기대값 0 이하 — 신호 약화. 매매에 주의가 필요합니다.
          </div>
        )}
      </div>

      {data.description && (
        <div className="cde-card__description">
          <h4 className="cde-card__description-title">💡 상세 설명</h4>
          <p className="cde-card__description-text">{data.description}</p>
        </div>
      )}

      {data.reasoning && (
        <p className="cde-card__reasoning">{data.reasoning}</p>
      )}
    </div>
  );
}

// ── D. 리스크 관리 카드 ──────────────────────────────────
function RiskCard({ data, currentPrice }) {
  return (
    <div className="cde-card">
      <h3 className="cde-card__title">
        <span>🛡️</span> 리스크 관리 설계
      </h3>

      <div className="cde-card__price-levels">
        {/* 목표가 2 */}
        <div className="price-level price-level--target2">
          <span className="price-level__label">2차 목표가</span>
          <span className="price-level__value">{Number(data.target_2).toLocaleString()}원</span>
          <span className="price-level__pct">
            ({((data.target_2 - currentPrice) / currentPrice * 100).toFixed(1)}%)
          </span>
        </div>
        {/* 목표가 1 */}
        <div className="price-level price-level--target1">
          <span className="price-level__label">1차 목표가</span>
          <span className="price-level__value">{Number(data.target_1).toLocaleString()}원</span>
          <span className="price-level__pct">
            ({((data.target_1 - currentPrice) / currentPrice * 100).toFixed(1)}%)
          </span>
        </div>
        {/* 현재가 */}
        <div className="price-level price-level--current">
          <span className="price-level__label">현재가</span>
          <span className="price-level__value">{currentPrice.toLocaleString()}원</span>
        </div>
        {/* 손절가 */}
        <div className="price-level price-level--stop">
          <span className="price-level__label">손절가</span>
          <span className="price-level__value">{Number(data.stop_loss).toLocaleString()}원</span>
          <span className="price-level__pct">
            ({((data.stop_loss - currentPrice) / currentPrice * 100).toFixed(1)}%)
          </span>
        </div>
      </div>

      <div className="cde-card__grid cde-card__grid--3">
        <div className="cde-stat">
          <span className="cde-stat__label">R:R 비율 <Tip text={AI_TOOLTIPS.riskReward} /></span>
          <span className="cde-stat__value">{data.risk_reward_ratio}</span>
        </div>
        <div className="cde-stat">
          <span className="cde-stat__label">Kelly (0.5x) <Tip text={AI_TOOLTIPS.kelly} /></span>
          <span className="cde-stat__value">{data.half_kelly?.toFixed(1) ?? data.kelly_fraction?.toFixed(1)}%</span>
        </div>
        <div className="cde-stat">
          <span className="cde-stat__label">권장 비중 <Tip text={AI_TOOLTIPS.positionPct} /></span>
          <span className="cde-stat__value cde-stat__value--accent">{data.recommended_position_pct}%</span>
        </div>
      </div>

      {data.stop_loss_reason && (
        <p className="cde-card__note">📌 손절 근거: {data.stop_loss_reason}</p>
      )}

      {data.description && (
        <div className="cde-card__description">
          <h4 className="cde-card__description-title">💡 상세 설명</h4>
          <p className="cde-card__description-text">{data.description}</p>
        </div>
      )}

      {data.reasoning && (
        <p className="cde-card__reasoning">{data.reasoning}</p>
      )}
    </div>
  );
}

// ── E. 시나리오 확률 카드 ────────────────────────────────
function ScenarioCard({ data }) {
  return (
    <div className="cde-card">
      <h3 className="cde-card__title">
        <span>🎲</span> 시나리오 확률
      </h3>

      <div className="scenario-bars">
        <ScenarioBar
          label="📈 상승세 (Bullish)"
          pct={data.bullish_pct}
          desc={data.bullish_desc}
          color="var(--green)"
        />
        <ScenarioBar
          label="📉 하락세 (Bearish)"
          pct={data.bearish_pct}
          desc={data.bearish_desc}
          color="var(--red)"
        />
        <ScenarioBar
          label="➡️ 횡보세 (Sideways)"
          pct={data.sideways_pct}
          desc={data.sideways_desc}
          color="var(--yellow)"
        />
      </div>

      <div className="scenario-total">
        합계: {(data.bullish_pct + data.bearish_pct + data.sideways_pct)}%
      </div>
    </div>
  );
}

function ScenarioBar({ label, pct, desc, color }) {
  return (
    <div className="scenario-bar">
      <div className="scenario-bar__header">
        <span className="scenario-bar__label">{label}</span>
        <span className="scenario-bar__pct" style={{ color }}>{pct}%</span>
      </div>
      <div className="scenario-bar__track">
        <div className="scenario-bar__fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      {desc && <p className="scenario-bar__desc">{desc}</p>}
    </div>
  );
}

// ── F. 총 요약 카드 ──────────────────────────────────────
function SummaryCard({ data }) {
  const decisionColors = {
    buy: 'var(--green)',
    sell: 'var(--red)',
    hold: 'var(--yellow)',
  };
  const decisionBg = {
    buy: 'rgba(34, 197, 94, 0.08)',
    sell: 'rgba(239, 68, 68, 0.08)',
    hold: 'rgba(234, 179, 8, 0.08)',
  };
  const decisionEmoji = {
    buy: '🟢',
    sell: '🔴',
    hold: '🟡',
  };

  const timeframes = [
    { key: 'short_term', label: '단기', period: '1~2주 이하', icon: '⚡' },
    { key: 'mid_term', label: '중기', period: '1~3개월', icon: '📈' },
    { key: 'long_term', label: '장기', period: '3개월 이상', icon: '🎯' },
  ];

  return (
    <div className="cde-card summary-card">
      <h3 className="cde-card__title">
        <span>📝</span> 총 요약
      </h3>

      <p className="summary-card__overall">{data.overall}</p>

      <div
        className="summary-card__decision"
        style={{
          borderColor: decisionColors[data.decision] || 'var(--border)',
          background: decisionBg[data.decision] || 'transparent',
        }}
      >
        <div className="summary-card__decision-header">
          <span className="summary-card__decision-emoji">
            {decisionEmoji[data.decision] || '⚪'}
          </span>
          <span
            className="summary-card__decision-label"
            style={{ color: decisionColors[data.decision] }}
          >
            {data.decision_label}
          </span>
          {data.confidence_pct != null && (
            <span className="summary-card__confidence">
              확신도 {data.confidence_pct}%
            </span>
          )}
        </div>
        <p className="summary-card__decision-reason">{data.reasoning}</p>
      </div>

      {/* 기간별 투자 의견 */}
      <div className="summary-card__timeframes">
        <h4 className="summary-card__timeframes-title">📅 기간별 투자 의견</h4>
        <div className="summary-card__timeframes-grid">
          {timeframes.map(({ key, label, period, icon }) => {
            const tf = data[key];
            if (!tf) return null;
            return (
              <div
                key={key}
                className="timeframe-card"
                style={{
                  borderColor: decisionColors[tf.decision] || 'var(--border)',
                }}
              >
                <div className="timeframe-card__header">
                  <span className="timeframe-card__icon">{icon}</span>
                  <div className="timeframe-card__label">
                    <span className="timeframe-card__name">{label}</span>
                    <span className="timeframe-card__period">{period}</span>
                  </div>
                  <span
                    className="timeframe-card__badge"
                    style={{
                      color: decisionColors[tf.decision],
                      background: decisionBg[tf.decision],
                    }}
                  >
                    {decisionEmoji[tf.decision] || '⚪'} {tf.decision_label}
                  </span>
                </div>
                <p className="timeframe-card__reasoning">{tf.reasoning}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
