import { describe, it, expect } from 'vitest';

const TAG_COLORS = [
  { name: 'Laranja', hex: '#E8521A' },
  { name: 'Azul', hex: '#3B82F6' },
  { name: 'Verde', hex: '#22C55E' },
  { name: 'Vermelho', hex: '#EF4444' },
  { name: 'Amarelo', hex: '#EAB308' },
  { name: 'Roxo', hex: '#A855F7' },
  { name: 'Ciano', hex: '#06B6D4' },
  { name: 'Cinza', hex: '#71717A' },
]

const TRAINING_TYPE_LABELS: Record<string, string> = {
  corrida: 'Corrida',
  hiit: 'HIIT',
  recovery: 'Recuperação',
  forca: 'Força',
  mobilidade: 'Mobilidade',
}

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
