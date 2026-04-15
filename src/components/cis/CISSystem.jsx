// ============================================================
// CIS — CUSTOMER INFORMATION SYSTEM
// Account lookup, billing history, field service orders
// ============================================================

import { useState, useMemo } from 'react';
import { METERS } from '../../data/meters.js';
import StatusBadge from '../shared/StatusBadge.jsx';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';

// ---- Generate 12-month billing history ----
function buildBillingHistory(meter) {
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const seasonal = 1 + 0.3 * Math.sin(((d.getMonth() - 6) / 6) * Math.PI); // summer peak
    const kWh   = Math.round(meter.avgKWh * seasonal * (0.9 + Math.random() * 0.2) * 30);
    const rate  = meter.rateClass === 'Commercial' ? 0.14 : 0.12;
    const amount = parseFloat((kWh * rate + 12.50).toFixed(2)); // base charge $12.50
    months.push({
      month: d.toLocaleString('en-US', { month: 'short' }),
      year:  d.getFullYear(),
      label: d.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
      kWh,
      amount,
      status: Math.random() > 0.05 ? 'Paid' : 'Overdue',
      dueDate: new Date(d.getFullYear(), d.getMonth() + 1, 15).toLocaleDateString('en-US'),
    });
  }
  return months;
}

// ---- Build service history ----
function buildServiceHistory(meter) {
  const events = [
    { type: 'METER_INSTALL',   label: 'AMI Meter Installed',            icon: '⚙' },
    { type: 'COMM_ISSUE',      label: 'Communication Issue Reported',   icon: '⚠' },
    { type: 'FSO_COMPLETE',    label: 'Field Service Order Completed',  icon: '✓' },
    { type: 'RATE_CHANGE',     label: 'Rate Plan Updated',              icon: '≋' },
    { type: 'BILLING_DISPUTE', label: 'Billing Dispute Opened/Closed',  icon: '☰' },
  ];
  const count = 3 + Math.floor(Math.random() * 4);
  const result = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - Math.floor(Math.random() * 24));
    const evt = events[i % events.length];
    result.push({
      ...evt,
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      ts: d.getTime(),
    });
  }
  result.push({
    type: 'METER_INSTALL',
    label: 'AMI Meter Installed',
    icon: '⚙',
    date: new Date(meter.installDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    ts: new Date(meter.installDate).getTime(),
  });
  return result.sort((a, b) => b.ts - a.ts);
}

// ---- Field Order Form ----
function FieldOrderForm({ meter, onSubmit, onCancel }) {
  const ISSUE_TYPES = [
    'No Read / Communication Failure',
    'Tamper / Suspected Bypass',
    'CT Ratio Verification',
    'Meter Not Advancing',
    'Physical Meter Damage',
    'Meter Exchange Required',
    'Site Access Issue',
    'New Service Connection',
    'Other (see notes)',
  ];
  const [issueType, setIssueType] = useState(ISSUE_TYPES[0]);
  const [priority, setPriority]   = useState('Normal');
  const [notes, setNotes]         = useState('');

  function handleSubmit() {
    if (!notes.trim()) return;
    onSubmit(`${issueType} — ${notes}`);
  }

  return (
    <div className="cis-fso-form">
      <div className="cis-fso-form-title">NEW FIELD SERVICE ORDER — {meter.meterID}</div>

      <label className="vee-label">ISSUE TYPE</label>
      <select className="vee-select" value={issueType} onChange={e => setIssueType(e.target.value)}>
        {ISSUE_TYPES.map(t => <option key={t}>{t}</option>)}
      </select>

      <label className="vee-label" style={{ marginTop: 10 }}>PRIORITY</label>
      <div style={{ display: 'flex', gap: 6 }}>
        {['Normal', 'Urgent', 'Emergency'].map(p => (
          <button
            key={p}
            className={`rfmesh-filter-btn ${priority === p ? 'rfmesh-filter-active' : ''}`}
            onClick={() => setPriority(p)}
            style={{ flex: 1 }}
          >
            {p.toUpperCase()}
          </button>
        ))}
      </div>

      <label className="vee-label" style={{ marginTop: 10 }}>WORK ORDER NOTES <span className="text-red">*required</span></label>
      <textarea
        className="analyst-note"
        placeholder="Describe the issue, access instructions, safety notes, or anything the technician needs to know..."
        value={notes}
        onChange={e => setNotes(e.target.value)}
        rows={4}
      />

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn-primary" onClick={handleSubmit} disabled={!notes.trim()} style={{ flex: 2 }}>
          CREATE FIELD ORDER
        </button>
        <button className="btn-ghost" onClick={onCancel} style={{ flex: 1 }}>CANCEL</button>
      </div>
    </div>
  );
}

// ---- Account Detail Panel ----
function AccountDetail({ meter, meterState, state, onCreateFieldOrder, onClose }) {
  const [view, setView]           = useState('overview'); // 'overview' | 'billing' | 'service' | 'fso'
  const [fsoSubmitted, setFSOSubmitted] = useState(false);

  const billingHistory = useMemo(() => buildBillingHistory(meter), [meter.meterID]);
  const serviceHistory = useMemo(() => buildServiceHistory(meter), [meter.meterID]);

  const openExceptions = (state?.exceptions || []).filter(e => e.meterID === meter.meterID);
  const meterOrders   = (state?.fieldOrders || []).filter(o => o.meterID === meter.meterID);

  const totalBilled    = billingHistory.reduce((s, m) => s + m.amount, 0).toFixed(2);
  const avgMonthlyKWh  = Math.round(billingHistory.reduce((s, m) => s + m.kWh, 0) / 12);
  const hasOverdue     = billingHistory.some(m => m.status === 'Overdue');

  function handleFSOSubmit(issue) {
    onCreateFieldOrder(meter.meterID, meter.accountNumber, issue);
    setFSOSubmitted(true);
    setTimeout(() => { setFSOSubmitted(false); setView('overview'); }, 2500);
  }

  return (
    <div className="cis-detail-panel">
      <div className="cis-detail-header">
        <div>
          <div className="cis-detail-name">{meter.customerName}</div>
          <div className="cis-detail-sub">{meter.address}</div>
        </div>
        <div className="cis-detail-badges">
          <span className={`rate-pill rate-${meter.rateClass.toLowerCase()}`}>{meter.rateClass}</span>
          {hasOverdue && <span className="badge badge-red">OVERDUE BALANCE</span>}
          {openExceptions.length > 0 && (
            <span className="badge badge-amber">{openExceptions.length} OPEN EXCEPTION{openExceptions.length > 1 ? 'S' : ''}</span>
          )}
        </div>
        <button className="btn-ghost" onClick={onClose}>✕</button>
      </div>

      {/* Account meta strip */}
      <div className="cis-meta-strip">
        <div className="cis-meta-item">
          <span className="cis-meta-key">ACCOUNT #</span>
          <span className="cis-meta-val mono text-amber">{meter.accountNumber}</span>
        </div>
        <div className="cis-meta-item">
          <span className="cis-meta-key">METER ID</span>
          <span className="cis-meta-val mono">{meter.meterID}</span>
        </div>
        <div className="cis-meta-item">
          <span className="cis-meta-key">COLLECTOR</span>
          <span className="cis-meta-val mono">{meter.collectorID}</span>
        </div>
        <div className="cis-meta-item">
          <span className="cis-meta-key">INSTALL DATE</span>
          <span className="cis-meta-val mono">{meter.installDate}</span>
        </div>
        <div className="cis-meta-item">
          <span className="cis-meta-key">FIRMWARE</span>
          <span className="cis-meta-val mono">{meter.firmwareVersion}</span>
        </div>
        {meter.ctRatio && (
          <div className="cis-meta-item">
            <span className="cis-meta-key">CT RATIO</span>
            <span className="cis-meta-val mono text-amber">{meter.ctRatio}:5</span>
          </div>
        )}
        <div className="cis-meta-item">
          <span className="cis-meta-key">COMM STATUS</span>
          <span className="cis-meta-val"><StatusBadge status={meterState?.commStatus || 'Unknown'}/></span>
        </div>
        <div className="cis-meta-item">
          <span className="cis-meta-key">12-MO AVG</span>
          <span className="cis-meta-val mono">{avgMonthlyKWh} kWh/mo</span>
        </div>
        <div className="cis-meta-item">
          <span className="cis-meta-key">12-MO BILLED</span>
          <span className="cis-meta-val mono text-green">${totalBilled}</span>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="cis-subtabs">
        {[
          { id: 'overview', label: 'OVERVIEW' },
          { id: 'billing',  label: 'BILLING HISTORY' },
          { id: 'service',  label: 'SERVICE HISTORY' },
          { id: 'fso',      label: '+ FIELD ORDER' },
        ].map(t => (
          <button
            key={t.id}
            className={`excq-tab ${view === t.id ? 'excq-tab-active' : ''}`}
            onClick={() => setView(t.id)}
            style={{ fontSize: 9 }}
          >
            {t.label}
            {t.id === 'fso' && meterOrders.length > 0 && (
              <span style={{ marginLeft: 5, color: '#00838F', fontSize: 9 }}>({meterOrders.length})</span>
            )}
          </button>
        ))}
      </div>

      <div className="cis-detail-body">
        {/* ---- OVERVIEW ---- */}
        {view === 'overview' && (
          <div className="cis-overview-grid">
            {/* Open exceptions */}
            <div className="cis-overview-section">
              <div className="modal-section-title">OPEN EXCEPTIONS ({openExceptions.length})</div>
              {openExceptions.length === 0 ? (
                <div className="text-green mono" style={{ fontSize: 11, padding: 8 }}>✓ No open exceptions on this account</div>
              ) : openExceptions.map(exc => (
                <div key={exc.id} className={`cis-exc-row exc-row-${exc.severity?.toLowerCase()}`}>
                  <span className="mono text-amber">{exc.id}</span>
                  <span className={`exc-type-badge exc-type-${exc.type}`}>{exc.typeLabel}</span>
                  <StatusBadge status={exc.severity}/>
                  <span className="text-dim mono" style={{ fontSize: 9 }}>{new Date(exc.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>

            {/* Open field orders */}
            <div className="cis-overview-section">
              <div className="modal-section-title">FIELD ORDERS ({meterOrders.length})</div>
              {meterOrders.length === 0 ? (
                <div className="text-dim mono" style={{ fontSize: 11, padding: 8 }}>No field orders on this account</div>
              ) : meterOrders.map(order => (
                <div key={order.id} className="cis-forder-row">
                  <span className="mono text-amber">{order.id}</span>
                  <StatusBadge status={order.status}/>
                  <span className="text-dim" style={{ fontSize: 10, flex: 1 }}>{order.issue.slice(0, 60)}…</span>
                  <span className="text-dim mono" style={{ fontSize: 9 }}>{new Date(order.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>

            {/* Rate plan info */}
            <div className="cis-overview-section">
              <div className="modal-section-title">RATE PLAN</div>
              <div className="modal-kv-grid" style={{ fontSize: 10 }}>
                <span className="kv-key">PLAN</span>
                <span className="kv-val">{meter.rateClass === 'Commercial' ? 'G-1 General Service' : meter.rateClass === 'Solar' ? 'R-NEM Net Metering' : 'R-1 Residential'}</span>
                <span className="kv-key">BASE CHARGE</span>
                <span className="kv-val mono">$12.50 / month</span>
                <span className="kv-key">ENERGY RATE</span>
                <span className="kv-val mono">{meter.rateClass === 'Commercial' ? '$0.1400' : '$0.1200'} / kWh</span>
                <span className="kv-key">HIST AVG USAGE</span>
                <span className="kv-val mono">{meter.avgKWh} kWh/day</span>
                {meter.rateClass === 'Solar' && (
                  <>
                    <span className="kv-key">EXPORT CREDIT</span>
                    <span className="kv-val mono text-cyan">$0.0900 / kWh</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ---- BILLING HISTORY ---- */}
        {view === 'billing' && (
          <div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={billingHistory} margin={{ top: 4, right: 8, bottom: 4, left: 30 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#E0E0E0" vertical={false}/>
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#757575', fontFamily: 'monospace' }}/>
                <YAxis tick={{ fontSize: 9, fill: '#757575', fontFamily: 'monospace' }}
                  tickFormatter={v => `${v}`}
                  label={{ value: 'kWh', angle: -90, position: 'insideLeft', fill: '#757575', fontSize: 9, fontFamily: 'monospace' }}
                />
                <Tooltip
                  contentStyle={{ background: '#FFFFFF', border: '1px solid #E0E0E0', fontFamily: 'monospace', fontSize: 10 }}
                  formatter={(v, n) => [v, n === 'kWh' ? 'kWh Usage' : 'Amount']}
                />
                <Bar dataKey="kWh" fill="#FF9800" />
              </BarChart>
            </ResponsiveContainer>

            <table className="data-table" style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>PERIOD</th>
                  <th>USAGE (kWh)</th>
                  <th>AMOUNT</th>
                  <th>DUE DATE</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {billingHistory.slice().reverse().map((row, i) => (
                  <tr key={i} className={row.status === 'Overdue' ? 'exc-row-error' : ''}>
                    <td className="mono">{row.label}</td>
                    <td className="mono text-blue">{row.kWh.toLocaleString()}</td>
                    <td className="mono text-green">${row.amount.toFixed(2)}</td>
                    <td className="mono text-dim">{row.dueDate}</td>
                    <td><StatusBadge status={row.status === 'Paid' ? 'Passed' : 'Warning'}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ---- SERVICE HISTORY ---- */}
        {view === 'service' && (
          <div className="cis-service-timeline">
            {serviceHistory.map((evt, i) => (
              <div key={i} className="cis-timeline-item">
                <div className="cis-timeline-icon">{evt.icon}</div>
                <div className="cis-timeline-line" />
                <div className="cis-timeline-body">
                  <div className="cis-timeline-label">{evt.label}</div>
                  <div className="cis-timeline-date mono text-dim">{evt.date}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ---- FIELD SERVICE ORDER ---- */}
        {view === 'fso' && !fsoSubmitted && (
          <div>
            {meterOrders.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div className="modal-section-title">EXISTING ORDERS</div>
                {meterOrders.map(order => (
                  <div key={order.id} className="cis-forder-row">
                    <span className="mono text-amber">{order.id}</span>
                    <StatusBadge status={order.status}/>
                    <span className="text-dim" style={{ fontSize: 10, flex: 1 }}>{order.issue}</span>
                    <span className="text-dim mono" style={{ fontSize: 9 }}>{new Date(order.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
            <FieldOrderForm meter={meter} onSubmit={handleFSOSubmit} onCancel={() => setView('overview')} />
          </div>
        )}

        {view === 'fso' && fsoSubmitted && (
          <div className="modal-done" style={{ minHeight: 200 }}>
            <div className="done-icon" style={{ fontSize: 40 }}>✓</div>
            <div className="done-title">FIELD ORDER CREATED</div>
            <div className="done-note">Order queued for dispatch. Returning to overview...</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Main CIS ----
export default function CISSystem({ state, onCreateFieldOrder }) {
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState(null);

  const meterStates = state?.meterStates || {};

  // Search meters
  const results = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.trim().toLowerCase();
    return METERS.filter(m =>
      m.accountNumber.toLowerCase().includes(q) ||
      m.meterID.toLowerCase().includes(q) ||
      m.customerName.toLowerCase().includes(q) ||
      m.address.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [search]);

  // All meters list (browseable when no search)
  const allMeters = useMemo(() => {
    if (search.trim()) return [];
    return METERS;
  }, [search]);

  const displayList = search.trim() ? results : allMeters;

  // Counts
  const overdueAccounts = METERS.filter(m => {
    // Just simulate: commercial with high avgKWh have small chance of overdue
    return m.rateClass === 'Commercial' && m.avgKWh > 500 && Math.random() < 0.3;
  }).length;

  const openFSOCount = (state?.fieldOrders || []).filter(o => o.status !== 'Complete').length;
  const pendingFSOs  = (state?.fieldOrders || []).filter(o => o.status === 'Pending').length;

  return (
    <div className="cis-layout">
      {/* CIS stats bar */}
      <div className="cis-stats-bar">
        <div className="cis-stat">
          <span className="cis-stat-val">{METERS.length}</span>
          <span className="cis-stat-key">TOTAL ACCOUNTS</span>
        </div>
        <div className="cis-stat">
          <span className="cis-stat-val text-amber">{openFSOCount}</span>
          <span className="cis-stat-key">OPEN FIELD ORDERS</span>
        </div>
        <div className="cis-stat">
          <span className="cis-stat-val text-amber">{pendingFSOs}</span>
          <span className="cis-stat-key">PENDING DISPATCH</span>
        </div>
        <div className="cis-stat">
          <span className="cis-stat-val text-red">{(state?.exceptions || []).length}</span>
          <span className="cis-stat-key">ACCOUNTS WITH EXCEPTIONS</span>
        </div>
        <div className="cis-stat">
          <span className="cis-stat-val text-cyan">{METERS.filter(m => m.rateClass === 'Solar').length}</span>
          <span className="cis-stat-key">SOLAR NET METERING</span>
        </div>
        <div className="cis-stat">
          <span className="cis-stat-val text-purple">{METERS.filter(m => m.rateClass === 'Commercial').length}</span>
          <span className="cis-stat-key">COMMERCIAL ACCOUNTS</span>
        </div>
      </div>

      <div className="cis-body">
        {/* Left: search + account list */}
        <div className="cis-left">
          <div className="cis-search-box">
            <div className="cis-search-label">ACCOUNT LOOKUP</div>
            <input
              className="headend-search"
              style={{ fontSize: 12 }}
              placeholder="Search by account #, meter ID, name, or address..."
              value={search}
              onChange={e => { setSearch(e.target.value); setSelected(null); }}
              autoFocus
            />
            {search.trim() && (
              <div className="cis-search-count">
                {results.length} result{results.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          <div className="cis-account-list">
            {!search.trim() && (
              <div className="cis-browse-label">BROWSE ALL ACCOUNTS</div>
            )}
            {displayList.map(m => {
              const ms = meterStates[m.meterID] || {};
              const hasExc = (state?.exceptions || []).some(e => e.meterID === m.meterID);
              const hasFSO = (state?.fieldOrders || []).some(o => o.meterID === m.meterID && o.status !== 'Complete');
              return (
                <div
                  key={m.meterID}
                  className={`cis-account-row ${selected?.meterID === m.meterID ? 'cis-account-active' : ''}`}
                  onClick={() => setSelected(m)}
                >
                  <div className="cis-account-top">
                    <span className="cis-account-name">{m.customerName}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {hasExc && <span className="badge badge-red" style={{ fontSize: 7 }}>EXC</span>}
                      {hasFSO && <span className="badge badge-amber" style={{ fontSize: 7 }}>FSO</span>}
                      <span className={`rate-pill rate-${m.rateClass.toLowerCase()}`} style={{ fontSize: 7 }}>{m.rateClass.slice(0, 4)}</span>
                    </div>
                  </div>
                  <div className="cis-account-sub">
                    <span className="mono text-dim" style={{ fontSize: 9 }}>{m.accountNumber}</span>
                    <span className="mono text-dim" style={{ fontSize: 9 }}>{m.meterID}</span>
                  </div>
                  <div className="cis-account-addr">{m.address}</div>
                  <div className="cis-account-status">
                    <StatusBadge status={ms.commStatus || 'Unknown'} />
                  </div>
                </div>
              );
            })}
            {search.trim() && results.length === 0 && (
              <div className="text-dim mono" style={{ fontSize: 11, padding: 16, textAlign: 'center' }}>
                No accounts found matching "{search}"
              </div>
            )}
          </div>
        </div>

        {/* Right: account detail */}
        <div className="cis-right">
          {!selected ? (
            <div className="cis-no-selection">
              <div style={{ fontSize: 40, opacity: 0.3 }}>☰</div>
              <div>Select an account to view details</div>
              <div style={{ fontSize: 10, opacity: 0.5, marginTop: 4 }}>
                Search by name, account number, meter ID, or address
              </div>
            </div>
          ) : (
            <AccountDetail
              meter={selected}
              meterState={meterStates[selected.meterID]}
              state={state}
              onCreateFieldOrder={onCreateFieldOrder}
              onClose={() => setSelected(null)}
            />
          )}
        </div>
      </div>

      {/* Global field orders panel */}
      {(state?.fieldOrders || []).length > 0 && (
        <div className="cis-fso-global">
          <div className="panel-title">ALL OPEN FIELD SERVICE ORDERS</div>
          <div className="headend-table-wrapper" style={{ maxHeight: 180 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ORDER #</th>
                  <th>METER ID</th>
                  <th>CUSTOMER</th>
                  <th>ISSUE</th>
                  <th>STATUS</th>
                  <th>CREATED</th>
                </tr>
              </thead>
              <tbody>
                {(state.fieldOrders || []).map(order => (
                  <tr key={order.id}>
                    <td className="mono text-amber">{order.id}</td>
                    <td className="mono">{order.meterID}</td>
                    <td>{order.customerName}</td>
                    <td style={{ maxWidth: 240 }} className="text-dim">{order.issue.slice(0, 60)}{order.issue.length > 60 ? '…' : ''}</td>
                    <td><StatusBadge status={order.status}/></td>
                    <td className="mono text-dim">
                      {new Date(order.createdAt).toLocaleString('en-US', {
                        month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit', hour12: false
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
