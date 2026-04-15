// ============================================================
// SIMULATION ENGINE
// Drives meter states, exception generation, and sim clock
// ============================================================

import { METERS, COLLECTORS } from '../data/meters.js';
import { TRANSFORMERS, METER_TRANSFORMER_MAP, getMetersByTransformer } from '../data/grid.js';

// ---- Exception types ----
export const EXCEPTION_TYPES = {
  MISSING_READ:        { code: 'MISSING_READ',        label: 'Missing Read',              severity: 'Error',   billingImpact: true },
  CONSUMPTION_SPIKE:   { code: 'CONSUMPTION_SPIKE',   label: 'Consumption Spike',         severity: 'Error',   billingImpact: true },
  ZERO_READ:           { code: 'ZERO_READ',           label: 'Zero Read Active Acct',     severity: 'Warning', billingImpact: true },
  NEGATIVE_CONSUMPTION:{ code: 'NEGATIVE_CONSUMPTION',label: 'Negative Consumption',      severity: 'Error',   billingImpact: true },
  STALE_DATA:          { code: 'STALE_DATA',          label: 'Stale Data',                severity: 'Warning', billingImpact: false },
  COMM_FAILURE:        { code: 'COMM_FAILURE',        label: 'Communication Failure',     severity: 'Error',   billingImpact: false },
  TAMPER_ALERT:        { code: 'TAMPER_ALERT',        label: 'Tamper Alert',              severity: 'Error',   billingImpact: true },
  CT_RATIO_MISMATCH:   { code: 'CT_RATIO_MISMATCH',  label: 'CT Ratio Mismatch',         severity: 'Error',   billingImpact: true },
  TRANSFORMER_OUTAGE:  { code: 'TRANSFORMER_OUTAGE',  label: 'Transformer Outage',        severity: 'Error',   billingImpact: false },
  VOLTAGE_EXCURSION:   { code: 'VOLTAGE_EXCURSION',   label: 'Voltage Excursion',         severity: 'Warning', billingImpact: false },
};

// ---- Resolution options ----
export const RESOLUTION_OPTIONS = [
  { code: 'RETRY_COMM',    label: 'Retry Communication',     description: 'Send on-demand read request to meter' },
  { code: 'EDIT_DATA',     label: 'Edit / Correct Data',     description: 'Manually correct the interval data' },
  { code: 'ESTIMATE',      label: 'Estimate Usage',          description: 'Apply estimation method (linear/historical/similar)' },
  { code: 'FIELD_ORDER',   label: 'Issue Field Service Order',description: 'Dispatch a field technician to investigate' },
  { code: 'ESCALATE',      label: 'Escalate to Supervisor',  description: 'Flag for supervisor review' },
];

// ---- Seeded PRNG so data is reproducible per session ----
let _seed = 42;
function seededRand() {
  _seed = (_seed * 1664525 + 1013904223) & 0xffffffff;
  return ((_seed >>> 0) / 0xffffffff);
}

function rand(min = 0, max = 1) {
  return min + Math.random() * (max - min);
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---- Build initial meter state ----
function buildInitialMeterState(meter) {
  const nominalV = 120 + (Math.random() - 0.5) * 3;
  return {
    meterID: meter.meterID,
    signalStrength: randInt(60, 100), // dBm analog 0-100
    signalLabel: 'Strong',
    lastHeard: Date.now() - randInt(0, 3600000),
    commStatus: 'Communicating',
    veeStatus: 'Passed',
    staleCount: 0,
    lastRegisterRead: meter.avgKWh * randInt(800, 1200),
    intervalData: generateIntervalData(meter, 0),
    recentEvents: [],
    // Power quality
    voltageNominal: parseFloat(nominalV.toFixed(1)),
    currentVoltage: parseFloat(nominalV.toFixed(1)),
    powerQualityEvents: [],
    voltageExcursionCount: 0,
    anomalyFlags: {
      hasMissingRead: false,
      hasSpike: false,
      hasZero: false,
      hasNegative: false,
      isStale: false,
      hasCommFailure: false,
      hasTamper: false,
      hasCTMismatch: false,
    },
  };
}

export function generateIntervalData(meter, noiseLevel = 0) {
  const profile = meter.dailyProfile;
  return profile.map((multiplier, i) => {
    const base = meter.avgKWh / 24 / 4; // kWh per 15-min interval
    const noise = (Math.random() - 0.5) * noiseLevel * base;
    const value = Math.max(0, base * multiplier + noise);
    return parseFloat(value.toFixed(4));
  });
}

function signalToLabel(strength) {
  if (strength >= 70) return 'Strong';
  if (strength >= 40) return 'Weak';
  return 'None';
}

// ---- Main simulation state ----
let simState = null;

export function initSimulation() {
  const stored = localStorage.getItem('ami_sim_state');
  if (stored) {
    try {
      simState = JSON.parse(stored);
      return simState;
    } catch (e) {
      console.warn('Failed to parse stored sim state, reinitializing');
    }
  }

  const now = Date.now();
  simState = {
    // Sim clock starts at 6:00 AM today
    simTime: new Date().setHours(6, 0, 0, 0),
    simSpeed: 1,            // 1 = 1x, 5 = 5x, 10 = 10x, 0 = paused
    cycle: 0,
    exceptions: [],
    resolvedExceptions: [],
    fieldOrders: [],
    nextExceptionID: 1000,
    nextFieldOrderID: 5000,
    collectorStates: COLLECTORS.reduce((acc, c) => {
      acc[c.id] = { online: true, lastSeen: now };
      return acc;
    }, {}),
    meterStates: METERS.reduce((acc, m) => {
      acc[m.meterID] = buildInitialMeterState(m);
      return acc;
    }, {}),
    resolvedTodayCount: 0,
    resolutionTimes: [],       // ms per resolution, for avg calculation
    dailyExceptionCounts: buildLast7DaysCounts(),
  };

  persistState();
  return simState;
}

function buildLast7DaysCounts() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      date: d.toISOString().split('T')[0],
      count: randInt(3, 18),
    });
  }
  return days;
}

export function getSimState() {
  return simState;
}

export function persistState() {
  if (!simState) return;
  try {
    localStorage.setItem('ami_sim_state', JSON.stringify(simState));
  } catch (e) {
    console.warn('localStorage persist failed:', e);
  }
}

// ---- Tick — called by simulation timer ----
export function tick(listeners = []) {
  if (!simState || simState.simSpeed === 0) return;

  // Advance sim clock: each real-time tick = 1 sim hour
  simState.simTime += 3600000 * simState.simSpeed;
  simState.cycle += 1;

  // Run collector events
  runCollectorEvents();

  // Run per-meter simulation
  METERS.forEach(meter => {
    runMeterTick(meter);
  });

  // Generate new exceptions
  generateExceptions();

  persistState();

  // Notify subscribers
  listeners.forEach(fn => fn({ ...simState }));
}

function runCollectorEvents() {
  COLLECTORS.forEach(collector => {
    const state = simState.collectorStates[collector.id];
    if (state.online) {
      // 0.5% chance to go offline per tick
      if (Math.random() < 0.005) {
        state.online = false;
        state.offlineSince = simState.simTime;
        console.log(`[SIM] Collector ${collector.id} went OFFLINE`);
      }
    } else {
      // 20% chance to come back online each tick
      if (Math.random() < 0.2) {
        state.online = true;
        state.lastSeen = simState.simTime;
        console.log(`[SIM] Collector ${collector.id} came ONLINE`);
      }
    }
  });
}

function runMeterTick(meter) {
  const ms = simState.meterStates[meter.meterID];
  const collectorOnline = simState.collectorStates[meter.collectorID]?.online ?? true;

  if (!collectorOnline) {
    // Collector offline → meter not communicating
    ms.commStatus = 'Not Communicating';
    ms.signalStrength = 0;
    ms.signalLabel = 'None';
    return;
  }

  // Signal drift
  const drift = (Math.random() - 0.5) * 10;
  ms.signalStrength = Math.max(0, Math.min(100, ms.signalStrength + drift));
  ms.signalLabel = signalToLabel(ms.signalStrength);

  if (ms.signalStrength < 10) {
    ms.commStatus = 'Not Communicating';
    return;
  }

  ms.commStatus = 'Communicating';
  ms.lastHeard = simState.simTime;

  // Occasionally stale
  if (Math.random() < 0.01) {
    ms.staleCount++;
  } else {
    ms.staleCount = Math.max(0, ms.staleCount - 1);
  }

  // Update register read
  const dailyKWh = meter.avgKWh * (0.9 + Math.random() * 0.2);
  ms.lastRegisterRead += dailyKWh / 24;

  // ---- Power quality simulation ----
  const nomV = ms.voltageNominal || 120;
  const vDrift = (Math.random() - 0.5) * 2.5;
  ms.currentVoltage = parseFloat(Math.max(108, Math.min(132, nomV + vDrift)).toFixed(1));

  if (!ms.powerQualityEvents) ms.powerQualityEvents = [];

  // Voltage sag (< 110V) — 1.5% chance per tick
  if (Math.random() < 0.015) {
    const sagV = parseFloat((95 + Math.random() * 14).toFixed(1));
    ms.currentVoltage = sagV;
    ms.powerQualityEvents.unshift({ ts: simState.simTime, type: 'VOLTAGE_SAG', voltage: sagV, label: `Voltage Sag: ${sagV}V` });
    ms.voltageExcursionCount = (ms.voltageExcursionCount || 0) + 1;
  }

  // Voltage swell (> 130V) — 0.8% chance per tick
  if (Math.random() < 0.008) {
    const swellV = parseFloat((131 + Math.random() * 9).toFixed(1));
    ms.currentVoltage = swellV;
    ms.powerQualityEvents.unshift({ ts: simState.simTime, type: 'VOLTAGE_SWELL', voltage: swellV, label: `Voltage Swell: ${swellV}V` });
    ms.voltageExcursionCount = (ms.voltageExcursionCount || 0) + 1;
  }

  // Momentary outage (< 5 sim-min) — 0.3% chance per tick
  if (Math.random() < 0.003) {
    const dur = Math.ceil(Math.random() * 4);
    ms.powerQualityEvents.unshift({ ts: simState.simTime, type: 'MOMENTARY_OUTAGE', durationMin: dur, label: `Momentary Outage: ${dur} min` });
  }

  // Sustained outage (> 5 sim-min) — 0.1% chance per tick
  if (Math.random() < 0.001) {
    const dur = Math.ceil(6 + Math.random() * 54);
    ms.powerQualityEvents.unshift({ ts: simState.simTime, type: 'SUSTAINED_OUTAGE', durationMin: dur, label: `Sustained Outage: ${dur} min` });
  }

  // Keep only last 30 PQ events
  if (ms.powerQualityEvents.length > 30) ms.powerQualityEvents.length = 30;
}

function generateExceptions() {
  const now = simState.simTime;
  const meterIDs = METERS.map(m => m.meterID);

  // Missing read — 1-3% of meters per cycle
  const missingCount = randInt(0, Math.ceil(METERS.length * 0.03));
  for (let i = 0; i < missingCount; i++) {
    const meterID = pickRandom(meterIDs);
    if (!hasOpenException(meterID, 'MISSING_READ')) {
      addException('MISSING_READ', meterID, {
        detail: 'No interval data received for this meter in the current cycle.',
      });
    }
  }

  // Consumption spike — 1-2 meters per cycle
  if (Math.random() < 0.4) {
    const meterID = pickRandom(meterIDs.filter(id => !hasOpenException(id, 'CONSUMPTION_SPIKE')));
    if (meterID) {
      const meter = METERS.find(m => m.meterID === meterID);
      const multiplier = (5 + Math.random() * 5).toFixed(1);
      addException('CONSUMPTION_SPIKE', meterID, {
        detail: `Consumption ${multiplier}x historical average (${meter?.avgKWh} kWh/day). Peak interval recorded at ${(meter?.avgKWh / 24 * multiplier).toFixed(1)} kWh.`,
        multiplier: parseFloat(multiplier),
      });
    }
  }

  // Zero read — rare
  if (Math.random() < 0.15) {
    const activeMeter = pickRandom(METERS.filter(m =>
      m.rateClass !== 'Solar' && !hasOpenException(m.meterID, 'ZERO_READ')
    ));
    if (activeMeter) {
      addException('ZERO_READ', activeMeter.meterID, {
        detail: 'All 96 interval readings returned 0.000 kWh on an active account.',
      });
    }
  }

  // Negative consumption (non-solar)
  if (Math.random() < 0.1) {
    const nonSolar = METERS.filter(m => m.rateClass !== 'Solar');
    const meterID = pickRandom(nonSolar.map(m => m.meterID));
    if (meterID && !hasOpenException(meterID, 'NEGATIVE_CONSUMPTION')) {
      addException('NEGATIVE_CONSUMPTION', meterID, {
        detail: 'Negative consumption detected on non-solar account. Possible meter wiring reversal or data corruption.',
      });
    }
  }

  // Stale data — meters with high stale count
  METERS.forEach(meter => {
    const ms = simState.meterStates[meter.meterID];
    if (ms.staleCount >= 3 && !hasOpenException(meter.meterID, 'STALE_DATA')) {
      addException('STALE_DATA', meter.meterID, {
        detail: `Register read unchanged for ${ms.staleCount} consecutive cycles. Meter may be stuck.`,
      });
    }
  });

  // Communication failure — meters not communicating
  METERS.forEach(meter => {
    const ms = simState.meterStates[meter.meterID];
    if (ms.commStatus === 'Not Communicating' && !hasOpenException(meter.meterID, 'COMM_FAILURE')) {
      addException('COMM_FAILURE', meter.meterID, {
        detail: `Meter has not responded for ${Math.floor((now - ms.lastHeard) / 3600000)} hours. Last heard: ${new Date(ms.lastHeard).toLocaleTimeString()}.`,
      });
    }
  });

  // Tamper alert — very rare
  if (Math.random() < 0.02) {
    const meterID = pickRandom(meterIDs.filter(id => !hasOpenException(id, 'TAMPER_ALERT')));
    if (meterID) {
      addException('TAMPER_ALERT', meterID, {
        detail: 'Meter enclosure open event detected. Potential unauthorized meter access.',
        severity: 'CRITICAL',
      });
    }
  }

  // CT ratio mismatch — commercial meters only
  if (Math.random() < 0.08) {
    const commercial = METERS.filter(m => m.ctRatio && !hasOpenException(m.meterID, 'CT_RATIO_MISMATCH'));
    if (commercial.length > 0) {
      const meter = pickRandom(commercial);
      const programmed = meter.ctRatio;
      const detected = pickRandom([programmed * 2, programmed / 2, programmed + 200]);
      addException('CT_RATIO_MISMATCH', meter.meterID, {
        detail: `Programmed CT ratio: ${programmed}. Field-detected ratio: ${detected}. Billing multiplier error present.`,
        programmedCT: programmed,
        detectedCT: detected,
      });
    }
  }

  // Transformer outage — 2+ meters on same transformer not communicating
  TRANSFORMERS.forEach(trf => {
    const trfMeterIDs = getMetersByTransformer(trf.id);
    const darkIDs = trfMeterIDs.filter(mID => {
      const ms = simState.meterStates[mID];
      return ms && ms.commStatus === 'Not Communicating';
    });
    const alreadyOpen = simState.exceptions.some(
      e => e.type === 'TRANSFORMER_OUTAGE' && e.extra?.transformerID === trf.id && e.status === 'Open'
    );
    if (darkIDs.length >= 2 && !alreadyOpen) {
      addException('TRANSFORMER_OUTAGE', darkIDs[0], {
        detail: `${darkIDs.length}/${trfMeterIDs.length} meters on transformer ${trf.id} (${trf.address}) not communicating. Potential transformer-level outage.`,
        transformerID: trf.id,
        transformerName: trf.name,
        feederID: trf.feederID,
        affectedMeters: darkIDs,
        totalMeters: trfMeterIDs.length,
      });
    }
  });

  // Voltage excursion — meters with 3+ voltage events
  METERS.forEach(meter => {
    const ms = simState.meterStates[meter.meterID];
    if (!ms) return;
    if ((ms.voltageExcursionCount || 0) >= 3 && !hasOpenException(meter.meterID, 'VOLTAGE_EXCURSION')) {
      const pqEvents = (ms.powerQualityEvents || []).filter(e => e.type === 'VOLTAGE_SAG' || e.type === 'VOLTAGE_SWELL');
      const sagCount   = pqEvents.filter(e => e.type === 'VOLTAGE_SAG').length;
      const swellCount = pqEvents.filter(e => e.type === 'VOLTAGE_SWELL').length;
      addException('VOLTAGE_EXCURSION', meter.meterID, {
        detail: `${ms.voltageExcursionCount} voltage excursion events (${sagCount} sags, ${swellCount} swells). Circuit power quality may be degraded.`,
        sagCount,
        swellCount,
        excursionCount: ms.voltageExcursionCount,
      });
      ms.voltageExcursionCount = 0;
    }
  });
}

function hasOpenException(meterID, type) {
  return simState.exceptions.some(
    e => e.meterID === meterID && e.type === type && e.status === 'Open'
  );
}

function addException(type, meterID, extra = {}) {
  const meter = METERS.find(m => m.meterID === meterID);
  const exType = EXCEPTION_TYPES[type];
  const id = `EXC-${String(simState.nextExceptionID++).padStart(5, '0')}`;

  const exc = {
    id,
    meterID,
    accountNumber: meter?.accountNumber,
    customerName: meter?.customerName,
    address: meter?.address,
    type,
    typeLabel: exType.label,
    severity: exType.severity,
    billingImpact: exType.billingImpact,
    status: 'Open',
    createdAt: simState.simTime,
    updatedAt: simState.simTime,
    detail: extra.detail || '',
    extra,
    auditTrail: [
      { ts: simState.simTime, action: 'Exception generated by VEE engine', user: 'SYSTEM' }
    ],
    note: '',
    resolution: null,
  };

  simState.exceptions.push(exc);

  // Cap at 200 open exceptions
  if (simState.exceptions.length > 200) {
    simState.exceptions.shift();
  }
}

// ---- User actions ----

export function resolveException(exceptionID, resolution, note, analyst = 'AMI Analyst') {
  const exc = simState.exceptions.find(e => e.id === exceptionID);
  if (!exc) return false;

  const now = Date.now();
  const resolutionTime = now - (exc.createdAt);

  exc.status = 'Resolved';
  exc.updatedAt = now;
  exc.resolution = resolution;
  exc.note = note;
  exc.auditTrail.push({
    ts: now,
    action: `Resolved: ${RESOLUTION_OPTIONS.find(r => r.code === resolution)?.label || resolution}`,
    note,
    user: analyst,
  });

  simState.resolvedTodayCount++;
  simState.resolutionTimes.push(resolutionTime);

  // Move to resolved list
  simState.resolvedExceptions.push({ ...exc });
  simState.exceptions = simState.exceptions.filter(e => e.id !== exceptionID);

  persistState();
  return true;
}

export function issueFieldOrder(meterID, accountNumber, issue, requestedBy = 'AMI Analyst') {
  const meter = METERS.find(m => m.meterID === meterID);
  const id = `FSO-${String(simState.nextFieldOrderID++).padStart(5, '0')}`;

  const order = {
    id,
    meterID,
    accountNumber: accountNumber || meter?.accountNumber,
    customerName: meter?.customerName,
    address: meter?.address,
    issue,
    status: 'Pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    requestedBy,
    technicianID: null,
    completedAt: null,
    notes: [],
  };

  simState.fieldOrders.push(order);
  persistState();
  return order;
}

export function requestOnDemandRead(meterID) {
  const ms = simState.meterStates[meterID];
  if (!ms) return { success: false, message: 'Meter not found' };

  // 70% success if communicating, 20% if not
  const successRate = ms.commStatus === 'Communicating' ? 0.7 : 0.2;
  const success = Math.random() < successRate;

  const event = {
    ts: Date.now(),
    type: success ? 'ON_DEMAND_SUCCESS' : 'ON_DEMAND_FAILURE',
    message: success
      ? `On-demand read successful. Register: ${ms.lastRegisterRead.toFixed(2)} kWh`
      : 'On-demand read timed out. Meter did not respond.',
  };

  if (!ms.recentEvents) ms.recentEvents = [];
  ms.recentEvents.unshift(event);
  if (ms.recentEvents.length > 20) ms.recentEvents.pop();

  if (success) {
    ms.lastHeard = Date.now();
    ms.commStatus = 'Communicating';
  }

  persistState();
  return { success, message: event.message };
}

export function setSimSpeed(speed) {
  if (simState) {
    simState.simSpeed = speed;
    persistState();
  }
}

export function getAvgResolutionTime() {
  const times = simState?.resolutionTimes || [];
  if (times.length === 0) return 0;
  return Math.round(times.reduce((a, b) => a + b, 0) / times.length / 60000); // minutes
}

export function getBillingReadiness() {
  const total = METERS.length;
  const withExceptions = new Set(simState?.exceptions.map(e => e.meterID)).size;
  return Math.round(((total - withExceptions) / total) * 100);
}

export function resetSimulation() {
  localStorage.removeItem('ami_sim_state');
  simState = null;
  return initSimulation();
}
