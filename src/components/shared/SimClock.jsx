export default function SimClock({ simDate, simSpeed, onSpeedChange }) {
  const timeStr = simDate
    ? simDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '--:--';
  const dateStr = simDate
    ? simDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : '---';

  const speeds = [
    { label: 'PAUSE', value: 0 },
    { label: '1×',   value: 1 },
    { label: '5×',   value: 5 },
    { label: '10×',  value: 10 },
  ];

  return (
    <div className="sim-clock">
      <div className="sim-clock-time">
        <span className="sim-clock-label">OPS TIME</span>
        <span className="sim-clock-value">{timeStr}</span>
        <span className="sim-clock-date">{dateStr}</span>
      </div>
      <div className="sim-speed-controls">
        {speeds.map(s => (
          <button
            key={s.value}
            className={`speed-btn ${simSpeed === s.value ? 'speed-btn-active' : ''}`}
            onClick={() => onSpeedChange(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
