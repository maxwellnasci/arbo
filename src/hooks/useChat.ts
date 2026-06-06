import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'

export type Message = Database['public']['Tables']['messages']['Row']

export function useChat(studentId?: string | null) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!studentId) {
        setMessages([])
        setIsLoading(false)
        return
      }
      setIsLoading(true)
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('messages')
        .select('id, content, created_at, sender_id, admin_id, student_id, deleted_by_admin, deleted_by_student, read_at')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(100)
      if (cancelled) return
      if (fetchError) {
        setError(fetchError.message)
      } else if (data) {
        setMessages([...data].reverse())
      }
      setIsLoading(false)
    }

    load()

    if (!studentId) return

    const channel = supabase
      .channel(`chat_${studentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `student_id=eq.${studentId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMessages((prev) => {
              // Previne duplicação caso o select retorne antes do evento Realtime
              if (prev.find(m => m.id === payload.new.id)) return prev
              return [...prev, payload.new as Message]
            })
          } else if (payload.eventType === 'UPDATE') {
            setMessages((prev) =>
              prev.map((msg) => (msg.id === payload.new.id ? (payload.new as Message) : msg))
            )
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [studentId])

  const sendMessage = async (content: string, senderId: string, isAdmin: boolean) => {
    if (!studentId || !content.trim()) return

    const { error: sendError } = await supabase.from('messages').insert({
      student_id: studentId,
      sender_id: senderId,
      admin_id: isAdmin ? senderId : null,
      content: content.trim(),
    })

    if (sendError) throw sendError
  }

  const deleteMessage = async (messageId: string, isAdmin: boolean) => {
    const updatePayload = isAdmin
      ? { deleted_by_admin: true }
      : { deleted_by_student: true }

    const { error: deleteError } = await supabase
      .from('messages')
      .update(updatePayload)
      .eq('id', messageId)

    if (deleteError) throw deleteError
  }

  const markAsRead = async (messageId: string) => {
    const { error: readError } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', messageId)

    if (readError) throw readError
  }

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    deleteMessage,
    markAsRead,
  }
}
