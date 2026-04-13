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

// ── RSI (Wilder Smoothing) ───────────────────────────────

export function calcRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;

  // 첫 번째 평균 (SMA)
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  // Wilder Smoothing (이후 봉)
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

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
    slice.reduce((sum, p) => sum + Math.pow(p - ma, 2), 0) / (period - 1);
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

  // 지지 이탈 돌파 감지
  if (swingLows.length >= 1) {
    const lastLow = swingLows[swingLows.length - 1];
    if (currentPrice < lastLow.price) {
      result.recentBreakdown = {
        type: '지지 이탈',
        level: lastLow.price,
        dt: lastLow.dt,
      };
    }
  }

  return result;
}

// ── EMA 헬퍼 ─────────────────────────────────────────

function calcEMA(prices, period) {
  if (prices.length < period) return [];
  const k = 2 / (period + 1);
  const ema = [prices.slice(0, period).reduce((a, b) => a + b, 0) / period];
  for (let i = period; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[ema.length - 1] * (1 - k));
  }
  return ema;
}

// ── MACD (12, 26, 9) ────────────────────────────────

export function calcMACD(prices, fast = 12, slow = 26, signal = 9) {
  if (prices.length < slow + signal) return null;

  const emaFast = calcEMA(prices, fast);
  const emaSlow = calcEMA(prices, slow);

  // MACD Line: EMA(fast) - EMA(slow)
  // emaSlow starts at index 0 but maps to price index (slow-1)
  // emaFast starts at index 0 but maps to price index (fast-1)
  const offset = slow - fast;
  const macdLine = [];
  for (let i = 0; i < emaSlow.length; i++) {
    macdLine.push(emaFast[i + offset] - emaSlow[i]);
  }

  // Signal Line: EMA(9) of MACD Line
  const signalLine = calcEMA(macdLine, signal);

  const currentMACD = macdLine[macdLine.length - 1];
  const currentSignal = signalLine[signalLine.length - 1];
  const histogram = currentMACD - currentSignal;

  // 크로스 감지 (최근 2봉)
  const prevMACD = macdLine[macdLine.length - 2];
  const prevSignalOffset = signalLine.length - 2;
  const prevSignal = prevSignalOffset >= 0 ? signalLine[prevSignalOffset] : null;

  let cross = null;
  if (prevSignal !== null) {
    if (prevMACD < prevSignal && currentMACD > currentSignal) cross = 'golden'; // 골든크로스
    if (prevMACD > prevSignal && currentMACD < currentSignal) cross = 'dead';   // 데드크로스
  }

  let label;
  if (cross === 'golden') label = '골든크로스 (매수 신호)';
  else if (cross === 'dead') label = '데드크로스 (매도 신호)';
  else if (histogram > 0) label = '상승 모멘텀';
  else label = '하락 모멘텀';

  return {
    macdLine: currentMACD,
    signalLine: currentSignal,
    histogram,
    cross,
    label,
  };
}

// ── 스토캐스틱 (%K, %D) ────────────────────────────

export function calcStochastic(chartData, kPeriod = 14, dPeriod = 3) {
  if (chartData.length < kPeriod + dPeriod) return null;

  const kValues = [];
  for (let i = kPeriod - 1; i < chartData.length; i++) {
    const slice = chartData.slice(i - kPeriod + 1, i + 1);
    const high = Math.max(...slice.map(d => parsePrice(d.high_pric)));
    const low = Math.min(...slice.map(d => parsePrice(d.low_pric)));
    const close = parsePrice(chartData[i].cur_prc);
    const k = high === low ? 50 : ((close - low) / (high - low)) * 100;
    kValues.push(k);
  }

  // %D = %K의 dPeriod 단순이동평균
  const dValues = [];
  for (let i = dPeriod - 1; i < kValues.length; i++) {
    const avg = kValues.slice(i - dPeriod + 1, i + 1).reduce((a, b) => a + b, 0) / dPeriod;
    dValues.push(avg);
  }

  const currentK = kValues[kValues.length - 1];
  const currentD = dValues[dValues.length - 1];

  let signal;
  if (currentK >= 80 && currentD >= 80) signal = { level: 'overbought', label: `과매수 (%K: ${currentK.toFixed(1)}, %D: ${currentD.toFixed(1)})` };
  else if (currentK <= 20 && currentD <= 20) signal = { level: 'oversold', label: `과매도 (%K: ${currentK.toFixed(1)}, %D: ${currentD.toFixed(1)})` };
  else signal = { level: 'neutral', label: `중립 (%K: ${currentK.toFixed(1)}, %D: ${currentD.toFixed(1)})` };

  // %K가 %D를 상향 돌파하면 매수, 하향 돌파하면 매도
  const prevK = kValues.length >= 2 ? kValues[kValues.length - 2] : null;
  const prevD = dValues.length >= 2 ? dValues[dValues.length - 2] : null;
  let cross = null;
  if (prevK !== null && prevD !== null) {
    if (prevK < prevD && currentK > currentD) cross = 'golden';
    if (prevK > prevD && currentK < currentD) cross = 'dead';
  }

  return { k: currentK, d: currentD, signal, cross };
}

// ── MA 골든크로스/데드크로스 감지 ────────────────

export function detectMACross(closePrices, shortP = 5, longP = 20, lookback = 5) {
  if (closePrices.length < longP + lookback) return null;

  const crosses = [];
  for (let i = closePrices.length - lookback; i < closePrices.length; i++) {
    const shortMA = closePrices.slice(i - shortP + 1, i + 1).reduce((a, b) => a + b, 0) / shortP;
    const longMA = closePrices.slice(i - longP + 1, i + 1).reduce((a, b) => a + b, 0) / longP;
    const prevShortMA = closePrices.slice(i - shortP, i).reduce((a, b) => a + b, 0) / shortP;
    const prevLongMA = closePrices.slice(i - longP, i).reduce((a, b) => a + b, 0) / longP;

    if (prevShortMA <= prevLongMA && shortMA > longMA) {
      crosses.push({ type: 'golden', index: i, label: `MA${shortP}/MA${longP} 골든크로스` });
    } else if (prevShortMA >= prevLongMA && shortMA < longMA) {
      crosses.push({ type: 'dead', index: i, label: `MA${shortP}/MA${longP} 데드크로스` });
    }
  }

  return crosses.length > 0 ? crosses[crosses.length - 1] : null; // 가장 최근
}

// ── 볼린저 스퀴즈 감지 ─────────────────────────

export function detectBollingerSqueeze(closePrices, period = 20, lookback = 20) {
  if (closePrices.length < period + lookback) return null;

  const bandwidths = [];
  for (let i = period; i <= closePrices.length; i++) {
    const slice = closePrices.slice(i - period, i);
    const ma = slice.reduce((a, b) => a + b, 0) / period;
    const stdDev = Math.sqrt(slice.reduce((sum, p) => sum + Math.pow(p - ma, 2), 0) / (period - 1));
    bandwidths.push((4 * stdDev / ma) * 100); // bandwidth %
  }

  const recent = bandwidths.slice(-lookback);
  const currentBW = bandwidths[bandwidths.length - 1];
  const minBW = Math.min(...recent);

  const isSqueeze = currentBW <= minBW * 1.05; // 최저치 근처
  const avgBW = recent.reduce((a, b) => a + b, 0) / recent.length;

  return {
    squeeze: isSqueeze,
    currentBandwidth: currentBW,
    avgBandwidth: avgBW,
    label: isSqueeze ? '볼린저 스퀴즈 (변동성 확대 예상)' : '정상 범위',
  };
}

// ── B. 매매 전략 도출 (가중 점수제) ─────────────────────────

/**
 * 매수/매도 조건 가중 점수 평가
 * - 추세 (25점) + 돌파/지지 (25점) + 거래량 (20점) + 보조지표 (30점) = 100점
 */
export function deriveTradingStrategy({
  trendStructure, ma20, ma60, currentPrice,
  volumeAdv, supportResistance, latestCandle,
  ichimokuSignal, macd, stochastic, rsiSignal, bollingerSignal,
}) {
  const buyConditions = [];
  const sellConditions = [];

  // ═══════════════════════════════════════════════════════
  //  매수 조건 (가중 합산)
  // ═══════════════════════════════════════════════════════

  // ── 추세 (최대 25점) ──
  const isHHHL = trendStructure.pattern.includes('HH') && trendStructure.pattern.includes('HL');
  buyConditions.push({
    category: 'trend', label: 'HH-HL 상승 추세 패턴', weight: 15, met: isHHHL,
    desc: isHHHL
      ? 'Higher High + Higher Low 패턴으로 상승 추세가 확인됩니다.'
      : `현재 추세 패턴(${trendStructure.pattern || '판별불가'})은 전형적인 상승 추세가 아닙니다.`,
  });

  const maAligned = ma20 !== null && ma60 !== null && ma20 > ma60;
  buyConditions.push({
    category: 'trend', label: 'MA 정배열 (20MA > 60MA)', weight: 5, met: maAligned,
    desc: maAligned
      ? `20MA(${Math.round(ma20).toLocaleString()})가 60MA(${Math.round(ma60).toLocaleString()}) 위에 위치합니다.`
      : 'MA 정배열이 아닙니다.',
  });

  const aboveMA20 = ma20 !== null && currentPrice > ma20;
  buyConditions.push({
    category: 'trend', label: '가격 > 20MA', weight: 5, met: aboveMA20,
    desc: aboveMA20
      ? `현재가(${currentPrice.toLocaleString()})가 20MA(${Math.round(ma20).toLocaleString()}) 위에 있습니다.`
      : '현재가가 20MA 아래에 있어 단기 약세입니다.',
  });

  // ── 돌파/지지 (최대 25점) ──
  const breakoutDone = supportResistance.recentBreakout !== null;
  buyConditions.push({
    category: 'breakout', label: '저항선 돌파 완료', weight: 20, met: breakoutDone,
    desc: breakoutDone
      ? `${supportResistance.recentBreakout.level.toLocaleString()}원 저항을 돌파했습니다.`
      : '아직 저항선을 돌파하지 못했습니다.',
  });

  const nearR = supportResistance.nearestResistance;
  const gapPct = nearR ? ((nearR.price - currentPrice) / currentPrice * 100) : null;
  const breakoutNear = !breakoutDone && nearR && gapPct <= 2;
  buyConditions.push({
    category: 'breakout', label: '돌파 임박 (저항선 2% 이내)', weight: 12, met: breakoutNear,
    desc: breakoutNear
      ? `현재가가 저항선(${nearR.price.toLocaleString()}원)까지 ${gapPct.toFixed(1)}%로 돌파 임박 상태입니다.`
      : nearR
        ? `저항선(${nearR.price.toLocaleString()}원)까지 ${gapPct.toFixed(1)}% 남았습니다.`
        : '상방에 뚜렷한 저항선이 없습니다.',
  });

  const hasSupport = supportResistance.nearestSupport !== null;
  buyConditions.push({
    category: 'breakout', label: '하방 지지선 확인', weight: 5, met: hasSupport,
    desc: hasSupport
      ? `${supportResistance.nearestSupport.price.toLocaleString()}원에서 지지가 확인됩니다.`
      : '명확한 지지선이 확인되지 않습니다.',
  });

  // ── 거래량 (최대 20점) ──
  const volBreakout = volumeAdv.breakoutVolume;
  buyConditions.push({
    category: 'volume', label: '거래량 동반 돌파 (1.5배)', weight: 15, met: volBreakout,
    desc: volBreakout
      ? `거래량(${volumeAdv.latestVolume.toLocaleString()})이 20일 평균의 1.5배 이상으로 강한 수급입니다.`
      : '거래량 동반 돌파가 확인되지 않았습니다.',
  });

  const volIncreasing = volumeAdv.changeRate > 0;
  buyConditions.push({
    category: 'volume', label: '거래량 증가 추세', weight: 5, met: volIncreasing,
    desc: volIncreasing
      ? `5일 평균 거래량이 20일 평균 대비 ${volumeAdv.changeRate.toFixed(1)}% 증가합니다.`
      : `거래량이 ${Math.abs(volumeAdv.changeRate).toFixed(1)}% 감소 추세입니다.`,
  });

  // ── 보조지표 (최대 30점) ──
  const ichiBullish = ichimokuSignal && ichimokuSignal.signal === 'bullish';
  buyConditions.push({
    category: 'indicator', label: '일목균형표 강세', weight: 8, met: ichiBullish,
    desc: ichiBullish
      ? `일목균형표가 강세 신호(${ichimokuSignal.label})를 나타냅니다.`
      : `일목균형표: ${ichimokuSignal?.label || '데이터 부족'}`,
  });

  const macdBullish = macd && (macd.histogram > 0 || macd.cross === 'golden');
  buyConditions.push({
    category: 'indicator', label: 'MACD 상승 모멘텀', weight: 8, met: macdBullish,
    desc: macdBullish
      ? `MACD: ${macd.label}${macd.cross === 'golden' ? ' (골든크로스!)' : ''}`
      : `MACD: ${macd?.label || '데이터 부족'}`,
  });

  const stochBullish = stochastic && (stochastic.cross === 'golden' || stochastic.signal?.level === 'oversold');
  buyConditions.push({
    category: 'indicator', label: '스토캐스틱 매수 신호', weight: 7, met: stochBullish,
    desc: stochBullish
      ? `스토캐스틱: ${stochastic.signal?.label}${stochastic.cross === 'golden' ? ' (골든크로스!)' : ''}`
      : `스토캐스틱: ${stochastic?.signal?.label || '데이터 부족'}`,
  });

  const rsiGood = rsiSignal && (rsiSignal.level === 'neutral' || rsiSignal.level === 'oversold');
  buyConditions.push({
    category: 'indicator', label: 'RSI 양호 구간', weight: 4, met: rsiGood,
    desc: `RSI: ${rsiSignal?.label || '데이터 부족'}`,
  });

  const bbLower = bollingerSignal && (bollingerSignal.position === 'near_lower' || bollingerSignal.position === 'below');
  buyConditions.push({
    category: 'indicator', label: '볼린저 하단 반등 기대', weight: 3, met: bbLower,
    desc: `볼린저: ${bollingerSignal?.label || '데이터 부족'}`,
  });

  // ═══════════════════════════════════════════════════════
  //  매도 조건 (가중 합산)
  // ═══════════════════════════════════════════════════════

  // ── 추세 (최대 25점) ──
  const isLHLL = trendStructure.pattern.includes('LH') && trendStructure.pattern.includes('LL');
  sellConditions.push({
    category: 'trend', label: 'LH-LL 하락 추세 패턴', weight: 15, met: isLHLL,
    desc: isLHLL
      ? 'Lower High + Lower Low 패턴으로 하락 추세가 확인됩니다.'
      : `현재 추세 패턴(${trendStructure.pattern || '판별불가'})은 전형적인 하락 추세가 아닙니다.`,
  });

  const maReversed = ma20 !== null && ma60 !== null && ma20 < ma60;
  sellConditions.push({
    category: 'trend', label: 'MA 역배열 (20MA < 60MA)', weight: 5, met: maReversed,
    desc: maReversed
      ? '20MA가 60MA 아래에 위치하여 중기 하락 추세입니다.'
      : 'MA 역배열이 아닙니다.',
  });

  const belowMA20 = ma20 !== null && currentPrice < ma20;
  sellConditions.push({
    category: 'trend', label: '가격 < 20MA', weight: 5, met: belowMA20,
    desc: belowMA20
      ? `현재가가 20MA(${Math.round(ma20).toLocaleString()}) 아래에 있어 단기 약세입니다.`
      : '현재가가 20MA 위에 있어 안정적입니다.',
  });

  // ── 이탈 (최대 25점) ──
  const supportBreak = supportResistance.recentBreakdown != null;
  sellConditions.push({
    category: 'breakout', label: '직전 지지선 이탈', weight: 20, met: supportBreak,
    desc: supportBreak
      ? `지지선(${supportResistance.recentBreakdown.level.toLocaleString()}원)을 하향 이탈했습니다.`
      : '직전 지지선을 유지하고 있습니다.',
  });

  sellConditions.push({
    category: 'breakout', label: '20MA 하향 이탈', weight: 5, met: belowMA20,
    desc: belowMA20
      ? `현재가(${currentPrice.toLocaleString()})가 20MA 아래입니다.`
      : '현재가가 20MA 위에 있어 안정적입니다.',
  });

  // ── 거래량 (최대 20점) ──
  const isBearish = latestCandle && latestCandle.close < latestCandle.open;
  const bearishVol = volumeAdv.breakoutVolume && isBearish;
  sellConditions.push({
    category: 'volume', label: '음봉 + 거래량 급증', weight: 15, met: bearishVol,
    desc: bearishVol
      ? `음봉에 거래량(${volumeAdv.latestVolume.toLocaleString()})이 급증하여 매도 압력이 강합니다.`
      : '음봉 + 거래량 급증 신호가 없습니다.',
  });

  const volDecreasing = volumeAdv.decreasingTrend;
  sellConditions.push({
    category: 'volume', label: '5일 연속 거래량 감소', weight: 5, met: volDecreasing,
    desc: volDecreasing
      ? '최근 5일간 거래량이 연속 감소하고 있어 매수세가 약해지고 있습니다.'
      : '거래량 감소 추세가 아닙니다.',
  });

  // ── 보조지표 (최대 30점) ──
  const ichiBearish = ichimokuSignal && ichimokuSignal.signal === 'bearish';
  sellConditions.push({
    category: 'indicator', label: '일목균형표 약세', weight: 8, met: ichiBearish,
    desc: ichiBearish
      ? `일목균형표가 약세 신호(${ichimokuSignal.label})를 나타냅니다.`
      : `일목균형표: ${ichimokuSignal?.label || '데이터 부족'}`,
  });

  const macdBearish = macd && (macd.histogram < 0 || macd.cross === 'dead');
  sellConditions.push({
    category: 'indicator', label: 'MACD 하락 모멘텀', weight: 8, met: macdBearish,
    desc: macdBearish
      ? `MACD: ${macd.label}${macd.cross === 'dead' ? ' (데드크로스!)' : ''}`
      : `MACD: ${macd?.label || '데이터 부족'}`,
  });

  const stochBearish = stochastic && (stochastic.cross === 'dead' || stochastic.signal?.level === 'overbought');
  sellConditions.push({
    category: 'indicator', label: '스토캐스틱 매도 신호', weight: 7, met: stochBearish,
    desc: stochBearish
      ? `스토캐스틱: ${stochastic.signal?.label}${stochastic.cross === 'dead' ? ' (데드크로스!)' : ''}`
      : `스토캐스틱: ${stochastic?.signal?.label || '데이터 부족'}`,
  });

  const rsiOverbought = rsiSignal && rsiSignal.level === 'overbought';
  sellConditions.push({
    category: 'indicator', label: 'RSI 과매수', weight: 4, met: rsiOverbought,
    desc: `RSI: ${rsiSignal?.label || '데이터 부족'}`,
  });

  const bbUpper = bollingerSignal && (bollingerSignal.position === 'above' || bollingerSignal.position === 'near_upper');
  sellConditions.push({
    category: 'indicator', label: '볼린저 상단 과열', weight: 3, met: bbUpper,
    desc: `볼린저: ${bollingerSignal?.label || '데이터 부족'}`,
  });

  // ═══════════════════════════════════════════════════════
  //  가중 점수 계산 (0~100)
  // ═══════════════════════════════════════════════════════
  const maxBuyW = buyConditions.reduce((s, c) => s + c.weight, 0);
  const maxSellW = sellConditions.reduce((s, c) => s + c.weight, 0);
  const rawBuy = buyConditions.filter(c => c.met).reduce((s, c) => s + c.weight, 0);
  const rawSell = sellConditions.filter(c => c.met).reduce((s, c) => s + c.weight, 0);

  const buyScore = Math.round((rawBuy / maxBuyW) * 100);
  const sellScore = Math.round((rawSell / maxSellW) * 100);
  const netScore = buyScore - sellScore;

  // ═══════════════════════════════════════════════════════
  //  종합 판단
  // ═══════════════════════════════════════════════════════
  let overallSignal, overallLabel;
  if (buyScore >= 65 && sellScore < 30) {
    overallSignal = 'strong_buy';
    overallLabel = '강력 매수';
  } else if (buyScore >= 45 && sellScore < 40) {
    overallSignal = 'buy';
    overallLabel = '매수 우위';
  } else if (sellScore >= 65 && buyScore < 30) {
    overallSignal = 'strong_sell';
    overallLabel = '강력 매도';
  } else if (sellScore >= 45 && buyScore < 40) {
    overallSignal = 'sell';
    overallLabel = '매도 우위';
  } else if (netScore > 15) {
    overallSignal = 'lean_buy';
    overallLabel = '매수 관망';
  } else if (netScore < -15) {
    overallSignal = 'lean_sell';
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
    netScore,
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

  // MACD
  const macd = calcMACD(closePrices);

  // 스토캐스틱
  const stochastic = calcStochastic(sorted);

  // MA 크로스 이벤트 (5/20)
  const maCross = detectMACross(closePrices, 5, 20, 5);

  // 볼린저 스퀴즈
  const bollingerSqueeze = detectBollingerSqueeze(closePrices);

  // ── B. 매매 전략 도출 ──
  const latestItem = sorted[sorted.length - 1];
  const latestCandle = {
    open: parsePrice(latestItem.open_pric || latestItem.strt_pric || 0),
    close: parsePrice(latestItem.cur_prc),
    high: parsePrice(latestItem.high_pric),
    low: parsePrice(latestItem.low_pric),
  };
  const strategy = deriveTradingStrategy({
    trendStructure,
    ma20: ma.ma20,
    ma60: ma.ma60,
    currentPrice,
    volumeAdv: volumeAdvanced,
    supportResistance,
    latestCandle,
    ichimokuSignal,
    macd,
    stochastic,
    rsiSignal,
    bollingerSignal,
  });

  return {
    summary,
    ma: { values: ma, trend: maTrend },
    rsi: { value: rsi, signal: rsiSignal },
    bollinger: { bands: bollinger, signal: bollingerSignal, squeeze: bollingerSqueeze },
    ichimoku: { values: ichimoku, signal: ichimokuSignal },
    macd,
    stochastic,
    maCross,
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
