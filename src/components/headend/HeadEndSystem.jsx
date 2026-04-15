// ============================================================
// AMI HEAD-END SYSTEM
// Meter communication table, on-demand reads, event log
// ============================================================

import { useState, useMemo } from 'react';
import { METERS } from '../../data/meters.js';
import StatusBadge from '../shared/StatusBadge.jsx';

const FILTER_OPTIONS = [
  { id: 'ALL',        label: 'ALL METERS' },
  { id: 'COMM',       label: 'COMMUNICATING' },
  { id: 'NOCOMM',     label: 'NOT COMMUNICATING' },
  { id: 'ALARMING',   label: 'ALARMING' },
];

const SORT_COLS = ['meterID', 'accountNumber', 'lastRead', 'signal', 'status', 'firmware'];

// Global event log across all meters
let _globalEventLog = [];

function addToGlobalLog(event) {
  _globalEventLog = [event, ..._globalEventLog].slice(0, 100);
}

// Seed some initial events
if (_globalEventLog.length === 0) {
  const types = ['POWER_RESTORE', 'LAST_GASP', 'CONFIG_CHANGE', 'TAMPER', 'JOIN'];
  const msgs = {
    POWER_RESTORE: 'Power restored — meter re-joined mesh',
    LAST_GASP:     'Last gasp event — power loss detected',
    CONFIG_CHANGE: 'Firmware configuration updated',
    TAMPER:        'Tamper/tilt alert — enclosure event',
    JOIN:          'Meter joined collector RF mesh',
  };
  METERS.slice(0, 15).forEach((m, i) => {
    const t = types[i % types.length];
    _globalEventLog.push({
      ts: Date.now() - (i * 900000),
      meterID: m.meterID,
      accountNumber: m.accountNumber,
      type: t,
      message: msgs[t],
      severity: t === 'TAMPER' || t === 'LAST_GASP' ? 'Error' : t === 'CONFIG_CHANGE' ? 'Info' : 'Info',
    });
  });
}

export default function HeadEndSystem({ state, onDemandRead }) {
  const [filter, setFilter]         = useState('ALL');
  const [sortCol, setSortCol]       = useState('meterID');
  const [sortDir, setSortDir]       = useState('asc');
  const [search, setSearch]         = useState('');
  const [pendingReads, setPendingReads] = useState({}); // meterID → 'pending'|'ok'|'fail'
  const [eventLog, setEventLog]     = useState(_globalEventLog);
  const [expandedMeter, setExpandedMeter] = useState(null);

  const meterStates = state?.meterStates || {};
  const collectorStates = state?.collectorStates || {};

  // Check if a meter has an alarm (tamper, CT mismatch open exception)
  const alarmingMeters = useMemo(() => {
    const s = new Set();
    (state?.exceptions || []).forEach(e => {
      if (e.type === 'TAMPER_ALERT' || e.type === 'CT_RATIO_MISMATCH') s.add(e.meterID);
    });
    return s;
  }, [state?.exceptions]);

  // Build filtered + sorted meter list
  const filteredMeters = useMemo(() => {
    let list = METERS.map(m => ({ ...m, ms: meterStates[m.meterID] || {} }));

    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(m =>
        m.meterID.toLowerCase().includes(q) ||
        m.accountNumber.toLowerCase().includes(q) ||
        m.address.toLowerCase().includes(q) ||
        m.customerName.toLowerCase().includes(q)
      );
    }

    // Filter
    list = list.filter(m => {
      if (filter === 'COMM')     return m.ms.commStatus === 'Communicating';
      if (filter === 'NOCOMM')   return m.ms.commStatus === 'Not Communicating';
      if (filter === 'ALARMING') return alarmingMeters.has(m.meterID);
      return true;
    });

    // Sort
    list.sort((a, b) => {
      let av, bv;
      switch (sortCol) {
        case 'meterID':      av = a.meterID;   bv = b.meterID;   break;
        case 'accountNumber':av = a.accountNumber; bv = b.accountNumber; break;
        case 'lastRead':     av = a.ms.lastHeard || 0; bv = b.ms.lastHeard || 0; break;
        case 'signal':       av = a.ms.signalStrength || 0; bv = b.ms.signalStrength || 0; break;
        case 'status':       av = a.ms.commStatus || ''; bv = b.ms.commStatus || ''; break;
        case 'firmware':     av = a.firmwareVersion; bv = b.firmwareVersion; break;
        default: av = a.meterID; bv = b.meterID;
      }
      if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });

    return list;
  }, [meterStates, filter, sortCol, sortDir, search, alarmingMeters]);

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  async function handleOnDemandRead(meterID) {
    setPendingReads(p => ({ ...p, [meterID]: 'pending' }));
    await new Promise(r => setTimeout(r, 900 + Math.random() * 600));
    const result = onDemandRead(meterID);
    setPendingReads(p => ({ ...p, [meterID]: result.success ? 'ok' : 'fail' }));

    // Add to event log
    const meter = METERS.find(m => m.meterID === meterID);
    const evt = {
      ts: Date.now(),
      meterID,
      accountNumber: meter?.accountNumber,
      type: result.success ? 'ON_DEMAND_SUCCESS' : 'ON_DEMAND_FAILURE',
      message: result.message,
      severity: result.success ? 'Info' : 'Warning',
    };
    _globalEventLog = [evt, ..._globalEventLog].slice(0, 100);
    setEventLog([..._globalEventLog]);

    setTimeout(() => setPendingReads(p => ({ ...p, [meterID]: undefined })), 3000);
  }

  function signalBar(strength) {
    const bars = 5;
    const filled = Math.round((strength / 100) * bars);
    return (
      <span className="signal-bars">
        {Array.from({ length: bars }, (_, i) => (
          <span
            key={i}
            className="signal-bar"
            style={{
              background: i < filled
                ? (strength >= 70 ? '#2E7D32' : strength >= 40 ? '#FF9800' : '#D32F2F')
                : '#E0E0E0',
              height: `${8 + i * 2}px`,
            }}
          />
        ))}
        <span className="signal-pct" style={{
          color: strength >= 70 ? '#2E7D32' : strength >= 40 ? '#FF9800' : '#D32F2F'
        }}>
          {strength.toFixed(0)}%
        </span>
      </span>
    );
  }

  const commCount   = METERS.filter(m => meterStates[m.meterID]?.commStatus === 'Communicating').length;
  const noCommCount = METERS.filter(m => meterStates[m.meterID]?.commStatus === 'Not Communicating').length;
  const alarmCount  = alarmingMeters.size;

  return (
    <div className="headend-layout">
      {/* Stats row */}
      <div className="headend-stats-row">
        <div className="headend-stat">
          <span className="headend-stat-val text-green">{commCount}</span>
          <span className="headend-stat-key">COMMUNICATING</span>
        </div>
        <div className="headend-stat">
          <span className="headend-stat-val text-red">{noCommCount}</span>
          <span className="headend-stat-key">NOT COMMUNICATING</span>
        </div>
        <div className="headend-stat">
          <span className="headend-stat-val text-amber">{alarmCount}</span>
          <span className="headend-stat-key">ALARMING</span>
        </div>
        <div className="headend-stat">
          <span className="headend-stat-val">{METERS.length}</span>
          <span className="headend-stat-key">TOTAL ENDPOINTS</span>
        </div>
        <div className="headend-stat">
          <span className="headend-stat-val" style={{ color: commCount / METERS.length >= 0.95 ? '#2E7D32' : '#FF9800' }}>
            {Math.round(commCount / METERS.length * 100)}%
          </span>
          <span className="headend-stat-key">MESH HEALTH</span>
        </div>
      </div>

      {/* Filter + search bar */}
      <div className="headend-toolbar">
        <div className="headend-filters">
          {FILTER_OPTIONS.map(f => (
            <button
              key={f.id}
              className={`filter-tab ${filter === f.id ? 'filter-tab-active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              {f.id === 'ALARMING' && alarmCount > 0 && (
                <span className="filter-badge">{alarmCount}</span>
              )}
              {f.id === 'NOCOMM' && noCommCount > 0 && (
                <span className="filter-badge">{noCommCount}</span>
              )}
            </button>
          ))}
        </div>
        <input
          className="headend-search"
          placeholder="Search meter ID, account, address, customer..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Main meter table */}
      <div className="headend-table-wrapper">
        <table className="data-table headend-table">
          <thead>
            <tr>
              {[
                { key: 'meterID',       label: 'METER ID' },
                { key: 'accountNumber', label: 'ACCOUNT #' },
                { key: null,            label: 'CUSTOMER / ADDRESS' },
                { key: null,            label: 'RATE' },
                { key: 'lastRead',      label: 'LAST READ' },
                { key: 'signal',        label: 'SIGNAL' },
                { key: 'status',        label: 'STATUS' },
                { key: 'firmware',      label: 'FIRMWARE' },
                { key: null,            label: 'ACTION' },
              ].map((col, i) => (
                <th
                  key={i}
                  onClick={() => col.key && handleSort(col.key)}
                  style={{ cursor: col.key ? 'pointer' : 'default', userSelect: 'none' }}
                >
                  {col.label}
                  {col.key && sortCol === col.key && (
                    <span style={{ marginLeft: 4, color: '#00838F' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredMeters.length === 0 && (
              <tr><td colSpan={9} className="empty-row">No meters match filter</td></tr>
            )}
            {filteredMeters.map(meter => {
              const ms = meter.ms;
              const isAlarming = alarmingMeters.has(meter.meterID);
              const readStatus = pendingReads[meter.meterID];
              const collOnline = collectorStates[meter.collectorID]?.online !== false;
              const lastHeardAgo = ms.lastHeard
                ? Math.floor((Date.now() - ms.lastHeard) / 60000)
                : null;

              return (
                <tr
                  key={meter.meterID}
                  className={`
                    ${isAlarming ? 'row-alarming' : ''}
                    ${ms.commStatus === 'Not Communicating' ? 'row-nocomm' : ''}
                    ${expandedMeter === meter.meterID ? 'row-expanded' : ''}
                  `}
                  onClick={() => setExpandedMeter(p => p === meter.meterID ? null : meter.meterID)}
                >
                  <td className="mono text-amber">{meter.meterID}</td>
                  <td className="mono text-dim">{meter.accountNumber}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{meter.customerName}</div>
                    <div className="text-dim" style={{ fontSize: 10 }}>{meter.address}</div>
                  </td>
                  <td>
                    <span className={`rate-pill rate-${meter.rateClass.toLowerCase()}`}>
                      {meter.rateClass}
                    </span>
                  </td>
                  <td className="mono">
                    {lastHeardAgo !== null
                      ? lastHeardAgo < 60
                        ? <span className="text-green">{lastHeardAgo}m ago</span>
                        : <span className="text-amber">{Math.floor(lastHeardAgo / 60)}h {lastHeardAgo % 60}m ago</span>
                      : <span className="text-dim">—</span>
                    }
                  </td>
                  <td>{signalBar(ms.signalStrength || 0)}</td>
                  <td>
                    <StatusBadge status={ms.commStatus || 'Not Communicating'} />
                    {isAlarming && <span className="alarm-flag"> ⚠</span>}
                    {!collOnline && <span className="text-dim" style={{ fontSize: 9 }}> (COL OFFLINE)</span>}
                  </td>
                  <td className="mono text-dim">{meter.firmwareVersion}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <button
                      className={`read-btn ${readStatus === 'ok' ? 'read-ok' : readStatus === 'fail' ? 'read-fail-btn' : readStatus === 'pending' ? 'read-pending' : ''}`}
                      onClick={() => handleOnDemandRead(meter.meterID)}
                      disabled={readStatus === 'pending'}
                      title="Request on-demand meter read"
                    >
                      {readStatus === 'pending' ? '◌' : readStatus === 'ok' ? '✓ OK' : readStatus === 'fail' ? '✕ FAIL' : '↺ READ'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Expanded meter detail row (shows recent events for that meter) */}
      {expandedMeter && (() => {
        const meter = METERS.find(m => m.meterID === expandedMeter);
        const ms = meterStates[expandedMeter] || {};
        const meterEvts = eventLog.filter(e => e.meterID === expandedMeter);
        return (
          <div className="headend-expanded-detail">
            <div className="headend-exp-header">
              <span className="mono text-amber">{expandedMeter}</span>
              <span className="text-dim"> — {meter?.customerName} — {meter?.address}</span>
              <span className="mono text-dim" style={{ marginLeft: 16 }}>
                Register: <span className="text-green">{ms.lastRegisterRead?.toFixed(2)} kWh</span>
              </span>
              {meter?.ctRatio && (
                <span className="mono text-dim" style={{ marginLeft: 16 }}>
                  CT Ratio: <span className="text-amber">{meter.ctRatio}:5</span>
                </span>
              )}
              <button className="btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => setExpandedMeter(null)}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 16, padding: '8px 0' }}>
              <div style={{ flex: 1 }}>
                <div className="panel-title">METER EVENTS — THIS SESSION</div>
                {meterEvts.length === 0 ? (
                  <div className="text-dim mono" style={{ fontSize: 11, padding: 8 }}>No events recorded this session</div>
                ) : meterEvts.map((evt, i) => (
                  <div key={i} className={`headend-event headend-event-${evt.severity?.toLowerCase() || 'info'}`}>
                    <span className="mono text-dim">{new Date(evt.ts).toLocaleTimeString('en-US', { hour12: false })}</span>
                    <span className={`event-type-badge evt-${evt.type}`}>{evt.type.replace(/_/g, ' ')}</span>
                    <span>{evt.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Global event log */}
      <div className="headend-eventlog">
        <div className="panel-title">SYSTEM EVENT LOG — ALL METERS (LAST 50)</div>
        <div className="headend-eventlog-scroll">
          {eventLog.slice(0, 50).map((evt, i) => (
            <div key={i} className={`headend-event headend-event-${evt.severity?.toLowerCase() || 'info'}`}>
              <span className="mono text-dim" style={{ minWidth: 70 }}>
                {new Date(evt.ts).toLocaleTimeString('en-US', { hour12: false })}
              </span>
              <span className="mono text-amber" style={{ minWidth: 110 }}>{evt.meterID}</span>
              <span className={`event-type-badge evt-${evt.type}`}>{evt.type.replace(/_/g, ' ')}</span>
              <span style={{ color: '#cbd5e1' }}>{evt.message}</span>
            </div>
          ))}
          {eventLog.length === 0 && (
            <div className="text-dim mono" style={{ fontSize: 11, padding: 8 }}>
              No events recorded — events appear as meters communicate
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
