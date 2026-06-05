import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useChat } from '../../hooks/useChat'
import styles from './AlunoChat.module.css'

type AlunoChatProps = {
  studentId: string
}

export default function AlunoChat({ studentId }: AlunoChatProps) {
  const { messages, isLoading, sendMessage, deleteMessage } = useChat(studentId)
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    setSending(true)
    setActionError(null)
    try {
      await sendMessage(content, studentId, false)
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
      await deleteMessage(msgId, false)
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Erro ao apagar mensagem')
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.avatar}>
          P
        </div>
        <div>
          <h2 className={styles.title}>Professor</h2>
          <p className={styles.subtitle}>Chat Direto</p>
        </div>
      </div>

      <div className={styles.messagesContainer}>
        {isLoading ? (
          <div className={styles.loading}>Carregando mensagens...</div>
        ) : messages.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>💬</span>
            <p className={styles.emptyTitle}>Nenhuma mensagem ainda.</p>
            <p className={styles.emptySub}>Mande uma dúvida ou feedback sobre seu treino!</p>
          </div>
        ) : (
          <AnimatePresence>
            {messages.map((msg, i) => {
              if (msg.deleted_by_student) return null
              const isStudent = msg.sender_id === studentId
              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                  key={msg.id}
                  className={`${styles.messageWrapper} ${isStudent ? styles.wrapperStudent : styles.wrapperAdmin}`}
                >
                  <div className={`${styles.bubble} ${isStudent ? styles.bubbleStudent : styles.bubbleAdmin}`}>
                    <p className={styles.msgContent}>{msg.content}</p>
                    <span className={styles.msgTime}>
                      {format(new Date(msg.created_at), "HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  {isStudent && (
                    <button className={styles.deleteBtn} onClick={() => handleDelete(msg.id)} title="Apagar mensagem">
                      <Trash2 size={14} />
                    </button>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.inputArea}>
        {actionError && (
          <p className={styles.errorText}>
            {actionError}
          </p>
        )}
        <form onSubmit={handleSend} className={styles.form}>
          <input
            type="text"
            placeholder="Mensagem para o professor..."
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
    </div>
  )
}
