import './DiggingPanel.css';

export default function DiggingPanel() {
  return (
    <section className="digging-panel">
      <div className="digging-panel__header">
        <span className="digging-panel__icon">🔍</span>
        <h2 className="digging-panel__title">신규종목 디깅</h2>
      </div>

      <div className="digging-panel__empty">
        <span className="digging-panel__empty-icon">🚧</span>
        <p className="digging-panel__empty-text">신규종목 디깅 기능을 준비 중입니다.</p>
        <p className="digging-panel__empty-hint">
          유망 종목을 발굴하고 분석하는 기능이 곧 추가될 예정입니다.
        </p>
      </div>
    </section>
  );
}
