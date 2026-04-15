// ============================================================
// SHIFT HANDOFF — Persistent notes + auto-generated report
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { METERS } from '../../data/meters.js';

const NOTES_KEY = 'ami_shift_notes';

function saveNotes(text) {
  try { localStorage.setItem(NOTES_KEY, text); } catch(e) {}
}

function loadNotes() {
  try { return localStorage.getItem(NOTES_KEY) || ''; } catch(e) { return ''; }
}

function formatTs(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function severityOrder(sev) {
  return sev === 'Error' ? 0 : 1;
}

export default function ShiftHandoff({ state }) {
  const [notes, setNotes] = useState(loadNotes);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'unsaved' | 'saving'
  const [showReport, setShowReport] = useState(false);

  // Debounced save
  useEffect(() => {
    setSaveStatus('unsaved');
    const timer = setTimeout(() => {
      saveNotes(notes);
      setSaveStatus('saved');
    }, 800);
    return () => clearTimeout(timer);
  }, [notes]);

  const openExceptions = (state?.exceptions || []).filter(e => e.status === 'Open');
  const openErrors     = openExceptions.filter(e => e.severity === 'Error');
  const openWarnings   = openExceptions.filter(e => e.severity === 'Warning');

  // Sorted by severity then age
  const sortedOpen = [...openExceptions].sort((a, b) => {
    const s = severityOrder(a.severity) - severityOrder(b.severity);
    if (s !== 0) return s;
    return b.createdAt - a.createdAt; // newer first within same severity
  });

  // Recent escalations
  const recentEscalations = (state?.resolvedExceptions || [])
    .filter(e => e.resolution === 'ESCALATE')
    .slice(-5)
    .reverse();

  // Meters awaiting field service
  const pendingFSOs = (state?.fieldOrders || []).filter(o => o.status !== 'Complete');

  // Billing-impacting open exceptions
  const billingImpact = openExceptions.filter(e => e.billingImpact);

  // Auto-note template
  function generateNoteTemplate() {
    const now = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const lines = [
      `=== SHIFT NOTES — ${now} ===`,
      '',
      'PRIORITY ITEMS:',
      ...openErrors.slice(0, 5).map(e => `  - ${e.id} [${e.typeLabel}] ${e.meterID} — ${e.detail?.slice(0, 80)}...`),
      '',
      'PENDING FIELD ORDERS:',
      ...pendingFSOs.slice(0, 3).map(o => `  - ${o.id} ${o.meterID} — ${o.issue}`),
      '',
      'NOTES FOR NEXT SHIFT:',
      '  [add notes here]',
    ];
    setNotes(notes ? notes + '\n\n' + lines.join('\n') : lines.join('\n'));
  }

  return (
    <div className="handoff-layout">
      {/* Left: Notes editor */}
      <div className="handoff-left">
        <div className="handoff-notes-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="handoff-notes-title">✎ SHIFT NOTES</div>
            <div className={`handoff-save-indicator ${saveStatus === 'saved' ? 'saved' : ''}`}>
              {saveStatus === 'saved' ? '✓ SAVED' : '● UNSAVED'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn-ghost" style={{ fontSize: 9, padding: '3px 10px' }} onClick={generateNoteTemplate}>
              + AUTO-FILL TEMPLATE
            </button>
            <button
              className="btn-ghost"
              style={{ fontSize: 9, padding: '3px 10px' }}
              onClick={() => { if (window.confirm('Clear all notes?')) setNotes(''); }}
            >
              × CLEAR
            </button>
          </div>

          <textarea
            className="handoff-textarea"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Document pending work, escalations, and important items for the next shift...&#10;&#10;Tip: Use the AUTO-FILL TEMPLATE button to generate a starting template."
          />
        </div>

        {/* Quick stats for outgoing */}
        <div className="handoff-report-panel">
          <div className="handoff-report-title">OUTGOING STATUS SUMMARY</div>
          <div className="handoff-stat-grid">
            <div className="handoff-stat-item">
              <div className="handoff-stat-val" style={{ color: openErrors.length > 0 ? '#ef4444' : '#22c55e' }}>
                {openErrors.length}
              </div>
              <div className="handoff-stat-lbl">Open Errors</div>
            </div>
            <div className="handoff-stat-item">
              <div className="handoff-stat-val" style={{ color: openWarnings.length > 0 ? '#f59e0b' : '#22c55e' }}>
                {openWarnings.length}
              </div>
              <div className="handoff-stat-lbl">Open Warnings</div>
            </div>
            <div className="handoff-stat-item">
              <div className="handoff-stat-val" style={{ color: pendingFSOs.length > 0 ? '#f59e0b' : '#9ca3af' }}>
                {pendingFSOs.length}
              </div>
              <div className="handoff-stat-lbl">Pending FSOs</div>
            </div>
          </div>
          <button
            className="btn-primary"
            style={{ width: '100%', marginTop: 8, fontSize: 10 }}
            onClick={() => setShowReport(r => !r)}
          >
            {showReport ? '▲ COLLAPSE REPORT' : '▼ GENERATE HANDOFF REPORT'}
          </button>
        </div>
      </div>

      {/* Right: Auto-generated handoff report */}
      <div className="handoff-right">
        {/* Unresolved high-priority */}
        <div className="handoff-report-panel">
          <div className="handoff-report-title">
            UNRESOLVED HIGH-PRIORITY EXCEPTIONS
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: openErrors.length > 0 ? '#ef4444' : '#22c55e', fontWeight: 400 }}>
              {openErrors.length} ERRORS
            </span>
          </div>
          {openErrors.length === 0 ? (
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af', padding: '8px 0' }}>
              ✓ No open error-severity exceptions
            </div>
          ) : (
            <div className="handoff-section">
              {openErrors.slice(0, 10).map(e => (
                <div key={e.id} className="handoff-exc-row">
                  <span className={`exc-type-badge exc-type-${e.type}`} style={{ fontSize: 8, flexShrink: 0 }}>{e.typeLabel}</span>
                  <span className="handoff-exc-id">{e.id}</span>
                  <span className="handoff-exc-detail">{e.meterID} — {e.detail?.slice(0, 90)}</span>
                </div>
              ))}
              {openErrors.length > 10 && (
                <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#9ca3af', padding: '4px 6px' }}>
                  + {openErrors.length - 10} more errors…
                </div>
              )}
            </div>
          )}
        </div>

        {/* Billing impact */}
        {billingImpact.length > 0 && (
          <div className="handoff-report-panel">
            <div className="handoff-report-title">
              BILLING-IMPACTING EXCEPTIONS
              <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#ef4444', fontWeight: 400 }}>
                {billingImpact.length} UNRESOLVED
              </span>
            </div>
            <div className="handoff-section">
              {billingImpact.slice(0, 8).map(e => (
                <div key={e.id} className="handoff-exc-row">
                  <span className={`exc-type-badge exc-type-${e.type}`} style={{ fontSize: 8, flexShrink: 0 }}>{e.typeLabel}</span>
                  <span className="handoff-exc-id">{e.id}</span>
                  <span className="handoff-exc-detail">{e.meterID} — {e.customerName}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending FSOs */}
        {pendingFSOs.length > 0 && (
          <div className="handoff-report-panel">
            <div className="handoff-report-title">
              METERS AWAITING FIELD SERVICE
              <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#f59e0b', fontWeight: 400 }}>
                {pendingFSOs.length} PENDING
              </span>
            </div>
            <div className="handoff-section">
              {pendingFSOs.map(fso => (
                <div key={fso.id} className="handoff-exc-row">
                  <span className="handoff-exc-id" style={{ color: '#f59e0b' }}>{fso.id}</span>
                  <span className="handoff-exc-detail">{fso.meterID} — {fso.issue}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#9ca3af', flexShrink: 0 }}>
                    {formatTs(fso.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent escalations */}
        {recentEscalations.length > 0 && (
          <div className="handoff-report-panel">
            <div className="handoff-report-title">RECENT ESCALATIONS</div>
            <div className="handoff-section">
              {recentEscalations.map(e => (
                <div key={e.id} className="handoff-exc-row">
                  <span className={`exc-type-badge exc-type-${e.type}`} style={{ fontSize: 8, flexShrink: 0 }}>{e.typeLabel}</span>
                  <span className="handoff-exc-id">{e.id}</span>
                  <span className="handoff-exc-detail">{e.meterID} — {e.note?.slice(0, 80)}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#9ca3af', flexShrink: 0 }}>
                    {formatTs(e.updatedAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full handoff report (collapsible) */}
        {showReport && (
          <div className="handoff-report-panel" style={{ background: '#f8fafc', border: '1px solid #00838F' }}>
            <div className="handoff-report-title" style={{ color: '#00838F' }}>
              ⊞ COMPILED HANDOFF REPORT
              <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 400 }}>
                {new Date().toLocaleString()}
              </span>
            </div>
            <pre style={{
              fontFamily: 'monospace', fontSize: 10, color: '#333', whiteSpace: 'pre-wrap',
              lineHeight: 1.7, maxHeight: 400, overflowY: 'auto',
            }}>
{`GRID EDGE MDMS — SHIFT HANDOFF REPORT
Generated: ${new Date().toLocaleString()}
Analyst: AMI Analyst
${'─'.repeat(50)}

EXCEPTION SUMMARY
  Total Open:          ${openExceptions.length}
  Critical Errors:     ${openErrors.length}
  Warnings:            ${openWarnings.length}
  Billing Impact:      ${billingImpact.length} exceptions

OPEN ERRORS (${openErrors.length})
${openErrors.slice(0, 10).map(e => `  ${e.id}  ${e.type.padEnd(22)}  ${e.meterID}  ${e.customerName}`).join('\n') || '  None'}

PENDING FIELD ORDERS (${pendingFSOs.length})
${pendingFSOs.map(o => `  ${o.id}  ${o.meterID}  ${o.issue?.slice(0, 50)}`).join('\n') || '  None'}

RECENT ESCALATIONS (${recentEscalations.length})
${recentEscalations.map(e => `  ${e.id}  ${e.meterID}  ${e.note?.slice(0, 50)}`).join('\n') || '  None'}

ANALYST NOTES
${'─'.repeat(50)}
${notes || '  (no notes recorded)'}
${'─'.repeat(50)}
END OF HANDOFF REPORT`}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
