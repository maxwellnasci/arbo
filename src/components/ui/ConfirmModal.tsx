
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Info } from 'lucide-react'

export type ConfirmModalProps = {
  isOpen: boolean
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  type?: 'danger' | 'warning' | 'info'
}

export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  type = 'danger'
}: ConfirmModalProps) {
  const getIcon = () => {
    switch (type) {
      case 'danger':
      case 'warning':
        return <AlertTriangle size={24} color={type === 'danger' ? 'var(--red-accent)' : 'var(--orange)'} />
      case 'info':
        return <Info size={24} color="var(--blue-accent)" />
    }
  }

  const getButtonColor = () => {
    switch (type) {
      case 'danger': return 'var(--red-accent)'
      case 'warning': return 'var(--orange)'
      case 'info': return 'var(--blue-accent)'
      default: return 'var(--orange)'
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'var(--backdrop-bg)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '400px',
              boxShadow: 'var(--shadow-modal)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '24px' }}>
              <div style={{
                background: (() => {
                  const subtleMap = { danger: 'var(--red-subtle)', warning: 'var(--orange-subtle)', info: 'var(--blue-subtle)' };
                  return subtleMap[type];
                })(),
                padding: '12px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {getIcon()}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ 
                  margin: '0 0 8px 0', 
                  fontSize: '18px', 
                  color: 'var(--text-primary)',
                  fontWeight: 600
                }}>
                  {title}
                </h3>
                <p style={{ 
                  margin: 0, 
                  fontSize: '14px', 
                  color: 'var(--text-secondary)',
                  lineHeight: '1.5'
                }}>
                  {description}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={onCancel}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  flex: 1
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-surface-hover)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                style={{
                  background: getButtonColor(),
                  border: 'none',
                  color: 'var(--text-on-brand)',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                  flex: 1
                }}
                onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
