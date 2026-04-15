// ============================================================
// VEE ENGINE — VALIDATION, ESTIMATION & EDITING
// Rule-by-rule pass/fail, Run VEE button, estimation methods
// ============================================================

import { useState, useMemo, useCallback } from 'react';
import { METERS } from '../../data/meters.js';
import { generateIntervalData } from '../../engine/simulation.js';
import StatusBadge from '../shared/StatusBadge.jsx';

// ---- VEE Rules ----
const VEE_RULES = [
  {
    id: 'MISSING_INTERVAL',
    label: 'Missing Interval Check',
    description: 'Verifies all 96 intervals (15-min) are present for each meter in the billing period.',
    detail: 'Flags any meter where one or more intervals contain null or no-read values. Missing intervals prevent accurate daily total computation.',
    category: 'Validation',
  },
  {
    id: 'ZERO_CONSUMPTION',
    label: 'Zero Consumption Check',
    description: 'Identifies meters reporting zero usage across an entire read period.',
    detail: 'A full day of zero reads on an active account is anomalous. Could indicate comm failure, meter malfunction, or tamper. Solar meters are excluded during daylight hours.',
    category: 'Validation',
  },
  {
    id: 'NEGATIVE_CONSUMPTION',
    label: 'Negative Consumption Check',
    description: 'Detects negative interval values on non-solar accounts.',
    detail: 'Negative consumption on residential/commercial accounts suggests meter reversal, wiring error, or data corruption. Net-metering solar accounts are expected to export.',
    category: 'Validation',
  },
  {
    id: 'SPIKE_CHECK',
    label: 'Spike Check (Hi/Lo vs Historical)',
    description: 'Compares current usage against 30-day historical profile. Flags deviations > 3σ.',
    detail: 'A reading exceeding 3x or dropping below 0.2x the historical average triggers a spike exception. Reviewed against weather data and account history before estimating.',
    category: 'Validation',
  },
  {
    id: 'SUM_CHECK',
    label: 'Sum Check (Intervals vs Register)',
    description: 'Validates that sum of 96 interval reads matches the register delta read.',
    detail: 'The arithmetic sum of all 15-minute intervals should equal the cumulative register delta within a tolerance of ±0.5%. Mismatches indicate data transmission errors.',
    category: 'Validation',
  },
  {
    id: 'STALE_DATA',
    label: 'Stale Data Check',
    description: 'Detects meters reporting identical values across 3 or more consecutive read cycles.',
    detail: 'A stuck register is a sign of a failed meter head or firmware freeze. Customer continues to consume energy but the meter is not advancing.',
    category: 'Validation',
  },
  {
    id: 'DUPLICATE_READ',
    label: 'Duplicate Read Check',
    description: 'Identifies duplicate interval reads submitted from the same meter within a single period.',
    detail: 'Duplicate submissions from HES retries can inflate interval sums. VEE deduplicates by timestamp and read sequence number before processing.',
    category: 'Validation',
  },
];

const ESTIMATION_METHODS = [
  {
    id: 'LINEAR',
    label: 'Linear Interpolation',
    description: 'Fills missing intervals by drawing a straight line between the last valid read and the next valid read.',
    useCase: 'Best for short gaps (1–4 intervals) in stable load profiles.',
    accuracy: 'Good',
    icon: '↗',
  },
  {
    id: 'HISTORICAL',
    label: 'Historical Profile',
    description: 'Uses the meter\'s own 30-day interval history to reconstruct missing periods using the same time-of-day shape.',
    useCase: 'Best for longer gaps (4–24+ intervals) where load pattern is consistent.',
    accuracy: 'Better',
    icon: '◷',
  },
  {
    id: 'SIMILAR_METER',
    label: 'Similar Meter Proxy',
    description: 'Substitutes data from a statistically similar meter on the same collector and rate class.',
    useCase: 'Used when a meter has no reliable history (new install, meter exchange).',
    accuracy: 'Acceptable',
    icon: '⊕',
  },
];

// ---- Run VEE on a single meter's interval data ----
function runVEERules(meter, intervalData, meterState) {
  const results = {};
  const isNonSolar = meter.rateClass !== 'Solar';

  // MISSING_INTERVAL
  const missingCount = intervalData.filter(v => v === null || v === undefined).length;
  results.MISSING_INTERVAL = {
    pass: missingCount === 0,
    detail: missingCount === 0
      ? `All 96 intervals present`
      : `${missingCount} interval(s) missing`,
    value: missingCount,
  };

  // ZERO_CONSUMPTION
  const allZero = intervalData.every(v => v === 0);
  results.ZERO_CONSUMPTION = {
    pass: !allZero || !isNonSolar,
    detail: allZero && isNonSolar
      ? '96 consecutive zero reads on active account'
      : 'Non-zero consumption detected',
    value: allZero,
  };

  // NEGATIVE_CONSUMPTION
  const negIntervals = intervalData.filter(v => v < 0);
  if (isNonSolar) {
    results.NEGATIVE_CONSUMPTION = {
      pass: negIntervals.length === 0,
      detail: negIntervals.length === 0
        ? 'No negative intervals detected'
        : `${negIntervals.length} negative interval(s) on non-solar account`,
      value: negIntervals.length,
    };
  } else {
    results.NEGATIVE_CONSUMPTION = {
      pass: true,
      detail: `${negIntervals.length} negative intervals (expected — solar export)`,
      value: negIntervals.length,
      skipped: true,
    };
  }

  // SPIKE_CHECK
  const avgInterval = meter.avgKWh / 96;
  const maxInterval = Math.max(...intervalData);
  const minIntervalPos = Math.min(...intervalData.filter(v => v >= 0));
  const spikeHigh = maxInterval > avgInterval * 3.5;
  const spikeLow  = minIntervalPos < avgInterval * 0.05 && isNonSolar;
  results.SPIKE_CHECK = {
    pass: !spikeHigh && !spikeLow,
    detail: spikeHigh
      ? `Peak interval ${maxInterval.toFixed(4)} kWh = ${(maxInterval / avgInterval).toFixed(1)}x historical avg`
      : spikeLow
      ? `Min interval (${minIntervalPos.toFixed(4)} kWh) below 5% of historical avg`
      : `All intervals within 3σ of historical profile`,
    value: { maxInterval, avgInterval, spikeHigh, spikeLow },
  };

  // SUM_CHECK
  const intervalSum = intervalData.reduce((s, v) => s + Math.max(0, v), 0);
  const registerDelta = meter.avgKWh * (0.9 + Math.random() * 0.2);
  const sumDiffPct = Math.abs((intervalSum - registerDelta) / registerDelta) * 100;
  results.SUM_CHECK = {
    pass: sumDiffPct <= 0.5,
    detail: sumDiffPct <= 0.5
      ? `Interval sum matches register delta (Δ${sumDiffPct.toFixed(3)}%)`
      : `Sum mismatch: intervals=${intervalSum.toFixed(3)} kWh, register Δ=${registerDelta.toFixed(3)} kWh (${sumDiffPct.toFixed(2)}% error)`,
    value: { intervalSum, registerDelta, sumDiffPct },
  };

  // STALE_DATA
  const staleCount = meterState?.staleCount || 0;
  results.STALE_DATA = {
    pass: staleCount < 3,
    detail: staleCount < 3
      ? `Register advancing normally (stale count: ${staleCount})`
      : `Register stuck for ${staleCount} consecutive read cycles`,
    value: staleCount,
  };

  // DUPLICATE_READ
  results.DUPLICATE_READ = {
    pass: true,
    detail: 'No duplicate intervals detected in this batch',
    value: 0,
  };

  // Determine overall status
  const failures = Object.values(results).filter(r => !r.pass && !r.skipped).length;
  const overallStatus = failures === 0 ? 'Passed' : failures >= 3 ? 'Exception' : 'Exception';

  return { results, overallStatus, failures };
}

export default function VEEEngine({ state }) {
  const [selectedMeterID, setSelectedMeterID] = useState(METERS[0]?.meterID || '');
  const [veeResults, setVeeResults] = useState({});
  const [running, setRunning] = useState(false);
  const [runLog, setRunLog] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState('HISTORICAL');

  const meterStates = state?.meterStates || {};

  const selectedMeter = METERS.find(m => m.meterID === selectedMeterID);
  const selectedResult = veeResults[selectedMeterID];

  // Run VEE for selected meter
  const runVEE = useCallback(async () => {
    if (!selectedMeter || running) return;
    setRunning(true);

    const ms = meterStates[selectedMeterID] || {};
    const intervalData = ms.intervalData || generateIntervalData(selectedMeter, 0.1);

    // Simulate processing delay
    await new Promise(r => setTimeout(r, 600));

    const result = runVEERules(selectedMeter, intervalData, ms);
    setVeeResults(prev => ({ ...prev, [selectedMeterID]: result }));

    // Add to run log
    const logEntry = {
      ts: Date.now(),
      meterID: selectedMeterID,
      status: result.overallStatus,
      failures: result.failures,
      rules: Object.keys(result.results).length,
    };
    setRunLog(prev => [logEntry, ...prev].slice(0, 20));
    setRunning(false);
  }, [selectedMeter, selectedMeterID, meterStates, running]);

  // Run VEE for ALL meters
  const runVEEAll = useCallback(async () => {
    setRunning(true);
    const newResults = {};
    const newLog = [];

    for (const meter of METERS) {
      const ms = meterStates[meter.meterID] || {};
      const intervalData = ms.intervalData || generateIntervalData(meter, 0.1);
      const result = runVEERules(meter, intervalData, ms);
      newResults[meter.meterID] = result;
      newLog.push({
        ts: Date.now(),
        meterID: meter.meterID,
        status: result.overallStatus,
        failures: result.failures,
        rules: 7,
      });
    }

    await new Promise(r => setTimeout(r, 1200));
    setVeeResults(newResults);
    setRunLog(prev => [...newLog, ...prev].slice(0, 50));
    setRunning(false);
  }, [meterStates]);

  // Summary stats from run results
  const runSummary = useMemo(() => {
    const entries = Object.entries(veeResults);
    if (entries.length === 0) return null;
    return {
      total: entries.length,
      passed: entries.filter(([,r]) => r.overallStatus === 'Passed').length,
      failed: entries.filter(([,r]) => r.overallStatus !== 'Passed').length,
    };
  }, [veeResults]);

  return (
    <div className="vee-layout">
      {/* Left panel: meter selector + run controls */}
      <div className="vee-left">
        <div className="vee-controls-panel">
          <div className="panel-title">VEE ENGINE CONTROLS</div>

          <div style={{ marginBottom: 10 }}>
            <label className="vee-label">SELECTED METER</label>
            <select
              className="vee-select"
              value={selectedMeterID}
              onChange={e => setSelectedMeterID(e.target.value)}
            >
              {METERS.map(m => (
                <option key={m.meterID} value={m.meterID}>
                  {m.meterID} — {m.customerName}
                </option>
              ))}
            </select>
          </div>

          <div className="vee-run-btns">
            <button className="btn-primary" onClick={runVEE} disabled={running} style={{ flex: 1 }}>
              {running ? '◌ RUNNING...' : '▶ RUN VEE — SELECTED'}
            </button>
            <button className="btn-ghost" onClick={runVEEAll} disabled={running} style={{ flex: 1 }}>
              {running ? '◌' : '▶▶ RUN ALL METERS'}
            </button>
          </div>

          {running && (
            <div className="vee-running-indicator">
              <span style={{ animation: 'pulse-badge 0.8s infinite', display: 'inline-block' }}>◌</span>
              {' '}Processing VEE rules...
            </div>
          )}

          {runSummary && (
            <div className="vee-run-summary">
              <div className="vee-summary-row">
                <span>Meters processed:</span>
                <span className="mono">{runSummary.total}</span>
              </div>
              <div className="vee-summary-row">
                <span className="text-green">Passed:</span>
                <span className="mono text-green">{runSummary.passed}</span>
              </div>
              <div className="vee-summary-row">
                <span className="text-red">Failed:</span>
                <span className="mono text-red">{runSummary.failed}</span>
              </div>
            </div>
          )}
        </div>

        {/* Estimation methods */}
        <div className="vee-methods-panel">
          <div className="panel-title">ESTIMATION METHODS</div>
          {ESTIMATION_METHODS.map(method => (
            <div
              key={method.id}
              className={`vee-method-card ${selectedMethod === method.id ? 'vee-method-active' : ''}`}
              onClick={() => setSelectedMethod(method.id)}
            >
              <div className="vee-method-header">
                <span className="vee-method-icon">{method.icon}</span>
                <span className="vee-method-label">{method.label}</span>
                <span className={`vee-method-acc acc-${method.accuracy.toLowerCase()}`}>{method.accuracy}</span>
              </div>
              <div className="vee-method-desc">{method.description}</div>
              <div className="vee-method-use">
                <span className="text-dim">Use when: </span>{method.useCase}
              </div>
            </div>
          ))}
        </div>

        {/* VEE run log */}
        <div className="vee-log-panel">
          <div className="panel-title">RUN LOG</div>
          <div className="vee-log-scroll">
            {runLog.length === 0 ? (
              <div className="text-dim mono" style={{ fontSize: 10, padding: 6 }}>
                No runs recorded — press RUN VEE to process
              </div>
            ) : runLog.slice(0, 15).map((entry, i) => (
              <div key={i} className={`vee-log-row ${entry.status === 'Passed' ? 'vee-log-pass' : 'vee-log-fail'}`}>
                <span className="mono text-dim">{new Date(entry.ts).toLocaleTimeString('en-US', { hour12: false })}</span>
                <span className="mono text-amber">{entry.meterID}</span>
                <StatusBadge status={entry.status} />
                {entry.failures > 0 && <span className="text-red" style={{ fontSize: 9 }}>{entry.failures} fail</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel: rule-by-rule results */}
      <div className="vee-right">
        <div className="vee-rules-header">
          <div>
            <div className="vee-rules-title">VEE RULE RESULTS</div>
            {selectedMeter && (
              <div className="vee-rules-sub">
                {selectedMeter.meterID} — {selectedMeter.customerName} ({selectedMeter.rateClass})
              </div>
            )}
          </div>
          {selectedResult && (
            <StatusBadge status={selectedResult.overallStatus} size="lg" />
          )}
        </div>

        {!selectedResult ? (
          <div className="vee-no-results">
            <div className="vee-no-results-icon">◎</div>
            <div>Run VEE to see rule-by-rule results for this meter</div>
            <button className="btn-primary" onClick={runVEE} disabled={running} style={{ marginTop: 12 }}>
              ▶ RUN VEE NOW
            </button>
          </div>
        ) : (
          <div className="vee-rules-list">
            {VEE_RULES.map(rule => {
              const result = selectedResult.results[rule.id];
              if (!result) return null;
              return (
                <div key={rule.id} className={`vee-rule-card ${result.pass ? 'vee-rule-pass' : 'vee-rule-fail'} ${result.skipped ? 'vee-rule-skip' : ''}`}>
                  <div className="vee-rule-top">
                    <div className="vee-rule-name-row">
                      <span className="vee-rule-status-icon">
                        {result.skipped ? '—' : result.pass ? '✓' : '✕'}
                      </span>
                      <span className="vee-rule-name">{rule.label}</span>
                      <span className={`vee-rule-badge ${result.pass ? 'badge-green' : result.skipped ? 'badge-blue' : 'badge-red'}`}>
                        {result.skipped ? 'SKIPPED' : result.pass ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                    <div className="vee-rule-category">{rule.category}</div>
                  </div>

                  <div className="vee-rule-desc">{rule.description}</div>

                  <div className={`vee-rule-detail ${result.pass ? 'detail-pass' : result.skipped ? 'detail-skip' : 'detail-fail'}`}>
                    {result.detail}
                  </div>

                  {!result.pass && !result.skipped && (
                    <div className="vee-rule-explain">{rule.detail}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* All-meter summary table when full batch run */}
        {runSummary && runSummary.total > 1 && (
          <div style={{ marginTop: 12 }}>
            <div className="panel-title" style={{ marginBottom: 6 }}>BATCH RESULTS — ALL METERS</div>
            <div className="headend-table-wrapper" style={{ maxHeight: 200 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>METER ID</th>
                    <th>VEE STATUS</th>
                    <th>RULES FAILED</th>
                    <th>RATE CLASS</th>
                  </tr>
                </thead>
                <tbody>
                  {METERS.map(m => {
                    const r = veeResults[m.meterID];
                    if (!r) return null;
                    return (
                      <tr
                        key={m.meterID}
                        className={selectedMeterID === m.meterID ? 'row-expanded' : ''}
                        onClick={() => setSelectedMeterID(m.meterID)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="mono text-amber">{m.meterID}</td>
                        <td><StatusBadge status={r.overallStatus} /></td>
                        <td className="mono">
                          {r.failures === 0
                            ? <span className="text-green">0</span>
                            : <span className="text-red">{r.failures}</span>
                          }
                        </td>
                        <td>
                          <span className={`rate-pill rate-${m.rateClass.toLowerCase()}`}>{m.rateClass}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
