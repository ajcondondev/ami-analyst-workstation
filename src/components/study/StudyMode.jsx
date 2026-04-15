// ============================================================
// STUDY MODE — Glossary, exception explanations, quiz
// ============================================================

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { EXCEPTION_TYPES, RESOLUTION_OPTIONS } from '../../engine/simulation.js';
import { METERS } from '../../data/meters.js';

// ---- Simulation Challenges ----
const CHALLENGES = [
  {
    id: 'CH001',
    title: 'Critical Exception Clearance',
    difficulty: 'Intermediate',
    timeLimit: 180, // seconds
    description: 'A transformer on Feeder SW-A has had a partial outage. Multiple meters are dark and billing cycle close is tomorrow. Triage and clear all critical exceptions before the deadline.',
    scenario: 'Feeder SW-A, 6:00 AM. Three meters on TRF-SW-01 (MTR-SW-001, 002, 003) have gone dark overnight. Billing cycle closes in 26 hours. Your queue has 8 open exceptions.',
    checklist: [
      { id: 'c1', text: 'Check RF mesh — identify if collector COL-SW-01 is online' },
      { id: 'c2', text: 'Request on-demand reads for all 3 dark meters' },
      { id: 'c3', text: 'Identify the TRANSFORMER_OUTAGE exception in the queue' },
      { id: 'c4', text: 'Issue a Field Service Order for transformer inspection' },
      { id: 'c5', text: 'Estimate usage for all 3 meters using historical profile' },
      { id: 'c6', text: 'Document root cause in audit trail for each exception' },
      { id: 'c7', text: 'Escalate to supervisor — billing deadline approaching' },
    ],
    passCriteria: 'Complete all 7 steps before timer expires',
    learningPoints: 'Transformer outages require both immediate comm retry AND field dispatch. Never wait for field service when billing deadline is imminent — estimate and document.',
  },
  {
    id: 'CH002',
    title: 'Billing Deadline Triage',
    difficulty: 'Advanced',
    timeLimit: 240,
    description: 'It is 4:00 PM on billing cycle close day. You have 12 open exceptions, 6 with billing impact. Prioritize and resolve as many as possible before the 11:59 PM deadline.',
    scenario: 'Cycle close day. 7 hours remain. Open exceptions include: 2 MISSING_READ (Residential), 1 CT_RATIO_MISMATCH (Commercial, $12,000/mo), 1 TAMPER_ALERT, 3 COMM_FAILURE (collector came back online 30 min ago), 1 CONSUMPTION_SPIKE, 3 ZERO_READ.',
    checklist: [
      { id: 'c1', text: 'Triage by billing impact — identify the 6 billing-impacting exceptions' },
      { id: 'c2', text: 'Resolve CT_RATIO_MISMATCH first: issue FSO + escalate (largest revenue impact)' },
      { id: 'c3', text: 'Retry comm on the 3 COMM_FAILURE meters (collector just came back online)' },
      { id: 'c4', text: 'Estimate the 2 MISSING_READ meters using historical profile' },
      { id: 'c5', text: 'Issue FSO for TAMPER_ALERT (cannot be closed without field visit)' },
      { id: 'c6', text: 'Review CONSUMPTION_SPIKE interval chart — edit if data error, field order if real' },
      { id: 'c7', text: 'Estimate the 3 ZERO_READ meters — confirm accounts are residential (not solar)' },
      { id: 'c8', text: 'Document all resolutions with notes before 11:59 PM' },
    ],
    passCriteria: 'Complete all 8 steps and demonstrate correct priority order',
    learningPoints: 'On cycle close day, work in priority order: billing impact → revenue risk → comm retries → estimations. CT ratio mismatches on large commercial accounts always go first.',
  },
  {
    id: 'CH003',
    title: 'Power Quality Incident Response',
    difficulty: 'Advanced',
    timeLimit: 200,
    description: 'A voltage excursion event has been flagged on 4 meters in the Springfield-West area. Multiple sag events recorded. Identify the affected circuit and respond appropriately.',
    scenario: 'Multiple VOLTAGE_EXCURSION exceptions have fired on MTR-SW-005, 006, 007 (all on TRF-SW-02, Feeder SW-A). Voltage sags of 97V, 103V, and 101V were recorded over the past 3 hours. No communication failures — all meters are reading normally.',
    checklist: [
      { id: 'c1', text: 'Navigate to Outage Analysis — view topology tree for Feeder SW-A' },
      { id: 'c2', text: 'Confirm all 3 meters are on the same transformer (TRF-SW-02)' },
      { id: 'c3', text: 'Check MDMS Power Quality tab for each meter — note sag voltages' },
      { id: 'c4', text: 'Determine if this is a VOLTAGE_SAG pattern (multiple meters, same transformer)' },
      { id: 'c5', text: 'Rule out meter fault — on-demand reads return valid data (not comm issue)' },
      { id: 'c6', text: 'Issue a Field Service Order with issue type: "Voltage quality investigation"' },
      { id: 'c7', text: 'Escalate to Distribution Engineering (voltage quality is out of analyst scope)' },
      { id: 'c8', text: 'Document timeline: when sags occurred, voltage levels, affected meters' },
    ],
    passCriteria: 'Correctly identify transformer-level pattern and escalate appropriately',
    learningPoints: 'Voltage excursions that affect multiple meters on the same transformer indicate a distribution-level power quality issue, not a meter problem. These require field investigation and engineering escalation, not data estimation.',
  },
];

// ---- AMI Glossary ----
const GLOSSARY = [
  { term: 'AMI',              def: 'Advanced Metering Infrastructure. A two-way communication system enabling remote meter reading, near real-time data collection, and remote control of smart meters.' },
  { term: 'HES / Head-End System', def: 'The software platform that communicates with meters in the field. Acts as the command center for the RF mesh, managing data collection, commands, and meter events.' },
  { term: 'MDMS',             def: 'Meter Data Management System. Stores, validates, and processes interval data from all meters. The authoritative repository for usage data used in billing.' },
  { term: 'VEE',              def: 'Validation, Estimation, and Editing. The automated process that checks interval data for errors, estimates missing reads, and applies corrections before billing.' },
  { term: 'RF Mesh',          def: 'Radio Frequency Mesh Network. A self-healing wireless network where each smart meter acts as a node that can relay data from other meters to collectors.' },
  { term: 'Collector / DCU',  def: 'Data Collector Unit. A node in the RF mesh that aggregates data from nearby meters and transmits to the Head-End System via backhaul (cellular or fiber).' },
  { term: 'Interval Data',    def: '15-minute usage readings stored as a time series. Each day generates 96 intervals per meter. Used for TOU billing and load analysis.' },
  { term: 'Register Read',    def: 'Cumulative kWh reading from the meter\'s register. Analogous to an odometer. The delta between two reads equals consumption for that period.' },
  { term: 'Last Gasp',        def: 'An event message transmitted by the meter the instant it detects power loss. Used to quickly identify outage locations without a customer call.' },
  { term: 'Power Restore',    def: 'An event transmitted when the meter detects power has been restored. Paired with Last Gasp to calculate outage duration.' },
  { term: 'CT Ratio',         def: 'Current Transformer Ratio. Used on commercial/industrial meters with high loads. A CT steps down large currents so the meter can read them. The ratio (e.g., 400:5) must be programmed correctly or billing is wrong by that multiplier.' },
  { term: 'On-Demand Read',   def: 'A command sent from the HES to a specific meter requesting an immediate register/interval read, rather than waiting for the next scheduled read cycle.' },
  { term: 'Tamper Alert',     def: 'An event generated when the meter detects unauthorized access — typically an enclosure open event, magnetic interference, or reversed meter wiring.' },
  { term: 'Stale Data',       def: 'When a meter\'s register read does not change across multiple read cycles, indicating the meter is not advancing. Could be a frozen head, failed display, or comm issue masking real data.' },
  { term: 'Estimation',       def: 'Replacing a missing or invalid interval with a calculated value. Estimation methods include linear interpolation, historical profile, and similar-meter substitution.' },
  { term: 'Exception',        def: 'A flag raised by VEE or the HES when data fails a validation rule. Exceptions must be reviewed and resolved by an analyst before affected intervals are used for billing.' },
  { term: 'TOU',              def: 'Time-of-Use pricing. Rate structure where electricity costs more during peak hours (typically afternoon/evening) and less during off-peak. Requires interval data to calculate correctly.' },
  { term: 'Net Metering',     def: 'Billing arrangement for solar customers. Excess generation exported to the grid offsets consumption charges. Requires the meter to record both import and export.' },
  { term: 'Backhaul',         def: 'The communication link between a collector (DCU) and the Head-End System. Typically cellular (4G/5G) or fiber. If backhaul fails, all downstream meters become unreachable.' },
  { term: 'Billing Readiness',def: 'Metric expressing what percentage of accounts have validated interval data suitable for bill generation. Target is >98% at cycle close.' },
  { term: 'FSO',              def: 'Field Service Order. A work order dispatched to a technician to physically investigate or repair a meter. Created when remote resolution is not possible.' },
  { term: 'Sum Check',        def: 'VEE rule that verifies the sum of all 96 interval reads equals the register delta within a tolerance (typically ±0.5%). A mismatch suggests data corruption or transmission error.' },
  { term: 'Spike Check',      def: 'VEE rule comparing current interval data to the meter\'s 30-day historical profile. Deviations beyond 3 standard deviations trigger a spike exception.' },
  { term: 'Signal Strength',  def: 'Measured in dBm, indicates the quality of the RF signal between a meter and its collector. Below -100 dBm is considered marginal; above -85 dBm is strong.' },
  { term: 'Firmware',         def: 'Software embedded in the smart meter. Updated remotely (OTA — over the air) via the HES. Firmware version affects feature support, bug fixes, and event reporting.' },
  { term: 'CIS',              def: 'Customer Information System. The utility\'s billing and account management platform. Contains customer demographics, rate plans, billing history, and service history.' },
  { term: 'Substation',       def: 'A high-voltage facility where transmission voltage (e.g., 115kV) is stepped down to distribution voltage (e.g., 13.8kV) for delivery to customers via feeders.' },
  { term: 'Feeder',           def: 'A medium-voltage distribution circuit (typically 4kV–34.5kV) originating from a substation. Serves a geographic area and supplies multiple distribution transformers.' },
  { term: 'Distribution Transformer', def: 'A pole-mounted or pad-mounted device that steps distribution voltage (13.8kV) down to service voltage (120/240V) for delivery to end customers. Typically serves 3–15 meters.' },
  { term: 'Voltage Sag',      def: 'A brief reduction in RMS voltage below 90% of nominal (below 108V on a 120V circuit). Can be caused by motor starting, fault clearing, or load switching. Does not cause data loss but indicates power quality issues.' },
  { term: 'Voltage Swell',    def: 'A brief increase in RMS voltage above 110% of nominal (above 132V on a 120V circuit). Can be caused by load disconnection or capacitor switching. Indicated by VOLTAGE_EXCURSION exceptions.' },
  { term: 'Momentary Outage', def: 'A power interruption lasting less than 5 minutes. Meters will log a Last Gasp followed quickly by a Power Restore. Momentary outages don\'t require estimation if data was collected before and after.' },
  { term: 'Sustained Outage', def: 'A power interruption lasting more than 5 minutes. Requires data estimation for the outage period if meter interval data is missing. May require field investigation to determine cause.' },
  { term: 'SLA',              def: 'Service Level Agreement. In AMI operations, SLAs define the maximum acceptable time to resolve exceptions (e.g., 24h for errors, 72h for warnings). Unresolved exceptions at SLA breach require escalation.' },
  { term: 'Billing Cycle',    def: 'The monthly period over which consumption is measured for billing. Typically closes on a fixed day (e.g., the 15th). All exceptions with billing impact must be resolved before cycle close to enable accurate bill generation.' },
  { term: 'Outage Correlation', def: 'The process of identifying when multiple meters losing communication are caused by a single upstream device (transformer, collector, or feeder) rather than individual meter failures. Critical for efficient triage.' },
].sort((a, b) => a.term.localeCompare(b.term));

// ---- Exception explanations ----
const EXCEPTION_EXPLANATIONS = {
  MISSING_READ: {
    what: 'One or more 15-minute intervals did not arrive in the MDMS from the meter for the current read cycle.',
    why: 'Without complete interval data, the system cannot accurately calculate daily consumption or TOU charges. Billing on estimated data introduces revenue risk.',
    causes: ['RF signal dropout', 'Collector backhaul failure', 'Meter firmware crash', 'Power outage during collection window'],
    resolutions: [
      { action: 'Retry Comm', when: 'Signal is adequate — meter may have missed the collection window' },
      { action: 'Estimate',   when: 'Comm retry failed — gap is short and load profile is stable' },
      { action: 'Field Order', when: 'Meter has not responded for 24+ hours or signal is consistently poor' },
    ],
    studyTip: 'Missing reads are the most common exception type (~60-70% of queue in normal operations). The key skill is triaging: is this a comm issue (retry first) or a meter failure (field order)?',
  },
  CONSUMPTION_SPIKE: {
    what: 'One or more interval readings far exceed the meter\'s 30-day historical average — typically 3–10× normal.',
    why: 'A billing spike can generate a customer complaint and a revenue recovery issue. If the spike is real, it may indicate a load change or CT ratio error. If fake, it inflates usage incorrectly.',
    causes: ['CT ratio mismatch (commercial)', 'Meter wiring reversal', 'Actual load change (new equipment, EV charger)', 'Data corruption / bit flip in transmission'],
    resolutions: [
      { action: 'Edit Data',  when: 'Data is clearly corrupt and historical profile can replace it' },
      { action: 'Field Order', when: 'CT ratio verification needed or physical inspection required' },
      { action: 'Escalate',   when: 'Large commercial account with potential significant billing impact' },
    ],
    studyTip: 'Always check the account rate class first. On commercial/CT meters, a spike could indicate the CT ratio is wrong — the error multiplies every reading.',
  },
  ZERO_READ: {
    what: 'All 96 intervals for the period returned exactly 0.000 kWh on an account known to be active.',
    why: 'An active account cannot have zero consumption unless something has failed. Billing zero usage means potential revenue loss and may violate service continuity rules.',
    causes: ['Meter head failure', 'Communication failure (reads arrive as null/zero)', 'Meter tampering / bypass', 'New service with no load connected'],
    resolutions: [
      { action: 'Retry Comm', when: 'Check if meter is reachable — may be a comm/null-data issue' },
      { action: 'Estimate',   when: 'Account history is reliable and gap is isolated' },
      { action: 'Field Order', when: 'Multiple consecutive zero-read periods — physical inspection needed' },
    ],
    studyTip: 'Solar meters can legitimately show near-zero during low-sun periods. Always check rate class before flagging. Non-solar zero reads need a physical response if retry fails.',
  },
  NEGATIVE_CONSUMPTION: {
    what: 'Interval values are negative on an account that is not a net-metering solar customer.',
    why: 'Negative consumption on a residential/commercial account is physically impossible and indicates a data or wiring error. If billed, the customer receives a credit they didn\'t earn.',
    causes: ['Meter wired backwards (CT polarity reversal)', 'Phase error on 3-phase service', 'Data processing error in MDMS', 'Firmware bug in meter'],
    resolutions: [
      { action: 'Field Order', when: 'Meter wiring reversal suspected — technician must verify CT polarity' },
      { action: 'Edit Data',   when: 'Isolated data error with no wiring issue identified' },
      { action: 'Escalate',   when: 'Large commercial account or persistent issue' },
    ],
    studyTip: 'Note: solar net-metering accounts (R-NEM) will show negative intervals during peak sun hours — that\'s normal export. This exception is skipped for solar accounts in the VEE engine.',
  },
  STALE_DATA: {
    what: 'The meter\'s register read has not changed across 3 or more consecutive read cycles, despite the account being active.',
    why: 'A stuck register means consumption is not being recorded. The utility is providing service without measurement — a direct revenue loss.',
    causes: ['Frozen meter head (firmware issue)', 'Failed optical port / pulse output', 'Physical meter damage', 'Register rollover (meter hit maximum value)'],
    resolutions: [
      { action: 'Retry Comm', when: 'First occurrence — may be a transient comm issue masking real reads' },
      { action: 'Field Order', when: 'Confirmed 3+ cycles of identical reads — meter head replacement likely needed' },
      { action: 'Estimate',   when: 'While awaiting field work — estimate based on historical profile' },
    ],
    studyTip: 'Distinguish stale data from zero reads: stale means the same non-zero value repeats. Zero reads are their own exception. The stale count in the system tells you how many cycles.',
  },
  COMM_FAILURE: {
    what: 'The meter has not communicated with the Head-End System within the expected collection window.',
    why: 'No communication means no data. If unresolved, it cascades into missing reads and eventually stale data. Billing requires complete reads by cycle close.',
    causes: ['RF signal too weak (meter at cell edge)', 'Collector (DCU) offline', 'Physical meter failure', 'Firmware crash / hung meter process'],
    resolutions: [
      { action: 'Retry Comm', when: 'Signal was recently adequate — attempt on-demand read first' },
      { action: 'Field Order', when: 'Signal is poor long-term or collector is online but meter won\'t respond' },
      { action: 'Estimate',   when: 'Near billing cycle close and field response cannot arrive in time' },
    ],
    studyTip: 'Check the collector status first. If the collector is offline, ALL downstream meters will show comm failure. One collector issue can generate dozens of comm failure exceptions at once.',
  },
  TAMPER_ALERT: {
    what: 'The meter detected and transmitted an enclosure-open event, magnetic interference, or other tampering indicator.',
    why: 'Meter tampering can lead to service theft, unsafe conditions, and legal liability. All tamper alerts require investigation regardless of whether billing appears normal.',
    causes: ['Unauthorized meter access for service theft', 'Magnetic bypass device placed near meter', 'Legitimate utility work (accidental trigger)', 'Vandalism or physical damage'],
    resolutions: [
      { action: 'Field Order', when: 'Always — tamper alerts require physical investigation' },
      { action: 'Escalate',   when: 'High-usage commercial account, repeat tamper, or signs of bypass' },
    ],
    studyTip: 'Tamper alerts are never resolved by comm retry or estimation. A technician must physically inspect the meter and document findings. These are regulatory and safety events, not just data issues.',
  },
  TRANSFORMER_OUTAGE: {
    what: 'Two or more meters served by the same distribution transformer are simultaneously not communicating, suggesting a transformer-level failure rather than individual meter issues.',
    why: 'A transformer outage affects all downstream customers simultaneously, creating multiple comm failure and missing read exceptions that appear unrelated without grid topology context. Correct identification prevents unnecessary individual meter field orders.',
    causes: ['Distribution transformer failure (overload, lightning strike, age)', 'Fuse blown on transformer primary', 'Physical damage to transformer (vehicle strike, flooding)', 'Voltage collapse on transformer secondary'],
    resolutions: [
      { action: 'Field Order',  when: 'Always — transformer outages require physical investigation and likely replacement' },
      { action: 'Estimate',     when: 'While awaiting field response — estimate all affected meters using historical profiles' },
      { action: 'Escalate',     when: 'Large number of customers affected, commercial accounts impacted, or feeder-level event suspected' },
    ],
    studyTip: 'The key skill is recognizing the pattern: multiple meters going dark simultaneously on the same transformer is a transformer event, not a coincidence. Always check the grid topology before issuing individual meter field orders.',
  },
  VOLTAGE_EXCURSION: {
    what: 'A meter has recorded three or more voltage sag (< 110V) or voltage swell (> 130V) events within a monitoring period, indicating a power quality issue on the circuit.',
    why: 'Voltage excursions can damage customer equipment, violate regulatory voltage requirements (ANSI C84.1), and indicate underlying distribution problems. Unlike data quality exceptions, these do not affect billing but require engineering investigation.',
    causes: ['Heavy motor loads on the same circuit causing sag', 'Capacitor bank switching causing swell', 'Loose utility connections or corroded conductors', 'Undersized distribution transformer (chronic sag)', 'Fault clearing on adjacent feeders'],
    resolutions: [
      { action: 'Field Order',  when: 'Issue for voltage quality investigation — lineman must check utility connections' },
      { action: 'Escalate',     when: 'Always escalate to Distribution Engineering for root cause analysis and corrective action' },
      { action: 'Retry Comm',   when: 'Only if comm failure is also present — voltage excursions do not affect communication normally' },
    ],
    studyTip: 'Voltage excursion exceptions are a power quality issue, not a data quality issue. They should never be resolved with estimation or data edits. The correct response is always an FSO + Engineering escalation. Check if multiple meters on the same transformer are affected — that indicates a distribution-level problem.',
  },
  CT_RATIO_MISMATCH: {
    what: 'The CT (Current Transformer) ratio programmed in the meter does not match the ratio detected or expected based on service specifications.',
    why: 'CT ratio errors create a billing multiplier problem. If programmed at 200:5 but actual CT is 400:5, every reading is off by 2×. Commercial accounts can have very large billing errors.',
    causes: ['Wrong CT installed during meter exchange', 'CT ratio not updated in HES after transformer change', 'Programming error during meter installation', 'CT failure or bypass'],
    resolutions: [
      { action: 'Field Order', when: 'Always requires physical CT verification by a qualified technician' },
      { action: 'Escalate',   when: 'Large commercial account — may require billing adjustment / revenue recovery' },
    ],
    studyTip: 'CT ratio mismatches are exclusively on commercial/industrial accounts. The billing error equals (actual ratio / programmed ratio). A 2× error on a $10,000/month account is a $5,000/month problem.',
  },
};

// ---- Quiz scenarios ----
const QUIZ_SCENARIOS = [
  {
    id: 'Q001',
    scenario: 'A residential meter (MTR-SW-003) shows all 96 intervals as 0.000 kWh. The account is active. Signal strength is 85%. Collector COL-SW-01 is online.',
    question: 'What is the most appropriate first resolution action?',
    options: [
      { code: 'A', text: 'Immediately issue a Field Service Order', correct: false, explain: 'Close — but not first. Try comm first since signal is good and the collector is online.' },
      { code: 'B', text: 'Request an on-demand read to verify meter is communicating', correct: true, explain: 'Correct! Signal is strong, collector is online — retry comm first. The zero reads may be a data transmission error rather than a meter failure.' },
      { code: 'C', text: 'Estimate the usage using historical profile', correct: false, explain: 'Not yet — estimation is a last resort when remote resolution fails. Always try comm retry first when signal is available.' },
      { code: 'D', text: 'Escalate to supervisor', correct: false, explain: 'Escalation is for situations requiring authority or complex billing impact. This is a standard workflow — try comm first.' },
    ],
    exceptionType: 'ZERO_READ',
    difficulty: 'Beginner',
  },
  {
    id: 'Q002',
    scenario: 'A commercial account (Rivendell Commerce Center, 850 kWh avg/day) has a CT ratio exception. Programmed: 800:5. Field-detected ratio: 400:5. The meter has been running for 60 days.',
    question: 'What is the billing impact and correct resolution?',
    options: [
      { code: 'A', text: 'No billing impact — the data looks normal in MDMS', correct: false, explain: 'Incorrect. A 2× CT ratio error means all readings are half of actual consumption. The account has been billed for only 50% of actual usage for 60 days.' },
      { code: 'B', text: 'Issue a Field Order to verify CT physically, then escalate for billing adjustment', correct: true, explain: 'Correct! Physical verification is mandatory. With 800:5 programmed but 400:5 actual, consumption is under-read by 2×. A 60-day billing adjustment on a large commercial account needs supervisor/billing review.' },
      { code: 'C', text: 'Edit the CT ratio in MDMS and close the exception', correct: false, explain: 'You cannot just edit the ratio — you need physical verification first. And 60 days of back-billing requires an FSO and escalation, not just a setting change.' },
      { code: 'D', text: 'Estimate 60 days of usage and close', correct: false, explain: 'Estimation does not apply to CT ratio mismatches. This requires physical verification and a formal billing adjustment process.' },
    ],
    exceptionType: 'CT_RATIO_MISMATCH',
    difficulty: 'Advanced',
  },
  {
    id: 'Q003',
    scenario: 'Collector COL-SC-02 goes offline at 2:00 AM. By 6:00 AM, 8 meters downstream are showing COMM_FAILURE exceptions. The collector comes back online at 7:30 AM.',
    question: 'What is the most efficient resolution approach?',
    options: [
      { code: 'A', text: 'Issue 8 individual Field Service Orders, one per meter', correct: false, explain: 'This is unnecessary — the root cause was the collector, not individual meters. Once the collector is back, attempt on-demand reads first.' },
      { code: 'B', text: 'Estimate all 8 meters using historical profiles', correct: false, explain: 'Too soon — the collector is back online. Try on-demand reads first to recover actual data. Estimation is a last resort.' },
      { code: 'C', text: 'Wait for the next scheduled read cycle — no action needed', correct: false, explain: 'If billing cycle close is approaching, you may not have time to wait. Also, unresolved exceptions need notes in the audit trail.' },
      { code: 'D', text: 'Request on-demand reads for all 8 meters; close exceptions with note if data recovers', correct: true, explain: 'Correct! The root cause (collector outage) resolved itself. On-demand reads recover the missed data. If successful, close exceptions with a note documenting the collector event as root cause.' },
    ],
    exceptionType: 'COMM_FAILURE',
    difficulty: 'Intermediate',
  },
  {
    id: 'Q004',
    scenario: 'A tamper alert fires on MTR-NA-047 (residential, solar). Signal is 72%. No other exceptions on this account. Last gasp event was logged 3 hours ago but power restore was also received.',
    question: 'Which resolution is appropriate?',
    options: [
      { code: 'A', text: 'Retry comm — the last gasp/restore suggests a brief power event, not actual tampering', correct: false, explain: 'Incorrect. A last gasp followed by restore could be a brief power interruption, but the tamper alert still requires physical investigation — you cannot rule out tampering remotely.' },
      { code: 'B', text: 'Resolve as informational — solar meters trigger false tamper alerts', correct: false, explain: 'Incorrect. Rate class does not exempt a meter from tamper alert investigation. All tamper alerts require physical inspection.' },
      { code: 'C', text: 'Issue a Field Service Order for physical meter inspection', correct: true, explain: 'Correct. Tamper alerts always require a field response. The analyst notes the last gasp/restore as context (may be a brief power event) but investigation is mandatory — possible enclosure access cannot be ruled out remotely.' },
      { code: 'D', text: 'Estimate usage and escalate to supervisor', correct: false, explain: 'Estimating usage doesn\'t address the tamper. Escalation may be appropriate after the FSO if bypass is confirmed, but the FSO is the primary action.' },
    ],
    exceptionType: 'TAMPER_ALERT',
    difficulty: 'Intermediate',
  },
  {
    id: 'Q005',
    scenario: 'MTR-SC-033 (residential, 39 kWh avg/day) shows a consumption spike: 312 kWh in a single day. The account history shows stable consumption. The spike occurred on a Sunday. No CT ratio on this meter.',
    question: 'What do you do first?',
    options: [
      { code: 'A', text: 'Accept the data — customer may have had a party or used unusual appliances', correct: false, explain: 'You cannot accept data with an 8× spike without investigation. It may be real, but it must be confirmed.' },
      { code: 'B', text: 'Review the 96-interval chart for the spike day — identify which intervals are anomalous', correct: true, explain: 'Correct first step! The interval chart will tell you if the spike is across all intervals (systemic error) or just a few intervals (possible actual load event). This guides your resolution.' },
      { code: 'C', text: 'Immediately estimate the full day using historical profile', correct: false, explain: 'Premature — you need to review the data first. The spike may be real (large load event) or a specific interval error, not the whole day.' },
      { code: 'D', text: 'Issue a Field Service Order for meter inspection', correct: false, explain: 'Not the right first step for a residential meter with no CT ratio. Data review comes first — you may find the spike is a 1-2 interval blip that can be edited without a truck roll.' },
    ],
    exceptionType: 'CONSUMPTION_SPIKE',
    difficulty: 'Intermediate',
  },
  {
    id: 'Q006',
    scenario: 'It is 3:00 PM on billing cycle close day. MTR-SW-010 has 12 missing intervals from 2:00–4:59 AM this morning. Signal is now 45% (weak). The collector is online.',
    question: 'Given the time pressure, what is the right action?',
    options: [
      { code: 'A', text: 'Issue a Field Service Order', correct: false, explain: 'Too slow for cycle close day. A field tech cannot arrive and resolve in time to meet the billing deadline.' },
      { code: 'B', text: 'Try an on-demand read, then estimate if it fails — document reasoning', correct: true, explain: 'Correct. With cycle close imminent, you try comm once more (weak signal may recover). If that fails, estimate using historical profile for the 3-hour gap and document everything in the audit trail. Billing cannot wait.' },
      { code: 'C', text: 'Escalate to supervisor and do nothing else', correct: false, explain: 'Escalation alone doesn\'t resolve the billing block. You should escalate AND take action — comm retry plus estimation if needed.' },
      { code: 'D', text: 'Bill zero for the missing intervals', correct: false, explain: 'Never bill zero for known-active accounts — it understates consumption and creates a billing dispute. Estimate using approved methodology.' },
    ],
    exceptionType: 'MISSING_READ',
    difficulty: 'Advanced',
  },
  {
    id: 'Q007',
    scenario: 'At 3:00 AM, four meters simultaneously go dark: MTR-SC-021, 022, 023, 024 (all on transformer TRF-SC-01). Collector COL-SC-01 is online. No other meters on COL-SC-01 are affected.',
    question: 'What is the most likely root cause and correct first action?',
    options: [
      { code: 'A', text: 'Four individual meter failures — issue 4 separate Field Service Orders', correct: false, explain: 'Unlikely. Four meters failing simultaneously on the same transformer strongly suggests a transformer-level event, not 4 individual meter failures. Check topology before issuing individual FSOs.' },
      { code: 'B', text: 'Collector backhaul issue — retry comm on all 4 meters', correct: false, explain: 'Partially correct instinct but not the best diagnosis. The collector is online and only the 4 meters on TRF-SC-01 are affected. Other meters on COL-SC-01 are communicating — this rules out a backhaul issue.' },
      { code: 'C', text: 'Likely transformer outage — issue one FSO for transformer TRF-SC-01 and estimate all 4 meters', correct: true, explain: 'Correct! Multiple meters on the same transformer going dark simultaneously is the classic pattern for a transformer outage. One FSO for the transformer is more efficient than 4 individual meter FSOs. Estimate meter data while awaiting field response.' },
      { code: 'D', text: 'Power outage affecting all of Feeder SC-A — escalate to operations center', correct: false, explain: 'Too broad — other meters on Feeder SC-A (COL-SC-01 and COL-SC-02) are still communicating. The impact is limited to TRF-SC-01, which points to the transformer level, not the feeder.' },
    ],
    exceptionType: 'TRANSFORMER_OUTAGE',
    difficulty: 'Intermediate',
  },
  {
    id: 'Q008',
    scenario: 'It is 48 hours before billing cycle close. You have 15 open exceptions. MTR-SW-010 has a MISSING_READ that is 67 hours old. The SLA target is 72 hours. Signal strength is currently 38%.',
    question: 'Given the SLA status and billing deadline, what is the correct action?',
    options: [
      { code: 'A', text: 'Wait — the SLA limit is 72 hours and you still have 5 hours', correct: false, explain: 'Incorrect. With 5 hours until SLA breach AND billing close in 48 hours, waiting is not appropriate. The billing deadline takes priority — you need data resolved before cycle close, not just before SLA breach.' },
      { code: 'B', text: 'Attempt on-demand read (signal is weak), then estimate immediately if it fails — both deadlines require action now', correct: true, explain: 'Correct! Two deadlines are converging: SLA breach in 5 hours AND billing cycle in 48 hours. Try comm once (signal may recover), but be prepared to estimate immediately. Document the SLA risk in the audit trail.' },
      { code: 'C', text: 'Issue a Field Service Order — signal is poor so field verification is needed', correct: false, explain: 'With 48 hours to billing close, a field tech cannot arrive in time. FSO is not the right tool when both the SLA and billing deadline are imminent. Estimate and document, then create an FSO for the next cycle.' },
      { code: 'D', text: 'Escalate to supervisor and wait for guidance', correct: false, explain: 'Escalation without taking action loses valuable time. With two imminent deadlines, take action (comm retry + estimate) AND notify the supervisor simultaneously.' },
    ],
    exceptionType: 'MISSING_READ',
    difficulty: 'Advanced',
  },
  {
    id: 'Q009',
    scenario: 'MTR-SW-005, 006, and 007 have each recorded 5 voltage sag events (94–108V) over the past 12 hours. All three meters are on transformer TRF-SW-02. They are communicating normally and interval data is clean.',
    question: 'How should these VOLTAGE_EXCURSION exceptions be resolved?',
    options: [
      { code: 'A', text: 'Estimate the interval data for all 3 meters and close the exceptions', correct: false, explain: 'Wrong approach. Voltage excursion exceptions indicate a power quality issue, not a data quality problem. The interval data is clean — there is nothing to estimate.' },
      { code: 'B', text: 'Retry comm on all 3 meters — the sags may have caused data gaps', correct: false, explain: 'No data gaps are present — all meters are communicating and interval data is clean. Voltage sags do not cause comm failures on modern smart meters. Retry comm is not relevant here.' },
      { code: 'C', text: 'Issue a Field Service Order and escalate to Distribution Engineering — this is a power quality event affecting a transformer circuit', correct: true, explain: 'Correct! Three meters on the same transformer showing identical voltage sag patterns indicates a distribution-level power quality issue. This requires an FSO for field investigation AND an engineering escalation. The analyst resolves the exception by triaging it correctly, not by editing data.' },
      { code: 'D', text: 'Close the exceptions as informational — voltage sags do not affect billing', correct: false, explain: 'Incorrect process. Even though billing is not directly impacted, voltage excursions require a documented response (FSO + escalation). Closing without action violates the utility\'s power quality response procedures.' },
    ],
    exceptionType: 'VOLTAGE_EXCURSION',
    difficulty: 'Intermediate',
  },
];

// ---- Glossary Component ----
function GlossaryTab({ search }) {
  const filtered = useMemo(() => {
    if (!search.trim()) return GLOSSARY;
    const q = search.toLowerCase();
    return GLOSSARY.filter(g => g.term.toLowerCase().includes(q) || g.def.toLowerCase().includes(q));
  }, [search]);

  return (
    <div className="study-glossary">
      <div className="study-section-head">AMI TERMINOLOGY GLOSSARY — {filtered.length} TERMS</div>
      {filtered.map((entry, i) => (
        <div key={i} className="glossary-entry">
          <div className="glossary-term">{entry.term}</div>
          <div className="glossary-def">{entry.def}</div>
        </div>
      ))}
    </div>
  );
}

// ---- Exception Guide Component ----
function ExceptionGuideTab() {
  const [selected, setSelected] = useState('MISSING_READ');
  const guide = EXCEPTION_EXPLANATIONS[selected];
  const excType = EXCEPTION_TYPES[selected];

  return (
    <div className="study-excguide">
      {/* Exception type selector */}
      <div className="study-excguide-nav">
        {Object.entries(EXCEPTION_TYPES).map(([code, t]) => (
          <button
            key={code}
            className={`excguide-nav-btn ${selected === code ? 'excguide-nav-active' : ''}`}
            onClick={() => setSelected(code)}
          >
            <span className={`exc-type-badge exc-type-${code}`} style={{ fontSize: 8 }}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Guide content */}
      <div className="excguide-content">
        <div className="excguide-header">
          <div>
            <span className={`exc-type-badge exc-type-${selected}`} style={{ fontSize: 11 }}>{excType?.label}</span>
            <span className="badge" style={{ marginLeft: 8 }}>
              {excType?.severity === 'Error' ? '🔴 Error' : '🟡 Warning'}
            </span>
            {excType?.billingImpact && <span className="badge badge-red" style={{ marginLeft: 6 }}>Billing Impact</span>}
          </div>
        </div>

        <div className="excguide-section">
          <div className="excguide-section-title">WHAT IS IT?</div>
          <div className="excguide-text">{guide?.what}</div>
        </div>

        <div className="excguide-section">
          <div className="excguide-section-title">WHY DOES IT MATTER?</div>
          <div className="excguide-text">{guide?.why}</div>
        </div>

        <div className="excguide-section">
          <div className="excguide-section-title">COMMON CAUSES</div>
          <ul className="excguide-list">
            {guide?.causes.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>

        <div className="excguide-section">
          <div className="excguide-section-title">RESOLUTION DECISION GUIDE</div>
          {guide?.resolutions.map((r, i) => (
            <div key={i} className="excguide-resolution">
              <span className="excguide-res-action">{r.action}</span>
              <span className="excguide-res-when">{r.when}</span>
            </div>
          ))}
        </div>

        <div className="excguide-tip">
          <span className="excguide-tip-label">STUDY TIP</span>
          <span className="excguide-tip-text">{guide?.studyTip}</span>
        </div>
      </div>
    </div>
  );
}

// ---- Quiz Component ----
function QuizTab() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected]     = useState(null);
  const [submitted, setSubmitted]   = useState(false);
  const [scores, setScores]         = useState({ correct: 0, total: 0 });
  const [history, setHistory]       = useState([]);
  const [quizDone, setQuizDone]     = useState(false);

  const scenario = QUIZ_SCENARIOS[currentIdx];

  function handleSelect(code) {
    if (submitted) return;
    setSelected(code);
  }

  function handleSubmit() {
    if (!selected || submitted) return;
    const isCorrect = scenario.options.find(o => o.code === selected)?.correct;
    setSubmitted(true);
    setScores(s => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));
    setHistory(h => [...h, {
      id: scenario.id,
      question: scenario.question.slice(0, 50) + '…',
      correct: isCorrect,
      selected,
    }]);
  }

  function handleNext() {
    if (currentIdx >= QUIZ_SCENARIOS.length - 1) {
      setQuizDone(true);
    } else {
      setCurrentIdx(i => i + 1);
      setSelected(null);
      setSubmitted(false);
    }
  }

  function handleReset() {
    setCurrentIdx(0);
    setSelected(null);
    setSubmitted(false);
    setScores({ correct: 0, total: 0 });
    setHistory([]);
    setQuizDone(false);
  }

  // Load from localStorage
  const savedScores = JSON.parse(localStorage.getItem('ami_quiz_scores') || '{"best":0,"sessions":0}');

  if (quizDone) {
    const pct = Math.round((scores.correct / scores.total) * 100);
    // Save best score
    const best = Math.max(savedScores.best, pct);
    localStorage.setItem('ami_quiz_scores', JSON.stringify({ best, sessions: savedScores.sessions + 1 }));

    return (
      <div className="quiz-done">
        <div className="quiz-done-score" style={{ color: pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444' }}>
          {pct}%
        </div>
        <div className="quiz-done-label">{scores.correct} / {scores.total} correct</div>
        <div className="quiz-done-rating">
          {pct >= 80 ? '✓ Ready for the job interview' : pct >= 60 ? '↻ Review exception guide and retry' : '⚠ Focus on the exception explanations above'}
        </div>
        <div className="quiz-history">
          {history.map((h, i) => (
            <div key={i} className={`quiz-hist-row ${h.correct ? 'hist-correct' : 'hist-wrong'}`}>
              <span>{h.correct ? '✓' : '✕'}</span>
              <span className="mono">{h.id}</span>
              <span className="text-dim">{h.question}</span>
              <span className="mono">Chose: {h.selected}</span>
            </div>
          ))}
        </div>
        <button className="btn-primary" onClick={handleReset} style={{ marginTop: 16 }}>
          ↻ RETAKE QUIZ
        </button>
        <div className="text-dim mono" style={{ fontSize: 10, marginTop: 8 }}>
          All-time best: {savedScores.best}% &nbsp;|&nbsp; Sessions: {savedScores.sessions + 1}
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-layout">
      {/* Progress */}
      <div className="quiz-progress-bar">
        <div className="quiz-progress-fill"
          style={{ width: `${((currentIdx) / QUIZ_SCENARIOS.length) * 100}%` }}
        />
      </div>

      <div className="quiz-meta">
        <span className="mono text-dim">{scenario.id}</span>
        <span className={`badge ${scenario.difficulty === 'Advanced' ? 'badge-red' : scenario.difficulty === 'Intermediate' ? 'badge-amber' : 'badge-blue'}`}>
          {scenario.difficulty}
        </span>
        <span className={`exc-type-badge exc-type-${scenario.exceptionType}`}>
          {EXCEPTION_TYPES[scenario.exceptionType]?.label}
        </span>
        <span className="mono text-dim" style={{ marginLeft: 'auto' }}>
          {currentIdx + 1} / {QUIZ_SCENARIOS.length} &nbsp;|&nbsp;
          Score: <span className={scores.correct / (scores.total || 1) >= 0.7 ? 'text-green' : 'text-amber'}>{scores.correct}/{scores.total}</span>
        </span>
      </div>

      <div className="quiz-scenario">
        <div className="quiz-scenario-label">SCENARIO</div>
        <div className="quiz-scenario-text">{scenario.scenario}</div>
      </div>

      <div className="quiz-question">{scenario.question}</div>

      <div className="quiz-options">
        {scenario.options.map(opt => {
          let cls = 'quiz-option';
          if (selected === opt.code) cls += ' quiz-opt-selected';
          if (submitted) {
            if (opt.correct) cls += ' quiz-opt-correct';
            else if (selected === opt.code && !opt.correct) cls += ' quiz-opt-wrong';
          }
          return (
            <div key={opt.code} className={cls} onClick={() => handleSelect(opt.code)}>
              <div className="quiz-opt-letter">{opt.code}</div>
              <div className="quiz-opt-body">
                <div className="quiz-opt-text">{opt.text}</div>
                {submitted && (selected === opt.code || opt.correct) && (
                  <div className="quiz-opt-explain">{opt.explain}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="quiz-footer">
        {!submitted ? (
          <button className="btn-primary" onClick={handleSubmit} disabled={!selected}>
            SUBMIT ANSWER
          </button>
        ) : (
          <button className="btn-primary" onClick={handleNext}>
            {currentIdx >= QUIZ_SCENARIOS.length - 1 ? 'SEE RESULTS →' : 'NEXT QUESTION →'}
          </button>
        )}
      </div>
    </div>
  );
}

// ---- Challenges Tab ----
function ChallengesTab() {
  const [activeChallengeId, setActiveChallengeId] = useState(null);
  const [timeLeft, setTimeLeft]   = useState(0);
  const [running, setRunning]     = useState(false);
  const [completed, setCompleted] = useState({});   // { checkId: true }
  const [result, setResult]       = useState(null); // 'pass' | 'timeout'
  const timerRef = useRef(null);

  const challenge = CHALLENGES.find(c => c.id === activeChallengeId);

  function startChallenge(ch) {
    clearInterval(timerRef.current);
    setActiveChallengeId(ch.id);
    setTimeLeft(ch.timeLimit);
    setCompleted({});
    setResult(null);
    setRunning(true);

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setRunning(false);
          setResult('timeout');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function toggleCheck(id) {
    if (!running) return;
    setCompleted(c => {
      const updated = { ...c, [id]: !c[id] };
      // Check if all items done
      if (challenge && Object.values(updated).filter(Boolean).length === challenge.checklist.length) {
        clearInterval(timerRef.current);
        setRunning(false);
        setResult('pass');
      }
      return updated;
    });
  }

  function exitChallenge() {
    clearInterval(timerRef.current);
    setActiveChallengeId(null);
    setRunning(false);
    setResult(null);
    setCompleted({});
  }

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const timerUrgency = timeLeft <= 30 ? 'urgent' : timeLeft <= 60 ? 'warn' : '';
  const doneCount = challenge ? Object.values(completed).filter(Boolean).length : 0;

  if (!activeChallengeId) {
    return (
      <div className="challenges-layout">
        <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#757575', marginBottom: 6, lineHeight: 1.6 }}>
          Simulation Challenges are timed walkthroughs of realistic AMI analyst scenarios. Work through the checklist before the timer expires.
        </div>
        {CHALLENGES.map(ch => (
          <div key={ch.id} className="challenge-card">
            <div className="challenge-header">
              <span className="challenge-title">{ch.title}</span>
              <span className={`badge ${ch.difficulty === 'Advanced' ? 'badge-red' : 'badge-amber'}`}>
                {ch.difficulty}
              </span>
              <span className="mono text-dim" style={{ fontSize: 9 }}>{ch.timeLimit}s limit</span>
            </div>
            <div className="challenge-desc">{ch.description}</div>
            <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#757575', marginBottom: 8 }}>
              {ch.checklist.length} steps &nbsp;·&nbsp; Scenario: {ch.scenario.slice(0, 100)}…
            </div>
            <button className="btn-primary" style={{ fontSize: 10 }} onClick={() => startChallenge(ch)}>
              ▶ START CHALLENGE
            </button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="challenges-layout">
      <div className={`challenge-card ${running ? 'challenge-active' : ''}`}>
        <div className="challenge-header">
          <span className="challenge-title">{challenge.title}</span>
          <span className={`badge ${challenge.difficulty === 'Advanced' ? 'badge-red' : 'badge-amber'}`}>
            {challenge.difficulty}
          </span>
          {running && (
            <span className={`challenge-timer timer-${timerUrgency}`}>{formatTime(timeLeft)}</span>
          )}
        </div>

        {result && (
          <div className={`challenge-result-banner challenge-result-${result === 'pass' ? 'pass' : 'timeout'}`}>
            {result === 'pass'
              ? `✓ CHALLENGE COMPLETE — ${doneCount}/${challenge.checklist.length} STEPS IN ${formatTime(challenge.timeLimit - timeLeft)}`
              : `⏱ TIME EXPIRED — ${doneCount}/${challenge.checklist.length} STEPS COMPLETED`
            }
          </div>
        )}

        <div className="challenge-desc">{challenge.scenario}</div>

        {/* Progress bar */}
        {running && (
          <div style={{ height: 4, background: '#e5e7eb', borderRadius: 2, marginBottom: 8 }}>
            <div style={{
              height: '100%', borderRadius: 2,
              width: `${(doneCount / challenge.checklist.length) * 100}%`,
              background: '#22c55e', transition: 'width 0.3s',
            }} />
          </div>
        )}

        <div className="challenge-checklist">
          {challenge.checklist.map(item => (
            <div
              key={item.id}
              className={`challenge-check-item ${completed[item.id] ? 'item-done' : ''}`}
              onClick={() => toggleCheck(item.id)}
            >
              <div className={`challenge-check-box ${completed[item.id] ? 'checked' : ''}`}>
                {completed[item.id] ? '✓' : ''}
              </div>
              <span style={{ textDecoration: completed[item.id] ? 'line-through' : 'none' }}>
                {item.text}
              </span>
            </div>
          ))}
        </div>

        {result && (
          <div style={{
            background: '#f8fafc', border: '1px solid #e5e7eb',
            padding: '10px 12px', fontFamily: 'monospace', fontSize: 10,
            color: '#757575', lineHeight: 1.7, marginTop: 8,
          }}>
            <div style={{ fontWeight: 700, color: '#1A237E', marginBottom: 4 }}>LEARNING POINTS:</div>
            {challenge.learningPoints}
          </div>
        )}

        <div className="challenge-btn-row" style={{ marginTop: 10 }}>
          {running && (
            <button className="btn-ghost" style={{ fontSize: 9 }} onClick={exitChallenge}>
              × ABANDON CHALLENGE
            </button>
          )}
          {!running && result && (
            <>
              <button className="btn-primary" style={{ fontSize: 10 }} onClick={() => startChallenge(challenge)}>
                ↻ RETRY CHALLENGE
              </button>
              <button className="btn-ghost" style={{ fontSize: 10 }} onClick={exitChallenge}>
                ← CHALLENGE LIST
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Main Study Mode ----
export default function StudyMode() {
  const [activeTab, setActiveTab] = useState('guide');
  const [search, setSearch]       = useState('');

  return (
    <div className="study-layout">
      <div className="study-header">
        <div className="study-title">✦ STUDY MODE — AMI ANALYST EXAM PREP</div>
        <div className="study-subtitle">
          Use this module to understand the systems, master exception types, and practice resolution decisions.
        </div>
      </div>

      <div className="study-tabs" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { id: 'guide',      label: '◎ EXCEPTION GUIDE', desc: `${Object.keys(EXCEPTION_TYPES).length} exception types` },
          { id: 'glossary',   label: '≋ GLOSSARY',         desc: `${GLOSSARY.length} AMI terms defined` },
          { id: 'quiz',       label: '⚡ QUIZ MODE',        desc: `${QUIZ_SCENARIOS.length} scenarios, scored` },
          { id: 'challenges', label: '⊞ CHALLENGES',        desc: `${CHALLENGES.length} timed simulations` },
        ].map(t => (
          <button
            key={t.id}
            className={`study-tab-btn ${activeTab === t.id ? 'study-tab-active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            <div className="study-tab-label">{t.label}</div>
            <div className="study-tab-desc">{t.desc}</div>
          </button>
        ))}
      </div>

      {(activeTab === 'glossary') && (
        <input
          className="headend-search"
          placeholder="Search glossary terms..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginBottom: 0 }}
        />
      )}

      <div className="study-body">
        {activeTab === 'guide'      && <ExceptionGuideTab />}
        {activeTab === 'glossary'   && <GlossaryTab search={search} />}
        {activeTab === 'quiz'       && <QuizTab />}
        {activeTab === 'challenges' && <ChallengesTab />}
      </div>
    </div>
  );
}
