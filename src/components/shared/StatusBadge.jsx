export default function StatusBadge({ status, size = 'sm' }) {
  const map = {
    'Communicating':     'badge-green',
    'Not Communicating': 'badge-red',
    'Alarming':          'badge-amber',
    'Open':              'badge-red',
    'Resolved':          'badge-green',
    'Pending':           'badge-amber',
    'Dispatched':        'badge-blue',
    'Complete':          'badge-green',
    'Passed':            'badge-green',
    'Exception':         'badge-red',
    'Estimated':         'badge-amber',
    'Online':            'badge-green',
    'Offline':           'badge-red',
    'Error':             'badge-red',
    'Warning':           'badge-amber',
    'Info':              'badge-blue',
    'Strong':            'badge-green',
    'Weak':              'badge-amber',
    'None':              'badge-red',
  };

  const cls = map[status] || 'badge-blue';
  return (
    <span className={`badge ${cls} ${size === 'lg' ? 'badge-lg' : ''}`}>
      {status}
    </span>
  );
}
