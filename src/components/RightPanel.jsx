/**
 * RightPanel.jsx
 * Right sidebar panel with tabs:
 *   adjust | presets | transform | edits | bg | info
 */
import React, { memo, useCallback } from 'react';
import HistogramPanel  from './HistogramPanel';
import EditStackPanel  from './EditStackPanel';
import BgRemoverPanel  from './BgRemoverPanel';
import { PRESETS }     from '../utils/presets';

const TABS = [
  { id: 'adjust',    label: 'Adjust'   },
  { id: 'presets',   label: 'Presets'  },
  { id: 'transform', label: 'Transform'},
  { id: 'edits',     label: 'Edits'    },
  { id: 'bg',        label: 'BG'       },
  { id: 'info',      label: 'Info'     },
];

// Debounced slider — fires onChange 60ms after the user stops moving
const Slider = memo(function Slider({ label, min, max, step = 1, value, onChange, unit = '' }) {
  return (
    <div className="slider-row">
      <div className="slider-label-row">
        <span className="slider-label">{label}</span>
        <span className="slider-value">{typeof value === 'number' ? value.toFixed(step < 1 ? 1 : 0) : value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
});

export default function RightPanel({
  adjustments,
  activeTab,
  onTabChange,
  onAdjust,
  onToggle,
  onTransform,
  onReset,
  onAutoEnhance,
  autoEnhancing,
  onApplyPreset,
  histData,
  hasImage,
  // Edit stack props
  editStack,
  onToggleEdit,
  onRemoveEdit,
  onClearEdits,
  // BG remover props
  onBgRemoveRun,
  bgProcessing,
  bgProgress,
  toast,
}) {
  const disabled = !hasImage;

  return (
    <div className="right-panel">
      <div className="panel-header">Tools</div>

      {/* Tab bar — scrollable so all 6 fit */}
      <div className="panel-tabs" style={{ overflowX: 'auto', flexShrink: 0 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`panel-tab${activeTab === t.id ? ' active' : ''}`}
            onClick={() => onTabChange(t.id)}
            style={{ minWidth: 52, fontSize: 10.5, padding: '0 6px' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        className="panel-body"
        style={{
          opacity: disabled ? 0.4 : 1,
          pointerEvents: disabled ? 'none' : 'auto',
        }}
      >

        {/* ──────────────────── ADJUST TAB ──────────────────── */}
        {activeTab === 'adjust' && (
          <>
            {/* Auto Enhance */}
            <button
              onClick={onAutoEnhance}
              disabled={autoEnhancing || !hasImage}
              style={autoEnhanceStyle}
            >
              {autoEnhancing ? '⏳ Analyzing…' : '✨ Auto Enhance'}
            </button>

            <div className="tool-section">
              <div className="tool-section-title">Light</div>
              <Slider label="Brightness" min={0}    max={200} value={adjustments.brightness} onChange={(v) => onAdjust('brightness', v)} />
              <Slider label="Contrast"   min={0}    max={200} value={adjustments.contrast}   onChange={(v) => onAdjust('contrast', v)} />
              <Slider label="Exposure"   min={-100} max={100} value={adjustments.exposure}   onChange={(v) => onAdjust('exposure', v)} />
            </div>

            <div className="tool-section">
              <div className="tool-section-title">Color</div>
              <Slider label="Saturation"   min={0}    max={200} value={adjustments.saturation} onChange={(v) => onAdjust('saturation', v)} />
              <Slider label="Hue Rotate"   min={-180} max={180} value={adjustments.hue}        onChange={(v) => onAdjust('hue', v)} unit="°" />
            </div>

            <div className="tool-section">
              <div className="tool-section-title">Detail</div>
              <Slider label="Sharpness" min={0} max={10} step={0.5} value={adjustments.sharpness} onChange={(v) => onAdjust('sharpness', v)} />
              <Slider label="Blur"      min={0} max={10} step={0.5} value={adjustments.blur}      onChange={(v) => onAdjust('blur', v)} unit="px" />
            </div>

            <div className="tool-section">
              <div className="tool-section-title">Effects</div>
              <div className="toggle-row">
                <button className={`toggle-btn${adjustments.grayscale ? ' active' : ''}`} onClick={() => onToggle('grayscale')}>Grayscale</button>
                <button className={`toggle-btn${adjustments.sepia     ? ' active' : ''}`} onClick={() => onToggle('sepia')}>Sepia</button>
              </div>
            </div>

            <button className="reset-btn" onClick={onReset}>↺ Reset All</button>

            {/* Live histogram */}
            <HistogramPanel histData={histData} />
          </>
        )}

        {/* ──────────────────── PRESETS TAB ─────────────────── */}
        {activeTab === 'presets' && (
          <>
            <div className="tool-section-title" style={{ padding: '8px 4px 10px' }}>Filter Presets</div>
            <div style={presetsGridStyle}>
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => onApplyPreset(preset)}
                  style={presetCardStyle}
                  title={preset.description}
                >
                  <span style={{ fontSize: 20 }}>{preset.label.split(' ')[0]}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 3 }}>
                    {preset.label.split(' ').slice(1).join(' ')}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ──────────────────── TRANSFORM TAB ───────────────── */}
        {activeTab === 'transform' && (
          <>
            <div className="tool-section">
              <div className="tool-section-title">Flip</div>
              <div className="btn-row">
                <button className={`action-btn${adjustments.flipH ? ' active' : ''}`} style={{ flex: 1 }} onClick={() => onTransform('flipH')}>⇄ Horizontal</button>
                <button className={`action-btn${adjustments.flipV ? ' active' : ''}`} style={{ flex: 1 }} onClick={() => onTransform('flipV')}>⇅ Vertical</button>
              </div>
            </div>

            <div className="tool-section">
              <div className="tool-section-title">Rotate</div>
              <div className="btn-row">
                <button className="action-btn" style={{ flex: 1 }} onClick={() => onTransform('rotateCCW')}>↺ 90° CCW</button>
                <button className="action-btn" style={{ flex: 1 }} onClick={() => onTransform('rotateCW')}>↻ 90° CW</button>
              </div>
              <div style={{ padding: '6px 4px', fontSize: 11, color: 'var(--text-muted)' }}>
                Rotation: {adjustments.rotation}°
              </div>
            </div>

            <button className="reset-btn" onClick={onReset}>↺ Reset Transforms</button>
          </>
        )}

        {/* ──────────────────── EDITS TAB ───────────────────── */}
        {activeTab === 'edits' && (
          <EditStackPanel
            editStack={editStack}
            onToggle={onToggleEdit}
            onRemove={onRemoveEdit}
            onClear={onClearEdits}
          />
        )}

        {/* ──────────────────── BG TAB ──────────────────────── */}
        {activeTab === 'bg' && (
          <BgRemoverPanel
            hasImage={hasImage}
            isProcessing={bgProcessing}
            progress={bgProgress}
            onRun={onBgRemoveRun}
            toast={toast}
          />
        )}

        {/* ──────────────────── INFO TAB ────────────────────── */}
        {activeTab === 'info' && (
          <div style={{ padding: '4px' }}>
            <div className="tool-section-title" style={{ marginBottom: 8 }}>Current Values</div>
            {Object.entries(adjustments).map(([k, v]) => (
              <div key={k} style={infoRowStyle}>
                <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{k}</span>
                <span style={{ color: 'var(--accent)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {typeof v === 'boolean' ? (v ? 'On' : 'Off') : v}
                </span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const infoRowStyle = {
  display: 'flex', justifyContent: 'space-between',
  padding: '5px 2px', borderBottom: '1px solid var(--border)', fontSize: 12,
};

const autoEnhanceStyle = {
  width: '100%', height: 34, marginBottom: 10,
  background: 'linear-gradient(135deg, rgba(124,58,237,0.18), rgba(14,165,233,0.18))',
  border: '1px solid rgba(14,165,233,0.45)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--accent)', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', transition: 'all 0.15s',
};

const presetsGridStyle = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
};

const presetCardStyle = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', padding: '12px 6px',
  background: 'var(--bg-card)', border: '1px solid var(--border)',
  borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s', gap: 2,
};