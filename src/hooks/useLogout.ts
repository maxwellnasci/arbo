import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function useLogout() {
  const navigate = useNavigate()

  return async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }
}
