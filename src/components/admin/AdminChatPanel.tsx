import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useChat } from '../../hooks/useChat'
import { useAuth } from '../../contexts/AuthContext'
import styles from './AdminChatPanel.module.css'

type AdminChatPanelProps = {
  isOpen: boolean
  onClose: () => void
  studentId: string
  studentName: string
}

export default function AdminChatPanel({ isOpen, onClose, studentId, studentName }: AdminChatPanelProps) {
  const { user } = useAuth()
  const { messages, isLoading, sendMessage, deleteMessage } = useChat(isOpen ? studentId : null)
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || !user) return

    setSending(true)
    setActionError(null)
    try {
      await sendMessage(content, user.id, true)
      setContent('')
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Erro ao enviar mensagem')
    } finally {
      setSending(false)
    }
  }

  const handleDelete = async (msgId: string) => {
    setActionError(null)
    try {
      await deleteMessage(msgId, true)
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Erro ao apagar mensagem')
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={styles.panel}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            {/* Header Glassmorphism */}
            <div className={styles.header}>
              <div className={styles.headerInfo}>
                <div className={styles.avatar}>
                  {studentName.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
                </div>
                <div>
                  <h3 className={styles.title}>{studentName}</h3>
                  <p className={styles.subtitle}>Chat Direto</p>
                </div>
              </div>
              <button onClick={onClose} className={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>

            {/* Messages Area */}
            <div className={styles.messagesContainer}>
              {isLoading ? (
                <div className={styles.loading}>Carregando mensagens...</div>
              ) : messages.length === 0 ? (
                <div className={styles.empty}>Nenhuma mensagem ainda. Diga olá! 👋</div>
              ) : (
                messages.map(msg => {
                  if (msg.deleted_by_admin) return null
                  const isAdmin = msg.sender_id !== studentId
                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      key={msg.id}
                      className={`${styles.messageWrapper} ${isAdmin ? styles.wrapperAdmin : styles.wrapperStudent}`}
                    >
                      <div className={`${styles.bubble} ${isAdmin ? styles.bubbleAdmin : styles.bubbleStudent}`}>
                        <p className={styles.msgContent}>{msg.content}</p>
                        <span className={styles.msgTime}>
                          {format(new Date(msg.created_at), "HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      {isAdmin && (
                        <button className={styles.deleteBtn} onClick={() => handleDelete(msg.id)} title="Apagar mensagem">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </motion.div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className={styles.inputArea}>
              {actionError && (
                <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#ff6b6b', textAlign: 'center' }}>
                  {actionError}
                </p>
              )}
              <form onSubmit={handleSend} className={styles.form}>
                <input
                  type="text"
                  placeholder="Escreva uma mensagem..."
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  className={styles.input}
                />
                <button
                  type="submit"
                  disabled={!content.trim() || sending}
                  className={styles.sendBtn}
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
