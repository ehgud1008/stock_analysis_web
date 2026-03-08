import { useState, useCallback } from 'react';
import { fetchToken, fetchChartData } from '../api/kiwoomApi';
import { analyzeAll } from '../features/analysis/indicators';

/**
 * 분석 플로우 상태 관리 훅
 * 상태: idle → analyzing → done | error
 */

const INITIAL_STATE = {
  // 앱 상태
  status: 'idle', // idle | loading_token | loaded_token | fetching_data | analyzing | done | error

  // 토큰
  token: '',

  // 조회 조건
  stockCode: '',
  stockName: '',
  chartType: 'day',
  baseDate: '',

  // 데이터
  chartData: null,
  analysis: null,

  // 에러
  error: null,
};

export function useAnalysis() {
  const [state, setState] = useState(INITIAL_STATE);

  const updateState = useCallback((partial) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  // ── 토큰 조회 ──
  const handleFetchToken = useCallback(async () => {
    updateState({ status: 'loading_token', error: null });
    try {
      const result = await fetchToken();
      updateState({ status: 'loaded_token', token: result.token });
    } catch (err) {
      updateState({ status: 'error', error: `토큰 조회 실패: ${err.message}` });
    }
  }, [updateState]);

  // ── 토큰 직접 입력 ──
  const setToken = useCallback(
    (token) => updateState({ token, status: token ? 'loaded_token' : 'idle' }),
    [updateState]
  );

  // ── 조회 조건 변경 ──
  const setStockCode = useCallback(
    (stockCode) => updateState({ stockCode }),
    [updateState]
  );
  const setStockName = useCallback(
    (stockName) => updateState({ stockName }),
    [updateState]
  );
  const setChartType = useCallback(
    (chartType) => updateState({ chartType }),
    [updateState]
  );
  const setBaseDate = useCallback(
    (baseDate) => updateState({ baseDate }),
    [updateState]
  );

  // ── 차트 데이터 조회 & 자동 분석 ──
  const handleFetchAndAnalyze = useCallback(async () => {
    if (!state.token || !state.stockCode) {
      updateState({ error: '토큰과 종목코드를 입력해주세요.' });
      return;
    }

    updateState({ status: 'fetching_data', error: null, chartData: null, analysis: null });
    try {
      const data = await fetchChartData(
        state.token,
        state.stockCode,
        state.chartType,
        state.baseDate
      );
      updateState({ chartData: data, status: 'analyzing' });

      // 자동 기술 분석 — 응답에서 차트 배열 키를 자동 탐색
      const chartArray = Object.values(data).find(
        (v) => Array.isArray(v) && v.length > 0 && v[0].cur_prc !== undefined
      ) || [];

      if (chartArray.length === 0) {
        throw new Error('차트 데이터를 찾을 수 없습니다. API 응답을 확인해주세요.');
      }

      const analysis = analyzeAll(chartArray);
      analysis.summary.stockCode = data.stk_cd || chartArray[0]?.stk_cd || state.stockCode;
      analysis.summary.chartType = state.chartType;
      updateState({ analysis, status: 'done' });
    } catch (err) {
      updateState({ status: 'error', error: `데이터 조회/분석 실패: ${err.message}` });
    }
  }, [state.token, state.stockCode, state.chartType, state.baseDate, updateState]);

  // ── 초기화 ──
  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return {
    state,
    handleFetchToken,
    setToken,
    setStockCode,
    setStockName,
    setChartType,
    setBaseDate,
    handleFetchAndAnalyze,
    reset,
  };
}
