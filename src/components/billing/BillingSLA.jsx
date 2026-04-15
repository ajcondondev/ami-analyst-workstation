// ============================================================
// BILLING SLA DASHBOARD
// Billing cycle countdown, exception aging, SLA metrics
// ============================================================

import { useState, useMemo } from 'react';
import { METERS } from '../../data/meters.js';

const SLA_THRESHOLDS = { green: 24, yellow: 48, orange: 72 }; // hours

function getAgeCategory(ageHours) {
  if (ageHours <= SLA_THRESHOLDS.green)  return 'green';
  if (ageHours <= SLA_THRESHOLDS.yellow) return 'yellow';
  if (ageHours <= SLA_THRESHOLDS.orange) return 'orange';
  return 'red';
}

function formatAge(ageHours) {
  if (ageHours < 1)   return `${Math.round(ageHours * 60)}m`;
  if (ageHours < 24)  return `${ageHours.toFixed(1)}h`;
  return `${(ageHours / 24).toFixed(1)}d`;
}

function getSlaPct(ageHours, threshold) {
  return Math.min(100, Math.round((ageHours / threshold) * 100));
}

export default function BillingSLA({ state, derived }) {
  const [billingDay, setBillingDay] = useState(() => {
    const stored = localStorage.getItem('ami_billing_day');
    return stored ? parseInt(stored, 10) : 15;
  });
  const [sortBy, setSortBy] = useState('age'); // 'age' | 'severity' | 'type'

  const simNow = state?.simTime ? new Date(state.simTime) : new Date();

  // Billing cycle countdown
  const billingDeadline = useMemo(() => {
    const d = new Date(simNow);
    d.setDate(billingDay);
    d.setHours(23, 59, 59, 0);
    if (d <= simNow) d.setMonth(d.getMonth() + 1);
    return d;
  }, [simNow, billingDay]);

  const daysUntilClose = Math.max(0, (billingDeadline - simNow) / (1000 * 60 * 60 * 24));
  const urgency = daysUntilClose <= 1 ? 'high' : daysUntilClose <= 3 ? 'med' : 'low';

  // Exception aging
  const openExceptions = useMemo(() => {
    return (state?.exceptions || [])
      .filter(e => e.status === 'Open')
      .map(e => {
        const ageHours = (simNow - new Date(e.createdAt)) / 3600000;
        return { ...e, ageHours, ageCategory: getAgeCategory(ageHours) };
      });
  }, [state?.exceptions, simNow]);

  const sortedExceptions = useMemo(() => {
    const list = [...openExceptions];
    if (sortBy === 'age') return list.sort((a, b) => b.ageHours - a.ageHours);
    if (sortBy === 'severity') return list.sort((a, b) => {
      const sev = { Error: 0, Warning: 1 };
      return (sev[a.severity] ?? 2) - (sev[b.severity] ?? 2);
    });
    return list.sort((a, b) => a.type.localeCompare(b.type));
  }, [openExceptions, sortBy]);

  // SLA metrics
  const slaMetrics = useMemo(() => {
    const resolved = state?.resolvedExceptions || [];
    const total = resolved.length;
    if (total === 0) return { h24: 0, h48: 0, h72: 0 };
    const within = (hours) => resolved.filter(e => {
      const age = (e.updatedAt - e.createdAt) / 3600000;
      return age <= hours;
    }).length;
    return {
      h24: Math.round((within(24) / total) * 100),
      h48: Math.round((within(48) / total) * 100),
      h72: Math.round((within(72) / total) * 100),
    };
  }, [state?.resolvedExceptions]);

  // KPI summary
  const totalResolved = state?.resolvedTodayCount || 0;
  const avgResMin = derived?.avgResolutionMinutes || 0;
  const billingPct = derived?.billingReadinessPct || 0;
  const openCount  = openExceptions.length;

  // Age distribution
  const ageCounts = {
    green:  openExceptions.filter(e => e.ageCategory === 'green').length,
    yellow: openExceptions.filter(e => e.ageCategory === 'yellow').length,
    orange: openExceptions.filter(e => e.ageCategory === 'orange').length,
    red:    openExceptions.filter(e => e.ageCategory === 'red').length,
  };

  function handleBillingDayChange(val) {
    const n = Math.max(1, Math.min(28, parseInt(val) || 15));
    setBillingDay(n);
    localStorage.setItem('ami_billing_day', String(n));
  }

  const slaColor = (pct) => pct >= 90 ? '#22c55e' : pct >= 70 ? '#f59e0b' : '#ef4444';

  return (
    <div className="billing-layout">
      {/* Top row: cycle card + KPI + SLA */}
      <div className="billing-top-row">

        {/* Billing Cycle Card */}
        <div className="billing-cycle-card">
          <div className="billing-cycle-title">BILLING CYCLE CLOSE</div>
          <div className={`billing-cycle-countdown urgency-${urgency}`}>
            {daysUntilClose < 1
              ? `${Math.round(daysUntilClose * 24)}h`
              : `${Math.floor(daysUntilClose)}d`
            }
          </div>
          <div className="billing-cycle-sub">
            Deadline: {billingDeadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            &nbsp;·&nbsp;
            {urgency === 'high' ? '🔴 URGENT' : urgency === 'med' ? '🟡 APPROACHING' : '🟢 ON TRACK'}
          </div>
          <div className="billing-day-setting">
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#757575' }}>CYCLE DAY:</span>
            <input
              type="number"
              className="billing-day-input"
              value={billingDay}
              min={1}
              max={28}
              onChange={e => handleBillingDayChange(e.target.value)}
            />
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#757575' }}>of month</span>
          </div>
        </div>

        {/* KPI Card */}
        <div className="billing-kpi-card">
          <div className="billing-cycle-title">DAILY KPIs</div>
          <div className="billing-kpi-grid">
            <div className="billing-kpi-item">
              <div className="billing-kpi-val" style={{ color: openCount > 20 ? '#ef4444' : '#1A237E' }}>{openCount}</div>
              <div className="billing-kpi-lbl">Open Exceptions</div>
            </div>
            <div className="billing-kpi-item">
              <div className="billing-kpi-val" style={{ color: '#22c55e' }}>{totalResolved}</div>
              <div className="billing-kpi-lbl">Resolved Today</div>
            </div>
            <div className="billing-kpi-item">
              <div className="billing-kpi-val" style={{ color: billingPct >= 95 ? '#22c55e' : '#f59e0b' }}>{billingPct}%</div>
              <div className="billing-kpi-lbl">Billing Ready</div>
            </div>
            <div className="billing-kpi-item">
              <div className="billing-kpi-val">{avgResMin > 0 ? `${avgResMin}m` : '—'}</div>
              <div className="billing-kpi-lbl">Avg Resolution</div>
            </div>
          </div>
        </div>

        {/* SLA Card */}
        <div className="sla-card">
          <div className="billing-cycle-title">SLA PERFORMANCE (Resolved Exceptions)</div>
          <div className="sla-bars">
            {[
              { label: '< 24h', pct: slaMetrics.h24, color: '#22c55e' },
              { label: '< 48h', pct: slaMetrics.h48, color: '#f59e0b' },
              { label: '< 72h', pct: slaMetrics.h72, color: '#ef4444' },
            ].map(row => (
              <div key={row.label} className="sla-bar-row">
                <span className="sla-bar-label">{row.label}</span>
                <div className="sla-bar-track">
                  <div className="sla-bar-fill"
                    style={{ width: `${row.pct}%`, background: slaColor(row.pct) }} />
                </div>
                <span className="sla-bar-pct" style={{ color: slaColor(row.pct) }}>{row.pct}%</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { label: '< 24h', count: ageCounts.green,  bg: '#22c55e' },
              { label: '24–48h', count: ageCounts.yellow, bg: '#f59e0b' },
              { label: '48–72h', count: ageCounts.orange, bg: '#ef4444' },
              { label: '> 72h',  count: ageCounts.red,    bg: '#b91c1c' },
            ].map(b => (
              <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'monospace', fontSize: 9 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: b.bg, display: 'inline-block' }} />
                <span style={{ color: '#757575' }}>{b.label}</span>
                <span style={{ fontWeight: 700, color: b.count > 0 && b.bg !== '#22c55e' ? b.bg : '#333' }}>{b.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Exception Aging Table */}
      <div className="billing-aging-section">
        <div className="billing-aging-header">
          <div className="billing-aging-title">
            EXCEPTION AGING — {openExceptions.length} OPEN
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#757575' }}>SORT:</span>
            {['age', 'severity', 'type'].map(s => (
              <button
                key={s}
                className={`rfmesh-filter-btn ${sortBy === s ? 'rfmesh-filter-active' : ''}`}
                onClick={() => setSortBy(s)}
                style={{ fontSize: 8, padding: '2px 7px' }}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {openExceptions.length === 0 ? (
          <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af', textAlign: 'center', padding: 32 }}>
            ✓ No open exceptions
          </div>
        ) : (
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>EXCEPTION ID</th>
                <th>TYPE</th>
                <th>METER</th>
                <th>SEVERITY</th>
                <th>BILLING</th>
                <th>AGE</th>
                <th>SLA STATUS</th>
              </tr>
            </thead>
            <tbody>
              {sortedExceptions.map(e => {
                const cat = e.ageCategory;
                const rowClass = `aging-row-${cat}`;
                const ageClass = `aging-age-${cat}`;
                const slaPct72 = getSlaPct(e.ageHours, 72);
                return (
                  <tr key={e.id} className={rowClass}>
                    <td className="mono" style={{ fontSize: 10 }}>{e.id}</td>
                    <td><span className={`exc-type-badge exc-type-${e.type}`} style={{ fontSize: 8 }}>{e.typeLabel}</span></td>
                    <td className="mono" style={{ fontSize: 10 }}>{e.meterID}</td>
                    <td>
                      <span className={`badge ${e.severity === 'Error' ? 'badge-red' : 'badge-amber'}`}>
                        {e.severity}
                      </span>
                    </td>
                    <td>
                      {e.billingImpact
                        ? <span style={{ color: '#ef4444', fontFamily: 'monospace', fontSize: 9 }}>IMPACT</span>
                        : <span style={{ color: '#9ca3af', fontFamily: 'monospace', fontSize: 9 }}>—</span>
                      }
                    </td>
                    <td className={`aging-age-cell ${ageClass}`}>{formatAge(e.ageHours)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{
                          width: 60, height: 6, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden', flexShrink: 0
                        }}>
                          <div style={{
                            height: '100%', borderRadius: 2,
                            width: `${slaPct72}%`,
                            background: cat === 'green' ? '#22c55e' : cat === 'yellow' ? '#f59e0b' : '#ef4444',
                          }} />
                        </div>
                        <span style={{ fontFamily: 'monospace', fontSize: 9, color: cat === 'green' ? '#22c55e' : cat === 'yellow' ? '#f59e0b' : '#ef4444' }}>
                          {slaPct72}% of 72h
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
