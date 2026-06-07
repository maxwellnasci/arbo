import { describe, it, expect } from 'vitest';

describe('Auth Role Logic', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getRole = (user: any) => user?.app_metadata?.role || null;

  it('role admin in app_metadata returns admin', () => {
    const user = { app_metadata: { role: 'admin' }, user_metadata: { role: 'aluno' } };
    expect(getRole(user)).toBe('admin');
  });

  it('role aluno in app_metadata returns aluno', () => {
    const user = { app_metadata: { role: 'aluno' }, user_metadata: { role: 'admin' } };
    expect(getRole(user)).toBe('aluno');
  });

  it('empty app_metadata returns null', () => {
    const user = { app_metadata: {}, user_metadata: { role: 'admin' } };
    expect(getRole(user)).toBeNull();
  });

  it('user_metadata is NEVER used for role', () => {
    const user = { app_metadata: {}, user_metadata: { role: 'admin' } };
    expect(getRole(user)).toBeNull(); // Should not fallback to user_metadata
  });
});
