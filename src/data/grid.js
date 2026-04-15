// ============================================================
// GRID TOPOLOGY — Distribution Grid Hierarchy
// 2 Substations → 4 Feeders → 12 Transformers → 50 Meters
// ============================================================

export const SUBSTATIONS = [
  {
    id: 'SUB-MASS',
    name: 'Springfield Substation',
    location: 'Springfield, MA',
    voltage: '115kV / 13.8kV',
    feederIDs: ['FDR-SW-A', 'FDR-SW-B', 'FDR-SC-A'],
  },
  {
    id: 'SUB-NH',
    name: 'Manchester Substation',
    location: 'Manchester, NH',
    voltage: '115kV / 13.8kV',
    feederIDs: ['FDR-NH-A'],
  },
];

export const FEEDERS = [
  { id: 'FDR-SW-A', substationID: 'SUB-MASS', name: 'Feeder SW-A',  description: 'Springfield-West Residential',  voltage: '13.8kV', transformerIDs: ['TRF-SW-01', 'TRF-SW-02', 'TRF-SW-03'] },
  { id: 'FDR-SW-B', substationID: 'SUB-MASS', name: 'Feeder SW-B',  description: 'Springfield-West Commercial',   voltage: '13.8kV', transformerIDs: ['TRF-SW-04', 'TRF-SW-05', 'TRF-SW-06'] },
  { id: 'FDR-SC-A', substationID: 'SUB-MASS', name: 'Feeder SC-A',  description: 'Springfield-Central Mixed',     voltage: '13.8kV', transformerIDs: ['TRF-SC-01', 'TRF-SC-02', 'TRF-SC-03'] },
  { id: 'FDR-NH-A', substationID: 'SUB-NH',   name: 'Feeder NH-A',  description: 'Manchester / Concord Mixed',    voltage: '13.8kV', transformerIDs: ['TRF-NA-01', 'TRF-NA-02', 'TRF-NA-03'] },
];

export const TRANSFORMERS = [
  // Feeder SW-A (Springfield-West Residential)
  { id: 'TRF-SW-01', feederID: 'FDR-SW-A', name: 'SW-01', address: 'Elm St / Oak Ave Junction',      kva: 50,   meterCount: 4 },
  { id: 'TRF-SW-02', feederID: 'FDR-SW-A', name: 'SW-02', address: 'Birch Rd Pad Mount',             kva: 37.5, meterCount: 3 },
  { id: 'TRF-SW-03', feederID: 'FDR-SW-A', name: 'SW-03', address: 'Maple Dr / Willow Ln',           kva: 50,   meterCount: 3 },
  // Feeder SW-B (Springfield-West Commercial)
  { id: 'TRF-SW-04', feederID: 'FDR-SW-B', name: 'SW-04', address: 'Main St Commercial Row',         kva: 500,  meterCount: 3 },
  { id: 'TRF-SW-05', feederID: 'FDR-SW-B', name: 'SW-05', address: 'Sunset Blvd / Cedar St',         kva: 75,   meterCount: 4 },
  { id: 'TRF-SW-06', feederID: 'FDR-SW-B', name: 'SW-06', address: 'Industrial Blvd / Park Ave',     kva: 500,  meterCount: 3 },
  // Feeder SC-A (Springfield-Central Mixed)
  { id: 'TRF-SC-01', feederID: 'FDR-SC-A', name: 'SC-01', address: 'Center St / Church Ave',         kva: 75,   meterCount: 6 },
  { id: 'TRF-SC-02', feederID: 'FDR-SC-A', name: 'SC-02', address: 'Broad St Distribution',          kva: 167,  meterCount: 5 },
  { id: 'TRF-SC-03', feederID: 'FDR-SC-A', name: 'SC-03', address: 'Grant St / Chestnut Rd',         kva: 1000, meterCount: 7 },
  // Feeder NH-A (Manchester / Concord)
  { id: 'TRF-NA-01', feederID: 'FDR-NH-A', name: 'NA-01', address: 'Elm St / Bridge St, Manchester', kva: 50,   meterCount: 4 },
  { id: 'TRF-NA-02', feederID: 'FDR-NH-A', name: 'NA-02', address: 'Canal St / Hanover, Manchester', kva: 1000, meterCount: 4 },
  { id: 'TRF-NA-03', feederID: 'FDR-NH-A', name: 'NA-03', address: 'Pleasant St / State, Concord',   kva: 50,   meterCount: 4 },
];

// Meter → Transformer assignment
export const METER_TRANSFORMER_MAP = {
  // FDR-SW-A → TRF-SW-01 (4), TRF-SW-02 (3), TRF-SW-03 (3)
  'MTR-SW-001': 'TRF-SW-01', 'MTR-SW-002': 'TRF-SW-01', 'MTR-SW-003': 'TRF-SW-01', 'MTR-SW-004': 'TRF-SW-01',
  'MTR-SW-005': 'TRF-SW-02', 'MTR-SW-006': 'TRF-SW-02', 'MTR-SW-007': 'TRF-SW-02',
  'MTR-SW-008': 'TRF-SW-03', 'MTR-SW-009': 'TRF-SW-03', 'MTR-SW-010': 'TRF-SW-03',
  // FDR-SW-B → TRF-SW-04 (3), TRF-SW-05 (4), TRF-SW-06 (3)
  'MTR-SW-011': 'TRF-SW-04', 'MTR-SW-012': 'TRF-SW-04', 'MTR-SW-013': 'TRF-SW-04',
  'MTR-SW-014': 'TRF-SW-05', 'MTR-SW-015': 'TRF-SW-05', 'MTR-SW-016': 'TRF-SW-05', 'MTR-SW-017': 'TRF-SW-05',
  'MTR-SW-018': 'TRF-SW-06', 'MTR-SW-019': 'TRF-SW-06', 'MTR-SW-020': 'TRF-SW-06',
  // FDR-SC-A → TRF-SC-01 (6), TRF-SC-02 (5), TRF-SC-03 (7)
  'MTR-SC-021': 'TRF-SC-01', 'MTR-SC-022': 'TRF-SC-01', 'MTR-SC-023': 'TRF-SC-01',
  'MTR-SC-024': 'TRF-SC-01', 'MTR-SC-025': 'TRF-SC-01', 'MTR-SC-026': 'TRF-SC-01',
  'MTR-SC-027': 'TRF-SC-02', 'MTR-SC-028': 'TRF-SC-02', 'MTR-SC-029': 'TRF-SC-02',
  'MTR-SC-030': 'TRF-SC-02', 'MTR-SC-031': 'TRF-SC-02',
  'MTR-SC-032': 'TRF-SC-03', 'MTR-SC-033': 'TRF-SC-03', 'MTR-SC-034': 'TRF-SC-03',
  'MTR-SC-035': 'TRF-SC-03', 'MTR-SC-036': 'TRF-SC-03', 'MTR-SC-037': 'TRF-SC-03', 'MTR-SC-038': 'TRF-SC-03',
  // FDR-NH-A → TRF-NA-01 (4), TRF-NA-02 (4), TRF-NA-03 (4)
  'MTR-NA-039': 'TRF-NA-01', 'MTR-NA-040': 'TRF-NA-01', 'MTR-NA-041': 'TRF-NA-01', 'MTR-NA-042': 'TRF-NA-01',
  'MTR-NA-043': 'TRF-NA-02', 'MTR-NA-044': 'TRF-NA-02', 'MTR-NA-045': 'TRF-NA-02', 'MTR-NA-046': 'TRF-NA-02',
  'MTR-NA-047': 'TRF-NA-03', 'MTR-NA-048': 'TRF-NA-03', 'MTR-NA-049': 'TRF-NA-03', 'MTR-NA-050': 'TRF-NA-03',
};

// Convenience: get all meter IDs on a given transformer
export function getMetersByTransformer(transformerID) {
  return Object.entries(METER_TRANSFORMER_MAP)
    .filter(([, tID]) => tID === transformerID)
    .map(([mID]) => mID);
}

// Convenience: get feeder for a meter
export function getFeederForMeter(meterID) {
  const trfID = METER_TRANSFORMER_MAP[meterID];
  if (!trfID) return null;
  return FEEDERS.find(f => f.id === TRANSFORMERS.find(t => t.id === trfID)?.feederID) || null;
}

// Convenience: get transformer for a meter
export function getTransformerForMeter(meterID) {
  const trfID = METER_TRANSFORMER_MAP[meterID];
  return TRANSFORMERS.find(t => t.id === trfID) || null;
}

// Build full hierarchy map: substation → feeders → transformers → meters
export function buildGridHierarchy(meterStates = {}) {
  return SUBSTATIONS.map(sub => ({
    ...sub,
    feeders: FEEDERS.filter(f => sub.feederIDs.includes(f.id)).map(feeder => ({
      ...feeder,
      transformers: TRANSFORMERS.filter(t => feeder.transformerIDs.includes(t.id)).map(trf => {
        const meterIDs = getMetersByTransformer(trf.id);
        const meterStatusList = meterIDs.map(mID => meterStates[mID]?.commStatus || 'Unknown');
        const darkCount = meterStatusList.filter(s => s === 'Not Communicating').length;
        return {
          ...trf,
          meterIDs,
          darkCount,
          status: darkCount === 0 ? 'OK'
            : darkCount >= meterIDs.length ? 'Outage'
            : darkCount >= 2 ? 'Degraded'
            : 'Degraded',
        };
      }),
    })),
  }));
}
