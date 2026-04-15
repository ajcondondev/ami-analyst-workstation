// ============================================================
// REPORTS MODULE
// Daily exception summary, billing accuracy, meter health
// ============================================================

import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import { METERS } from '../../data/meters.js';
import { EXCEPTION_TYPES } from '../../engine/simulation.js';

// ---- CSV Export ----
function exportCSV(filename, headers, rows) {
  const lines = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---- Daily Exception Summary ----
function DailySummaryTab({ state }) {
  const simNow = state?.simTime ? new Date(state.simTime) : new Date();
  const allExceptions = [...(state?.exceptions || []), ...(state?.resolvedExceptions || [])];

  // Count by type (all exceptions in sim)
  const byType = useMemo(() => {
    const counts = {};
    allExceptions.forEach(e => {
      if (!counts[e.type]) counts[e.type] = { type: e.type, label: e.typeLabel || e.type, total: 0, open: 0, resolved: 0 };
      counts[e.type].total++;
      if (e.status === 'Open') counts[e.type].open++;
      else counts[e.type].resolved++;
    });
    return Object.values(counts).sort((a, b) => b.total - a.total);
  }, [allExceptions]);

  // Resolution actions breakdown
  const byResolution = useMemo(() => {
    const counts = {};
    (state?.resolvedExceptions || []).forEach(e => {
      const key = e.resolution || 'UNKNOWN';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([code, value]) => ({ code, value })).sort((a, b) => b.value - a.value);
  }, [state?.resolvedExceptions]);

  // 7-day trend
  const trendData = useMemo(() => {
    return (state?.dailyExceptionCounts || []).map(d => ({
      date: d.date.slice(5), // MM-DD
      count: d.count,
    }));
  }, [state?.dailyExceptionCounts]);

  const CHART_COLORS = ['#D32F2F','#FF9800','#1565C0','#6A1B9A','#FFA000','#C62828','#B71C1C','#7B1FA2','#BF360C','#F57F17'];

  function handleExport() {
    exportCSV('daily_exception_summary.csv',
      ['Type', 'Total', 'Open', 'Resolved'],
      byType.map(r => [r.label, r.total, r.open, r.resolved])
    );
  }

  return (
    <div className="reports-body">
      <div className="report-section">
        <div className="report-section-title">
          EXCEPTION COUNTS BY TYPE
          <button className="export-btn" onClick={handleExport}>↓ EXPORT CSV</button>
        </div>
        <div className="report-stat-row">
          <div className="report-stat-chip">
            <div>
              <div className="report-stat-chip-val" style={{ color: '#ef4444' }}>{(state?.exceptions || []).length}</div>
              <div className="report-stat-chip-lbl">Open</div>
            </div>
          </div>
          <div className="report-stat-chip">
            <div>
              <div className="report-stat-chip-val" style={{ color: '#22c55e' }}>{(state?.resolvedExceptions || []).length}</div>
              <div className="report-stat-chip-lbl">Resolved</div>
            </div>
          </div>
          <div className="report-stat-chip">
            <div>
              <div className="report-stat-chip-val">{allExceptions.length}</div>
              <div className="report-stat-chip-lbl">Total Generated</div>
            </div>
          </div>
        </div>

        <table className="data-table" style={{ width: '100%', marginBottom: 12 }}>
          <thead>
            <tr>
              <th>EXCEPTION TYPE</th>
              <th>TOTAL</th>
              <th>OPEN</th>
              <th>RESOLVED</th>
              <th>RESOLUTION RATE</th>
            </tr>
          </thead>
          <tbody>
            {byType.map((r, i) => (
              <tr key={r.type}>
                <td><span className={`exc-type-badge exc-type-${r.type}`} style={{ fontSize: 8 }}>{r.label}</span></td>
                <td className="mono">{r.total}</td>
                <td className="mono" style={{ color: r.open > 0 ? '#ef4444' : '#9ca3af' }}>{r.open}</td>
                <td className="mono" style={{ color: '#22c55e' }}>{r.resolved}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: 2, maxWidth: 80 }}>
                      <div style={{
                        height: '100%', borderRadius: 2,
                        width: `${r.total > 0 ? Math.round((r.resolved / r.total) * 100) : 0}%`,
                        background: CHART_COLORS[i % CHART_COLORS.length],
                      }} />
                    </div>
                    <span style={{ fontFamily: 'monospace', fontSize: 9 }}>
                      {r.total > 0 ? Math.round((r.resolved / r.total) * 100) : 0}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {trendData.length > 0 && (
          <>
            <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#757575', marginBottom: 6 }}>7-DAY EXCEPTION TREND</div>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={trendData} margin={{ top: 4, right: 8, bottom: 4, left: 24 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#E0E0E0" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fontFamily: 'monospace', fill: '#757575' }} />
                <YAxis tick={{ fontSize: 9, fontFamily: 'monospace', fill: '#757575' }} />
                <Tooltip
                  contentStyle={{ fontFamily: 'monospace', fontSize: 11 }}
                  formatter={(v) => [v, 'Exceptions']}
                />
                <Bar dataKey="count" fill="#1A237E" radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {byResolution.length > 0 && (
        <div className="report-section">
          <div className="report-section-title">RESOLUTION ACTIONS TAKEN</div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              {byResolution.map((r, i) => (
                <div key={r.code} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 10, width: 160 }}>{r.code.replace(/_/g, ' ')}</span>
                  <div style={{ flex: 1, height: 8, background: '#e5e7eb', borderRadius: 2 }}>
                    <div style={{
                      height: '100%', borderRadius: 2,
                      width: `${(r.value / Math.max(...byResolution.map(x=>x.value))) * 100}%`,
                      background: CHART_COLORS[i % CHART_COLORS.length],
                    }} />
                  </div>
                  <span style={{ fontFamily: 'monospace', fontSize: 10, width: 24, textAlign: 'right', fontWeight: 700 }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Billing Accuracy ----
function BillingAccuracyTab({ state }) {
  const meterStates = state?.meterStates || {};
  const resolved = state?.resolvedExceptions || [];

  const estimatedCount = Object.values(meterStates).filter(ms => ms.staleCount >= 3).length;
  const manualEditCount = resolved.filter(e => e.resolution === 'EDIT_DATA').length;
  const cleanCount = METERS.length - estimatedCount;
  const totalMeters = METERS.length;

  const estimatedPct = Math.round((estimatedCount / totalMeters) * 100);
  const manualPct    = Math.round((manualEditCount / Math.max(1, totalMeters)) * 100);
  const cleanPct     = Math.max(0, 100 - estimatedPct - manualPct);

  const pieData = [
    { name: 'Clean Reads',   value: cleanPct,     fill: '#22c55e' },
    { name: 'Estimated',     value: estimatedPct, fill: '#f59e0b' },
    { name: 'Manual Edit',   value: Math.min(manualPct, 100 - estimatedPct), fill: '#ef4444' },
  ].filter(d => d.value > 0);

  const solars    = METERS.filter(m => m.rateClass === 'Solar').length;
  const commercials = METERS.filter(m => m.rateClass === 'Commercial').length;
  const residentl = METERS.filter(m => m.rateClass === 'Residential').length;

  function handleExport() {
    exportCSV('billing_accuracy_report.csv',
      ['Metric', 'Count', 'Percentage'],
      [
        ['Clean Reads', cleanCount, `${cleanPct}%`],
        ['Estimated', estimatedCount, `${estimatedPct}%`],
        ['Manual Edits', manualEditCount, `${manualPct}%`],
        ['Total Meters', totalMeters, '100%'],
      ]
    );
  }

  return (
    <div className="reports-body">
      <div className="report-section">
        <div className="report-section-title">
          WEEKLY BILLING ACCURACY REPORT
          <button className="export-btn" onClick={handleExport}>↓ EXPORT CSV</button>
        </div>
        <div className="report-accuracy-grid">
          <div className="accuracy-card">
            <div className="accuracy-pct" style={{ color: '#22c55e' }}>{cleanPct}%</div>
            <div className="accuracy-lbl">Clean Reads</div>
            <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#9ca3af', marginTop: 4 }}>
              {cleanCount} / {totalMeters} meters
            </div>
          </div>
          <div className="accuracy-card">
            <div className="accuracy-pct" style={{ color: '#f59e0b' }}>{estimatedPct}%</div>
            <div className="accuracy-lbl">Estimated Reads</div>
            <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#9ca3af', marginTop: 4 }}>
              {estimatedCount} meters with stale data
            </div>
          </div>
          <div className="accuracy-card">
            <div className="accuracy-pct" style={{ color: '#ef4444' }}>{manualPct}%</div>
            <div className="accuracy-lbl">Manual Edits</div>
            <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#9ca3af', marginTop: 4 }}>
              {manualEditCount} data corrections
            </div>
          </div>
        </div>

        {pieData.length > 0 && (
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}%`}
                labelLine={true}
              >
                {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip formatter={(v) => `${v}%`} contentStyle={{ fontFamily: 'monospace', fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}

        <div style={{ marginTop: 10 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#757575', marginBottom: 6 }}>RATE CLASS BREAKDOWN</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: 'Residential', count: residentl, color: '#FF9800' },
              { label: 'Commercial',  count: commercials, color: '#1565C0' },
              { label: 'Solar',       count: solars,    color: '#00838F' },
            ].map(c => (
              <div key={c.label} className="report-stat-chip">
                <div>
                  <div className="report-stat-chip-val" style={{ fontSize: 16, color: c.color }}>{c.count}</div>
                  <div className="report-stat-chip-lbl">{c.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Meter Health ----
function MeterHealthTab({ state }) {
  const meterStates = state?.meterStates || {};
  const allExceptions = [...(state?.exceptions || []), ...(state?.resolvedExceptions || [])];

  // Build health score per meter
  const meterHealth = useMemo(() => {
    return METERS.map(m => {
      const ms = meterStates[m.meterID] || {};
      const mExceptions = allExceptions.filter(e => e.meterID === m.meterID);
      const openExc = mExceptions.filter(e => e.status === 'Open').length;
      const totalExc = mExceptions.length;
      const signal = ms.signalStrength || 0;
      const isComm = ms.commStatus === 'Communicating';
      const stale  = ms.staleCount || 0;
      const pqCount = (ms.powerQualityEvents || []).length;

      // Health score 0-100 (100 = perfect)
      let score = 100;
      score -= openExc * 15;
      score -= Math.max(0, (totalExc - openExc)) * 3;
      if (!isComm) score -= 30;
      if (signal < 40) score -= 20;
      else if (signal < 70) score -= 5;
      score -= stale * 5;
      score -= pqCount * 2;
      score = Math.max(0, Math.min(100, score));

      return {
        meterID: m.meterID,
        customerName: m.customerName,
        rateClass: m.rateClass,
        signal,
        commStatus: ms.commStatus || 'Unknown',
        openExc,
        totalExc,
        stale,
        pqCount,
        score,
        status: score >= 80 ? 'Good' : score >= 50 ? 'Fair' : 'Poor',
      };
    }).sort((a, b) => a.score - b.score); // worst first
  }, [meterStates, allExceptions]);

  const poor = meterHealth.filter(m => m.status === 'Poor').length;
  const fair = meterHealth.filter(m => m.status === 'Fair').length;

  function handleExport() {
    exportCSV('meter_health_report.csv',
      ['Meter ID', 'Customer', 'Rate Class', 'Signal %', 'Comm Status', 'Open Exc', 'Total Exc', 'Health Score', 'Status'],
      meterHealth.map(m => [m.meterID, m.customerName, m.rateClass, m.signal, m.commStatus, m.openExc, m.totalExc, m.score, m.status])
    );
  }

  const scoreColor = (score) => score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="reports-body">
      <div className="report-section">
        <div className="report-section-title">
          METER HEALTH REPORT — {METERS.length} METERS
          <button className="export-btn" onClick={handleExport}>↓ EXPORT CSV</button>
        </div>
        <div className="report-stat-row">
          <div className="report-stat-chip">
            <div>
              <div className="report-stat-chip-val" style={{ color: '#ef4444' }}>{poor}</div>
              <div className="report-stat-chip-lbl">Poor Health</div>
            </div>
          </div>
          <div className="report-stat-chip">
            <div>
              <div className="report-stat-chip-val" style={{ color: '#f59e0b' }}>{fair}</div>
              <div className="report-stat-chip-lbl">Fair Health</div>
            </div>
          </div>
          <div className="report-stat-chip">
            <div>
              <div className="report-stat-chip-val" style={{ color: '#22c55e' }}>{METERS.length - poor - fair}</div>
              <div className="report-stat-chip-lbl">Good Health</div>
            </div>
          </div>
        </div>

        <table className="health-table">
          <thead>
            <tr>
              <th>METER ID</th>
              <th>CUSTOMER</th>
              <th>RATE</th>
              <th>SIGNAL</th>
              <th>COMM</th>
              <th>OPEN EXC</th>
              <th>PQ EVENTS</th>
              <th>HEALTH SCORE</th>
            </tr>
          </thead>
          <tbody>
            {meterHealth.map(m => (
              <tr key={m.meterID}>
                <td className="mono" style={{ fontSize: 9 }}>{m.meterID}</td>
                <td style={{ fontSize: 10 }}>{m.customerName}</td>
                <td><span className={`rate-pill rate-${m.rateClass.toLowerCase()}`}>{m.rateClass}</span></td>
                <td className="mono" style={{ fontSize: 10, color: m.signal < 40 ? '#ef4444' : m.signal < 70 ? '#f59e0b' : '#22c55e' }}>
                  {m.signal}%
                </td>
                <td style={{ fontSize: 9 }}>
                  <span style={{ color: m.commStatus === 'Communicating' ? '#22c55e' : '#ef4444', fontFamily: 'monospace' }}>
                    {m.commStatus === 'Communicating' ? 'OK' : 'NO COMM'}
                  </span>
                </td>
                <td className="mono" style={{ fontSize: 10, color: m.openExc > 0 ? '#ef4444' : '#9ca3af' }}>
                  {m.openExc}
                </td>
                <td className="mono" style={{ fontSize: 10, color: m.pqCount > 5 ? '#f59e0b' : '#9ca3af' }}>
                  {m.pqCount}
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 50, height: 6, background: '#e5e7eb', borderRadius: 2 }}>
                      <div style={{ width: `${m.score}%`, height: '100%', background: scoreColor(m.score), borderRadius: 2 }} />
                    </div>
                    <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color: scoreColor(m.score) }}>
                      {m.score}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Main ----
export default function ReportsModule({ state }) {
  const [activeTab, setActiveTab] = useState('daily');

  return (
    <div className="reports-layout">
      <div className="reports-tabs">
        {[
          { id: 'daily',    label: '◎ DAILY SUMMARY' },
          { id: 'billing',  label: '≋ BILLING ACCURACY' },
          { id: 'health',   label: '⊞ METER HEALTH' },
        ].map(t => (
          <button
            key={t.id}
            className={`reports-tab-btn ${activeTab === t.id ? 'reports-tab-active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'daily'   && <DailySummaryTab   state={state} />}
      {activeTab === 'billing' && <BillingAccuracyTab state={state} />}
      {activeTab === 'health'  && <MeterHealthTab     state={state} />}
    </div>
  );
}
