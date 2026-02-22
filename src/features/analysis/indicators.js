/**
 * 기술적 지표 계산 모듈
 * 모든 함수는 순수 함수 — prices 배열은 최신 → 과거 순서 (API 응답 그대로)
 */

/**
 * 데이터를 숫자 배열로 정규화 (부호 제거)
 */
export function parsePrice(raw) {
  if (typeof raw === 'number') return raw;
  return Math.abs(Number(raw.replace(/[^0-9.-]/g, '')));
}

/**
 * 차트 데이터를 시간순(오래된→최신)으로 정렬 후 종가 배열 반환
 */
export function toClosePrices(chartData) {
  const sorted = [...chartData].reverse();
  return sorted.map((d) => parsePrice(d.cur_prc));
}

// ── 이동평균선 (MA) ──────────────────────────────────────

export function calcMA(prices, period) {
  if (prices.length < period) return null;
  const slice = prices.slice(prices.length - period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export function calcAllMA(prices) {
  const periods = [5, 10, 20, 60, 120];
  const result = {};
  for (const p of periods) {
    result[`ma${p}`] = calcMA(prices, p);
  }
  return result;
}

/**
 * 이평선 배열 상태 판단
 */
export function getMATrend(mas) {
  const available = [mas.ma5, mas.ma10, mas.ma20, mas.ma60, mas.ma120].filter(
    (v) => v !== null
  );
  if (available.length < 3) return { type: 'unknown', label: '데이터 부족' };

  const isGoldenCross = available.every(
    (v, i) => i === 0 || v <= available[i - 1]
  );
  const isDeathCross = available.every(
    (v, i) => i === 0 || v >= available[i - 1]
  );

  if (isGoldenCross)
    return { type: 'bullish', label: '정배열 (단기 > 장기)' };
  if (isDeathCross)
    return { type: 'bearish', label: '역배열 (단기 < 장기)' };
  return { type: 'mixed', label: '혼조 배열' };
}

// ── RSI ──────────────────────────────────────────────────

export function calcRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function getRSISignal(rsi) {
  if (rsi === null) return { level: 'unknown', label: '데이터 부족' };
  if (rsi >= 70) return { level: 'overbought', label: `과매수 (${rsi.toFixed(1)})` };
  if (rsi <= 30) return { level: 'oversold', label: `과매도 (${rsi.toFixed(1)})` };
  return { level: 'neutral', label: `중립 (${rsi.toFixed(1)})` };
}

// ── 볼린저 밴드 ──────────────────────────────────────────

export function calcBollingerBands(prices, period = 20, multiplier = 2) {
  if (prices.length < period) return null;

  const slice = prices.slice(prices.length - period);
  const ma = slice.reduce((a, b) => a + b, 0) / period;

  const variance =
    slice.reduce((sum, p) => sum + Math.pow(p - ma, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  return {
    upper: ma + multiplier * stdDev,
    middle: ma,
    lower: ma - multiplier * stdDev,
    bandwidth: ((multiplier * 2 * stdDev) / ma) * 100,
  };
}

export function getBollingerSignal(currentPrice, bands) {
  if (!bands) return { position: 'unknown', label: '데이터 부족' };

  const pctB =
    ((currentPrice - bands.lower) / (bands.upper - bands.lower)) * 100;

  if (currentPrice > bands.upper)
    return { position: 'above', label: `상단 돌파 (%B: ${pctB.toFixed(1)}%)`, pctB };
  if (currentPrice < bands.lower)
    return { position: 'below', label: `하단 이탈 (%B: ${pctB.toFixed(1)}%)`, pctB };
  if (pctB > 80)
    return { position: 'near_upper', label: `상단 근접 (%B: ${pctB.toFixed(1)}%)`, pctB };
  if (pctB < 20)
    return { position: 'near_lower', label: `하단 근접 (%B: ${pctB.toFixed(1)}%)`, pctB };
  return { position: 'middle', label: `중앙 (%B: ${pctB.toFixed(1)}%)`, pctB };
}

// ── 일목균형표 ───────────────────────────────────────────

export function calcIchimoku(chartData) {
  // chartData: 시간순(오래된→최신) 배열, 각 item에 high_pric, low_pric, cur_prc
  const len = chartData.length;
  if (len < 52) return null;

  const highLow = (arr, start, count) => {
    const slice = arr.slice(start, start + count);
    const highs = slice.map((d) => parsePrice(d.high_pric));
    const lows = slice.map((d) => parsePrice(d.low_pric));
    return {
      high: Math.max(...highs),
      low: Math.min(...lows),
    };
  };

  // 전환선 (9일)
  const conv9 = highLow(chartData, len - 9, 9);
  const tenkanSen = (conv9.high + conv9.low) / 2;

  // 기준선 (26일)
  const base26 = highLow(chartData, len - 26, 26);
  const kijunSen = (base26.high + base26.low) / 2;

  // 선행스팬1 (전환선+기준선)/2
  const senkouSpanA = (tenkanSen + kijunSen) / 2;

  // 선행스팬2 (52일)
  const span52 = highLow(chartData, len - 52, 52);
  const senkouSpanB = (span52.high + span52.low) / 2;

  // 후행스팬 = 현재 종가 (26일 전에 표시)
  const chikouSpan = parsePrice(chartData[len - 1].cur_prc);

  const cloudTop = Math.max(senkouSpanA, senkouSpanB);
  const cloudBottom = Math.min(senkouSpanA, senkouSpanB);

  return {
    tenkanSen,
    kijunSen,
    senkouSpanA,
    senkouSpanB,
    chikouSpan,
    cloudTop,
    cloudBottom,
  };
}

export function getIchimokuSignal(currentPrice, ichimoku) {
  if (!ichimoku) return { signal: 'unknown', label: '데이터 부족', details: [] };

  const details = [];
  let bullishCount = 0;
  let bearishCount = 0;

  // 가격 vs 구름
  if (currentPrice > ichimoku.cloudTop) {
    details.push('가격이 구름대 위 (강세)');
    bullishCount++;
  } else if (currentPrice < ichimoku.cloudBottom) {
    details.push('가격이 구름대 아래 (약세)');
    bearishCount++;
  } else {
    details.push('가격이 구름대 내부 (혼조)');
  }

  // 전환선 vs 기준선
  if (ichimoku.tenkanSen > ichimoku.kijunSen) {
    details.push('전환선 > 기준선 (매수 신호)');
    bullishCount++;
  } else {
    details.push('전환선 < 기준선 (매도 신호)');
    bearishCount++;
  }

  // 구름 색상
  if (ichimoku.senkouSpanA > ichimoku.senkouSpanB) {
    details.push('양운 (상승 구름)');
    bullishCount++;
  } else {
    details.push('음운 (하락 구름)');
    bearishCount++;
  }

  let signal = 'neutral';
  let label = '중립';
  if (bullishCount >= 2) {
    signal = 'bullish';
    label = '강세';
  }
  if (bearishCount >= 2) {
    signal = 'bearish';
    label = '약세';
  }

  return { signal, label, details };
}

// ── A. 기술적 구조 분석 ──────────────────────────────────

/**
 * 스윙 고점/저점 탐색 (N봉 기준)
 */
export function findSwingPoints(chartData, lookback = 3) {
  const highs = [];
  const lows = [];
  for (let i = lookback; i < chartData.length - lookback; i++) {
    const h = parsePrice(chartData[i].high_pric);
    const l = parsePrice(chartData[i].low_pric);
    let isSwingHigh = true;
    let isSwingLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (parsePrice(chartData[i - j].high_pric) >= h) isSwingHigh = false;
      if (parsePrice(chartData[i + j].high_pric) >= h) isSwingHigh = false;
      if (parsePrice(chartData[i - j].low_pric) <= l) isSwingLow = false;
      if (parsePrice(chartData[i + j].low_pric) <= l) isSwingLow = false;
    }
    if (isSwingHigh) highs.push({ index: i, price: h, dt: chartData[i].dt });
    if (isSwingLow) lows.push({ index: i, price: l, dt: chartData[i].dt });
  }
  return { highs, lows };
}

/**
 * HH/HL/LH/LL 추세 구조 판별
 */
export function detectTrendStructure(swingHighs, swingLows, currentPrice, ma20, ma60) {
  const result = {
    pattern: '',        // HH-HL, LH-LL, 혼조
    direction: '',      // 상승, 하락, 횡보
    strength: '',       // 강, 중, 약
    details: [],
  };

  // 최근 스윙 고점 2개 비교
  if (swingHighs.length >= 2) {
    const [prev, curr] = swingHighs.slice(-2);
    if (curr.price > prev.price) {
      result.details.push(`Higher High (HH): ${prev.price.toLocaleString()} → ${curr.price.toLocaleString()}`);
      result.pattern = 'HH';
    } else {
      result.details.push(`Lower High (LH): ${prev.price.toLocaleString()} → ${curr.price.toLocaleString()}`);
      result.pattern = 'LH';
    }
  }

  // 최근 스윙 저점 2개 비교
  if (swingLows.length >= 2) {
    const [prev, curr] = swingLows.slice(-2);
    if (curr.price > prev.price) {
      result.details.push(`Higher Low (HL): ${prev.price.toLocaleString()} → ${curr.price.toLocaleString()}`);
      result.pattern += '-HL';
    } else {
      result.details.push(`Lower Low (LL): ${prev.price.toLocaleString()} → ${curr.price.toLocaleString()}`);
      result.pattern += '-LL';
    }
  }

  // 추세 방향 결정
  if (result.pattern.includes('HH') && result.pattern.includes('HL')) {
    result.direction = '상승';
  } else if (result.pattern.includes('LH') && result.pattern.includes('LL')) {
    result.direction = '하락';
  } else {
    result.direction = '횡보';
  }

  // MA 기반 추세 보조 판단
  if (ma20 !== null && ma60 !== null) {
    if (currentPrice > ma20 && ma20 > ma60) {
      result.details.push('20MA > 60MA, 가격 > 20MA → 강한 상승 추세');
      result.strength = '강';
    } else if (currentPrice < ma20 && ma20 < ma60) {
      result.details.push('20MA < 60MA, 가격 < 20MA → 강한 하락 추세');
      result.strength = '강';
    } else if (currentPrice > ma20) {
      result.details.push('가격 > 20MA → 단기 상승 추세');
      result.strength = '중';
    } else {
      result.details.push('가격 < 20MA → 단기 하락 추세');
      result.strength = '중';
    }
  } else {
    result.strength = '약';
  }

  return result;
}

/**
 * ATR (Average True Range) 계산
 */
export function calcATR(chartData, period = 14) {
  if (chartData.length < period + 1) return null;

  const trValues = [];
  for (let i = 1; i < chartData.length; i++) {
    const h = parsePrice(chartData[i].high_pric);
    const l = parsePrice(chartData[i].low_pric);
    const prevC = parsePrice(chartData[i - 1].cur_prc);
    const tr = Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));
    trValues.push(tr);
  }

  const recent = trValues.slice(-period);
  const atr = recent.reduce((a, b) => a + b, 0) / period;

  // 최근 3봉 변동성 급증 여부
  const recent3 = trValues.slice(-3);
  const avg3 = recent3.reduce((a, b) => a + b, 0) / 3;
  const volatilitySpike = avg3 > atr * 1.5;

  return { atr, volatilitySpike, avgTR3: avg3 };
}

/**
 * 고급 거래량 분석
 */
export function analyzeVolumeAdvanced(chartData) {
  const volumes = chartData.map((d) => Number(d.trde_qty));
  const len = volumes.length;

  const avg5 = volumes.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, len);
  const avg20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, len);

  // 5일 평균 대비 증감률 (%)
  const changeRate = avg20 > 0 ? ((avg5 - avg20) / avg20) * 100 : 0;

  // 거래량 감소 추세: 최근 5일 연속 감소 여부
  let decreasingTrend = true;
  const last5 = volumes.slice(-5);
  for (let i = 1; i < last5.length; i++) {
    if (last5[i] >= last5[i - 1]) {
      decreasingTrend = false;
      break;
    }
  }

  // 돌파 시 거래량 동반 여부 (최근 1봉에서 20일 평균의 1.5배 이상)
  const latestVolume = volumes[len - 1] || 0;
  const breakoutVolume = latestVolume > avg20 * 1.5;

  return {
    avg5,
    avg20,
    changeRate,
    decreasingTrend,
    breakoutVolume,
    latestVolume,
  };
}

/**
 * 지지/저항선 도출 및 돌파 여부 확인
 */
export function findSupportResistance(swingHighs, swingLows, currentPrice) {
  const result = {
    resistance: [],  // 저항선 (현재가 위의 스윙 고점)
    support: [],     // 지지선 (현재가 아래의 스윙 저점)
    nearestResistance: null,
    nearestSupport: null,
    recentBreakout: null,
  };

  // 저항선: 현재가 위의 스윙 고점
  const resistanceCandidates = swingHighs
    .filter((s) => s.price > currentPrice)
    .sort((a, b) => a.price - b.price);
  result.resistance = resistanceCandidates.slice(0, 3);
  result.nearestResistance = resistanceCandidates[0] || null;

  // 지지선: 현재가 아래의 스윙 저점
  const supportCandidates = swingLows
    .filter((s) => s.price < currentPrice)
    .sort((a, b) => b.price - a.price);
  result.support = supportCandidates.slice(0, 3);
  result.nearestSupport = supportCandidates[0] || null;

  // 최근 돌파 여부: 현재가가 직전 스윙 고점을 돌파했는지
  if (swingHighs.length >= 1) {
    const lastHigh = swingHighs[swingHighs.length - 1];
    if (currentPrice > lastHigh.price) {
      result.recentBreakout = {
        type: '저항 돌파',
        level: lastHigh.price,
        dt: lastHigh.dt,
      };
    }
  }

  return result;
}

// ── B. 매매 전략 도출 ────────────────────────────────────

/**
 * 매수/매도 조건 평가
 */
export function deriveTradingStrategy(trendStructure, ma20, currentPrice, volumeAdv, supportResistance) {
  const buyConditions = [];
  const sellConditions = [];

  // 매수 조건 1: 상승 추세 + 20MA 위
  const cond1 = trendStructure.direction === '상승' && currentPrice > (ma20 || 0);
  buyConditions.push({
    label: '상승 추세 + 20MA 위',
    met: cond1,
    desc: cond1
      ? `현재 상승 추세이며 가격(${currentPrice.toLocaleString()})이 20MA 위에 있습니다.`
      : `상승 추세가 아니거나 가격이 20MA 아래에 있습니다.`,
  });

  // 매수 조건 2: 저항 돌파 후 지지 확인
  const cond2 = supportResistance.recentBreakout !== null && supportResistance.nearestSupport !== null;
  buyConditions.push({
    label: '저항 돌파 후 지지 확인',
    met: cond2,
    desc: cond2
      ? `최근 ${supportResistance.recentBreakout.level.toLocaleString()}원 저항을 돌파했으며, ${supportResistance.nearestSupport.price.toLocaleString()}원에서 지지가 확인됩니다.`
      : '최근 저항 돌파가 확인되지 않았습니다.',
  });

  // 매수 조건 3: 거래량 동반 고점 돌파
  const cond3 = volumeAdv.breakoutVolume && supportResistance.recentBreakout !== null;
  buyConditions.push({
    label: '거래량 동반 고점 돌파',
    met: cond3,
    desc: cond3
      ? `거래량(${volumeAdv.latestVolume.toLocaleString()})이 20일 평균의 1.5배 이상으로, 돌파에 거래량이 동반되었습니다.`
      : '거래량 동반 돌파가 확인되지 않았습니다.',
  });

  // 매도 조건 1: 직전 저점 이탈
  const lastSupport = supportResistance.nearestSupport;
  const sell1 = lastSupport && currentPrice < lastSupport.price;
  sellConditions.push({
    label: '직전 저점 이탈',
    met: sell1,
    desc: sell1
      ? `현재가가 직전 지지선(${lastSupport.price.toLocaleString()})을 하향 이탈했습니다.`
      : '직전 지지선을 유지하고 있습니다.',
  });

  // 매도 조건 2: 20MA 하향 이탈
  const sell2 = ma20 !== null && currentPrice < ma20;
  sellConditions.push({
    label: '20MA 하향 이탈',
    met: sell2,
    desc: sell2
      ? `현재가(${currentPrice.toLocaleString()})가 20MA(${Math.round(ma20).toLocaleString()}) 아래에 있습니다.`
      : `현재가가 20MA 위에 있어 안정적입니다.`,
  });

  // 매도 조건 3: 음봉 + 거래량 급증
  const sell3 = volumeAdv.breakoutVolume && trendStructure.direction === '하락';
  sellConditions.push({
    label: '하락 추세 + 거래량 급증',
    met: sell3,
    desc: sell3
      ? '하락 추세에서 거래량이 급증하여 매도 압력이 강합니다.'
      : '특별한 매도 압력 신호가 없습니다.',
  });

  // 종합 판단
  const buyScore = buyConditions.filter((c) => c.met).length;
  const sellScore = sellConditions.filter((c) => c.met).length;

  let overallSignal, overallLabel;
  if (buyScore >= 2 && sellScore === 0) {
    overallSignal = 'strong_buy';
    overallLabel = '강력 매수';
  } else if (buyScore >= 1 && sellScore === 0) {
    overallSignal = 'buy';
    overallLabel = '매수 관망';
  } else if (sellScore >= 2) {
    overallSignal = 'strong_sell';
    overallLabel = '강력 매도';
  } else if (sellScore >= 1 && buyScore === 0) {
    overallSignal = 'sell';
    overallLabel = '매도 관망';
  } else {
    overallSignal = 'neutral';
    overallLabel = '중립 (관망)';
  }

  return {
    buyConditions,
    sellConditions,
    buyScore,
    sellScore,
    overallSignal,
    overallLabel,
  };
}

// ── 전체 분석 통합 ───────────────────────────────────────

export function analyzeAll(chartData) {
  const sorted = [...chartData].reverse(); // 오래된 → 최신
  const closePrices = sorted.map((d) => parsePrice(d.cur_prc));
  const currentPrice = closePrices[closePrices.length - 1];
  const latestData = sorted[sorted.length - 1];

  // 기본 요약
  const allHighs = sorted.map((d) => parsePrice(d.high_pric));
  const allLows = sorted.map((d) => parsePrice(d.low_pric));
  const summary = {
    stockCode: latestData.stk_cd || '',
    currentPrice,
    highestPrice: Math.max(...allHighs),
    lowestPrice: Math.min(...allLows),
    dataCount: sorted.length,
    dateRange: {
      from: sorted[0].dt || sorted[0].cntr_tm,
      to: latestData.dt || latestData.cntr_tm,
    },
  };

  // 이동평균선
  const ma = calcAllMA(closePrices);
  const maTrend = getMATrend(ma);

  // RSI
  const rsi = calcRSI(closePrices);
  const rsiSignal = getRSISignal(rsi);

  // 볼린저 밴드
  const bollinger = calcBollingerBands(closePrices);
  const bollingerSignal = getBollingerSignal(currentPrice, bollinger);

  // 일목균형표
  const ichimoku = calcIchimoku(sorted);
  const ichimokuSignal = getIchimokuSignal(currentPrice, ichimoku);

  // 거래량 분석 (기본)
  const volumes = sorted.map((d) => Number(d.trde_qty));
  const avgVolume5 =
    volumes.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, volumes.length);
  const avgVolume20 =
    volumes.slice(-20).reduce((a, b) => a + b, 0) /
    Math.min(20, volumes.length);
  const volumeTrend = avgVolume5 > avgVolume20 * 1.5 ? 'high' : avgVolume5 < avgVolume20 * 0.5 ? 'low' : 'normal';

  // ── A. 기술적 구조 분석 ──
  const swingPoints = findSwingPoints(sorted);
  const trendStructure = detectTrendStructure(
    swingPoints.highs, swingPoints.lows,
    currentPrice, ma.ma20, ma.ma60
  );
  const atrData = calcATR(sorted);
  const volumeAdvanced = analyzeVolumeAdvanced(sorted);
  const supportResistance = findSupportResistance(
    swingPoints.highs, swingPoints.lows, currentPrice
  );

  // ── B. 매매 전략 도출 ──
  const strategy = deriveTradingStrategy(
    trendStructure, ma.ma20, currentPrice, volumeAdvanced, supportResistance
  );

  return {
    summary,
    ma: { values: ma, trend: maTrend },
    rsi: { value: rsi, signal: rsiSignal },
    bollinger: { bands: bollinger, signal: bollingerSignal },
    ichimoku: { values: ichimoku, signal: ichimokuSignal },
    volume: {
      avg5: avgVolume5,
      avg20: avgVolume20,
      trend: volumeTrend,
      label:
        volumeTrend === 'high'
          ? '거래량 급증 (5일 평균 > 20일 평균 x1.5)'
          : volumeTrend === 'low'
          ? '거래량 감소 (5일 평균 < 20일 평균 x0.5)'
          : '거래량 보통',
    },
    // A. 기술적 구조 분석
    structure: {
      trendStructure,
      atr: atrData,
      volumeAdvanced,
      supportResistance,
      swingPoints,
    },
    // B. 매매 전략
    strategy,
  };
}

/**
 * 분석 결과를 AI 프롬프트 문자열로 변환
 */
export function buildAIPrompt(analysis, selectedIndicators) {
  const lines = [];
  lines.push(`## 종목 분석 데이터`);
  lines.push(`- 현재가: ${analysis.summary.currentPrice.toLocaleString()}원`);
  lines.push(`- 기간: ${analysis.summary.dateRange.from} ~ ${analysis.summary.dateRange.to}`);
  lines.push(`- 데이터 수: ${analysis.summary.dataCount}개`);
  lines.push(`- 기간 최고가: ${analysis.summary.highestPrice.toLocaleString()}원`);
  lines.push(`- 기간 최저가: ${analysis.summary.lowestPrice.toLocaleString()}원`);
  lines.push('');

  if (selectedIndicators.includes('ma')) {
    lines.push(`### 이동평균선`);
    lines.push(`- 배열 상태: ${analysis.ma.trend.label}`);
    Object.entries(analysis.ma.values).forEach(([key, val]) => {
      if (val !== null) lines.push(`- ${key.toUpperCase()}: ${Math.round(val).toLocaleString()}원`);
    });
    lines.push('');
  }

  if (selectedIndicators.includes('rsi')) {
    lines.push(`### RSI (14)`);
    lines.push(`- ${analysis.rsi.signal.label}`);
    lines.push('');
  }

  if (selectedIndicators.includes('bollinger')) {
    lines.push(`### 볼린저 밴드`);
    if (analysis.bollinger.bands) {
      lines.push(`- 상단: ${Math.round(analysis.bollinger.bands.upper).toLocaleString()}원`);
      lines.push(`- 중단(MA20): ${Math.round(analysis.bollinger.bands.middle).toLocaleString()}원`);
      lines.push(`- 하단: ${Math.round(analysis.bollinger.bands.lower).toLocaleString()}원`);
      lines.push(`- 밴드폭: ${analysis.bollinger.bands.bandwidth.toFixed(2)}%`);
    }
    lines.push(`- 위치: ${analysis.bollinger.signal.label}`);
    lines.push('');
  }

  if (selectedIndicators.includes('ichimoku')) {
    lines.push(`### 일목균형표`);
    lines.push(`- 종합 판단: ${analysis.ichimoku.signal.label}`);
    analysis.ichimoku.signal.details.forEach((d) => lines.push(`  - ${d}`));
    if (analysis.ichimoku.values) {
      lines.push(`- 전환선: ${Math.round(analysis.ichimoku.values.tenkanSen).toLocaleString()}원`);
      lines.push(`- 기준선: ${Math.round(analysis.ichimoku.values.kijunSen).toLocaleString()}원`);
      lines.push(`- 구름 상단: ${Math.round(analysis.ichimoku.values.cloudTop).toLocaleString()}원`);
      lines.push(`- 구름 하단: ${Math.round(analysis.ichimoku.values.cloudBottom).toLocaleString()}원`);
    }
    lines.push('');
  }

  if (selectedIndicators.includes('volume')) {
    lines.push(`### 거래량`);
    lines.push(`- ${analysis.volume.label}`);
    lines.push(`- 5일 평균: ${Math.round(analysis.volume.avg5).toLocaleString()}`);
    lines.push(`- 20일 평균: ${Math.round(analysis.volume.avg20).toLocaleString()}`);
    lines.push('');
  }

  lines.push(`---`);
  lines.push(`위 기술적 지표를 종합적으로 분석하여:`);
  lines.push(`1. 지지선과 저항선을 파악하고`);
  lines.push(`2. 현재 추세를 판단하고`);
  lines.push(`3. 거래량을 분석하고`);
  lines.push(`4. 최적의 매수/매도 타이밍과 목표가, 손절가를 제시하세요.`);
  lines.push(`5. 각 판단의 근거를 구체적으로 설명하세요.`);
  lines.push(`6. 불확실한 부분은 불확실성을 명시하세요.`);

  return lines.join('\n');
}
