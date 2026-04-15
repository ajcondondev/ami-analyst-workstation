// ============================================================
// OUTAGE ANALYSIS — Grid hierarchy, outage correlation, map
// ============================================================

import { useState, useMemo } from 'react';
import { SUBSTATIONS, FEEDERS, TRANSFORMERS, buildGridHierarchy, getMetersByTransformer } from '../../data/grid.js';
import { METERS } from '../../data/meters.js';

const STATUS_COLORS = { OK: '#22c55e', Degraded: '#f59e0b', Outage: '#ef4444', Unknown: '#9ca3af' };

function statusDot(status) {
  return <span className={`tree-dot tree-dot-${status?.toLowerCase() || 'unknown'}`} />;
}

function computeGridStatus(meterStates) {
  const hierarchy = buildGridHierarchy(meterStates);
  // Augment feeders with aggregate status
  return hierarchy.map(sub => ({
    ...sub,
    feeders: sub.feeders.map(feeder => {
      const trfs = feeder.transformers;
      const outageCount   = trfs.filter(t => t.status === 'Outage').length;
      const degradedCount = trfs.filter(t => t.status === 'Degraded').length;
      const feederStatus  = outageCount === trfs.length ? 'Outage'
        : (outageCount + degradedCount) > 0 ? 'Degraded'
        : 'OK';
      return { ...feeder, feederStatus, outageCount, degradedCount };
    }),
  })).map(sub => {
    const allStatuses = sub.feeders.map(f => f.feederStatus);
    const subStatus = allStatuses.every(s => s === 'Outage') ? 'Outage'
      : allStatuses.some(s => s === 'Outage' || s === 'Degraded') ? 'Degraded'
      : 'OK';
    return { ...sub, subStatus };
  });
}

// ---- Tree View ----
function TopologyTree({ grid, selectedTrf, onSelectTrf }) {
  const [collapsedFeeders, setCollapsedFeeders] = useState({});
  const [collapsedSubs, setCollapsedSubs] = useState({});

  function toggleFeeder(id) {
    setCollapsedFeeders(c => ({ ...c, [id]: !c[id] }));
  }
  function toggleSub(id) {
    setCollapsedSubs(c => ({ ...c, [id]: !c[id] }));
  }

  return (
    <div className="outage-tree">
      {grid.map(sub => (
        <div key={sub.id} className="tree-sub-node">
          {/* Substation row */}
          <div className="tree-row" onClick={() => toggleSub(sub.id)}>
            <span className="tree-chevron">{collapsedSubs[sub.id] ? '▶' : '▼'}</span>
            {statusDot(sub.subStatus)}
            <span className="tree-label" style={{ fontWeight: 700 }}>⚡ {sub.name}</span>
            <span className="tree-sublabel">{sub.location}</span>
            <span className={`tree-badge tree-badge-${sub.subStatus === 'OK' ? 'ok' : sub.subStatus === 'Outage' ? 'alert' : 'warn'}`}>
              {sub.subStatus}
            </span>
          </div>

          {!collapsedSubs[sub.id] && sub.feeders.map(feeder => (
            <div key={feeder.id}>
              {/* Feeder row */}
              <div className="tree-row tree-indent-1" onClick={() => toggleFeeder(feeder.id)}>
                <span className="tree-chevron">{collapsedFeeders[feeder.id] ? '▶' : '▼'}</span>
                {statusDot(feeder.feederStatus)}
                <span className="tree-label">⊏ {feeder.name}</span>
                <span className="tree-sublabel">{feeder.description}</span>
                {feeder.outageCount > 0 && (
                  <span className="tree-badge tree-badge-alert">{feeder.outageCount} OUTAGE</span>
                )}
                {feeder.degradedCount > 0 && feeder.outageCount === 0 && (
                  <span className="tree-badge tree-badge-warn">{feeder.degradedCount} DEGRADED</span>
                )}
                {feeder.outageCount === 0 && feeder.degradedCount === 0 && (
                  <span className="tree-badge tree-badge-ok">ALL OK</span>
                )}
              </div>

              {!collapsedFeeders[feeder.id] && feeder.transformers.map(trf => (
                <div key={trf.id}>
                  {/* Transformer row */}
                  <div
                    className={`tree-row tree-indent-2 ${selectedTrf?.id === trf.id ? 'tree-row-selected' : ''}`}
                    onClick={() => onSelectTrf(trf)}
                  >
                    <span className="tree-chevron">□</span>
                    {statusDot(trf.status)}
                    <span className="tree-label">▤ {trf.id}</span>
                    <span className="tree-sublabel">{trf.address}</span>
                    <span className="tree-sublabel" style={{ marginLeft: 4 }}>{trf.kva} kVA</span>
                    {trf.darkCount > 0 ? (
                      <span className={`tree-badge tree-badge-${trf.darkCount >= trf.meterIDs.length ? 'alert' : 'warn'}`}>
                        {trf.darkCount}/{trf.meterIDs.length} DARK
                      </span>
                    ) : (
                      <span className="tree-badge tree-badge-ok">{trf.meterIDs.length} OK</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---- Transformer Detail Panel ----
function TrfDetail({ trf, meterStates }) {
  if (!trf) {
    return (
      <div className="outage-detail-card" style={{ flex: 1 }}>
        <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af', textAlign: 'center', padding: 32 }}>
          ← Select a transformer to view meter status
        </div>
      </div>
    );
  }

  const meterIDs = getMetersByTransformer(trf.id);
  const feeder = FEEDERS.find(f => f.id === trf.feederID);

  return (
    <div className="outage-detail-card" style={{ flex: 1 }}>
      <div className="outage-detail-title">
        Transformer {trf.id} — {trf.address}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div className="report-stat-chip">
          <div>
            <div className="report-stat-chip-val" style={{ fontSize: 16, color: '#1A237E' }}>{trf.kva} kVA</div>
            <div className="report-stat-chip-lbl">Rating</div>
          </div>
        </div>
        <div className="report-stat-chip">
          <div>
            <div className="report-stat-chip-val" style={{ fontSize: 16, color: feeder ? '#1A237E' : '#9ca3af' }}>{feeder?.name || '—'}</div>
            <div className="report-stat-chip-lbl">Feeder</div>
          </div>
        </div>
        <div className="report-stat-chip">
          <div>
            <div className="report-stat-chip-val" style={{ fontSize: 16, color: trf.darkCount > 0 ? '#ef4444' : '#22c55e' }}>
              {trf.darkCount}/{meterIDs.length}
            </div>
            <div className="report-stat-chip-lbl">Meters Dark</div>
          </div>
        </div>
        <div className="report-stat-chip">
          <div>
            <div className="report-stat-chip-val" style={{ fontSize: 16, color: STATUS_COLORS[trf.status] }}>{trf.status}</div>
            <div className="report-stat-chip-lbl">Status</div>
          </div>
        </div>
      </div>

      {trf.darkCount >= 2 && (
        <div style={{
          padding: '8px 12px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.3)',
          fontFamily: 'monospace', fontSize: 10, color: '#ef4444', marginBottom: 10, fontWeight: 700,
        }}>
          ⚠ POTENTIAL TRANSFORMER OUTAGE — {trf.darkCount} of {meterIDs.length} meters not communicating
        </div>
      )}

      <div className="outage-detail-title" style={{ fontSize: 9, marginBottom: 6 }}>METER STATUS</div>
      <div className="outage-meter-grid">
        {meterIDs.map(mID => {
          const meter = METERS.find(m => m.meterID === mID);
          const ms = meterStates?.[mID] || {};
          const dark = ms.commStatus === 'Not Communicating';
          return (
            <div key={mID} className={`outage-meter-chip ${dark ? 'chip-dark' : 'chip-ok'}`}>
              <span className={`tree-dot tree-dot-${dark ? 'outage' : 'ok'}`} />
              <div>
                <div style={{ fontWeight: 700, color: dark ? '#ef4444' : '#22c55e' }}>{mID}</div>
                <div style={{ color: '#9ca3af', fontSize: 8 }}>{meter?.customerName}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Outage Map ----
function OutageMap({ grid, onSelectTrf }) {
  return (
    <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
      <div className="outage-map">
        {grid.flatMap(sub => sub.feeders).map(feeder => (
          <div key={feeder.id} className="outage-feeder-block">
            <div className="outage-feeder-title">
              <span style={{ marginRight: 6 }}>{statusDot(feeder.feederStatus)}</span>
              {feeder.name} — {feeder.description}
            </div>
            <div className="outage-trf-chips">
              {feeder.transformers.map(trf => (
                <div
                  key={trf.id}
                  className={`outage-trf-chip trf-chip-${trf.status.toLowerCase()}`}
                  onClick={() => onSelectTrf(trf)}
                >
                  <span className={`tree-dot tree-dot-${trf.status.toLowerCase()}`} />
                  <span className="trf-chip-name">{trf.id}</span>
                  <span className="trf-chip-stat" style={{ fontSize: 9, color: '#9ca3af' }}>{trf.address}</span>
                  <span className={`trf-chip-stat trf-chip-stat-${trf.darkCount > 0 ? (trf.darkCount >= trf.meterIDs.length ? 'red' : 'amber') : 'green'}`}>
                    {trf.darkCount > 0 ? `${trf.darkCount}/${trf.meterIDs.length} dark` : `${trf.meterIDs.length}/${trf.meterIDs.length} ok`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Main ----
export default function OutageAnalysis({ state }) {
  const [activeView, setActiveView] = useState('tree');
  const [selectedTrf, setSelectedTrf] = useState(null);

  const meterStates = state?.meterStates || {};

  const grid = useMemo(() => computeGridStatus(meterStates), [meterStates]);

  // Summary counts
  const totalTransformers = TRANSFORMERS.length;
  const allTransformers = grid.flatMap(sub => sub.feeders).flatMap(f => f.transformers);
  const trfOutage   = allTransformers.filter(t => t.status === 'Outage').length;
  const trfDegraded = allTransformers.filter(t => t.status === 'Degraded').length;
  const trfOk       = totalTransformers - trfOutage - trfDegraded;

  const feedersDegraded = grid.flatMap(s => s.feeders).filter(f => f.feederStatus !== 'OK').length;

  // Exceptions related to transformer outages
  const outageExceptions = (state?.exceptions || []).filter(e => e.type === 'TRANSFORMER_OUTAGE' && e.status === 'Open');

  return (
    <div className="outage-layout">
      {/* Summary strip */}
      <div className="outage-header-strip">
        <div className={`outage-summary-card ${trfOutage > 0 ? 'card-red' : 'card-green'}`}>
          <div className="outage-summary-num" style={{ color: trfOutage > 0 ? '#ef4444' : '#22c55e' }}>{trfOutage}</div>
          <div className="outage-summary-label">Transformers Out</div>
        </div>
        <div className={`outage-summary-card ${trfDegraded > 0 ? 'card-amber' : 'card-green'}`}>
          <div className="outage-summary-num" style={{ color: trfDegraded > 0 ? '#f59e0b' : '#22c55e' }}>{trfDegraded}</div>
          <div className="outage-summary-label">Transformers Degraded</div>
        </div>
        <div className={`outage-summary-card card-green`}>
          <div className="outage-summary-num" style={{ color: '#22c55e' }}>{trfOk}</div>
          <div className="outage-summary-label">Transformers OK</div>
        </div>
        <div className={`outage-summary-card ${feedersDegraded > 0 ? 'card-amber' : 'card-green'}`}>
          <div className="outage-summary-num" style={{ color: feedersDegraded > 0 ? '#f59e0b' : '#22c55e' }}>{feedersDegraded}</div>
          <div className="outage-summary-label">Feeders Degraded</div>
        </div>
        <div className={`outage-summary-card ${outageExceptions.length > 0 ? 'card-red' : 'card-green'}`}>
          <div className="outage-summary-num" style={{ color: outageExceptions.length > 0 ? '#ef4444' : '#22c55e' }}>{outageExceptions.length}</div>
          <div className="outage-summary-label">Open Outage Exceptions</div>
        </div>
      </div>

      {/* View tabs */}
      <div className="outage-tabs">
        <button className={`outage-tab-btn ${activeView === 'tree' ? 'outage-tab-active' : ''}`} onClick={() => setActiveView('tree')}>
          ▤ TOPOLOGY TREE
        </button>
        <button className={`outage-tab-btn ${activeView === 'map' ? 'outage-tab-active' : ''}`} onClick={() => setActiveView('map')}>
          ◈ OUTAGE MAP
        </button>
      </div>

      {activeView === 'tree' && (
        <div className="outage-body">
          <div className="outage-tree-col">
            <TopologyTree grid={grid} selectedTrf={selectedTrf} onSelectTrf={setSelectedTrf} />
          </div>
          <div className="outage-detail-col">
            <TrfDetail trf={selectedTrf} meterStates={meterStates} />
            {outageExceptions.length > 0 && (
              <div className="outage-detail-card">
                <div className="outage-detail-title">Active Outage Exceptions ({outageExceptions.length})</div>
                {outageExceptions.map(e => (
                  <div key={e.id} style={{
                    padding: '6px 8px', marginBottom: 4,
                    border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.04)',
                    fontFamily: 'monospace', fontSize: 10,
                  }}>
                    <div style={{ fontWeight: 700, color: '#ef4444' }}>{e.id} — {e.extra?.transformerID}</div>
                    <div style={{ color: '#757575', marginTop: 2 }}>{e.detail}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeView === 'map' && (
        <OutageMap grid={grid} onSelectTrf={(trf) => { setSelectedTrf(trf); setActiveView('tree'); }} />
      )}
    </div>
  );
}
