// ============================================================
// useSimulation — React hook that drives the simulation clock
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  initSimulation,
  getSimState,
  tick,
  setSimSpeed,
  resolveException,
  issueFieldOrder,
  requestOnDemandRead,
  resetSimulation,
  getAvgResolutionTime,
  getBillingReadiness,
  persistState,
} from '../engine/simulation.js';
import { METERS } from '../data/meters.js';

// Tick interval in ms (real time). Each tick = 1 sim-hour * simSpeed
const TICK_INTERVAL_MS = 15000; // 15 seconds real time

export default function useSimulation() {
  const [state, setState] = useState(null);
  const listenersRef = useRef([]);
  const intervalRef = useRef(null);

  // Initialize on mount
  useEffect(() => {
    const initial = initSimulation();
    setState({ ...initial });

    // Start the tick loop
    const listener = (newState) => setState({ ...newState });
    listenersRef.current = [listener];

    intervalRef.current = setInterval(() => {
      tick(listenersRef.current);
    }, TICK_INTERVAL_MS);

    return () => {
      clearInterval(intervalRef.current);
    };
  }, []);

  const changeSpeed = useCallback((speed) => {
    setSimSpeed(speed);
    const current = getSimState();
    setState(prev => ({ ...prev, simSpeed: speed }));
  }, []);

  const resolve = useCallback((exceptionID, resolution, note) => {
    const success = resolveException(exceptionID, resolution, note);
    if (success) {
      setState({ ...getSimState() });
    }
    return success;
  }, []);

  const createFieldOrder = useCallback((meterID, accountNumber, issue) => {
    const order = issueFieldOrder(meterID, accountNumber, issue);
    setState({ ...getSimState() });
    return order;
  }, []);

  const onDemandRead = useCallback((meterID) => {
    const result = requestOnDemandRead(meterID);
    setState({ ...getSimState() });
    return result;
  }, []);

  const reset = useCallback(() => {
    clearInterval(intervalRef.current);
    const fresh = resetSimulation();
    setState({ ...fresh });
    intervalRef.current = setInterval(() => {
      tick(listenersRef.current);
    }, TICK_INTERVAL_MS);
  }, []);

  // Derived stats
  const derived = state ? {
    totalMeters: METERS.length,
    communicatingCount: Object.values(state.meterStates || {}).filter(m => m.commStatus === 'Communicating').length,
    communicatingPct: (() => {
      const total = METERS.length;
      const comm = Object.values(state.meterStates || {}).filter(m => m.commStatus === 'Communicating').length;
      return Math.round((comm / total) * 100);
    })(),
    openExceptions: (state.exceptions || []).filter(e => e.status === 'Open').length,
    resolvedToday: state.resolvedTodayCount || 0,
    pendingFieldOrders: (state.fieldOrders || []).filter(o => o.status !== 'Complete').length,
    avgResolutionMinutes: getAvgResolutionTime(),
    billingReadinessPct: getBillingReadiness(),
    exceptionsByType: (() => {
      const counts = {};
      (state.exceptions || []).forEach(e => {
        counts[e.typeLabel] = (counts[e.typeLabel] || 0) + 1;
      });
      return Object.entries(counts).map(([name, value]) => ({ name, value }));
    })(),
    simDate: new Date(state.simTime || Date.now()),
    collectorStates: state.collectorStates || {},
  } : null;

  return {
    state,
    derived,
    changeSpeed,
    resolve,
    createFieldOrder,
    onDemandRead,
    reset,
  };
}
