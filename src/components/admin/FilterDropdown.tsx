import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import styles from './FilterDropdown.module.css'

export interface FilterDropdownOption {
  key: string
  label: string
  dotColor?: string
}

interface FilterDropdownProps {
  idleLabel: string
  allOptionLabel: string
  options: FilterDropdownOption[]
  selectedKey: string
  onSelect: (key: string) => void
  footer?: { label: string; onClick: () => void }
}

const ALL_KEY = 'todos'
const PANEL_MAX_WIDTH = 280
const VIEWPORT_MARGIN = 8

export function FilterDropdown({ idleLabel, allOptionLabel, options, selectedKey, onSelect, footer }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})
  const wrapperRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    function updatePosition() {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return

      const style: React.CSSProperties = { top: rect.bottom + 6 }
      const overflowsRight = rect.left + PANEL_MAX_WIDTH > window.innerWidth - VIEWPORT_MARGIN
      if (overflowsRight) {
        style.right = Math.max(VIEWPORT_MARGIN, window.innerWidth - rect.right)
      } else {
        style.left = rect.left
      }
      setPanelStyle(style)
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (wrapperRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const selectedOption = options.find(o => o.key === selectedKey)

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ''}`}
      >
        <span className={styles.triggerLabel}>
          {selectedOption?.dotColor && (
            <span className={styles.dot} style={{ background: selectedOption.dotColor }} />
          )}
          {selectedOption?.label ?? idleLabel}
        </span>
        <ChevronDown size={14} className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} />
      </button>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className={styles.panel}
              style={panelStyle}
            >
              <button
                type="button"
                onClick={() => { onSelect(ALL_KEY); setIsOpen(false) }}
                className={`${styles.option} ${selectedKey === ALL_KEY ? styles.optionActive : ''}`}
              >
                {allOptionLabel}
              </button>
              {options.map(option => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => { onSelect(option.key); setIsOpen(false) }}
                  className={`${styles.option} ${selectedKey === option.key ? styles.optionActive : ''}`}
                >
                  {option.dotColor && <span className={styles.dot} style={{ background: option.dotColor }} />}
                  {option.label}
                </button>
              ))}
              {footer && (
                <>
                  <div className={styles.divider} />
                  <button
                    type="button"
                    onClick={() => { setIsOpen(false); footer.onClick() }}
                    className={styles.footerOption}
                  >
                    {footer.label}
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
