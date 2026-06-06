import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

type FormState = {
  age: string
  weight_kg: string
  height_cm: string
  runs_2km: boolean | null
  runs_5km: boolean | null
  runs_5km_time: string
  runs_10km: boolean | null
  runs_10km_time: string
  objectives: string[]
  physical_limitations: string
  weekly_frequency: string
}

const OBJECTIVES = [
  { value: 'correr_5km', label: 'Correr 5km' },
  { value: 'correr_10km', label: 'Correr 10km' },
  { value: 'melhorar_tempo_5km', label: 'Melhorar tempo no 5km' },
  { value: 'melhorar_tempo_10km', label: 'Melhorar tempo no 10km' },
]

export default function AnamnesisForm() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>({
    age: '',
    weight_kg: '',
    height_cm: '',
    runs_2km: null,
    runs_5km: null,
    runs_5km_time: '',
    runs_10km: null,
    runs_10km_time: '',
    objectives: [],
    physical_limitations: '',
    weekly_frequency: '',
  })

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const toggleObjective = (value: string) => {
    setForm(prev => ({
      ...prev,
      objectives: prev.objectives.includes(value)
        ? prev.objectives.filter(o => o !== value)
        : [...prev.objectives, value],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!form.age || !form.weekly_frequency) {
      setError('Idade e frequência semanal são obrigatórios.')
      return
    }

    if (form.objectives.length === 0) {
      setError('Selecione pelo menos um objetivo.')
      return
    }

    setLoading(true)

    const age = parseInt(form.age)
    const maxHeartRate = 220 - age

    // Nível estimado com base na capacidade de corrida declarada
    let level: 'iniciante' | 'intermediario' | 'avancado' = 'iniciante'
    if (form.runs_10km) level = 'avancado'
    else if (form.runs_5km) level = 'intermediario'

    const { error: anamnesisError } = await supabase
      .from('anamnesis')
      .insert({
        user_id: user!.id,
        max_heart_rate: maxHeartRate,
        weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
        height_cm: form.height_cm ? parseInt(form.height_cm) : null,
        objectives: form.objectives,
        physical_limitations: form.physical_limitations || null,
        weekly_frequency: parseInt(form.weekly_frequency),
      })

    if (anamnesisError) {
      console.error(anamnesisError)
      setError('Erro ao salvar dados. Tente novamente.')
      setLoading(false)
      return
    }

    // Atualiza nível no perfil
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ level })
      .eq('id', user!.id)

    if (profileError) {
      console.error(profileError)
    }

    navigate('/aluno')
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>Vamos começar!</h1>
          <p style={styles.subtitle}>
            Precisamos de algumas informações para personalizar seus treinos.
          </p>
        </header>

        <form onSubmit={handleSubmit} style={styles.form}>

          {/* Dados físicos */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Dados físicos</h2>

            <div style={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>Idade *</label>
                <input
                  type="number"
                  min={10}
                  max={80}
                  placeholder="anos"
                  value={form.age}
                  onChange={e => set('age', e.target.value)}
                  required
                  style={styles.input}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Peso (kg)</label>
                <input
                  type="number"
                  min={30}
                  max={200}
                  step={0.1}
                  placeholder="kg"
                  value={form.weight_kg}
                  onChange={e => set('weight_kg', e.target.value)}
                  style={styles.input}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Altura (cm)</label>
                <input
                  type="number"
                  min={100}
                  max={250}
                  placeholder="cm"
                  value={form.height_cm}
                  onChange={e => set('height_cm', e.target.value)}
                  style={styles.input}
                />
              </div>
            </div>

            {form.age && (
              <p style={styles.hint}>
                FC máxima estimada: <strong style={{ color: 'var(--orange)' }}>{220 - parseInt(form.age)} bpm</strong>
              </p>
            )}
          </section>

          {/* Capacidade de corrida */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Sua corrida hoje</h2>

            <YesNoField
              label="Consegue correr 2km sem parar?"
              value={form.runs_2km}
              onChange={v => set('runs_2km', v)}
            />

            <YesNoField
              label="Consegue correr 5km sem parar?"
              value={form.runs_5km}
              onChange={v => set('runs_5km', v)}
            />
            {form.runs_5km && (
              <div style={styles.field}>
                <label style={styles.label}>Tempo médio nos 5km (ex: 30:00)</label>
                <input
                  type="text"
                  placeholder="mm:ss"
                  value={form.runs_5km_time}
                  onChange={e => set('runs_5km_time', e.target.value)}
                  style={styles.input}
                />
              </div>
            )}

            <YesNoField
              label="Consegue correr 10km sem parar?"
              value={form.runs_10km}
              onChange={v => set('runs_10km', v)}
            />
            {form.runs_10km && (
              <div style={styles.field}>
                <label style={styles.label}>Tempo médio nos 10km (ex: 60:00)</label>
                <input
                  type="text"
                  placeholder="mm:ss"
                  value={form.runs_10km_time}
                  onChange={e => set('runs_10km_time', e.target.value)}
                  style={styles.input}
                />
              </div>
            )}
          </section>

          {/* Objetivos */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Objetivos *</h2>
            <div style={styles.checkboxGroup}>
              {OBJECTIVES.map(obj => (
                <label key={obj.value} style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={form.objectives.includes(obj.value)}
                    onChange={() => toggleObjective(obj.value)}
                    style={styles.checkbox}
                  />
                  {obj.label}
                </label>
              ))}
            </div>
          </section>

          {/* Frequência e limitações */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Rotina</h2>

            <div style={styles.field}>
              <label style={styles.label}>Quantas vezes por semana pretende treinar? *</label>
              <select
                value={form.weekly_frequency}
                onChange={e => set('weekly_frequency', e.target.value)}
                required
                style={styles.select}
              >
                <option value="">Selecione...</option>
                <option value="1">1x por semana</option>
                <option value="2">2x por semana</option>
                <option value="3">3x por semana</option>
                <option value="4">4x por semana</option>
                <option value="5">5x ou mais</option>
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Limitações físicas (opcional)</label>
              <textarea
                placeholder="Ex: dor no joelho, problema na coluna..."
                value={form.physical_limitations}
                onChange={e => set('physical_limitations', e.target.value)}
                rows={3}
                style={styles.textarea}
              />
            </div>
          </section>

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Salvando...' : 'Iniciar minha jornada'}
          </button>
        </form>
      </div>
    </div>
  )
}

function YesNoField({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean | null
  onChange: (v: boolean) => void
}) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <p style={{ color: 'var(--text-primary)', fontSize: '14px', margin: '0 0 8px', fontFamily: 'sans-serif' }}>
        {label}
      </p>
      <div style={{ display: 'flex', gap: '10px' }}>
        {([true, false] as const).map(opt => (
          <button
            key={String(opt)}
            type="button"
            onClick={() => onChange(opt)}
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              border: '1.5px solid',
              borderColor: value === opt ? 'var(--orange)' : 'var(--border-default)',
              backgroundColor: value === opt ? 'var(--orange-subtle)' : 'var(--bg-input)',
              color: value === opt ? 'var(--orange)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              fontFamily: 'sans-serif',
            }}
          >
            {opt ? 'Sim' : 'Não'}
          </button>
        ))}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100svh',
    backgroundColor: 'var(--bg-primary)',
    padding: '24px 16px 48px',
    fontFamily: 'sans-serif',
  },
  container: {
    maxWidth: '560px',
    margin: '0 auto',
  },
  header: {
    marginBottom: '32px',
  },
  title: {
    color: 'var(--text-primary)',
    fontSize: '28px',
    fontWeight: 800,
    margin: '0 0 8px',
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '15px',
    margin: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  section: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '12px',
  },
  sectionTitle: {
    color: 'var(--orange)',
    fontSize: '14px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    margin: '0 0 16px',
  },
  row: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    flex: 1,
    minWidth: '100px',
    marginBottom: '12px',
  },
  label: {
    color: 'var(--text-primary)',
    fontSize: '13px',
    fontWeight: 500,
  },
  input: {
    backgroundColor: 'var(--bg-input)',
    border: '1.5px solid var(--border-default)',
    borderRadius: '10px',
    color: 'var(--text-primary)',
    fontSize: '15px',
    padding: '12px 16px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  select: {
    backgroundColor: 'var(--bg-input)',
    border: '1.5px solid var(--border-default)',
    borderRadius: '10px',
    color: 'var(--text-primary)',
    fontSize: '15px',
    padding: '12px 16px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    appearance: 'none',
  },
  textarea: {
    backgroundColor: 'var(--bg-input)',
    border: '1.5px solid var(--border-default)',
    borderRadius: '10px',
    color: 'var(--text-primary)',
    fontSize: '15px',
    padding: '12px 16px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    resize: 'vertical',
  },
  checkboxGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: 'var(--text-primary)',
    fontSize: '14px',
    cursor: 'pointer',
  },
  checkbox: {
    accentColor: 'var(--orange)',
    width: '18px',
    height: '18px',
  },
  hint: {
    color: 'var(--text-secondary)',
    fontSize: '13px',
    margin: '4px 0 0',
  },
  error: {
    color: 'var(--red-accent)',
    fontSize: '13px',
    margin: '4px 0',
  },
  button: {
    backgroundColor: 'var(--orange)',
    color: 'var(--text-primary)',
    border: 'none',
    borderRadius: '12px',
    fontSize: '17px',
    fontWeight: 700,
    padding: '18px',
    cursor: 'pointer',
    width: '100%',
    marginTop: '8px',
    letterSpacing: '0.02em',
  },
}
