import './ValuationAnalysis.css';

/**
 * 밸류에이션 종합 분석 카드
 * - 수익성, 자산가치, 시가총액 적정성, 수급/안정성 분석
 * - 종합 점수 게이지 + 등급 판정 + 카테고리별 세부 지표
 */
export default function ValuationAnalysis({ stockInfo }) {
  if (!stockInfo) return null;

  const n = (v) => (v != null && v !== '' ? Number(v) : null);

  // 모든 지표 계산
  const metrics = calcAllMetrics(stockInfo);
  // 카테고리별 점수
  const categoryScores = calcCategoryScores(metrics);
  // 종합 점수 & 등급
  const totalScore = Math.round(
    Object.values(categoryScores).reduce((s, c) => s + c.score, 0) /
      Object.values(categoryScores).length
  );
  const grade = getGrade(totalScore);
  // 종합 코멘트
  const verdicts = buildVerdicts(metrics, stockInfo);

  // 게이지 SVG 계산
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (totalScore / 100) * circumference;

  return (
    <div className="val-analysis">
      <div className="val-analysis__header">
        <span className="val-analysis__icon">📐</span>
        <h3 className="val-analysis__title">밸류에이션 종합 분석</h3>
      </div>

      {/* ── 종합 스코어 ── */}
      <div className="val-score-section">
        <div className="val-score-gauge">
          <svg className="val-score-gauge__svg" viewBox="0 0 120 120">
            <circle className="val-score-gauge__track" cx="60" cy="60" r={radius} />
            <circle
              className="val-score-gauge__fill"
              cx="60"
              cy="60"
              r={radius}
              stroke={grade.color}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="val-score-gauge__center">
            <div className="val-score-gauge__number" style={{ color: grade.color }}>
              {totalScore}
            </div>
            <div className="val-score-gauge__label">/ 100</div>
          </div>
        </div>

        <div className="val-score-info">
          <div className={`val-score-grade val-score-grade--${grade.key}`}>
            <span>{grade.emoji}</span>
            <span>{grade.label}</span>
          </div>
          <p className="val-score-summary">{grade.desc}</p>

          {/* 카테고리별 미니 바 */}
          <div className="val-score-bars">
            {Object.entries(categoryScores).map(([key, cat]) => (
              <div key={key} className="val-score-bar">
                <span className="val-score-bar__label">{cat.label}</span>
                <div className="val-score-bar__track">
                  <div
                    className="val-score-bar__fill"
                    style={{
                      width: `${cat.score}%`,
                      background: getBarColor(cat.score),
                    }}
                  />
                </div>
                <span className="val-score-bar__value" style={{ color: getBarColor(cat.score) }}>
                  {cat.score}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 카테고리별 상세 ── */}
      <div className="val-categories">
        {/* 1. 수익성 */}
        <CategoryCard
          icon="💹"
          title="수익성"
          score={categoryScores.profitability.score}
          metrics={metrics.profitability}
        />

        {/* 2. 자산가치 */}
        <CategoryCard
          icon="🏦"
          title="자산가치"
          score={categoryScores.assetValue.score}
          metrics={metrics.assetValue}
        />

        {/* 3. 시가총액 적정성 */}
        <CategoryCard
          icon="📊"
          title="시총 적정성"
          score={categoryScores.marketCap.score}
          metrics={metrics.marketCap}
        />

        {/* 4. 수급/안정성 */}
        <CategoryCard
          icon="🔒"
          title="수급 · 안정성"
          score={categoryScores.stability.score}
          metrics={metrics.stability}
        />
      </div>

      {/* ── 종합 판정 코멘트 ── */}
      <div className={`val-verdict val-verdict--${grade.key}`}>
        <h4 className="val-verdict__title">
          <span>💡</span> 밸류에이션 종합 판정
        </h4>
        <div className="val-verdict__items">
          {verdicts.map((v, i) => (
            <div key={i} className="val-verdict__item">
              <span className="val-verdict__item-icon">{v.icon}</span>
              <span>{v.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 카테고리 카드 컴포넌트
// ═══════════════════════════════════════════════════════════
function CategoryCard({ icon, title, score, metrics }) {
  const badgeClass = score >= 70 ? 'positive' : score >= 50 ? 'neutral' : score >= 30 ? 'caution' : 'negative';

  return (
    <div className="val-category">
      <div className="val-category__header">
        <h4 className="val-category__title">
          <span>{icon}</span> {title}
        </h4>
        <span className={`val-category__badge val-category__badge--${badgeClass}`}>
          {score}점
        </span>
      </div>
      <div className="val-metrics">
        {metrics.map((m, i) => (
          <div key={i} className="val-metric">
            <div className="val-metric__left">
              <span className={`val-metric__indicator val-metric__indicator--${m.status}`} />
              <span className="val-metric__name">{m.name}</span>
            </div>
            <div className="val-metric__right">
              <span className={`val-metric__value ${m.valueColor ? `val-metric__value--${m.valueColor}` : ''}`}>
                {m.value}
              </span>
              <span className={`val-metric__tag val-metric__tag--${m.status}`}>
                {m.tag}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 지표 계산 로직
// ═══════════════════════════════════════════════════════════
function calcAllMetrics(info) {
  const n = (v) => (v != null && v !== '' ? Number(v) : null);

  // ── 수익성 ──
  const per = n(info.per);
  const eps = n(info.eps);
  const roe = n(info.roe);
  const saleAmt = n(info.sale_amt);
  const busPro = n(info.bus_pro);
  const opMargin = saleAmt && saleAmt !== 0 ? ((busPro || 0) / saleAmt * 100) : null;

  const profitability = [];

  // PER
  if (per !== null) {
    let status, tag, valueColor, score;
    if (per < 0) {
      status = 'danger'; tag = '적자'; valueColor = 'red'; score = 0;
    } else if (per < 8) {
      status = 'excellent'; tag = '저평가'; valueColor = 'green'; score = 95;
    } else if (per < 15) {
      status = 'good'; tag = '양호'; valueColor = 'blue'; score = 75;
    } else if (per < 25) {
      status = 'neutral'; tag = '적정'; score = 55;
    } else if (per < 40) {
      status = 'caution'; tag = '고평가'; valueColor = 'yellow'; score = 30;
    } else {
      status = 'danger'; tag = '과열'; valueColor = 'red'; score = 10;
    }
    profitability.push({ name: 'PER (주가수익비율)', value: `${per}배`, status, tag, valueColor, score });
  }

  // EPS
  if (eps !== null) {
    const curPrc = n(info.cur_prc);
    const earningYield = curPrc && curPrc > 0 ? (eps / curPrc * 100).toFixed(1) : null;
    let status, tag, valueColor, score;
    if (eps < 0) {
      status = 'danger'; tag = '적자'; valueColor = 'red'; score = 0;
    } else if (eps > 5000) {
      status = 'excellent'; tag = '우수'; valueColor = 'green'; score = 90;
    } else if (eps > 1000) {
      status = 'good'; tag = '양호'; valueColor = 'blue'; score = 70;
    } else {
      status = 'neutral'; tag = '보통'; score = 50;
    }
    const displayVal = earningYield ? `${Number(eps).toLocaleString()}원 (${earningYield}%)` : `${Number(eps).toLocaleString()}원`;
    profitability.push({ name: 'EPS (주당순이익)', value: displayVal, status, tag, valueColor, score });
  }

  // ROE
  if (roe !== null) {
    let status, tag, valueColor, score;
    if (roe < 0) {
      status = 'danger'; tag = '위험'; valueColor = 'red'; score = 0;
    } else if (roe < 5) {
      status = 'caution'; tag = '부진'; valueColor = 'yellow'; score = 25;
    } else if (roe < 10) {
      status = 'neutral'; tag = '보통'; score = 50;
    } else if (roe < 15) {
      status = 'good'; tag = '양호'; valueColor = 'blue'; score = 75;
    } else {
      status = 'excellent'; tag = '우수'; valueColor = 'green'; score = 95;
    }
    profitability.push({ name: 'ROE (자기자본이익률)', value: `${roe}%`, status, tag, valueColor, score });
  }

  // 영업이익률
  if (opMargin !== null) {
    let status, tag, valueColor, score;
    const m = opMargin;
    if (m < 0) {
      status = 'danger'; tag = '적자'; valueColor = 'red'; score = 0;
    } else if (m < 5) {
      status = 'caution'; tag = '저조'; valueColor = 'yellow'; score = 25;
    } else if (m < 10) {
      status = 'neutral'; tag = '보통'; score = 50;
    } else if (m < 20) {
      status = 'good'; tag = '양호'; valueColor = 'blue'; score = 75;
    } else {
      status = 'excellent'; tag = '우수'; valueColor = 'green'; score = 95;
    }
    profitability.push({ name: '영업이익률', value: `${m.toFixed(1)}%`, status, tag, valueColor, score });
  }

  // ── 자산가치 ──
  const pbr = n(info.pbr);
  const bps = n(info.bps);
  const ev = info.ev;

  const assetValue = [];

  // PBR
  if (pbr !== null) {
    let status, tag, valueColor, score;
    if (pbr < 0) {
      status = 'danger'; tag = '자본잠식'; valueColor = 'red'; score = 0;
    } else if (pbr < 0.7) {
      status = 'excellent'; tag = '심한 저평가'; valueColor = 'green'; score = 95;
    } else if (pbr < 1) {
      status = 'good'; tag = '저평가'; valueColor = 'green'; score = 80;
    } else if (pbr < 2) {
      status = 'neutral'; tag = '적정'; score = 60;
    } else if (pbr < 5) {
      status = 'caution'; tag = '고평가'; valueColor = 'yellow'; score = 30;
    } else {
      status = 'danger'; tag = '과열'; valueColor = 'red'; score = 10;
    }
    assetValue.push({ name: 'PBR (주가순자산비율)', value: `${pbr}배`, status, tag, valueColor, score });
  }

  // BPS & 안전마진
  if (bps !== null) {
    const curPrc = n(info.cur_prc);
    const safetyMargin = curPrc && curPrc > 0 ? ((bps - curPrc) / curPrc * 100).toFixed(1) : null;
    let status, tag, valueColor, score;
    if (safetyMargin !== null) {
      const sm = Number(safetyMargin);
      if (sm > 50) {
        status = 'excellent'; tag = '높은 안전마진'; valueColor = 'green'; score = 95;
      } else if (sm > 0) {
        status = 'good'; tag = '양(+) 마진'; valueColor = 'blue'; score = 70;
      } else if (sm > -30) {
        status = 'neutral'; tag = '보통'; score = 45;
      } else {
        status = 'caution'; tag = '낮은 마진'; valueColor = 'yellow'; score = 20;
      }
      assetValue.push({
        name: 'BPS 안전마진',
        value: `${Number(bps).toLocaleString()}원 (${sm > 0 ? '+' : ''}${safetyMargin}%)`,
        status, tag, valueColor, score,
      });
    } else {
      assetValue.push({ name: 'BPS (주당순자산)', value: `${Number(bps).toLocaleString()}원`, status: 'neutral', tag: '-', score: 50 });
    }
  }

  // EV
  if (ev != null && ev !== '') {
    const evNum = n(ev);
    assetValue.push({
      name: 'EV (기업가치)',
      value: evNum !== null ? evNum.toLocaleString() : String(ev),
      status: 'neutral',
      tag: '참고',
      score: 50,
    });
  }

  // ── 시가총액 적정성 ──
  const mac = n(info.mac);
  const macWght = n(info.mac_wght);
  const marketCap = [];

  // PSR
  if (mac !== null && saleAmt !== null && saleAmt > 0) {
    const psr = mac / saleAmt;
    let status, tag, valueColor, score;
    if (psr < 0.5) {
      status = 'excellent'; tag = '극저평가'; valueColor = 'green'; score = 95;
    } else if (psr < 1) {
      status = 'good'; tag = '저평가'; valueColor = 'green'; score = 80;
    } else if (psr < 3) {
      status = 'neutral'; tag = '적정'; score = 55;
    } else if (psr < 10) {
      status = 'caution'; tag = '고평가'; valueColor = 'yellow'; score = 25;
    } else {
      status = 'danger'; tag = '과열'; valueColor = 'red'; score = 10;
    }
    marketCap.push({ name: 'PSR (시총/매출)', value: `${psr.toFixed(2)}배`, status, tag, valueColor, score });
  }

  // 시가총액
  if (mac !== null) {
    let sizeLabel, status, score;
    if (mac >= 100000) {
      sizeLabel = '대형주'; status = 'good'; score = 70;
    } else if (mac >= 10000) {
      sizeLabel = '중형주'; status = 'neutral'; score = 55;
    } else if (mac >= 2000) {
      sizeLabel = '소형주'; status = 'caution'; score = 40;
    } else {
      sizeLabel = '초소형주'; status = 'danger'; score = 20;
    }
    marketCap.push({ name: '시가총액', value: `${mac.toLocaleString()}억원`, status, tag: sizeLabel, score });
  }

  // 시총비중
  if (macWght !== null) {
    let status, tag, score;
    if (macWght >= 1) {
      status = 'excellent'; tag = '주도주급'; score = 85;
    } else if (macWght >= 0.1) {
      status = 'good'; tag = '핵심주'; score = 65;
    } else if (macWght >= 0.01) {
      status = 'neutral'; tag = '보통'; score = 45;
    } else {
      status = 'caution'; tag = '미미'; score = 25;
    }
    marketCap.push({ name: '시총비중', value: `${macWght}%`, status, tag, score });
  }

  // 시총 vs 순이익  (PER 교차검증)
  const cupNga = n(info.cup_nga);
  if (mac !== null && cupNga !== null && cupNga > 0) {
    const capToProfit = mac / cupNga;
    let status, tag, valueColor, score;
    if (capToProfit < 10) {
      status = 'excellent'; tag = '양호'; valueColor = 'green'; score = 85;
    } else if (capToProfit < 20) {
      status = 'good'; tag = '적정'; valueColor = 'blue'; score = 65;
    } else if (capToProfit < 40) {
      status = 'caution'; tag = '높음'; valueColor = 'yellow'; score = 35;
    } else {
      status = 'danger'; tag = '과대'; valueColor = 'red'; score = 15;
    }
    marketCap.push({ name: '시총/순이익', value: `${capToProfit.toFixed(1)}배`, status, tag, valueColor, score });
  }

  // ── 수급/안정성 ──
  const forExh = n(info.for_exh_rt);
  const crdRt = n(info.crd_rt);
  const dstrRt = n(info.dstr_rt);
  const stability = [];

  // 외인소진률
  if (forExh !== null) {
    let status, tag, valueColor, score;
    if (forExh >= 40) {
      status = 'excellent'; tag = '높은 관심'; valueColor = 'green'; score = 90;
    } else if (forExh >= 20) {
      status = 'good'; tag = '양호'; valueColor = 'blue'; score = 70;
    } else if (forExh >= 5) {
      status = 'neutral'; tag = '보통'; score = 50;
    } else {
      status = 'caution'; tag = '관심 부족'; valueColor = 'yellow'; score = 25;
    }
    stability.push({ name: '외인소진률', value: `${forExh}%`, status, tag, valueColor, score });
  }

  // 신용비율
  if (crdRt !== null) {
    let status, tag, valueColor, score;
    if (crdRt < 1) {
      status = 'excellent'; tag = '안전'; valueColor = 'green'; score = 90;
    } else if (crdRt < 3) {
      status = 'good'; tag = '양호'; score = 70;
    } else if (crdRt < 5) {
      status = 'caution'; tag = '주의'; valueColor = 'yellow'; score = 40;
    } else {
      status = 'danger'; tag = '위험'; valueColor = 'red'; score = 15;
    }
    stability.push({ name: '신용비율', value: `${crdRt}%`, status, tag, valueColor, score });
  }

  // 유통비율
  if (dstrRt !== null) {
    let status, tag, score;
    if (dstrRt >= 70) {
      status = 'good'; tag = '높은 유동성'; score = 70;
    } else if (dstrRt >= 40) {
      status = 'neutral'; tag = '적정'; score = 55;
    } else if (dstrRt >= 20) {
      status = 'caution'; tag = '대주주 지분 높음'; score = 40;
    } else {
      status = 'danger'; tag = '유동성 부족'; score = 20;
    }
    stability.push({ name: '유통비율', value: `${dstrRt}%`, status, tag, score });
  }

  return { profitability, assetValue, marketCap, stability };
}

// ── 카테고리별 점수 계산 ──
function calcCategoryScores(metrics) {
  const calcAvg = (arr) => {
    const scored = arr.filter((m) => m.score != null);
    if (scored.length === 0) return 50;
    return Math.round(scored.reduce((s, m) => s + m.score, 0) / scored.length);
  };

  return {
    profitability: { label: '수익성', score: calcAvg(metrics.profitability) },
    assetValue: { label: '자산가치', score: calcAvg(metrics.assetValue) },
    marketCap: { label: '시총적정성', score: calcAvg(metrics.marketCap) },
    stability: { label: '수급안정', score: calcAvg(metrics.stability) },
  };
}

// ── 등급 판정 ──
function getGrade(score) {
  if (score >= 75) {
    return {
      key: 'undervalued',
      label: '저평가 (Undervalued)',
      emoji: '🟢',
      color: 'var(--green)',
      desc: '주요 밸류에이션 지표가 매력적인 구간에 있습니다. 수익성과 자산가치를 감안할 때 현재 주가에 투자 매력이 높은 것으로 판단됩니다.',
    };
  }
  if (score >= 50) {
    return {
      key: 'fair',
      label: '적정 (Fair Value)',
      emoji: '🔵',
      color: 'var(--blue)',
      desc: '밸류에이션이 합리적인 수준에 있습니다. 과도한 저평가도 고평가도 아니며, 실적 성장세와 업종 모멘텀을 함께 확인해야 합니다.',
    };
  }
  if (score >= 30) {
    return {
      key: 'overvalued',
      label: '고평가 (Overvalued)',
      emoji: '🟡',
      color: 'var(--yellow)',
      desc: '일부 밸류에이션 지표가 고평가 구간에 진입해 있습니다. 성장성이 뒷받침되지 않으면 주가 조정 리스크에 유의하세요.',
    };
  }
  return {
    key: 'overheated',
    label: '과열 (Overheated)',
    emoji: '🔴',
    color: 'var(--red)',
    desc: '밸류에이션이 과열 구간입니다. 펀더멘탈 대비 주가가 과도하게 높으며, 단기 하락 리스크가 큽니다.',
  };
}

// ── 점수별 바 색상 ──
function getBarColor(score) {
  if (score >= 75) return 'var(--green)';
  if (score >= 50) return 'var(--blue)';
  if (score >= 30) return 'var(--yellow)';
  return 'var(--red)';
}

// ── 종합 판정 코멘트 ──
function buildVerdicts(metrics, info) {
  const items = [];
  const n = (v) => (v != null && v !== '' ? Number(v) : null);

  const per = n(info.per);
  const pbr = n(info.pbr);
  const roe = n(info.roe);
  const busPro = n(info.bus_pro);
  const saleAmt = n(info.sale_amt);
  const mac = n(info.mac);
  const forExh = n(info.for_exh_rt);
  const crdRt = n(info.crd_rt);

  // PER + PBR 종합
  if (per !== null && pbr !== null) {
    if (per > 0 && per < 10 && pbr < 1) {
      items.push({ icon: '✅', text: `PER ${per}배 + PBR ${pbr}배 — 이익·자산 기준 모두 저평가 구간으로, 가치투자 관점에서 매력적입니다.` });
    } else if (per > 30 && pbr > 3) {
      items.push({ icon: '⚠️', text: `PER ${per}배 + PBR ${pbr}배 — 고평가가 중첩되어 있습니다. 고성장 기대가 반영된 것인지 확인이 필요합니다.` });
    }
  }

  // 가치 함정 경고 (PER/PBR 저평가 but ROE 부진)
  if (per !== null && per > 0 && per < 10 && roe !== null && roe < 5 && roe >= 0) {
    items.push({ icon: '🪤', text: `저PER이지만 ROE ${roe}%로 낮아 '가치 함정(Value Trap)' 가능성에 주의하세요.` });
  }

  // ROE 판정
  if (roe !== null) {
    if (roe >= 20) {
      items.push({ icon: '🏆', text: `ROE ${roe}% — 매우 높은 자본 효율성을 보이며, 지속 가능한 경쟁력을 시사합니다.` });
    } else if (roe < 0) {
      items.push({ icon: '⛔', text: `ROE ${roe}% — 자본잠식 가능성이 있습니다. 재무 건전성을 반드시 확인하세요.` });
    }
  }

  // 영업이익률
  if (saleAmt != null && saleAmt > 0 && busPro != null) {
    const opMargin = (busPro / saleAmt * 100);
    if (opMargin >= 20) {
      items.push({ icon: '💎', text: `영업이익률 ${opMargin.toFixed(1)}% — 업종 내 높은 수익성을 보유한 우량 기업입니다.` });
    } else if (opMargin < 0) {
      items.push({ icon: '⛔', text: `영업적자 상태 — 본업 수익성에 구조적 문제가 있을 수 있습니다.` });
    }
  }

  // PSR
  if (mac !== null && saleAmt !== null && saleAmt > 0) {
    const psr = mac / saleAmt;
    if (psr > 10) {
      items.push({ icon: '🔥', text: `PSR ${psr.toFixed(1)}배 — 매출 대비 시가총액이 매우 높습니다. 고성장 루머나 테마주 가능성을 점검하세요.` });
    }
  }

  // 수급 관련
  if (forExh !== null && forExh >= 40) {
    items.push({ icon: '🏦', text: `외인소진률 ${forExh}% — 외국인 투자 비중이 높아 수급 안정성이 우수합니다.` });
  }
  if (crdRt !== null && crdRt > 5) {
    items.push({ icon: '⚠️', text: `신용비율 ${crdRt}% — 급락 시 반대매매로 인한 추가 하락 리스크가 있습니다.` });
  }

  if (items.length === 0) {
    items.push({ icon: 'ℹ️', text: '주요 밸류에이션 지표가 안정적인 범위 내에 있습니다. 업종 비교 및 실적 추이를 함께 확인하세요.' });
  }

  return items;
}
