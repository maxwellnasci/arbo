import { describe, it, expect } from 'vitest';

export function formatTime(seconds?: number): string {
  if (!seconds) return 'N/A';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${h}:${min.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

describe('formatTime', () => {
  it('should return N/A for 0', () => {
    expect(formatTime(0)).toBe('N/A');
  });

  it('should return 5:00 for 300 seconds', () => {
    expect(formatTime(300)).toBe('5:00');
  });

  it('should return 1:01:01 for 3661 seconds', () => {
    expect(formatTime(3661)).toBe('1:01:01');
  });

  it('should return N/A for undefined', () => {
    expect(formatTime(undefined)).toBe('N/A');
  });
});
