import { describe, it, expect } from 'vitest';
import { getScheduleStatus } from '../lib/scheduleUtils';

describe('getScheduleStatus', () => {
  // Corner Cases de entrada nula ou invalida
  it('deve retornar "pendente" se o schedule for null', () => {
    expect(getScheduleStatus(null)).toBe('pendente');
  });

  it('deve retornar "pendente" se o schedule for undefined', () => {
    expect(getScheduleStatus(undefined)).toBe('pendente');
  });

  it('deve retornar "pendente" para tipos primitivos em vez de objeto', () => {
    expect(getScheduleStatus(42)).toBe('pendente');
    expect(getScheduleStatus('string')).toBe('pendente');
    expect(getScheduleStatus(true)).toBe('pendente');
  });

  // Testes de status "concluido"
  it('deve retornar "concluido" se a propriedade completed_at estiver presente e for valida', () => {
    expect(getScheduleStatus({ completed_at: '2026-06-07T12:00:00Z' })).toBe('concluido');
  });

  it('deve retornar "concluido" mesmo que scheduled_day_of_week tambem esteja presente (prioridade)', () => {
    expect(getScheduleStatus({ 
      completed_at: '2026-06-07T12:00:00Z', 
      scheduled_day_of_week: 3 
    })).toBe('concluido');
  });

  // Testes de status "agendado"
  it('deve retornar "agendado" se a propriedade scheduled_day_of_week estiver presente (e sem completed_at)', () => {
    expect(getScheduleStatus({ scheduled_day_of_week: 1 })).toBe('agendado');
  });

  it('deve retornar "agendado" se scheduled_day_of_week for zero (valor falsy mas valido)', () => {
    expect(getScheduleStatus({ scheduled_day_of_week: 0 })).toBe('agendado');
  });

  // Corner Cases com nulls internos (tipicos de banco de dados como Supabase)
  it('deve retornar "pendente" se ambas propriedades existirem mas forem null', () => {
    expect(getScheduleStatus({ completed_at: null, scheduled_day_of_week: null })).toBe('pendente');
  });

  it('deve retornar "agendado" se completed_at for null mas scheduled_day_of_week for valido', () => {
    expect(getScheduleStatus({ completed_at: null, scheduled_day_of_week: 5 })).toBe('agendado');
  });

  // Outros casos
  it('deve retornar "pendente" para objeto vazio', () => {
    expect(getScheduleStatus({})).toBe('pendente');
  });

  it('deve retornar "pendente" para objeto sem as propriedades esperadas', () => {
    expect(getScheduleStatus({ id: 1, name: 'Test' })).toBe('pendente');
  });
});
