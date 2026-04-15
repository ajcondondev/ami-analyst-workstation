// ============================================================
// RF MESH NETWORK VIEW
// SVG-based visual of meters, collectors, and signal lines
// ============================================================

import { useState, useMemo } from 'react';
import { METERS, COLLECTORS, NEIGHBORHOODS } from '../../data/meters.js';
import StatusBadge from '../shared/StatusBadge.jsx';

// ---- Layout constants ----
// We lay out neighborhoods as 3 columns in the SVG viewport
const SVG_W = 900;
const SVG_H = 580;
const METER_R  = 9;
const COL_R    = 18;

// Fixed positions for each collector
const COLLECTOR_POSITIONS = {
  'COL-SW-01': { x: 120, y: 140 },
  'COL-SW-02': { x: 120, y: 380 },
  'COL-SC-01': { x: 370, y: 140 },
  'COL-SC-02': { x: 370, y: 380 },
  'COL-NA-01': { x: 700, y: 260 },
};

// Distribute meter positions in a circular/grid pattern around their collector
function getMeterPositions() {
  const positions = {};
  COLLECTORS.forEach(collector => {
    const center = COLLECTOR_POSITIONS[collector.id];
    const meters = METERS.filter(m => m.collectorID === collector.id);
    const count = meters.length;
    const cols = Math.ceil(Math.sqrt(count));
    const spacing = 52;
    const startX = center.x - ((Math.min(cols, count) - 1) * spacing) / 2;
    const startY = center.y + 60;

    meters.forEach((meter, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions[meter.meterID] = {
        x: startX + col * spacing,
        y: startY + row * spacing,
      };
    });
  });
  return positions;
}

const METER_POSITIONS = getMeterPositions();

// ---- Signal colors ----
function signalColor(strength, commStatus) {
  if (commStatus === 'Not Communicating') return '#D32F2F';
  if (strength >= 70) return '#2E7D32';
  if (strength >= 40) return '#FF9800';
  return '#D32F2F';
}

function signalLineColor(strength, commStatus) {
  if (commStatus === 'Not Communicating') return 'rgba(211,47,47,0.2)';
  if (strength >= 70) return 'rgba(46,125,50,0.25)';
  if (strength >= 40) return 'rgba(255,152,0,0.25)';
  return 'rgba(211,47,47,0.15)';
}

// ---- Meter detail panel ----
function MeterDetailPanel({ meter, meterState, onClose, onDemandRead }) {
  const [readResult, setReadResult] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!meter || !meterState) return null;

  const color = signalColor(meterState.signalStrength, meterState.commStatus);

  async function handleRead() {
    setLoading(true);
    setReadResult(null);
    await new Promise(r => setTimeout(r, 800));
    const result = onDemandRead(meter.meterID);
    setReadResult(result);
    setLoading(false);
  }

  return (
    <div className="mesh-detail-panel">
      <div className="mesh-detail-header">
        <div>
          <div className="mesh-detail-id">{meter.meterID}</div>
          <div className="mesh-detail-addr">{meter.address}</div>
        </div>
        <button className="btn-ghost" onClick={onClose}>✕ CLOSE</button>
      </div>

      <div className="mesh-detail-grid">
        <div className="mesh-detail-row">
          <span className="mesh-detail-key">CUSTOMER</span>
          <span className="mesh-detail-val">{meter.customerName}</span>
        </div>
        <div className="mesh-detail-row">
          <span className="mesh-detail-key">ACCOUNT #</span>
          <span className="mesh-detail-val mono">{meter.accountNumber}</span>
        </div>
        <div className="mesh-detail-row">
          <span className="mesh-detail-key">RATE CLASS</span>
          <span className="mesh-detail-val">
            <StatusBadge status={meter.rateClass === 'Solar' ? 'Info' : meter.rateClass === 'Commercial' ? 'Warning' : 'Passed'} />
            {' '}{meter.rateClass}
          </span>
        </div>
        <div className="mesh-detail-row">
          <span className="mesh-detail-key">COLLECTOR</span>
          <span className="mesh-detail-val mono">{meter.collectorID}</span>
        </div>
        <div className="mesh-detail-row">
          <span className="mesh-detail-key">FIRMWARE</span>
          <span className="mesh-detail-val mono">{meter.firmwareVersion}</span>
        </div>
        <div className="mesh-detail-row">
          <span className="mesh-detail-key">INSTALL DATE</span>
          <span className="mesh-detail-val mono">{meter.installDate}</span>
        </div>
        {meter.ctRatio && (
          <div className="mesh-detail-row">
            <span className="mesh-detail-key">CT RATIO</span>
            <span className="mesh-detail-val mono">{meter.ctRatio}:5</span>
          </div>
        )}
        <div className="mesh-detail-row">
          <span className="mesh-detail-key">COMM STATUS</span>
          <span className="mesh-detail-val">
            <StatusBadge status={meterState.commStatus} />
          </span>
        </div>
        <div className="mesh-detail-row">
          <span className="mesh-detail-key">SIGNAL</span>
          <span className="mesh-detail-val" style={{ color }}>
            {meterState.signalLabel} ({meterState.signalStrength.toFixed(0)}%)
          </span>
        </div>
        <div className="mesh-detail-row">
          <span className="mesh-detail-key">LAST HEARD</span>
          <span className="mesh-detail-val mono">
            {new Date(meterState.lastHeard).toLocaleTimeString('en-US', { hour12: false })}
          </span>
        </div>
        <div className="mesh-detail-row">
          <span className="mesh-detail-key">REGISTER READ</span>
          <span className="mesh-detail-val mono">{meterState.lastRegisterRead?.toFixed(2)} kWh</span>
        </div>
        <div className="mesh-detail-row">
          <span className="mesh-detail-key">VEE STATUS</span>
          <span className="mesh-detail-val">
            <StatusBadge status={meterState.veeStatus} />
          </span>
        </div>
      </div>

      <div className="mesh-detail-actions">
        <button
          className="btn-primary"
          onClick={handleRead}
          disabled={loading}
        >
          {loading ? '◌ READING...' : '↺ ON-DEMAND READ'}
        </button>
      </div>

      {readResult && (
        <div className={`mesh-read-result ${readResult.success ? 'read-success' : 'read-fail'}`}>
          {readResult.success ? '✓' : '✕'} {readResult.message}
        </div>
      )}

      {/* Recent events */}
      {meterState.recentEvents && meterState.recentEvents.length > 0 && (
        <div className="mesh-events">
          <div className="mesh-events-title">RECENT EVENTS</div>
          {meterState.recentEvents.slice(0, 5).map((evt, i) => (
            <div key={i} className={`mesh-event-row ${evt.type.includes('SUCCESS') ? 'evt-success' : 'evt-fail'}`}>
              <span className="mono text-dim">{new Date(evt.ts).toLocaleTimeString('en-US', { hour12: false })}</span>
              <span>{evt.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Main RF Mesh View ----
export default function RFMeshView({ state, onDemandRead }) {
  const [selectedMeter, setSelectedMeter] = useState(null);
  const [filter, setFilter] = useState('ALL'); // ALL | COMM | NOCOMM | WEAK

  const meterStates = state?.meterStates || {};
  const collectorStates = state?.collectorStates || {};

  // Filter meters
  const visibleMeters = useMemo(() => {
    return METERS.filter(m => {
      const ms = meterStates[m.meterID];
      if (!ms) return true;
      if (filter === 'COMM')   return ms.commStatus === 'Communicating' && ms.signalStrength >= 70;
      if (filter === 'WEAK')   return ms.commStatus === 'Communicating' && ms.signalStrength < 70;
      if (filter === 'NOCOMM') return ms.commStatus === 'Not Communicating';
      return true;
    });
  }, [meterStates, filter]);

  // Stats
  const commCount  = METERS.filter(m => meterStates[m.meterID]?.commStatus === 'Communicating').length;
  const weakCount  = METERS.filter(m => meterStates[m.meterID]?.signalStrength < 70 && meterStates[m.meterID]?.commStatus === 'Communicating').length;
  const noCommCount = METERS.filter(m => meterStates[m.meterID]?.commStatus === 'Not Communicating').length;
  const offlineCollectors = COLLECTORS.filter(c => !collectorStates[c.id]?.online);

  const selectedMeterData = selectedMeter ? METERS.find(m => m.meterID === selectedMeter) : null;
  const selectedMeterState = selectedMeter ? meterStates[selectedMeter] : null;

  return (
    <div className="rfmesh-layout">
      {/* Controls bar */}
      <div className="rfmesh-controls">
        <div className="rfmesh-stats">
          <span className="rfmesh-stat rfmesh-stat-green" onClick={() => setFilter('COMM')}>
            ● {commCount} STRONG
          </span>
          <span className="rfmesh-stat rfmesh-stat-amber" onClick={() => setFilter('WEAK')}>
            ● {weakCount} WEAK
          </span>
          <span className="rfmesh-stat rfmesh-stat-red" onClick={() => setFilter('NOCOMM')}>
            ● {noCommCount} NO COMM
          </span>
          {offlineCollectors.length > 0 && (
            <span className="rfmesh-stat rfmesh-stat-red rfmesh-stat-pulse">
              ⚠ {offlineCollectors.length} COLLECTOR{offlineCollectors.length > 1 ? 'S' : ''} OFFLINE
            </span>
          )}
        </div>
        <div className="rfmesh-filters">
          {['ALL','COMM','WEAK','NOCOMM'].map(f => (
            <button
              key={f}
              className={`rfmesh-filter-btn ${filter === f ? 'rfmesh-filter-active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'ALL' ? 'ALL METERS' : f === 'COMM' ? 'STRONG' : f === 'WEAK' ? 'WEAK SIGNAL' : 'NOT COMM'}
            </button>
          ))}
          {filter !== 'ALL' && (
            <button className="rfmesh-filter-btn" onClick={() => setFilter('ALL')}>✕ CLEAR</button>
          )}
        </div>
      </div>

      <div className="rfmesh-body">
        {/* SVG Network Map */}
        <div className="rfmesh-map-container">
          {/* Neighborhood labels */}
          <div className="rfmesh-nh-labels">
            <div className="rfmesh-nh-label" style={{ left: '5%' }}>SPRINGFIELD-WEST</div>
            <div className="rfmesh-nh-label" style={{ left: '36%' }}>SPRINGFIELD-CENTRAL</div>
            <div className="rfmesh-nh-label" style={{ left: '70%' }}>MANCHESTER, NH</div>
          </div>

          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            className="rfmesh-svg"
            onClick={() => setSelectedMeter(null)}
          >
            <defs>
              {/* Glow filters */}
              <filter id="glow-green">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="glow-amber">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="glow-red">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>

            {/* Background neighborhood zones */}
            <rect x="10" y="10" width="240" height={SVG_H - 20} fill="rgba(34,197,94,0.03)" stroke="rgba(34,197,94,0.08)" strokeWidth="1" rx="0"/>
            <rect x="265" y="10" width="240" height={SVG_H - 20} fill="rgba(59,130,246,0.03)" stroke="rgba(59,130,246,0.08)" strokeWidth="1" rx="0"/>
            <rect x="520" y="10" width="370" height={SVG_H - 20} fill="rgba(245,158,11,0.03)" stroke="rgba(245,158,11,0.08)" strokeWidth="1" rx="0"/>

            {/* Signal lines — draw first so meters appear on top */}
            {METERS.map(meter => {
              const mPos = METER_POSITIONS[meter.meterID];
              const cPos = COLLECTOR_POSITIONS[meter.collectorID];
              if (!mPos || !cPos) return null;
              const ms = meterStates[meter.meterID];
              const hidden = filter !== 'ALL' && !visibleMeters.includes(meter);
              if (hidden) return null;
              const lineColor = ms ? signalLineColor(ms.signalStrength, ms.commStatus) : 'rgba(71,85,105,0.2)';
              return (
                <line
                  key={`line-${meter.meterID}`}
                  x1={cPos.x} y1={cPos.y}
                  x2={mPos.x} y2={mPos.y}
                  stroke={lineColor}
                  strokeWidth="1"
                  strokeDasharray={ms?.commStatus === 'Not Communicating' ? '3 4' : 'none'}
                />
              );
            })}

            {/* Collector nodes */}
            {COLLECTORS.map(collector => {
              const pos = COLLECTOR_POSITIONS[collector.id];
              const online = collectorStates[collector.id]?.online !== false;
              const color = online ? '#1565C0' : '#D32F2F';
              const meterCount = METERS.filter(m => m.collectorID === collector.id).length;
              const commMeters = METERS.filter(m =>
                m.collectorID === collector.id &&
                meterStates[m.meterID]?.commStatus === 'Communicating'
              ).length;

              return (
                <g key={collector.id}>
                  {/* Outer ring pulse for online collectors */}
                  {online && (
                    <circle cx={pos.x} cy={pos.y} r={COL_R + 8} fill="none"
                      stroke="rgba(21,101,192,0.2)" strokeWidth="1">
                      <animate attributeName="r" values={`${COL_R+6};${COL_R+14};${COL_R+6}`} dur="3s" repeatCount="indefinite"/>
                      <animate attributeName="opacity" values="0.4;0;0.4" dur="3s" repeatCount="indefinite"/>
                    </circle>
                  )}
                  <rect
                    x={pos.x - COL_R} y={pos.y - COL_R}
                    width={COL_R * 2} height={COL_R * 2}
                    fill={online ? 'rgba(21,101,192,0.15)' : 'rgba(211,47,47,0.15)'}
                    stroke={color}
                    strokeWidth="2"
                  />
                  <text x={pos.x} y={pos.y - 2} textAnchor="middle" fontSize="9" fontFamily="monospace" fontWeight="bold" fill={color}>
                    {online ? '◉' : '✕'}
                  </text>
                  <text x={pos.x} y={pos.y + 9} textAnchor="middle" fontSize="7" fontFamily="monospace" fill={color}>
                    {commMeters}/{meterCount}
                  </text>
                  {/* Collector label */}
                  <text x={pos.x} y={pos.y - COL_R - 8} textAnchor="middle" fontSize="8" fontFamily="monospace" fill={online ? '#757575' : '#D32F2F'}>
                    {collector.id}
                  </text>
                  {!online && (
                    <text x={pos.x} y={pos.y - COL_R - 18} textAnchor="middle" fontSize="8" fontFamily="monospace" fill="#D32F2F" fontWeight="bold">
                      OFFLINE
                    </text>
                  )}
                </g>
              );
            })}

            {/* Meter nodes */}
            {METERS.map(meter => {
              const mPos = METER_POSITIONS[meter.meterID];
              if (!mPos) return null;
              const ms = meterStates[meter.meterID];
              const hidden = filter !== 'ALL' && !visibleMeters.find(m => m.meterID === meter.meterID);
              if (hidden) return null;

              const color = ms ? signalColor(ms.signalStrength, ms.commStatus) : '#9E9E9E';
              const isSelected = selectedMeter === meter.meterID;
              const isNotComm = ms?.commStatus === 'Not Communicating';
              const isWeak = ms?.signalStrength < 70 && ms?.signalStrength >= 40;
              const collOnline = collectorStates[meter.collectorID]?.online !== false;

              return (
                <g
                  key={meter.meterID}
                  onClick={e => { e.stopPropagation(); setSelectedMeter(meter.meterID); }}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Selection ring */}
                  {isSelected && (
                    <circle cx={mPos.x} cy={mPos.y} r={METER_R + 5}
                      fill="none" stroke="#00838F" strokeWidth="1.5" strokeDasharray="3 2"/>
                  )}

                  {/* Weak signal pulse */}
                  {(isWeak && !isNotComm) && (
                    <circle cx={mPos.x} cy={mPos.y} r={METER_R + 3} fill="none"
                      stroke="rgba(255,152,0,0.4)" strokeWidth="1">
                      <animate attributeName="r" values={`${METER_R};${METER_R+7};${METER_R}`} dur="2s" repeatCount="indefinite"/>
                      <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite"/>
                    </circle>
                  )}

                  {/* Main meter circle */}
                  <circle
                    cx={mPos.x} cy={mPos.y} r={METER_R}
                    fill={isNotComm ? 'rgba(239,68,68,0.12)' : `${color}18`}
                    stroke={color}
                    strokeWidth={isSelected ? 2 : 1}
                    opacity={(!collOnline && !isNotComm) ? 0.4 : 1}
                  />

                  {/* Rate class indicator dot */}
                  <circle
                    cx={mPos.x} cy={mPos.y} r={2.5}
                    fill={meter.rateClass === 'Solar' ? '#00838F' : meter.rateClass === 'Commercial' ? '#1565C0' : color}
                  />

                  {/* Meter ID label (hover-style, always shown small) */}
                  <text
                    x={mPos.x} y={mPos.y + METER_R + 10}
                    textAnchor="middle"
                    fontSize="6"
                    fontFamily="monospace"
                    fill={isSelected ? '#00838F' : '#9E9E9E'}
                  >
                    {meter.meterID.replace('MTR-', '')}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Legend */}
          <div className="rfmesh-legend">
            <span className="legend-item"><span className="legend-dot" style={{background:'#22c55e'}}/> Strong (&gt;70%)</span>
            <span className="legend-item"><span className="legend-dot" style={{background:'#f59e0b'}}/> Weak (40–70%)</span>
            <span className="legend-item"><span className="legend-dot" style={{background:'#ef4444'}}/> No Comm</span>
            <span className="legend-item"><span className="legend-dot" style={{background:'#06b6d4'}}/> Solar</span>
            <span className="legend-item"><span className="legend-dot" style={{background:'#a855f7'}}/> Commercial</span>
            <span className="legend-item legend-collector">▣ Collector Node</span>
          </div>
        </div>

        {/* Detail panel */}
        {selectedMeter && (
          <MeterDetailPanel
            meter={selectedMeterData}
            meterState={selectedMeterState}
            onClose={() => setSelectedMeter(null)}
            onDemandRead={onDemandRead}
          />
        )}
      </div>
    </div>
  );
}
