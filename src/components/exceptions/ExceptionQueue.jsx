// ============================================================
// EXCEPTION QUEUE — Core Feature
// Sortable/filterable table + resolution workflow
// ============================================================

import { useState, useMemo, useCallback } from 'react';
import { METERS } from '../../data/meters.js';
import { EXCEPTION_TYPES, RESOLUTION_OPTIONS, generateIntervalData } from '../../engine/simulation.js';
import StatusBadge from '../shared/StatusBadge.jsx';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine
} from 'recharts';

// ---- Utility ----
function ageLabel(createdAt, simTime) {
  const ms = (simTime || Date.now()) - createdAt;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h === 0) return `${m}m`;
  if (h < 24) return `${h}h ${m}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

// ---- Mini interval sparkline inside resolution modal ----
function IntervalSparkline({ meter, intervalData }) {
  if (!meter || !intervalData) return null;
  const data = intervalData.map((kWh, i) => ({ i, kWh }));
  const color = meter.rateClass === 'Solar' ? '#00838F'
    : meter.rateClass === 'Commercial' ? '#1565C0' : '#FF9800';
  return (
    <ResponsiveContainer width="100%" height={90}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
        <defs>
          <linearGradient id="excGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
            <stop offset="95%" stopColor={color} stopOpacity={0.02}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 4" stroke="#E0E0E0" vertical={false}/>
        <XAxis dataKey="i" hide />
        <YAxis hide />
        <Tooltip
          contentStyle={{ background: '#FFFFFF', border: '1px solid #E0E0E0', fontFamily: 'monospace', fontSize: 10 }}
          formatter={v => [`${v.toFixed(4)} kWh`, 'Interval']}
        />
        <ReferenceLine y={meter.avgKWh / 96} stroke="rgba(255,152,0,0.5)" strokeDasharray="3 2"/>
        <Area type="monotone" dataKey="kWh" stroke={color} strokeWidth={1.5} fill="url(#excGrad)" dot={false}/>
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ---- Resolution Workflow Modal ----
function ResolutionModal({ exception, state, onResolve, onClose, onCreateFieldOrder }) {
  const [step, setStep] = useState(1); // 1=review, 2=resolve, 3=done
  const [selectedResolution, setSelectedResolution] = useState(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const meter = METERS.find(m => m.meterID === exception.meterID);
  const meterState = state?.meterStates?.[exception.meterID] || {};
  const intervalData = meterState.intervalData || (meter ? generateIntervalData(meter, 0.1) : []);

  // Billing history — last 6 months usage
  const billingHistory = useMemo(() => {
    if (!meter) return [];
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push({
        month: d.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
        kWh: Math.round(meter.avgKWh * (0.85 + Math.random() * 0.3) * 30),
      });
    }
    return months;
  }, [meter]);

  async function handleConfirm() {
    if (!selectedResolution || !note.trim()) return;
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 500));

    // If field order, also create it
    if (selectedResolution === 'FIELD_ORDER') {
      onCreateFieldOrder(
        exception.meterID,
        exception.accountNumber,
        `${exception.typeLabel} — ${exception.detail.slice(0, 80)}`
      );
    }

    onResolve(exception.id, selectedResolution, note);
    setStep(3);
    setSubmitting(false);
  }

  const resolutionOpts = RESOLUTION_OPTIONS.filter(opt => {
    // Context-sensitive: only show relevant options per exception type
    if (exception.type === 'TAMPER_ALERT') {
      return ['FIELD_ORDER', 'ESCALATE'].includes(opt.code);
    }
    if (exception.type === 'CT_RATIO_MISMATCH') {
      return ['FIELD_ORDER', 'ESCALATE', 'EDIT_DATA'].includes(opt.code);
    }
    if (exception.type === 'COMM_FAILURE' || exception.type === 'MISSING_READ') {
      return ['RETRY_COMM', 'ESTIMATE', 'FIELD_ORDER', 'ESCALATE'].includes(opt.code);
    }
    return true;
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>

        {/* Modal header */}
        <div className="modal-header">
          <div>
            <div className="modal-title">
              <span className={`exc-type-dot exc-dot-${exception.severity?.toLowerCase()}`}/>
              EXCEPTION RESOLUTION WORKFLOW
            </div>
            <div className="modal-subtitle">{exception.id} — {exception.typeLabel}</div>
          </div>
          <button className="btn-ghost" onClick={onClose}>✕ CLOSE</button>
        </div>

        {/* Step indicator */}
        <div className="modal-steps">
          {['REVIEW DATA', 'SELECT RESOLUTION', 'CONFIRMED'].map((label, i) => (
            <div key={i} className={`modal-step ${step === i + 1 ? 'step-active' : step > i + 1 ? 'step-done' : 'step-pending'}`}>
              <span className="step-num">{step > i + 1 ? '✓' : i + 1}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>

        {/* ---- STEP 1: Review Data ---- */}
        {step === 1 && (
          <div className="modal-body">
            <div className="modal-two-col">
              {/* Left: exception info */}
              <div className="modal-info-col">
                <div className="modal-section-title">EXCEPTION DETAILS</div>
                <div className="modal-kv-grid">
                  <span className="kv-key">EXCEPTION ID</span>
                  <span className="kv-val mono text-amber">{exception.id}</span>
                  <span className="kv-key">TYPE</span>
                  <span className="kv-val">{exception.typeLabel}</span>
                  <span className="kv-key">SEVERITY</span>
                  <span className="kv-val"><StatusBadge status={exception.severity} size="lg"/></span>
                  <span className="kv-key">BILLING IMPACT</span>
                  <span className="kv-val">
                    {exception.billingImpact
                      ? <span className="text-red">⚠ YES — Affects billing</span>
                      : <span className="text-dim">No direct billing impact</span>}
                  </span>
                  <span className="kv-key">CREATED</span>
                  <span className="kv-val mono">{new Date(exception.createdAt).toLocaleString()}</span>
                  <span className="kv-key">AGE</span>
                  <span className="kv-val mono text-amber">{ageLabel(exception.createdAt, state?.simTime)}</span>
                </div>

                <div className="modal-section-title" style={{ marginTop: 12 }}>EXCEPTION DESCRIPTION</div>
                <div className="modal-detail-box">{exception.detail}</div>

                <div className="modal-section-title" style={{ marginTop: 12 }}>AUDIT TRAIL</div>
                {exception.auditTrail?.map((entry, i) => (
                  <div key={i} className="audit-entry">
                    <span className="mono text-dim">{new Date(entry.ts).toLocaleTimeString('en-US', { hour12: false })}</span>
                    <span className="text-dim">[{entry.user}]</span>
                    <span>{entry.action}</span>
                  </div>
                ))}
              </div>

              {/* Right: meter + data context */}
              <div className="modal-data-col">
                <div className="modal-section-title">METER CONTEXT</div>
                <div className="modal-kv-grid">
                  <span className="kv-key">METER ID</span>
                  <span className="kv-val mono text-amber">{exception.meterID}</span>
                  <span className="kv-key">ACCOUNT #</span>
                  <span className="kv-val mono">{exception.accountNumber}</span>
                  <span className="kv-key">CUSTOMER</span>
                  <span className="kv-val">{exception.customerName}</span>
                  <span className="kv-key">ADDRESS</span>
                  <span className="kv-val">{exception.address}</span>
                  <span className="kv-key">RATE CLASS</span>
                  <span className="kv-val">
                    <span className={`rate-pill rate-${meter?.rateClass?.toLowerCase()}`}>{meter?.rateClass}</span>
                  </span>
                  <span className="kv-key">COLLECTOR</span>
                  <span className="kv-val mono">{meter?.collectorID}</span>
                  <span className="kv-key">COMM STATUS</span>
                  <span className="kv-val"><StatusBadge status={meterState.commStatus || 'Unknown'}/></span>
                  <span className="kv-key">SIGNAL</span>
                  <span className="kv-val mono">{meterState.signalLabel} ({(meterState.signalStrength || 0).toFixed(0)}%)</span>
                  <span className="kv-key">LAST HEARD</span>
                  <span className="kv-val mono">{meterState.lastHeard ? new Date(meterState.lastHeard).toLocaleTimeString('en-US', { hour12: false }) : '—'}</span>
                  <span className="kv-key">HIST AVG</span>
                  <span className="kv-val mono">{meter?.avgKWh} kWh/day</span>
                  {meter?.ctRatio && (
                    <>
                      <span className="kv-key">CT RATIO</span>
                      <span className="kv-val mono text-amber">{meter.ctRatio}:5</span>
                    </>
                  )}
                </div>

                <div className="modal-section-title" style={{ marginTop: 10 }}>24H INTERVAL DATA</div>
                <IntervalSparkline meter={meter} intervalData={intervalData} />

                <div className="modal-section-title" style={{ marginTop: 10 }}>BILLING HISTORY (6 MO)</div>
                <div className="billing-history-strip">
                  {billingHistory.map((b, i) => (
                    <div key={i} className="billing-month">
                      <div className="billing-month-label">{b.month}</div>
                      <div className="billing-month-bar-track">
                        <div className="billing-month-bar-fill"
                          style={{
                            height: `${Math.round((b.kWh / Math.max(...billingHistory.map(x => x.kWh))) * 100)}%`,
                            background: i === billingHistory.length - 1 ? '#FF9800' : '#1565C0',
                          }}
                        />
                      </div>
                      <div className="billing-month-val">{b.kWh}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-primary" onClick={() => setStep(2)}>
                PROCEED TO RESOLUTION →
              </button>
            </div>
          </div>
        )}

        {/* ---- STEP 2: Select resolution ---- */}
        {step === 2 && (
          <div className="modal-body">
            <div className="modal-section-title">SELECT RESOLUTION ACTION</div>
            <div className="resolution-options">
              {resolutionOpts.map(opt => (
                <div
                  key={opt.code}
                  className={`resolution-option ${selectedResolution === opt.code ? 'resolution-selected' : ''}`}
                  onClick={() => setSelectedResolution(opt.code)}
                >
                  <div className="resolution-opt-check">
                    {selectedResolution === opt.code ? '◉' : '○'}
                  </div>
                  <div className="resolution-opt-body">
                    <div className="resolution-opt-label">{opt.label}</div>
                    <div className="resolution-opt-desc">{opt.description}</div>
                  </div>
                  {opt.code === 'FIELD_ORDER' && (
                    <span className="resolution-badge badge-amber">FSO</span>
                  )}
                  {opt.code === 'ESCALATE' && (
                    <span className="resolution-badge badge-red">ESCALATE</span>
                  )}
                </div>
              ))}
            </div>

            <div className="modal-section-title" style={{ marginTop: 14 }}>
              ANALYST NOTE <span className="text-red">*required</span>
            </div>
            <textarea
              className="analyst-note"
              placeholder="Document your investigation findings and rationale for this resolution. Be specific — this note becomes part of the permanent audit trail."
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={4}
            />

            {selectedResolution === 'FIELD_ORDER' && (
              <div className="fso-notice">
                ⚠ Selecting this option will automatically create a Field Service Order (FSO) linked to {exception.meterID}. The order will appear in the CIS module and Field Orders list.
              </div>
            )}

            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setStep(1)}>← BACK</button>
              <button
                className="btn-primary"
                onClick={handleConfirm}
                disabled={!selectedResolution || !note.trim() || submitting}
              >
                {submitting ? '◌ PROCESSING...' : 'CONFIRM RESOLUTION →'}
              </button>
            </div>
          </div>
        )}

        {/* ---- STEP 3: Done ---- */}
        {step === 3 && (
          <div className="modal-body modal-done">
            <div className="done-icon">✓</div>
            <div className="done-title">EXCEPTION RESOLVED</div>
            <div className="done-id">{exception.id}</div>
            <div className="done-resolution">
              Resolution: <strong>{RESOLUTION_OPTIONS.find(r => r.code === selectedResolution)?.label}</strong>
            </div>
            {selectedResolution === 'FIELD_ORDER' && (
              <div className="done-fso">Field Service Order created and queued for dispatch.</div>
            )}
            <div className="done-note">Note logged to audit trail.</div>
            <button className="btn-primary" onClick={onClose} style={{ marginTop: 20 }}>
              CLOSE
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Resolved Exception Detail ----
function ResolvedDetail({ exception, onClose }) {
  if (!exception) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">RESOLVED EXCEPTION — AUDIT TRAIL</div>
            <div className="modal-subtitle">{exception.id} — {exception.typeLabel}</div>
          </div>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="modal-kv-grid" style={{ marginBottom: 12 }}>
            <span className="kv-key">METER ID</span>
            <span className="kv-val mono text-amber">{exception.meterID}</span>
            <span className="kv-key">CUSTOMER</span>
            <span className="kv-val">{exception.customerName}</span>
            <span className="kv-key">EXCEPTION TYPE</span>
            <span className="kv-val">{exception.typeLabel}</span>
            <span className="kv-key">RESOLUTION</span>
            <span className="kv-val text-green">
              {RESOLUTION_OPTIONS.find(r => r.code === exception.resolution)?.label || exception.resolution}
            </span>
            <span className="kv-key">RESOLVED AT</span>
            <span className="kv-val mono">{new Date(exception.updatedAt).toLocaleString()}</span>
          </div>
          <div className="modal-section-title">ANALYST NOTE</div>
          <div className="modal-detail-box" style={{ color: '#e2e8f0', marginBottom: 12 }}>
            {exception.note || <span className="text-dim">No note recorded</span>}
          </div>
          <div className="modal-section-title">FULL AUDIT TRAIL</div>
          {exception.auditTrail?.map((entry, i) => (
            <div key={i} className="audit-entry">
              <span className="mono text-dim">{new Date(entry.ts).toLocaleString()}</span>
              <span className="text-dim">[{entry.user}]</span>
              <span>{entry.action}</span>
              {entry.note && <div style={{ marginLeft: 24, color: '#94a3b8', fontSize: 10 }}>→ {entry.note}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Main Exception Queue ----
export default function ExceptionQueue({ state, derived, onResolve, onCreateFieldOrder }) {
  const [activeTab, setActiveTab]       = useState('open');   // 'open' | 'resolved'
  const [filterType, setFilterType]     = useState('ALL');
  const [filterSeverity, setFilterSev]  = useState('ALL');
  const [search, setSearch]             = useState('');
  const [sortCol, setSortCol]           = useState('createdAt');
  const [sortDir, setSortDir]           = useState('desc');
  const [selectedExc, setSelectedExc]   = useState(null);    // for resolution modal
  const [selectedResolved, setSelectedResolved] = useState(null); // for resolved detail

  const simTime = state?.simTime || Date.now();

  const openExceptions     = state?.exceptions || [];
  const resolvedExceptions = state?.resolvedExceptions || [];

  // All unique types in open exceptions
  const typeOptions = useMemo(() => {
    const types = new Set(openExceptions.map(e => e.type));
    return ['ALL', ...Array.from(types)];
  }, [openExceptions]);

  // Filter + sort open exceptions
  const filteredOpen = useMemo(() => {
    let list = [...openExceptions];
    if (filterType !== 'ALL')     list = list.filter(e => e.type === filterType);
    if (filterSeverity !== 'ALL') list = list.filter(e => e.severity === filterSeverity);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(e =>
        e.id.toLowerCase().includes(q) ||
        e.meterID.toLowerCase().includes(q) ||
        e.typeLabel?.toLowerCase().includes(q) ||
        e.customerName?.toLowerCase().includes(q) ||
        e.accountNumber?.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      let av, bv;
      switch (sortCol) {
        case 'id':          av = a.id;           bv = b.id;           break;
        case 'meterID':     av = a.meterID;      bv = b.meterID;      break;
        case 'type':        av = a.typeLabel;    bv = b.typeLabel;    break;
        case 'severity':    av = a.severity;     bv = b.severity;     break;
        case 'createdAt':   av = a.createdAt;    bv = b.createdAt;    break;
        case 'billing':     av = a.billingImpact; bv = b.billingImpact; break;
        default: av = a.createdAt; bv = b.createdAt;
      }
      if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      if (typeof av === 'boolean') return sortDir === 'asc' ? (av ? 1 : -1) : (av ? -1 : 1);
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return list;
  }, [openExceptions, filterType, filterSeverity, search, sortCol, sortDir]);

  // Filter + sort resolved exceptions
  const filteredResolved = useMemo(() => {
    let list = [...resolvedExceptions];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(e =>
        e.id.toLowerCase().includes(q) ||
        e.meterID.toLowerCase().includes(q) ||
        e.typeLabel?.toLowerCase().includes(q) ||
        e.customerName?.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [resolvedExceptions, search]);

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  }

  function SortIcon({ col }) {
    if (sortCol !== col) return <span style={{ color: '#BDBDBD', marginLeft: 3 }}>↕</span>;
    return <span style={{ color: '#00838F', marginLeft: 3 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  // Severity color helper
  function excRowClass(exc) {
    if (exc.severity === 'Error') return 'exc-row-error';
    if (exc.severity === 'Warning') return 'exc-row-warning';
    return '';
  }

  const errorCount   = openExceptions.filter(e => e.severity === 'Error').length;
  const warningCount = openExceptions.filter(e => e.severity === 'Warning').length;
  const billingCount = openExceptions.filter(e => e.billingImpact).length;

  return (
    <div className="excq-layout">
      {/* Metrics strip */}
      <div className="excq-metrics">
        <div className="excq-metric">
          <span className="excq-metric-val text-red">{openExceptions.length}</span>
          <span className="excq-metric-key">OPEN EXCEPTIONS</span>
        </div>
        <div className="excq-metric">
          <span className="excq-metric-val text-red">{errorCount}</span>
          <span className="excq-metric-key">ERRORS</span>
        </div>
        <div className="excq-metric">
          <span className="excq-metric-val text-amber">{warningCount}</span>
          <span className="excq-metric-key">WARNINGS</span>
        </div>
        <div className="excq-metric">
          <span className="excq-metric-val text-amber">{billingCount}</span>
          <span className="excq-metric-key">BILLING IMPACT</span>
        </div>
        <div className="excq-metric">
          <span className="excq-metric-val text-green">{derived?.resolvedToday || 0}</span>
          <span className="excq-metric-key">RESOLVED TODAY</span>
        </div>
        <div className="excq-metric">
          <span className="excq-metric-val">{derived?.avgResolutionMinutes || 0}m</span>
          <span className="excq-metric-key">AVG RESOLUTION</span>
        </div>
        <div className="excq-metric">
          <span className="excq-metric-val" style={{ color: derived?.billingReadinessPct >= 95 ? '#2E7D32' : '#FF9800' }}>
            {derived?.billingReadinessPct || 0}%
          </span>
          <span className="excq-metric-key">BILLING READINESS</span>
        </div>
        <div className="excq-metric">
          <span className="excq-metric-val">{resolvedExceptions.length}</span>
          <span className="excq-metric-key">TOTAL RESOLVED</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="excq-tab-bar">
        <button
          className={`excq-tab ${activeTab === 'open' ? 'excq-tab-active' : ''}`}
          onClick={() => setActiveTab('open')}
        >
          OPEN EXCEPTIONS
          {openExceptions.length > 0 && (
            <span className="nav-badge" style={{ marginLeft: 8, position: 'static' }}>
              {openExceptions.length}
            </span>
          )}
        </button>
        <button
          className={`excq-tab ${activeTab === 'resolved' ? 'excq-tab-active' : ''}`}
          onClick={() => setActiveTab('resolved')}
        >
          RESOLVED HISTORY
          {resolvedExceptions.length > 0 && (
            <span style={{ marginLeft: 8, fontSize: 9, color: '#22c55e' }}>({resolvedExceptions.length})</span>
          )}
        </button>
      </div>

      {/* Toolbar */}
      <div className="excq-toolbar">
        <div className="excq-filters">
          {/* Type filter */}
          <select
            className="vee-select"
            style={{ width: 'auto', minWidth: 180 }}
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            <option value="ALL">ALL TYPES</option>
            {Object.values(EXCEPTION_TYPES).map(t => (
              <option key={t.code} value={t.code}>{t.label}</option>
            ))}
          </select>

          {/* Severity filter */}
          <select
            className="vee-select"
            style={{ width: 'auto', minWidth: 130 }}
            value={filterSeverity}
            onChange={e => setFilterSev(e.target.value)}
          >
            <option value="ALL">ALL SEVERITIES</option>
            <option value="Error">Error Only</option>
            <option value="Warning">Warning Only</option>
          </select>
        </div>

        <input
          className="headend-search"
          placeholder="Search exception ID, meter, customer, account..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#475569', whiteSpace: 'nowrap' }}>
          {activeTab === 'open' ? filteredOpen.length : filteredResolved.length} records
        </div>
      </div>

      {/* ---- OPEN EXCEPTIONS TABLE ---- */}
      {activeTab === 'open' && (
        <div className="excq-table-wrapper">
          <table className="data-table excq-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('id')} style={{ cursor: 'pointer' }}>
                  EXCEPTION ID <SortIcon col="id"/>
                </th>
                <th onClick={() => handleSort('meterID')} style={{ cursor: 'pointer' }}>
                  METER ID <SortIcon col="meterID"/>
                </th>
                <th>CUSTOMER</th>
                <th onClick={() => handleSort('type')} style={{ cursor: 'pointer' }}>
                  TYPE <SortIcon col="type"/>
                </th>
                <th onClick={() => handleSort('severity')} style={{ cursor: 'pointer' }}>
                  SEVERITY <SortIcon col="severity"/>
                </th>
                <th onClick={() => handleSort('createdAt')} style={{ cursor: 'pointer' }}>
                  AGE <SortIcon col="createdAt"/>
                </th>
                <th onClick={() => handleSort('billing')} style={{ cursor: 'pointer' }}>
                  BILLING <SortIcon col="billing"/>
                </th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredOpen.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-row">
                    {openExceptions.length === 0
                      ? '✓ No open exceptions — all meters clean'
                      : 'No exceptions match current filters'}
                  </td>
                </tr>
              )}
              {filteredOpen.map(exc => (
                <tr
                  key={exc.id}
                  className={`excq-row ${excRowClass(exc)}`}
                  onClick={() => setSelectedExc(exc)}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="mono text-amber">{exc.id}</td>
                  <td className="mono">{exc.meterID}</td>
                  <td>
                    <div style={{ fontWeight: 500, fontSize: 11 }}>{exc.customerName}</div>
                    <div className="text-dim" style={{ fontSize: 9 }}>{exc.accountNumber}</div>
                  </td>
                  <td>
                    <span className={`exc-type-badge exc-type-${exc.type}`}>
                      {exc.typeLabel}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={exc.severity} />
                  </td>
                  <td className="mono">
                    <span className={exc.severity === 'Error' ? 'text-red' : 'text-amber'}>
                      {ageLabel(exc.createdAt, simTime)}
                    </span>
                  </td>
                  <td>
                    {exc.billingImpact
                      ? <span className="text-red" style={{ fontFamily: 'monospace', fontSize: 9, fontWeight: 700 }}>⚠ YES</span>
                      : <span className="text-dim" style={{ fontFamily: 'monospace', fontSize: 9 }}>—</span>}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <button
                      className="btn-primary"
                      style={{ fontSize: 9, padding: '3px 8px' }}
                      onClick={() => setSelectedExc(exc)}
                    >
                      RESOLVE →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---- RESOLVED EXCEPTIONS TABLE ---- */}
      {activeTab === 'resolved' && (
        <div className="excq-table-wrapper">
          <table className="data-table excq-table">
            <thead>
              <tr>
                <th>EXCEPTION ID</th>
                <th>METER ID</th>
                <th>CUSTOMER</th>
                <th>TYPE</th>
                <th>RESOLUTION</th>
                <th>RESOLVED AT</th>
                <th>AUDIT</th>
              </tr>
            </thead>
            <tbody>
              {filteredResolved.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-row">
                    No resolved exceptions yet — work through the open queue above
                  </td>
                </tr>
              )}
              {filteredResolved.map(exc => (
                <tr
                  key={exc.id}
                  className="excq-row excq-row-resolved"
                  onClick={() => setSelectedResolved(exc)}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="mono text-dim">{exc.id}</td>
                  <td className="mono">{exc.meterID}</td>
                  <td style={{ fontSize: 11 }}>{exc.customerName}</td>
                  <td>
                    <span className={`exc-type-badge exc-type-${exc.type}`} style={{ opacity: 0.7 }}>
                      {exc.typeLabel}
                    </span>
                  </td>
                  <td>
                    <span className="text-green mono" style={{ fontSize: 10 }}>
                      ✓ {RESOLUTION_OPTIONS.find(r => r.code === exc.resolution)?.label || exc.resolution}
                    </span>
                  </td>
                  <td className="mono text-dim">
                    {new Date(exc.updatedAt).toLocaleString('en-US', {
                      month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit', hour12: false
                    })}
                  </td>
                  <td>
                    <button
                      className="btn-ghost"
                      style={{ fontSize: 9, padding: '2px 6px' }}
                      onClick={() => setSelectedResolved(exc)}
                    >
                      VIEW →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Resolution modal */}
      {selectedExc && (
        <ResolutionModal
          exception={selectedExc}
          state={state}
          onResolve={(id, res, note) => {
            onResolve(id, res, note);
            setSelectedExc(null);
          }}
          onClose={() => setSelectedExc(null)}
          onCreateFieldOrder={onCreateFieldOrder}
        />
      )}

      {/* Resolved detail modal */}
      {selectedResolved && (
        <ResolvedDetail
          exception={selectedResolved}
          onClose={() => setSelectedResolved(null)}
        />
      )}
    </div>
  );
}
