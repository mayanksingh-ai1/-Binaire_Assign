/**
 * presets.js
 * Named filter presets. Each preset is a partial adjustments patch
 * applied on top of default adjustments.
 * Extend this array to add more presets — no other files need changing.
 */

export const PRESETS = [
  {
    id: 'warm',
    label: '☀️ Warm',
    description: 'Warm golden tones',
    adjustments: {
      brightness: 108,
      contrast: 105,
      saturation: 120,
      hue: 15,
      exposure: 5,
      blur: 0,
      grayscale: false,
      sepia: false,
    },
  },
  {
    id: 'cool',
    label: '❄️ Cool',
    description: 'Cool blue tones',
    adjustments: {
      brightness: 98,
      contrast: 108,
      saturation: 110,
      hue: -20,
      exposure: -5,
      blur: 0,
      grayscale: false,
      sepia: false,
    },
  },
  {
    id: 'highcontrast',
    label: '◑ High Contrast',
    description: 'Punchy contrast',
    adjustments: {
      brightness: 100,
      contrast: 155,
      saturation: 115,
      hue: 0,
      exposure: 0,
      blur: 0,
      grayscale: false,
      sepia: false,
    },
  },
  {
    id: 'vintage',
    label: '🎞 Vintage',
    description: 'Faded film look',
    adjustments: {
      brightness: 110,
      contrast: 88,
      saturation: 75,
      hue: 10,
      exposure: -8,
      blur: 0,
      grayscale: false,
      sepia: true,
    },
  },
  {
    id: 'cinematic',
    label: '🎬 Cinematic',
    description: 'Teal & orange grade',
    adjustments: {
      brightness: 95,
      contrast: 130,
      saturation: 90,
      hue: -8,
      exposure: -5,
      blur: 0,
      grayscale: false,
      sepia: false,
    },
  },
  {
    id: 'bw',
    label: '⬛ Black & White',
    description: 'Clean monochrome',
    adjustments: {
      brightness: 100,
      contrast: 120,
      saturation: 0,
      hue: 0,
      exposure: 0,
      blur: 0,
      grayscale: true,
      sepia: false,
    },
  },
  {
    id: 'fade',
    label: '🌫 Fade',
    description: 'Soft matte look',
    adjustments: {
      brightness: 118,
      contrast: 75,
      saturation: 85,
      hue: 0,
      exposure: 8,
      blur: 0,
      grayscale: false,
      sepia: false,
    },
  },
  {
    id: 'vivid',
    label: '🌈 Vivid',
    description: 'Maximum colour pop',
    adjustments: {
      brightness: 105,
      contrast: 120,
      saturation: 175,
      hue: 0,
      exposure: 2,
      blur: 0,
      grayscale: false,
      sepia: false,
    },
  },
];

/**
 * Apply a preset on top of current adjustments.
 * Only patches the keys defined in the preset; keeps rotation/flip etc.
 */
export function applyPreset(currentAdjustments, preset) {
  return { ...currentAdjustments, ...preset.adjustments };
}