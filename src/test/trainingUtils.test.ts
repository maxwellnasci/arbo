import { describe, it, expect } from 'vitest';
import { TRAINING_TYPE_LABELS, TAG_COLORS } from '../lib/trainingUtils';

describe('trainingUtils', () => {
  it('TRAINING_TYPE_LABELS returns correct label for type', () => {
    expect(TRAINING_TYPE_LABELS['corrida']).toBe('Corrida');
    expect(TRAINING_TYPE_LABELS['forca']).toBe('Força');
  });

  it('TAG_COLORS has exactly 8 colors', () => {
    expect(TAG_COLORS.length).toBe(8);
  });

  it('Each color in TAG_COLORS is a valid hex', () => {
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    TAG_COLORS.forEach(colorObj => {
      expect(colorObj.hex).toMatch(hexRegex);
    });
  });
});
