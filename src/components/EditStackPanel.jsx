/**
 * EditStackPanel.jsx
 * ─────────────────────────────────────────────────────────────────
 * Displays the non-destructive edit stack.
 * Each row shows: toggle enable, label, value, remove.
 * Integrates with useEditStack hook.
 */
import React, { memo } from 'react';

export default memo(function EditStackPanel({ editStack, onToggle, onRemove, onClear }) {
  if (editStack.length === 0) {
    return (
      <div style={emptyStyle}>
        <div style={{ fontSize: 20, opacity: 0.3 }}>🗂</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          No edits yet
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
          Adjustments applied via sliders appear here
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '4px 0' }}>
      <div style={headerRowStyle}>
        <span style={sectionLabelStyle}>Edit Stack ({editStack.length})</span>
        <button style={clearBtnStyle} onClick={onClear} title="Clear all edits">
          Clear all
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {editStack.map((edit, index) => (
          <EditRow
            key={edit.id}
            edit={edit}
            index={index}
            onToggle={() => onToggle(edit.id)}
            onRemove={() => onRemove(edit.id)}
          />
        ))}
      </div>
    </div>
  );
});

const EditRow = memo(function EditRow({ edit, index, onToggle, onRemove }) {
  const displayValue = formatValue(edit.type, edit.value);

  return (
    <div style={{
      ...rowStyle,
      opacity: edit.enabled ? 1 : 0.45,
    }}>
      {/* Enable toggle */}
      <button
        style={{
          ...toggleDotStyle,
          background: edit.enabled ? 'var(--accent)' : 'var(--border)',
        }}
        onClick={onToggle}
        title={edit.enabled ? 'Disable this edit' : 'Enable this edit'}
      />

      {/* Index */}
      <span style={indexStyle}>{index + 1}</span>

      {/* Label */}
      <span style={labelStyle}>{edit.label}</span>

      {/* Value */}
      <span style={valueStyle}>{displayValue}</span>

      {/* Remove */}
      <button
        style={removeBtnStyle}
        onClick={onRemove}
        title="Remove this edit"
      >
        ✕
      </button>
    </div>
  );
});

function formatValue(type, value) {
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
  if (type === 'hue')      return `${value}°`;
  if (type === 'blur')     return `${value}px`;
  if (type === 'rotation') return `${value}°`;
  if (typeof value === 'number') return String(value);
  return String(value);
}

// ── Styles ─────────────────────────────────────────────────────────

const emptyStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '24px 8px',
  color: 'var(--text-muted)',
};

const headerRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '6px 4px 8px',
};

const sectionLabelStyle = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--text-muted)',
};

const clearBtnStyle = {
  fontSize: 10,
  color: 'var(--danger)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '2px 6px',
  borderRadius: 4,
};

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '5px 6px',
  background: 'var(--bg-card)',
  borderRadius: 6,
  border: '1px solid var(--border)',
  fontSize: 12,
  transition: 'opacity 0.15s',
};

const toggleDotStyle = {
  width: 10,
  height: 10,
  borderRadius: '50%',
  border: 'none',
  cursor: 'pointer',
  flexShrink: 0,
  padding: 0,
  transition: 'background 0.15s',
};

const indexStyle = {
  fontSize: 10,
  color: 'var(--text-muted)',
  minWidth: 14,
  textAlign: 'right',
  flexShrink: 0,
};

const labelStyle = {
  flex: 1,
  color: 'var(--text-secondary)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const valueStyle = {
  fontSize: 11,
  color: 'var(--accent)',
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
  minWidth: 32,
  textAlign: 'right',
};

const removeBtnStyle = {
  background: 'none',
  border: 'none',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: 11,
  padding: '0 2px',
  lineHeight: 1,
  flexShrink: 0,
  transition: 'color 0.15s',
};