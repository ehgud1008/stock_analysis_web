import './StockInfoPanel.css';

/**
 * 종목 펀더멘탈 정보(ka10001) 카드
 * - 기업 개요, 밸류에이션, 수급/유통, 가격 범위를 카드로 시각화
 * - 펀더멘탈 간단 분석 포함
 */
export default function StockInfoPanel({ stockInfo, stockName }) {
  if (!stockInfo) return null;

  const n = (v) => (v != null && v !== '' ? Number(v) : null);
  const fmt = (v) => (v != null ? Number(v).toLocaleString() : '-');
  const pct = (v) => (v != null && v !== '' ? `${v}%` : '-');

  // 펀더멘탈 분석
  const analyses = buildFundamentalAnalysis(stockInfo);

  return (
    <section className="stock-info-panel">
      <div className="stock-info-panel__header">
        <span className="stock-info-panel__icon">🏢</span>
        <h2 className="stock-info-panel__title">기업 정보</h2>
        {stockInfo.stk_nm && (
          <span className="stock-info-panel__badge">{stockInfo.stk_nm}</span>
        )}
      </div>

      <div className="stock-info-cards">
        {/* 기업 개요 */}
        <div className="si-card">
          <h3 className="si-card__title">
            <span>📋</span> 기업 개요
          </h3>
          <div className="si-card__grid">
            <StatItem label="종목명" value={stockInfo.stk_nm || stockName || '-'} />
            {/* <StatItem label="결산월" value={stockInfo.setl_mm ? `${stockInfo.setl_mm}월` : '-'} /> */}
            {/* <StatItem label="액면가" value={`${fmt(stockInfo.fav)}원`} /> */}
            <StatItem label="자본금" value={`${fmt(stockInfo.cap)}억원`} />
            <StatItem label="상장주식" value={`${fmt(stockInfo.flo_stk)}주`} wide />
          </div>
        </div>

        {/* 실적 */}
        <div className="si-card">
          <h3 className="si-card__title">
            <span>📊</span> 실적
          </h3>
          <div className="si-card__grid">
            <StatItem label="매출액" value={`${fmt(stockInfo.sale_amt)}억원`} />
            <StatItem
              label="영업이익"
              value={`${fmt(stockInfo.bus_pro)}억원`}
              color={n(stockInfo.bus_pro) > 0 ? 'green' : n(stockInfo.bus_pro) < 0 ? 'red' : null}
            />
            <StatItem
              label="당기순이익"
              value={`${fmt(stockInfo.cup_nga)}억원`}
              color={n(stockInfo.cup_nga) > 0 ? 'green' : n(stockInfo.cup_nga) < 0 ? 'red' : null}
              wide
            />
          </div>
        </div>

        {/* 밸류에이션 */}
        <div className="si-card">
          <h3 className="si-card__title">
            <span>💰</span> 밸류에이션
          </h3>
          <div className="si-card__grid">
            <StatItem label="시가총액" value={`${fmt(stockInfo.mac)}억원`} highlight />
            <StatItem label="시총비중" value={pct(stockInfo.mac_wght)} />
            <StatItem label="PER" value={stockInfo.per || '-'} color={getPerColor(n(stockInfo.per))} />
            <StatItem label="PBR" value={stockInfo.pbr || '-'} color={getPbrColor(n(stockInfo.pbr))} />
            <StatItem label="EPS" value={`${fmt(stockInfo.eps)}원`} />
            <StatItem label="BPS" value={`${fmt(stockInfo.bps)}원`} />
            <StatItem label="ROE" value={pct(stockInfo.roe)} color={getRoeColor(n(stockInfo.roe))} />
            <StatItem label="EV" value={stockInfo.ev || '-'} />
          </div>
        </div>

        {/* 수급/유통 */}
        <div className="si-card">
          <h3 className="si-card__title">
            <span>🔄</span> 수급 · 유통
          </h3>
          <div className="si-card__grid">
            <StatItem label="유통주식" value={`${fmt(stockInfo.dstr_stk)}주`} />
            <StatItem label="유통비율" value={pct(stockInfo.dstr_rt)} />
            <StatItem label="신용비율" value={pct(stockInfo.crd_rt)} />
            <StatItem label="외인소진률" value={pct(stockInfo.for_exh_rt)} />
            <StatItem label="현재가" value={`${fmt(stockInfo.cur_prc)}원`} highlight />
            <StatItem
              label="등락율"
              value={pct(stockInfo.flu_rt)}
              color={n(stockInfo.flu_rt) > 0 ? 'red' : n(stockInfo.flu_rt) < 0 ? 'blue' : null}
            />
            <StatItem label="거래량" value={fmt(stockInfo.trde_qty)} />
            <StatItem label="거래대비" value={fmt(stockInfo.trde_pre)} />
            {/* <StatItem label="연중최고" value={`${fmt(stockInfo.oyr_hgst)}원`} color="red" /> */}
            {/* <StatItem label="연중최저" value={`${fmt(stockInfo.oyr_lwst)}원`} color="blue" /> */}
            {/* <StatItem
              label="250일최고"
              value={`${fmt(stockInfo['250hgst'])}원`}
              sub={stockInfo['250hgst_pric_dt'] ? `${formatDate(stockInfo['250hgst_pric_dt'])} (${stockInfo['250hgst_pric_pre_rt']}%)` : null}
            />
            <StatItem
              label="250일최저"
              value={`${fmt(stockInfo['250lwst'])}원`}
              sub={stockInfo['250lwst_pric_dt'] ? `${formatDate(stockInfo['250lwst_pric_dt'])} (${stockInfo['250lwst_pric_pre_rt']}%)` : null}
            /> */}
          </div>
        </div>

        {/* 가격 범위 */}
        {/* <div className="si-card">
          <h3 className="si-card__title">
            <span>📈</span> 가격 범위
          </h3>
          <div className="si-card__grid">
            
          </div>
        </div> */}

        {/* 펀더멘탈 분석 */}
        {analyses.length > 0 && (
          <div className="si-card si-card--analysis">
            <h3 className="si-card__title">
              <span>🔍</span> 펀더멘탈 분석
            </h3>
            <div className="si-analysis-list">
              {analyses.map((a, i) => (
                <div key={i} className={`si-analysis-item si-analysis-item--${a.type}`}>
                  <span className="si-analysis-item__icon">{a.icon}</span>
                  <p className="si-analysis-item__text">{a.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ── 하위 컴포넌트 ──
function StatItem({ label, value, highlight, color, wide, sub }) {
  return (
    <div className={`si-stat ${wide ? 'si-stat--wide' : ''}`}>
      <span className="si-stat__label">{label}</span>
      <span
        className={`si-stat__value ${highlight ? 'si-stat__value--highlight' : ''} ${color ? `si-stat__value--${color}` : ''}`}
      >
        {value}
      </span>
      {sub && <span className="si-stat__sub">{sub}</span>}
    </div>
  );
}

// ── 펀더멘탈 분석 로직 ──
function buildFundamentalAnalysis(info) {
  const items = [];
  const n = (v) => (v != null && v !== '' ? Number(v) : null);

  // PER 분석
  const per = n(info.per);
  if (per !== null) {
    if (per < 0) {
      items.push({ icon: '⛔', type: 'negative', text: `PER ${per} — 당기순이익 적자 상태입니다.` });
    } else if (per < 10) {
      items.push({ icon: '✅', type: 'positive', text: `PER ${per}배 — 저평가 구간입니다. 업종 평균과 비교해보세요.` });
    } else if (per > 30) {
      items.push({ icon: '⚠️', type: 'caution', text: `PER ${per}배 — 고평가 구간입니다. 성장성이 뒷받침되는지 확인하세요.` });
    }
  }

  // PBR 분석
  const pbr = n(info.pbr);
  if (pbr !== null) {
    if (pbr < 1) {
      items.push({ icon: '✅', type: 'positive', text: `PBR ${pbr}배 — 순자산 대비 저평가 상태입니다.` });
    } else if (pbr > 5) {
      items.push({ icon: '⚠️', type: 'caution', text: `PBR ${pbr}배 — 순자산 대비 고평가입니다.` });
    }
  }

  // ROE 분석
  const roe = n(info.roe);
  if (roe !== null) {
    if (roe > 15) {
      items.push({ icon: '✅', type: 'positive', text: `ROE ${roe}% — 자본 효율성이 높습니다.` });
    } else if (roe < 5 && roe >= 0) {
      items.push({ icon: '⚠️', type: 'caution', text: `ROE ${roe}% — 자본 수익성이 낮습니다.` });
    } else if (roe < 0) {
      items.push({ icon: '⛔', type: 'negative', text: `ROE ${roe}% — 자본 잠식 가능성을 확인하세요.` });
    }
  }

  // 영업이익
  const busPro = n(info.bus_pro);
  if (busPro !== null) {
    if (busPro < 0) {
      items.push({ icon: '⛔', type: 'negative', text: `영업이익 적자 (${busPro.toLocaleString()}억원) — 본업 수익성에 문제가 있습니다.` });
    }
  }

  // 외인소진률
  const forExh = n(info.for_exh_rt);
  if (forExh !== null) {
    if (forExh > 40) {
      items.push({ icon: '✅', type: 'positive', text: `외인소진률 ${forExh}% — 외국인 투자 비중이 높아 안정적입니다.` });
    } else if (forExh < 5) {
      items.push({ icon: '⚠️', type: 'caution', text: `외인소진률 ${forExh}% — 외국인 관심이 낮습니다.` });
    }
  }

  // 신용비율
  const crdRt = n(info.crd_rt);
  if (crdRt !== null && crdRt > 5) {
    items.push({ icon: '⚠️', type: 'caution', text: `신용비율 ${crdRt}% — 신용거래 비중이 높아 급락 시 반대매매 리스크가 있습니다.` });
  }

  // 250일 최고가 대비율
  const hgstPre = n(info['250hgst_pric_pre_rt']);
  if (hgstPre !== null && hgstPre < -30) {
    items.push({ icon: '📉', type: 'caution', text: `250일 최고가 대비 ${hgstPre}% 하락 — 낙폭이 큰 편입니다.` });
  }

  if (items.length === 0) {
    items.push({ icon: 'ℹ️', type: 'neutral', text: '특이 사항 없음 — 주요 지표가 안정적인 범위에 있습니다.' });
  }

  return items;
}

// ── 유틸 ──
function getPerColor(per) {
  if (per === null) return null;
  if (per < 0) return 'red';
  if (per < 10) return 'green';
  if (per > 30) return 'red';
  return null;
}

function getPbrColor(pbr) {
  if (pbr === null) return null;
  if (pbr < 1) return 'green';
  if (pbr > 5) return 'red';
  return null;
}

function getRoeColor(roe) {
  if (roe === null) return null;
  if (roe > 15) return 'green';
  if (roe < 0) return 'red';
  return null;
}

function formatDate(dt) {
  if (!dt || dt.length < 8) return dt || '';
  return `${dt.slice(0, 4)}.${dt.slice(4, 6)}.${dt.slice(6, 8)}`;
}
