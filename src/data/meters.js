// ============================================================
// AMI METER DATA — 50 simulated meters across 3 service areas
// MA: Springfield-West, Springfield-Central
// NH: Manchester
// ============================================================

const FIRMWARE_VERSIONS = ['3.2.1', '3.2.4', '3.3.0', '4.0.1', '4.1.2'];
const RATE_CLASSES = ['Residential', 'Commercial', 'Solar'];

const NEIGHBORHOODS = [
  { id: 'SW', name: 'Springfield-West, MA',  collectorIDs: ['COL-SW-01', 'COL-SW-02'] },
  { id: 'SC', name: 'Springfield-Central, MA', collectorIDs: ['COL-SC-01', 'COL-SC-02'] },
  { id: 'NA', name: 'Manchester, NH',         collectorIDs: ['COL-NA-01'] },
];

const COLLECTORS = [
  { id: 'COL-SW-01', neighborhood: 'SW', name: 'Springfield-West Alpha', lat: 42.101, lng: -72.589, capacity: 12 },
  { id: 'COL-SW-02', neighborhood: 'SW', name: 'Springfield-West Beta',  lat: 42.099, lng: -72.591, capacity: 10 },
  { id: 'COL-SC-01', neighborhood: 'SC', name: 'Springfield-Central A',  lat: 42.105, lng: -72.580, capacity: 12 },
  { id: 'COL-SC-02', neighborhood: 'SC', name: 'Springfield-Central B',  lat: 42.103, lng: -72.576, capacity: 8  },
  { id: 'COL-NA-01', neighborhood: 'NA', name: 'Manchester Main',         lat: 42.996, lng: -71.454, capacity: 12 },
];

// Realistic daily usage profile — 96 intervals of 15 minutes each
// Values are multipliers on base usage
function buildDailyProfile(rateClass) {
  const hours = Array.from({ length: 96 }, (_, i) => i / 4); // 0..23.75
  return hours.map(h => {
    if (rateClass === 'Solar') {
      // Solar: negative during peak sun hours, normal at night
      if (h >= 9 && h < 16) {
        const mid = 12.5;
        const dist = Math.abs(h - mid) / 3.5;
        return -(1 - dist * dist) * 1.8;
      }
      return 0.15 + 0.05 * Math.random();
    }
    if (rateClass === 'Commercial') {
      // Commercial: flat low at night, ramps up 8am, peaks 10–6pm
      if (h < 7) return 0.3 + 0.05 * Math.random();
      if (h < 8) return 0.3 + (h - 7) * 0.5;
      if (h <= 18) return 0.9 + 0.15 * Math.sin(((h - 8) / 10) * Math.PI);
      if (h < 20) return 0.9 - (h - 18) * 0.3;
      return 0.3 + 0.05 * Math.random();
    }
    // Residential: typical duck curve
    if (h < 5)  return 0.12 + 0.03 * Math.random();
    if (h < 8)  return 0.12 + (h - 5) * 0.15;
    if (h < 9)  return 0.57 + 0.1 * Math.random();
    if (h < 17) return 0.35 + 0.1 * Math.sin(((h - 9) / 8) * Math.PI);
    if (h < 21) return 0.35 + (h - 17) * 0.18;
    if (h < 22) return 0.99;
    return 0.99 - (h - 22) * 0.4;
  });
}

const RAW_METERS = [
  // Springfield-West, MA — Residential (COL-SW-01)
  { meterID:'MTR-SW-001', accountNumber:'ACC-100001', customerName:'Ernest Hemingway',    address:'14 Elm St, Springfield, MA',          rateClass:'Residential', collectorID:'COL-SW-01', neighborhood:'SW', avgKWh:28 },
  { meterID:'MTR-SW-002', accountNumber:'ACC-100002', customerName:'Jane Austen',          address:'22 Elm St, Springfield, MA',          rateClass:'Residential', collectorID:'COL-SW-01', neighborhood:'SW', avgKWh:31 },
  { meterID:'MTR-SW-003', accountNumber:'ACC-100003', customerName:'Mark Twain',           address:'7 Oak Ave, Springfield, MA',          rateClass:'Residential', collectorID:'COL-SW-01', neighborhood:'SW', avgKWh:24 },
  { meterID:'MTR-SW-004', accountNumber:'ACC-100004', customerName:'Emily Bronte',         address:'33 Oak Ave, Springfield, MA',         rateClass:'Solar',       collectorID:'COL-SW-01', neighborhood:'SW', avgKWh:18 },
  { meterID:'MTR-SW-005', accountNumber:'ACC-100005', customerName:'Charles Dickens',      address:'5 Birch Rd, Springfield, MA',         rateClass:'Residential', collectorID:'COL-SW-01', neighborhood:'SW', avgKWh:35 },
  { meterID:'MTR-SW-006', accountNumber:'ACC-100006', customerName:'Virginia Woolf',       address:'19 Birch Rd, Springfield, MA',        rateClass:'Residential', collectorID:'COL-SW-01', neighborhood:'SW', avgKWh:29 },
  { meterID:'MTR-SW-007', accountNumber:'ACC-100007', customerName:'Charlotte Bronte',     address:'44 Maple Dr, Springfield, MA',        rateClass:'Solar',       collectorID:'COL-SW-01', neighborhood:'SW', avgKWh:22 },
  { meterID:'MTR-SW-008', accountNumber:'ACC-100008', customerName:'Edgar Allan Poe',      address:'8 Maple Dr, Springfield, MA',         rateClass:'Residential', collectorID:'COL-SW-01', neighborhood:'SW', avgKWh:33 },
  { meterID:'MTR-SW-009', accountNumber:'ACC-100009', customerName:'Oscar Wilde',          address:'60 Willow Ln, Springfield, MA',       rateClass:'Residential', collectorID:'COL-SW-01', neighborhood:'SW', avgKWh:27 },
  { meterID:'MTR-SW-010', accountNumber:'ACC-100010', customerName:'Thomas Hardy',         address:'12 Willow Ln, Springfield, MA',       rateClass:'Residential', collectorID:'COL-SW-01', neighborhood:'SW', avgKWh:41 },
  // Springfield-West, MA — Commercial/Mixed (COL-SW-02)
  { meterID:'MTR-SW-011', accountNumber:'ACC-100011', customerName:'Prancing Pony Inn',    address:'100 Main St, Springfield, MA',        rateClass:'Commercial',  collectorID:'COL-SW-02', neighborhood:'SW', avgKWh:180, ctRatio:200 },
  { meterID:'MTR-SW-012', accountNumber:'ACC-100012', customerName:'Mirkwood Automotive',  address:'110 Main St, Springfield, MA',        rateClass:'Commercial',  collectorID:'COL-SW-02', neighborhood:'SW', avgKWh:220, ctRatio:400 },
  { meterID:'MTR-SW-013', accountNumber:'ACC-100013', customerName:'George Eliot',         address:'3 Sunset Blvd, Springfield, MA',      rateClass:'Residential', collectorID:'COL-SW-02', neighborhood:'SW', avgKWh:26 },
  { meterID:'MTR-SW-014', accountNumber:'ACC-100014', customerName:'Henry James',          address:'17 Sunset Blvd, Springfield, MA',     rateClass:'Residential', collectorID:'COL-SW-02', neighborhood:'SW', avgKWh:38 },
  { meterID:'MTR-SW-015', accountNumber:'ACC-100015', customerName:'Edith Wharton',        address:'29 Cedar St, Springfield, MA',        rateClass:'Solar',       collectorID:'COL-SW-02', neighborhood:'SW', avgKWh:20 },
  { meterID:'MTR-SW-016', accountNumber:'ACC-100016', customerName:'Theodore Dreiser',     address:'41 Cedar St, Springfield, MA',        rateClass:'Residential', collectorID:'COL-SW-02', neighborhood:'SW', avgKWh:32 },
  { meterID:'MTR-SW-017', accountNumber:'ACC-100017', customerName:'Upton Sinclair',       address:'55 Pine Way, Springfield, MA',        rateClass:'Residential', collectorID:'COL-SW-02', neighborhood:'SW', avgKWh:29 },
  { meterID:'MTR-SW-018', accountNumber:'ACC-100018', customerName:'Stephen Crane',        address:'63 Pine Way, Springfield, MA',        rateClass:'Residential', collectorID:'COL-SW-02', neighborhood:'SW', avgKWh:44 },
  { meterID:'MTR-SW-019', accountNumber:'ACC-100019', customerName:'Bag End Laundromat',   address:'200 Industrial Blvd, Springfield, MA', rateClass:'Commercial', collectorID:'COL-SW-02', neighborhood:'SW', avgKWh:310, ctRatio:400 },
  { meterID:'MTR-SW-020', accountNumber:'ACC-100020', customerName:'Willa Cather',         address:'77 Park Ave, Springfield, MA',        rateClass:'Residential', collectorID:'COL-SW-02', neighborhood:'SW', avgKWh:25 },
  // Springfield-Central, MA (COL-SC-01)
  { meterID:'MTR-SC-021', accountNumber:'ACC-200021', customerName:'Gandalf Greyhame',     address:'5 Center St, Springfield, MA',        rateClass:'Residential', collectorID:'COL-SC-01', neighborhood:'SC', avgKWh:30 },
  { meterID:'MTR-SC-022', accountNumber:'ACC-200022', customerName:'Frodo Baggins',        address:'11 Center St, Springfield, MA',       rateClass:'Residential', collectorID:'COL-SC-01', neighborhood:'SC', avgKWh:22 },
  { meterID:'MTR-SC-023', accountNumber:'ACC-200023', customerName:'Aragorn Dunedain',     address:'23 Church Ave, Springfield, MA',      rateClass:'Residential', collectorID:'COL-SC-01', neighborhood:'SC', avgKWh:36 },
  { meterID:'MTR-SC-024', accountNumber:'ACC-200024', customerName:'Legolas Greenleaf',    address:'35 Church Ave, Springfield, MA',      rateClass:'Solar',       collectorID:'COL-SC-01', neighborhood:'SC', avgKWh:19 },
  { meterID:'MTR-SC-025', accountNumber:'ACC-200025', customerName:'Gimli son of Gloin',   address:'47 Broad St, Springfield, MA',        rateClass:'Residential', collectorID:'COL-SC-01', neighborhood:'SC', avgKWh:28 },
  { meterID:'MTR-SC-026', accountNumber:'ACC-200026', customerName:'Samwise Gamgee',       address:'59 Broad St, Springfield, MA',        rateClass:'Residential', collectorID:'COL-SC-01', neighborhood:'SC', avgKWh:33 },
  { meterID:'MTR-SC-027', accountNumber:'ACC-200027', customerName:'Shire Supply Co.',     address:'71 Broad St, Springfield, MA',        rateClass:'Commercial',  collectorID:'COL-SC-01', neighborhood:'SC', avgKWh:145, ctRatio:200 },
  { meterID:'MTR-SC-028', accountNumber:'ACC-200028', customerName:'Boromir of Gondor',    address:'83 Broad St, Springfield, MA',        rateClass:'Residential', collectorID:'COL-SC-01', neighborhood:'SC', avgKWh:41 },
  { meterID:'MTR-SC-029', accountNumber:'ACC-200029', customerName:'Faramir of Ithilien',  address:'12 Grant St, Springfield, MA',        rateClass:'Residential', collectorID:'COL-SC-01', neighborhood:'SC', avgKWh:27 },
  { meterID:'MTR-SC-030', accountNumber:'ACC-200030', customerName:'Eowyn of Rohan',       address:'24 Grant St, Springfield, MA',        rateClass:'Residential', collectorID:'COL-SC-01', neighborhood:'SC', avgKWh:31 },
  // Springfield-Central, MA (COL-SC-02)
  { meterID:'MTR-SC-031', accountNumber:'ACC-200031', customerName:'Rivendell Commerce Center', address:'500 Commerce Dr, Springfield, MA', rateClass:'Commercial', collectorID:'COL-SC-02', neighborhood:'SC', avgKWh:850, ctRatio:800 },
  { meterID:'MTR-SC-032', accountNumber:'ACC-200032', customerName:'Merry Brandybuck',     address:'8 Chestnut Rd, Springfield, MA',      rateClass:'Residential', collectorID:'COL-SC-02', neighborhood:'SC', avgKWh:26 },
  { meterID:'MTR-SC-033', accountNumber:'ACC-200033', customerName:'Pippin Took',          address:'16 Chestnut Rd, Springfield, MA',     rateClass:'Residential', collectorID:'COL-SC-02', neighborhood:'SC', avgKWh:39 },
  { meterID:'MTR-SC-034', accountNumber:'ACC-200034', customerName:'Galadriel of Lorien',  address:'28 Chestnut Rd, Springfield, MA',     rateClass:'Solar',       collectorID:'COL-SC-02', neighborhood:'SC', avgKWh:21 },
  { meterID:'MTR-SC-035', accountNumber:'ACC-200035', customerName:'Elrond Halfelven',     address:'40 Chestnut Rd, Springfield, MA',     rateClass:'Residential', collectorID:'COL-SC-02', neighborhood:'SC', avgKWh:35 },
  { meterID:'MTR-SC-036', accountNumber:'ACC-200036', customerName:'Bilbo Baggins',        address:'52 Chestnut Rd, Springfield, MA',     rateClass:'Residential', collectorID:'COL-SC-02', neighborhood:'SC', avgKWh:29 },
  { meterID:'MTR-SC-037', accountNumber:'ACC-200037', customerName:'Thorin Oakenshield',   address:'64 Chestnut Rd, Springfield, MA',     rateClass:'Residential', collectorID:'COL-SC-02', neighborhood:'SC', avgKWh:43 },
  { meterID:'MTR-SC-038', accountNumber:'ACC-200038', customerName:'Treebeard Fangorn',    address:'9 Valley Rd, Springfield, MA',        rateClass:'Residential', collectorID:'COL-SC-02', neighborhood:'SC', avgKWh:24 },
  // Manchester, NH (COL-NA-01)
  { meterID:'MTR-NA-039', accountNumber:'ACC-300039', customerName:'Walt Whitman',         address:'1 Elm St, Manchester, NH',            rateClass:'Residential', collectorID:'COL-NA-01', neighborhood:'NA', avgKWh:28 },
  { meterID:'MTR-NA-040', accountNumber:'ACC-300040', customerName:'Herman Melville',      address:'13 Elm St, Manchester, NH',           rateClass:'Residential', collectorID:'COL-NA-01', neighborhood:'NA', avgKWh:37 },
  { meterID:'MTR-NA-041', accountNumber:'ACC-300041', customerName:'Nathaniel Hawthorne',  address:'25 Bridge St, Manchester, NH',        rateClass:'Solar',       collectorID:'COL-NA-01', neighborhood:'NA', avgKWh:20 },
  { meterID:'MTR-NA-042', accountNumber:'ACC-300042', customerName:'Ralph W. Emerson',     address:'37 Bridge St, Manchester, NH',        rateClass:'Residential', collectorID:'COL-NA-01', neighborhood:'NA', avgKWh:32 },
  { meterID:'MTR-NA-043', accountNumber:'ACC-300043', customerName:'Henry D. Thoreau',     address:'49 Merrimack St, Manchester, NH',     rateClass:'Residential', collectorID:'COL-NA-01', neighborhood:'NA', avgKWh:26 },
  { meterID:'MTR-NA-044', accountNumber:'ACC-300044', customerName:'Shire Medical Group',  address:'200 Canal St, Manchester, NH',        rateClass:'Commercial',  collectorID:'COL-NA-01', neighborhood:'NA', avgKWh:1200, ctRatio:1200 },
  { meterID:'MTR-NA-045', accountNumber:'ACC-300045', customerName:'John Steinbeck',       address:'6 Hanover St, Nashua, NH',            rateClass:'Residential', collectorID:'COL-NA-01', neighborhood:'NA', avgKWh:30 },
  { meterID:'MTR-NA-046', accountNumber:'ACC-300046', customerName:'William Faulkner',     address:'18 Hanover St, Nashua, NH',           rateClass:'Residential', collectorID:'COL-NA-01', neighborhood:'NA', avgKWh:34 },
  { meterID:'MTR-NA-047', accountNumber:'ACC-300047', customerName:'Aldous Huxley',        address:'30 Pleasant St, Concord, NH',         rateClass:'Solar',       collectorID:'COL-NA-01', neighborhood:'NA', avgKWh:22 },
  { meterID:'MTR-NA-048', accountNumber:'ACC-300048', customerName:'George Orwell',        address:'42 North State St, Concord, NH',      rateClass:'Residential', collectorID:'COL-NA-01', neighborhood:'NA', avgKWh:29 },
  { meterID:'MTR-NA-049', accountNumber:'ACC-300049', customerName:'H.G. Wells',           address:'54 Main St, Concord, NH',             rateClass:'Residential', collectorID:'COL-NA-01', neighborhood:'NA', avgKWh:38 },
  { meterID:'MTR-NA-050', accountNumber:'ACC-300050', customerName:'Arthur Conan Doyle',   address:'66 Amherst St, Manchester, NH',       rateClass:'Residential', collectorID:'COL-NA-01', neighborhood:'NA', avgKWh:25 },
];

// Deduplicate and enrich
const seen = new Set();
export const METERS = RAW_METERS
  .filter(m => {
    if (seen.has(m.meterID)) return false;
    seen.add(m.meterID);
    return true;
  })
  .map((m, i) => ({
    ...m,
    firmwareVersion: FIRMWARE_VERSIONS[i % FIRMWARE_VERSIONS.length],
    installDate: new Date(2019 + (i % 4), (i * 3) % 12, (i * 7) % 28 + 1).toISOString().split('T')[0],
    dailyProfile: buildDailyProfile(m.rateClass),
    // Grid position for RF mesh visualization
    gridX: i % 10,
    gridY: Math.floor(i / 10),
  }));

export { NEIGHBORHOODS, COLLECTORS };

export function getMeterByID(id) {
  return METERS.find(m => m.meterID === id);
}

export function getMetersByCollector(collectorID) {
  return METERS.filter(m => m.collectorID === collectorID);
}

export function getMetersByNeighborhood(nhoodID) {
  return METERS.filter(m => m.neighborhood === nhoodID);
}
