import React from 'react';

const OPERATION_ICONS = {
  Import: '📥',
  'HDR Merge': '✦',
  Reset: '↺',
  flipH: '⇄',
  flipV: '⇅',
  rotateCW: '↻',
  rotateCCW: '↺',
  grayscale: '◑',
  sepia: '🎞',
  default: '✎',
};

function getIcon(type = '') {
  for (const [key, icon] of Object.entries(OPERATION_ICONS)) {
    if (type.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return OPERATION_ICONS.default;
}

export default function HistoryPanel({ history, currentIndex, onJump }) {
  return (
    <div className="history-panel">
      <div className="panel-header">History</div>
      <div className="panel-body">
        {history.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', marginTop: 20 }}>
            No history yet
          </div>
        ) : (
          <div className="history-list">
            {history.map((entry, i) => (
              <div
                key={i}
                className={`history-item${
                  i === currentIndex ? ' current' : i > currentIndex ? ' past' : ''
                }`}
                onClick={() => onJump(i)}
                title={`Go to: ${entry.type}`}
              >
                <span style={{ fontSize: 13 }}>{getIcon(entry.type)}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.type}
                </span>
                {i === currentIndex && (
                  <span style={{ fontSize: 9, background: 'var(--accent)', color: 'white', borderRadius: 3, padding: '1px 4px' }}>
                    NOW
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}