import { useAnalysis } from './hooks/useAnalysis';
import TokenPanel from './features/token/TokenPanel';
import StockInput from './features/stock/StockInput';
import AnalysisPanel from './features/analysis/AnalysisPanel';
import StrategyPanel from './features/analysis/StrategyPanel';
import AIAnalysisPanel from './features/analysis/AIAnalysisPanel';
import './App.css';

function App() {
  const {
    state,
    handleFetchToken,
    setToken,
    setStockCode,
    setChartType,
    setBaseDate,
    handleFetchAndAnalyze,
  } = useAnalysis();

  const isFetching = state.status === 'fetching_data' || state.status === 'analyzing';

  return (
    <div className="app">
      {/* Header */}
      <header className="app__header">
        <div className="app__header-inner">
          <div className="app__logo">
            <span className="app__logo-icon">⚡</span>
            <div>
              <h1 className="app__title">Stock Analysis</h1>
              <p className="app__subtitle">키움증권 API · 기술적 분석 · AI 매매 시그널</p>
            </div>
          </div>
          <div className="app__status-badge">
            <span className={`status-dot status-dot--${state.status === 'error' ? 'error' : state.status === 'idle' ? 'idle' : 'active'}`} />
            <span className="status-text">
              {getStatusLabel(state.status)}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="app__main">
        {/* 1. 토큰 관리 */}
        <TokenPanel
          token={state.token}
          onFetchToken={handleFetchToken}
          onTokenChange={setToken}
          status={state.status}
        />

        {/* 2. 종목 조회 */}
        <StockInput
          stockCode={state.stockCode}
          chartType={state.chartType}
          baseDate={state.baseDate}
          onStockCodeChange={setStockCode}
          onChartTypeChange={setChartType}
          onBaseDateChange={setBaseDate}
          onSubmit={handleFetchAndAnalyze}
          isDisabled={!state.token}
          isLoading={isFetching}
        />

        {/* 글로벌 에러 */}
        {state.error && (
          <div className="app__error">
            <span>⚠️</span> {state.error}
          </div>
        )}

        {/* 3. 분석 결과 */}
        {state.analysis && (
          <>
            <AnalysisPanel analysis={state.analysis} />

            {/* 4. 기술적 구조 분석 & 매매 전략 */}
            <StrategyPanel analysis={state.analysis} />

            {/* 5. AI 고급 분석 (C/D/E) */}
            <AIAnalysisPanel analysis={state.analysis} />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="app__footer">
        <p>Stock Analysis Web · 투자의 최종 결정은 본인에게 있습니다.</p>
      </footer>
    </div>
  );
}

function getStatusLabel(status) {
  const map = {
    idle: '대기 중',
    loading_token: '토큰 조회 중',
    loaded_token: '토큰 준비됨',
    fetching_data: '데이터 조회 중',
    analyzing: '분석 중',
    done: '완료',
    error: '오류 발생',
  };
  return map[status] || status;
}

export default App;
