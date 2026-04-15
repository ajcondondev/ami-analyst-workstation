import { useState } from 'react';
import useSimulation from './hooks/useSimulation.js';
import SimClock from './components/shared/SimClock.jsx';
import Dashboard from './components/dashboard/Dashboard.jsx';
import RFMeshView from './components/rfmesh/RFMeshView.jsx';
import HeadEndSystem from './components/headend/HeadEndSystem.jsx';
import MDMSView from './components/mdms/MDMSView.jsx';
import VEEEngine from './components/vee/VEEEngine.jsx';
import ExceptionQueue from './components/exceptions/ExceptionQueue.jsx';
import CISSystem from './components/cis/CISSystem.jsx';
import StudyMode from './components/study/StudyMode.jsx';

const NAV_ITEMS = [
  { id: 'dashboard',  label: 'DASHBOARD',       icon: '▣', desc: 'Operations overview',           group: 'OVERVIEW' },
  { id: 'rfmesh',     label: 'NETWORK HEALTH',  icon: '◈', desc: 'RF mesh topology & signal',     group: 'DATA COLLECTION' },
  { id: 'headend',    label: 'DEVICE COMMS',    icon: '⊞', desc: 'Head-end & meter commands',     group: 'DATA COLLECTION' },
  { id: 'mdms',       label: 'DATA BANKING',    icon: '≋', desc: 'Interval data repository',      group: 'DATA QUALITY' },
  { id: 'vee',        label: 'VEE ENGINE',       icon: '◎', desc: 'Validation, estimation & edit', group: 'DATA QUALITY' },
  { id: 'exceptions', label: 'EXCEPTION MGMT',  icon: '⚠', desc: 'Exception queue & resolution', group: 'OPERATIONS' },
  { id: 'cis',        label: 'DEVICE REGISTRY', icon: '☰', desc: 'Customer & meter accounts',     group: 'OPERATIONS' },
  { id: 'study',      label: 'STUDY MODE',       icon: '✦', desc: 'Exam prep & glossary',          group: 'TRAINING' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { state, derived, changeSpeed, resolve, createFieldOrder, onDemandRead, reset } = useSimulation();

  function renderTab() {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard state={state} derived={derived} />;
      case 'rfmesh':
        return <RFMeshView state={state} onDemandRead={onDemandRead} />;
      case 'headend':
        return <HeadEndSystem state={state} onDemandRead={onDemandRead} />;
      case 'mdms':
        return <MDMSView state={state} />;
      case 'vee':
        return <VEEEngine state={state} />;
      case 'exceptions':
        return (
          <ExceptionQueue
            state={state}
            derived={derived}
            onResolve={resolve}
            onCreateFieldOrder={createFieldOrder}
          />
        );
      case 'cis':
        return <CISSystem state={state} onCreateFieldOrder={createFieldOrder} />;
      case 'study':
        return <StudyMode />;
      default:
        return null;
    }
  }

  const openExcCount    = derived?.openExceptions || 0;
  const pendingFSOCount = derived?.pendingFieldOrders || 0;
  const activeItem      = NAV_ITEMS.find(n => n.id === activeTab);

  return (
    <div className="app-shell">
      {/* ---- Top bar ---- */}
      <header className="topbar">
        <div className="topbar-brand">
          <span className="brand-logo">⚡</span>
          <span className="brand-name">Grid Edge MDMS</span>
          <span className="brand-sub">AMI Operations Center</span>
        </div>

        {derived && (
          <SimClock
            simDate={derived.simDate}
            simSpeed={state?.simSpeed ?? 1}
            onSpeedChange={changeSpeed}
          />
        )}

        {/* Live system health strip */}
        {derived && (
          <div className="topbar-health">
            <span className="health-item" style={{ color: derived.communicatingPct >= 95 ? '#22c55e' : '#f59e0b' }}>
              MESH {derived.communicatingPct}%
            </span>
            <span className="health-sep">|</span>
            <span className="health-item" style={{ color: openExcCount > 0 ? '#ef4444' : '#22c55e' }}>
              {openExcCount > 0 ? `${openExcCount} EXCEPTIONS` : 'QUEUE CLEAR'}
            </span>
            <span className="health-sep">|</span>
            <span className="health-item" style={{ color: derived.billingReadinessPct >= 95 ? '#22c55e' : '#f59e0b' }}>
              BILLING {derived.billingReadinessPct}%
            </span>
          </div>
        )}

        <div className="topbar-actions">
          <button className="btn-ghost" onClick={reset} title="Reset simulation to initial state">
            ↺ RESET SIM
          </button>
        </div>
      </header>

      <div className="app-body">
        {/* ---- Sidebar nav ---- */}
        <nav className="sidebar">
          {['OVERVIEW', 'DATA COLLECTION', 'DATA QUALITY', 'OPERATIONS', 'TRAINING'].map((group, gi) => {
            const items = NAV_ITEMS.filter(n => n.group === group);
            return (
              <div key={group}>
                <div className="sidebar-section-label" style={gi > 0 ? { marginTop: 8 } : {}}>
                  {group}
                </div>
                {items.map(item => (
                  <NavButton
                    key={item.id}
                    item={item}
                    active={activeTab === item.id}
                    badge={
                      item.id === 'exceptions' && openExcCount > 0 ? openExcCount :
                      item.id === 'cis' && pendingFSOCount > 0 ? pendingFSOCount :
                      null
                    }
                    onClick={() => setActiveTab(item.id)}
                  />
                ))}
              </div>
            );
          })}
        </nav>

        {/* ---- Main content area ---- */}
        <main className="main-content">
          <div className="tab-header">
            <span className="tab-header-icon">{activeItem?.icon}</span>
            <span className="tab-header-label">{activeItem?.label}</span>
            <span className="tab-header-desc">{activeItem?.desc}</span>
            {activeTab === 'exceptions' && openExcCount > 0 && (
              <span className="tab-header-alert">
                {openExcCount} OPEN
              </span>
            )}
            {activeTab === 'cis' && pendingFSOCount > 0 && (
              <span className="tab-header-alert tab-header-alert-amber">
                {pendingFSOCount} PENDING FSO
              </span>
            )}
          </div>
          <div className="tab-body">
            {renderTab()}
          </div>
        </main>
      </div>
      <footer className="app-footer">
        <span className="footer-status">
          <span style={{ color: '#4CAF50', marginRight: 6 }}>●</span>
          <span style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>SYSTEM OPERATIONAL</span>
        </span>
        <span className="footer-credit">ajcondon</span>
      </footer>
    </div>
  );
}

function NavButton({ item, active, badge, onClick }) {
  return (
    <button
      className={`nav-item ${active ? 'nav-item-active' : ''}`}
      onClick={onClick}
      title={item.desc}
    >
      <span className="nav-icon">{item.icon}</span>
      <span className="nav-label">{item.label}</span>
      {badge != null && (
        <span className="nav-badge">{badge}</span>
      )}
    </button>
  );
}
