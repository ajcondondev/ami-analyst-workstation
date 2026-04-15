// ============================================================
// MDMS — METER DATA MANAGEMENT SYSTEM
// Interval data viewer, register reads, VEE status pipeline
// ============================================================

import { useState, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine
} from 'recharts';
import { METERS } from '../../data/meters.js';
import { generateIntervalData } from '../../engine/simulation.js';
import StatusBadge from '../shared/StatusBadge.jsx';

// Build 96-interval chart data for a given meter
function buildChartData(meter, intervalData) {
  return intervalData.map((kWh, i) => {
    const hour = Math.floor(i / 4);
    const min  = (i % 4) * 15;
    const label = `${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
    return { interval: i, label, kWh: parseFloat(kWh.toFixed(4)), time: label };
  });
}

// Build register read log
function buildRegisterLog(meter, meterState) {
  const base = meterState?.lastRegisterRead || meter.avgKWh * 1000;
  const reads = [];
  for (let d = 7; d >= 0; d--) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    const dailyVariance = meter.avgKWh * (0.9 + Math.random() * 0.2);
    reads.push({
      date: date.toISOString().split('T')[0],
      time: d === 0 ? 'Today 06:00' : `${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} 06:00`,
      reading: parseFloat((base - (dailyVariance * d)).toFixed(2)),
      delta: d > 0 ? parseFloat(dailyVariance.toFixed(2)) : null,
      source: d === 0 ? 'AMI' : Math.random() > 0.1 ? 'AMI' : 'Manual',
      quality: Math.random() > 0.05 ? 'Valid' : 'Estimated',
    });
  }
  return reads;
}

// Custom tooltip for interval chart
function IntervalTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const kWh = payload[0]?.value;
  return (
    <div style={{
      background: '#FFFFFF', border: '1px solid #E0E0E0',
      padding: '6px 10px', fontFamily: 'monospace', fontSize: 11
    }}>
      <div style={{ color: '#757575' }}>{label}</div>
      <div style={{ color: kWh < 0 ? '#00838F' : '#2E7D32', fontWeight: 700 }}>
        {kWh?.toFixed(4)} kWh
      </div>
    </div>
  );
}

const PQ_TYPE_LABELS = {
  VOLTAGE_SAG:      'Voltage Sag',
  VOLTAGE_SWELL:    'Voltage Swell',
  MOMENTARY_OUTAGE: 'Momentary Outage',
  SUSTAINED_OUTAGE: 'Sustained Outage',
};

function PowerQualityTab({ meter, meterState }) {
  if (!meter) return <div className="loading">Select a meter to view power quality data</div>;

  const pqEvents = meterState?.powerQualityEvents || [];
  const simNow   = Date.now();

  const sagCount      = pqEvents.filter(e => e.type === 'VOLTAGE_SAG').length;
  const swellCount    = pqEvents.filter(e => e.type === 'VOLTAGE_SWELL').length;
  const momentaryCount = pqEvents.filter(e => e.type === 'MOMENTARY_OUTAGE').length;
  const sustainedCount = pqEvents.filter(e => e.type === 'SUSTAINED_OUTAGE').length;

  const currentV = meterState?.currentVoltage ?? 120;
  const nominalV = meterState?.voltageNominal ?? 120;
  // Map voltage 90–140V → 0–100% for bar
  const vPct = Math.max(0, Math.min(100, ((currentV - 90) / 50) * 100));
  const vColor = currentV < 110 ? '#3b82f6' : currentV > 130 ? '#f59e0b' : '#22c55e';

  function formatEvtTs(ts) {
    return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="pq-layout">
      {/* Summary */}
      <div className="pq-summary-row">
        <div className="pq-stat-chip">
          <div className="pq-stat-val" style={{ color: sagCount > 0 ? '#3b82f6' : '#9ca3af' }}>{sagCount}</div>
          <div className="pq-stat-lbl">Voltage Sags</div>
        </div>
        <div className="pq-stat-chip">
          <div className="pq-stat-val" style={{ color: swellCount > 0 ? '#f59e0b' : '#9ca3af' }}>{swellCount}</div>
          <div className="pq-stat-lbl">Voltage Swells</div>
        </div>
        <div className="pq-stat-chip">
          <div className="pq-stat-val" style={{ color: momentaryCount > 0 ? '#ef4444' : '#9ca3af' }}>{momentaryCount}</div>
          <div className="pq-stat-lbl">Momentary Outages</div>
        </div>
        <div className="pq-stat-chip">
          <div className="pq-stat-val" style={{ color: sustainedCount > 0 ? '#b91c1c' : '#9ca3af' }}>{sustainedCount}</div>
          <div className="pq-stat-lbl">Sustained Outages</div>
        </div>
        <div className="pq-stat-chip">
          <div className="pq-stat-val" style={{ color: vColor }}>{currentV.toFixed(1)}V</div>
          <div className="pq-stat-lbl">Current Voltage</div>
        </div>
      </div>

      {/* Voltage gauge */}
      <div className="pq-voltage-gauge">
        <div className="pq-voltage-label">
          VOLTAGE LEVEL — Nominal: {nominalV.toFixed(1)}V &nbsp;|&nbsp; Sag threshold: &lt;110V &nbsp;|&nbsp; Swell threshold: &gt;130V
        </div>
        <div className="pq-voltage-bar-track">
          <div className="pq-voltage-bar-fill"
            style={{ width: `${vPct}%`, background: vColor }} />
        </div>
        <div className="pq-voltage-val" style={{ color: vColor }}>
          {currentV.toFixed(1)} V
          {currentV < 110 && <span style={{ marginLeft: 8, fontSize: 10 }}>⚡ SAG</span>}
          {currentV > 130 && <span style={{ marginLeft: 8, fontSize: 10 }}>⚡ SWELL</span>}
          {currentV >= 110 && currentV <= 130 && <span style={{ marginLeft: 8, fontSize: 10, color: '#9ca3af' }}>NORMAL</span>}
        </div>
      </div>

      {/* Events log */}
      <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#757575', letterSpacing: '0.06em', marginBottom: 4 }}>
        POWER QUALITY EVENTS — LAST {pqEvents.length} RECORDED
      </div>
      {pqEvents.length === 0 ? (
        <div className="pq-no-events">No power quality events recorded for this meter</div>
      ) : (
        <div className="pq-events-list">
          {pqEvents.map((evt, i) => (
            <div key={i} className="pq-event-row">
              <span className={`pq-event-type pq-type-${evt.type}`}>
                {PQ_TYPE_LABELS[evt.type] || evt.type}
              </span>
              <span className="pq-event-ts">{formatEvtTs(evt.ts)}</span>
              <span className="pq-event-detail">
                {evt.voltage != null ? `${evt.voltage.toFixed(1)} V` : ''}
                {evt.durationMin != null ? `${evt.durationMin} min` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MDMSView({ state }) {
  const [selectedMeterID, setSelectedMeterID] = useState(METERS[0]?.meterID || '');
  const [search, setSearch] = useState('');
  const [veeFilter, setVeeFilter] = useState('ALL');
  const [rightTab, setRightTab] = useState('intervals'); // 'intervals' | 'registers' | 'pq'

  const meterStates = state?.meterStates || {};

  const selectedMeter = METERS.find(m => m.meterID === selectedMeterID);
  const selectedMeterState = meterStates[selectedMeterID] || {};

  // Generate interval data for selected meter
  const intervalData = useMemo(() => {
    if (!selectedMeter) return [];
    const ms = meterStates[selectedMeterID];
    if (ms?.intervalData) return ms.intervalData;
    return generateIntervalData(selectedMeter, 0.1);
  }, [selectedMeterID, selectedMeter, meterStates]);

  const chartData = useMemo(() =>
    selectedMeter ? buildChartData(selectedMeter, intervalData) : [],
    [selectedMeter, intervalData]
  );

  const registerLog = useMemo(() =>
    selectedMeter ? buildRegisterLog(selectedMeter, selectedMeterState) : [],
    [selectedMeter, selectedMeterState]
  );

  // Compute per-meter VEE status list
  const meterVeeList = useMemo(() => {
    return METERS.map(m => {
      const ms = meterStates[m.meterID] || {};
      const openExc = (state?.exceptions || []).filter(e => e.meterID === m.meterID && e.status === 'Open');
      let veeStatus = 'Passed';
      if (openExc.length > 0) {
        const hasError = openExc.some(e => e.severity === 'Error');
        veeStatus = hasError ? 'Exception' : 'Exception';
      }
      if (ms.staleCount >= 3) veeStatus = 'Estimated';
      return {
        meterID: m.meterID,
        customerName: m.customerName,
        rateClass: m.rateClass,
        veeStatus,
        openExceptions: openExc.length,
        lastRead: ms.lastHeard,
        commStatus: ms.commStatus || 'Unknown',
        registerRead: ms.lastRegisterRead,
      };
    });
  }, [state?.exceptions, meterStates]);

  const filteredVeeList = useMemo(() => {
    let list = meterVeeList;
    if (veeFilter !== 'ALL') list = list.filter(m => m.veeStatus === veeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(m =>
        m.meterID.toLowerCase().includes(q) ||
        m.customerName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [meterVeeList, veeFilter, search]);

  const veeStats = {
    passed:    meterVeeList.filter(m => m.veeStatus === 'Passed').length,
    exception: meterVeeList.filter(m => m.veeStatus === 'Exception').length,
    estimated: meterVeeList.filter(m => m.veeStatus === 'Estimated').length,
  };

  // Chart stats
  const totalKwh    = intervalData.reduce((s, v) => s + Math.max(0, v), 0).toFixed(3);
  const peakKwh     = Math.max(...intervalData).toFixed(4);
  const minKwh      = Math.min(...intervalData).toFixed(4);
  const missingCount = intervalData.filter(v => v === 0 && selectedMeter?.rateClass !== 'Solar').length;
  const negCount     = intervalData.filter(v => v < 0).length;

  const chartColor = selectedMeter?.rateClass === 'Solar' ? '#00838F'
    : selectedMeter?.rateClass === 'Commercial' ? '#1565C0'
    : '#FF9800';

  return (
    <div className="mdms-layout">
      {/* Left column: meter selector + VEE status list */}
      <div className="mdms-left">
        {/* VEE pipeline summary */}
        <div className="mdms-vee-summary">
          <div className="mdms-vee-title">VEE PIPELINE STATUS</div>
          <div className="mdms-vee-bars">
            <div className="mdms-vee-bar-row">
              <span className="mdms-vee-label text-green">PASSED</span>
              <div className="mdms-vee-bar-track">
                <div className="mdms-vee-bar-fill"
                  style={{ width: `${(veeStats.passed / METERS.length) * 100}%`, background: '#22c55e' }}/>
              </div>
              <span className="mdms-vee-count text-green">{veeStats.passed}</span>
            </div>
            <div className="mdms-vee-bar-row">
              <span className="mdms-vee-label text-red">EXCEPTION</span>
              <div className="mdms-vee-bar-track">
                <div className="mdms-vee-bar-fill"
                  style={{ width: `${(veeStats.exception / METERS.length) * 100}%`, background: '#ef4444' }}/>
              </div>
              <span className="mdms-vee-count text-red">{veeStats.exception}</span>
            </div>
            <div className="mdms-vee-bar-row">
              <span className="mdms-vee-label text-amber">ESTIMATED</span>
              <div className="mdms-vee-bar-track">
                <div className="mdms-vee-bar-fill"
                  style={{ width: `${(veeStats.estimated / METERS.length) * 100}%`, background: '#f59e0b' }}/>
              </div>
              <span className="mdms-vee-count text-amber">{veeStats.estimated}</span>
            </div>
          </div>
        </div>

        {/* Meter list with VEE status */}
        <div className="mdms-meter-list-header">
          <input
            className="headend-search"
            placeholder="Search meter / customer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="mdms-vee-filters">
            {['ALL','Passed','Exception','Estimated'].map(f => (
              <button key={f}
                className={`rfmesh-filter-btn ${veeFilter === f ? 'rfmesh-filter-active' : ''}`}
                onClick={() => setVeeFilter(f)}
                style={{ fontSize: 8, padding: '2px 6px' }}
              >{f.toUpperCase()}</button>
            ))}
          </div>
        </div>

        <div className="mdms-meter-list">
          {filteredVeeList.map(m => (
            <div
              key={m.meterID}
              className={`mdms-meter-row ${selectedMeterID === m.meterID ? 'mdms-meter-active' : ''}`}
              onClick={() => setSelectedMeterID(m.meterID)}
            >
              <div className="mdms-meter-row-top">
                <span className="mono text-amber" style={{ fontSize: 10 }}>{m.meterID}</span>
                <StatusBadge status={m.veeStatus} />
              </div>
              <div className="mdms-meter-row-sub">
                <span className="text-dim" style={{ fontSize: 9 }}>{m.customerName}</span>
                {m.openExceptions > 0 && (
                  <span style={{ fontSize: 9, color: '#ef4444' }}>⚠ {m.openExceptions} exc</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right column: interval data + register log */}
      <div className="mdms-right">
        {!selectedMeter ? (
          <div className="loading">Select a meter to view data</div>
        ) : (
          <>
            {/* Right panel sub-tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              {[
                { id: 'intervals', label: '≋ INTERVAL DATA' },
                { id: 'registers', label: '⊞ REGISTER LOG' },
                { id: 'pq',        label: '⚡ POWER QUALITY' },
              ].map(t => (
                <button
                  key={t.id}
                  className={`rfmesh-filter-btn ${rightTab === t.id ? 'rfmesh-filter-active' : ''}`}
                  onClick={() => setRightTab(t.id)}
                  style={{ fontSize: 9, padding: '4px 12px' }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Power Quality tab */}
            {rightTab === 'pq' && (
              <PowerQualityTab meter={selectedMeter} meterState={selectedMeterState} />
            )}

            {/* Meter header (always visible when not on PQ tab) */}
            {rightTab !== 'pq' && (
            <div className="mdms-meter-header">
              <div>
                <div className="mdms-meter-header-id">{selectedMeter.meterID}</div>
                <div className="mdms-meter-header-sub">{selectedMeter.customerName} — {selectedMeter.address}</div>
              </div>
              <div className="mdms-meter-header-badges">
                <span className={`rate-pill rate-${selectedMeter.rateClass.toLowerCase()}`}>{selectedMeter.rateClass}</span>
                <StatusBadge status={selectedMeterState.veeStatus || 'Passed'} size="lg" />
                <StatusBadge status={selectedMeterState.commStatus || 'Communicating'} size="lg" />
              </div>
            </div>
            )}

            {/* Interval stats strip + chart (intervals tab) */}
            {rightTab === 'intervals' && (
            <>
            <div className="mdms-stats-strip">
              <div className="mdms-stat-item">
                <span className="mdms-stat-key">TOTAL (24H)</span>
                <span className="mdms-stat-val text-green">{totalKwh} kWh</span>
              </div>
              <div className="mdms-stat-item">
                <span className="mdms-stat-key">PEAK INTERVAL</span>
                <span className="mdms-stat-val text-amber">{peakKwh} kWh</span>
              </div>
              <div className="mdms-stat-item">
                <span className="mdms-stat-key">MIN INTERVAL</span>
                <span className="mdms-stat-val" style={{ color: parseFloat(minKwh) < 0 ? '#06b6d4' : '#cbd5e1' }}>{minKwh} kWh</span>
              </div>
              <div className="mdms-stat-item">
                <span className="mdms-stat-key">INTERVALS (96 total)</span>
                <span className="mdms-stat-val">{96 - missingCount} valid</span>
              </div>
              {missingCount > 0 && (
                <div className="mdms-stat-item">
                  <span className="mdms-stat-key">MISSING</span>
                  <span className="mdms-stat-val text-red">{missingCount} intervals</span>
                </div>
              )}
              {negCount > 0 && (
                <div className="mdms-stat-item">
                  <span className="mdms-stat-key">NEGATIVE</span>
                  <span className="mdms-stat-val" style={{ color: '#06b6d4' }}>{negCount} intervals (solar)</span>
                </div>
              )}
              <div className="mdms-stat-item">
                <span className="mdms-stat-key">HISTORICAL AVG</span>
                <span className="mdms-stat-val text-dim">{selectedMeter.avgKWh} kWh/day</span>
              </div>
            </div>

            {/* 96-interval chart */}
            <div className="mdms-chart-panel">
              <div className="chart-title">
                24-HOUR INTERVAL DATA — {selectedMeter.meterID}
                <span style={{ marginLeft: 8, color: '#757575', fontWeight: 400 }}>
                  (96 × 15-min intervals)
                </span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 24, left: 40 }}>
                  <defs>
                    <linearGradient id="intervalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColor} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={chartColor} stopOpacity={0.02}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="#E0E0E0" vertical={false}/>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 8, fill: '#757575', fontFamily: 'monospace' }}
                    interval={11}
                    angle={-30}
                    textAnchor="end"
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: '#757575', fontFamily: 'monospace' }}
                    tickFormatter={v => `${v.toFixed(2)}`}
                    label={{ value: 'kWh', angle: -90, position: 'insideLeft', fill: '#757575', fontSize: 9, fontFamily: 'monospace' }}
                  />
                  <Tooltip content={<IntervalTooltip />} />
                  {/* Zero line for solar */}
                  {selectedMeter.rateClass === 'Solar' && (
                    <ReferenceLine y={0} stroke="rgba(157,157,157,0.5)" strokeDasharray="4 2"/>
                  )}
                  {/* Historical average line */}
                  <ReferenceLine
                    y={selectedMeter.avgKWh / 96}
                    stroke="rgba(255,152,0,0.5)"
                    strokeDasharray="4 2"
                    label={{ value: 'hist avg', fill: '#FF9800', fontSize: 8, fontFamily: 'monospace' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="kWh"
                    stroke={chartColor}
                    strokeWidth={1.5}
                    fill="url(#intervalGrad)"
                    dot={false}
                    activeDot={{ r: 3, fill: chartColor }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            </>
            )}

            {/* Register read log (registers tab) */}
            {rightTab === 'registers' && (
            <div className="mdms-register-panel">
              <div className="chart-title">REGISTER READ LOG — LAST 8 READS</div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>DATE / TIME</th>
                    <th>CUMULATIVE READ (kWh)</th>
                    <th>DELTA (kWh)</th>
                    <th>SOURCE</th>
                    <th>QUALITY</th>
                  </tr>
                </thead>
                <tbody>
                  {registerLog.map((r, i) => (
                    <tr key={i} className={r.quality === 'Estimated' ? 'row-estimated' : ''}>
                      <td className="mono">{r.time}</td>
                      <td className="mono text-green">{r.reading.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="mono">
                        {r.delta !== null
                          ? <span className="text-amber">{r.delta.toFixed(2)}</span>
                          : <span className="text-dim">—</span>
                        }
                      </td>
                      <td>
                        <span className={`event-type-badge ${r.source === 'AMI' ? 'evt-ON_DEMAND_SUCCESS' : ''}`}>
                          {r.source}
                        </span>
                      </td>
                      <td><StatusBadge status={r.quality === 'Valid' ? 'Passed' : 'Estimated'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
