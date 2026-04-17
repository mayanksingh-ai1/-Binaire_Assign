/**
 * AnnotationToolbar.jsx
 * Floating toolbar shown when annotation mode is active.
 * Lets the user pick tool, color, stroke width, and undo/clear annotations.
 */
import React from 'react';
import { TOOLS } from '../hooks/useAnnotations';

const TOOL_BUTTONS = [
  { id: TOOLS.NONE,      icon: '↖',  label: 'Select (no draw)' },
  { id: TOOLS.FREEHAND,  icon: '✏️', label: 'Freehand draw' },
  { id: TOOLS.RECTANGLE, icon: '▭',  label: 'Rectangle' },
  { id: TOOLS.ARROW,     icon: '↗',  label: 'Arrow' },
  { id: TOOLS.TEXT,      icon: 'T',  label: 'Text' },
];

const STROKE_WIDTHS = [2, 4, 7, 12];

const PRESET_COLORS = [
  '#ff3b30', '#ff9500', '#ffcc00', '#34c759',
  '#0ea5e9', '#7c3aed', '#ffffff', '#000000',
];

export default function AnnotationToolbar({
  activeTool, setActiveTool,
  strokeColor, setStrokeColor,
  strokeWidth, setStrokeWidth,
  fontSize, setFontSize,
  canUndoAnno, canRedoAnno,
  onUndoAnno, onRedoAnno,
  onClear,
  hasImage,
}) {
  if (!hasImage) return null;

  return (
    <div style={toolbarStyle}>
      {/* Tool buttons */}
      <div style={groupStyle}>
        {TOOL_BUTTONS.map((t) => (
          <button
            key={t.id}
            title={t.label}
            onClick={() => setActiveTool(t.id)}
            style={{
              ...toolBtnStyle,
              background: activeTool === t.id ? 'var(--accent)' : 'var(--bg-card)',
              color: activeTool === t.id ? 'white' : 'var(--text-secondary)',
              borderColor: activeTool === t.id ? 'var(--accent)' : 'var(--border)',
            }}
          >
            {t.icon}
          </button>
        ))}
      </div>

      <div style={dividerStyle} />

      {/* Color presets + custom picker */}
      <div style={{ ...groupStyle, flexWrap: 'wrap', gap: 4 }}>
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            title={c}
            onClick={() => setStrokeColor(c)}
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: c,
              border: strokeColor === c ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer',
              outline: 'none',
              padding: 0,
              flexShrink: 0,
            }}
          />
        ))}
        <input
          type="color"
          value={strokeColor}
          onChange={(e) => setStrokeColor(e.target.value)}
          title="Custom color"
          style={{ width: 18, height: 18, border: 'none', padding: 0, cursor: 'pointer', borderRadius: 2, background: 'none' }}
        />
      </div>

      <div style={dividerStyle} />

      {/* Stroke width */}
      <div style={groupStyle}>
        {STROKE_WIDTHS.map((w) => (
          <button
            key={w}
            title={`${w}px`}
            onClick={() => setStrokeWidth(w)}
            style={{
              ...toolBtnStyle,
              background: strokeWidth === w ? 'var(--accent-dim)' : 'transparent',
              borderColor: strokeWidth === w ? 'var(--accent)' : 'var(--border)',
              color: 'var(--text-secondary)',
              padding: '0 8px',
            }}
          >
            <div style={{ width: w * 1.5, height: w * 1.5, borderRadius: '50%', background: strokeColor, maxWidth: 14, maxHeight: 14 }} />
          </button>
        ))}
      </div>

      {/* Font size (only for text tool) */}
      {activeTool === TOOLS.TEXT && (
        <>
          <div style={dividerStyle} />
          <div style={{ ...groupStyle, alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Size</span>
            <input
              type="number"
              min={8}
              max={120}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              style={{ width: 46, padding: '3px 6px', background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 11 }}
            />
          </div>
        </>
      )}

      <div style={dividerStyle} />

      {/* Undo / Redo / Clear */}
      <div style={groupStyle}>
        <button
          style={{ ...toolBtnStyle, opacity: canUndoAnno ? 1 : 0.4 }}
          disabled={!canUndoAnno}
          onClick={onUndoAnno}
          title="Undo annotation"
        >↩</button>
        <button
          style={{ ...toolBtnStyle, opacity: canRedoAnno ? 1 : 0.4 }}
          disabled={!canRedoAnno}
          onClick={onRedoAnno}
          title="Redo annotation"
        >↪</button>
        <button
          style={{ ...toolBtnStyle, color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)' }}
          onClick={onClear}
          title="Clear all annotations"
        >🗑</button>
      </div>
    </div>
  );
}

const toolbarStyle = {
  position: 'absolute',
  bottom: 36,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 30,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  background: 'rgba(17,17,19,0.92)',
  border: '1px solid var(--border)',
  borderRadius: 40,
  backdropFilter: 'blur(12px)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
  flexWrap: 'nowrap',
  maxWidth: '90vw',
  overflowX: 'auto',
};

const groupStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

const toolBtnStyle = {
  width: 30,
  height: 30,
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--bg-card)',
  color: 'var(--text-secondary)',
  fontSize: 14,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s',
  flexShrink: 0,
};

const dividerStyle = {
  width: 1,
  height: 20,
  background: 'var(--border)',
  flexShrink: 0,
};