/**
 * TextToolbar.jsx
 * Floating toolbar for text tool options.
 * Shows when isTextMode is true or a text object is selected.
 */
import React, { memo } from 'react';
import { FONT_FAMILIES } from '../hooks/useTextTool';

export default memo(function TextToolbar({
  isTextMode,
  selectedObject,
  defaultProps,
  onToggleMode,
  onUpdateSelected,
  onUpdateDefault,
  onDeleteSelected,
  hasImage,
}) {
  if (!hasImage) return null;
  if (!isTextMode && !selectedObject) return null;

  const props = selectedObject || defaultProps;

  const update = (patch) => {
    if (selectedObject) onUpdateSelected(selectedObject.id, patch);
    else onUpdateDefault(patch);
  };

  return (
    <div style={toolbarStyle}>
      {/* Text mode toggle */}
      <button
        style={{
          ...modeBtnStyle,
          background: isTextMode ? 'var(--accent)' : 'var(--bg-card)',
          color: isTextMode ? 'white' : 'var(--text-secondary)',
          borderColor: isTextMode ? 'var(--accent)' : 'var(--border)',
        }}
        onClick={onToggleMode}
        title="Toggle text tool"
      >
        T
      </button>

      <div style={divStyle} />

      {/* Font family */}
      <select
        value={props.fontFamily}
        onChange={(e) => update({ fontFamily: e.target.value })}
        style={selectStyle}
      >
        {FONT_FAMILIES.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>

      {/* Font size */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          type="number"
          min={6} max={300}
          value={props.fontSize}
          onChange={(e) => update({ fontSize: Number(e.target.value) })}
          style={numInputStyle}
        />
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>px</span>
      </div>

      <div style={divStyle} />

      {/* Bold */}
      <button
        style={{ ...iconBtnStyle, fontWeight: 700, background: props.bold ? 'var(--accent-dim)' : 'transparent', color: props.bold ? 'var(--accent)' : 'var(--text-secondary)' }}
        onClick={() => update({ bold: !props.bold })}
        title="Bold"
      >B</button>

      {/* Italic */}
      <button
        style={{ ...iconBtnStyle, fontStyle: 'italic', background: props.italic ? 'var(--accent-dim)' : 'transparent', color: props.italic ? 'var(--accent)' : 'var(--text-secondary)' }}
        onClick={() => update({ italic: !props.italic })}
        title="Italic"
      >I</button>

      <div style={divStyle} />

      {/* Color */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Color</span>
        <input
          type="color"
          value={props.color}
          onChange={(e) => update({ color: e.target.value })}
          style={{ width: 28, height: 24, border: 'none', padding: 0, cursor: 'pointer', borderRadius: 4, background: 'none' }}
        />
      </div>

      {/* Opacity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Opacity</span>
        <input
          type="range" min={0.1} max={1} step={0.05}
          value={props.opacity ?? 1}
          onChange={(e) => update({ opacity: Number(e.target.value) })}
          style={{ width: 60 }}
        />
      </div>

      {/* Delete selected */}
      {selectedObject && (
        <>
          <div style={divStyle} />
          <button
            style={{ ...iconBtnStyle, color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)' }}
            onClick={onDeleteSelected}
            title="Delete selected text"
          >🗑</button>
        </>
      )}

      {/* Hint */}
      {isTextMode && !selectedObject && (
        <>
          <div style={divStyle} />
          <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            Click canvas to add text
          </span>
        </>
      )}
    </div>
  );
});

const toolbarStyle = {
  position: 'absolute',
  top: 10,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 35,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '7px 14px',
  background: 'rgba(17,17,19,0.93)',
  border: '1px solid var(--border)',
  borderRadius: 36,
  backdropFilter: 'blur(12px)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
  flexWrap: 'nowrap',
  maxWidth: '92vw',
  overflowX: 'auto',
};

const modeBtnStyle = {
  width: 32,
  height: 30,
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: 15,
  fontWeight: 700,
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'all 0.15s',
};

const divStyle = {
  width: 1,
  height: 20,
  background: 'var(--border)',
  flexShrink: 0,
};

const selectStyle = {
  height: 28,
  padding: '0 6px',
  background: 'var(--bg-app)',
  border: '1px solid var(--border)',
  borderRadius: 5,
  color: 'var(--text-primary)',
  fontSize: 11,
  cursor: 'pointer',
  maxWidth: 120,
};

const numInputStyle = {
  width: 46,
  height: 28,
  padding: '0 6px',
  background: 'var(--bg-app)',
  border: '1px solid var(--border)',
  borderRadius: 5,
  color: 'var(--text-primary)',
  fontSize: 12,
  textAlign: 'center',
};

const iconBtnStyle = {
  width: 30,
  height: 28,
  border: '1px solid var(--border)',
  borderRadius: 5,
  background: 'transparent',
  color: 'var(--text-secondary)',
  fontSize: 13,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  transition: 'all 0.15s',
};