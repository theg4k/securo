import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { auth } from '@/lib/api'
import type { User } from '@/types'

import { AuthContext, type LoginResult } from '@/contexts/auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [session, setSession] = useState<{ token: string; user: User } | null>(null)
  const [failedToken, setFailedToken] = useState<string | null>(null)
  const [restoreAttempt, setRestoreAttempt] = useState(0)
  const queryClient = useQueryClient()

  const user = session && session.token === token ? session.user : null
  const sessionUnavailable = token !== null && failedToken === token
  const isLoading = token !== null && user === null && !sessionUnavailable

  const clearSession = useCallback(() => {
    localStorage.removeItem('token')
    setToken(null)
    setSession(null)
    setFailedToken(null)
    queryClient.clear()
  }, [queryClient])

  const retrySession = useCallback(() => {
    setFailedToken(null)
    setRestoreAttempt((attempt) => attempt + 1)
  }, [])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    const isCurrent = () => !cancelled && localStorage.getItem('token') === token
    auth.me(token)
      .then((me) => {
        if (isCurrent()) setSession({ token, user: me })
      })
      .catch((error: unknown) => {
        if (!isCurrent()) return
        if (isAxiosError(error) && error.response?.status === 401) {
          clearSession()
        } else {
          setFailedToken(token)
        }
      })
    return () => { cancelled = true }
  }, [token, restoreAttempt, clearSession])

  useEffect(() => {
    if (!sessionUnavailable) return
    window.addEventListener('online', retrySession)
    return () => window.removeEventListener('online', retrySession)
  }, [sessionUnavailable, retrySession])

  // Sync token across tabs via storage events
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== 'token' && e.key !== null) return
      const storedToken = localStorage.getItem('token')
      if (storedToken !== token) {
        setSession(null)
        setFailedToken(null)
        queryClient.clear()
        setToken(storedToken)
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [queryClient, token])

  const loginWithToken = useCallback((accessToken: string) => {
    localStorage.setItem('token', accessToken)
    setToken(accessToken)
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const data = await auth.login(email, password)

    if (data.requires_2fa) {
      return { requires_2fa: true, temp_token: data.temp_token, available_methods: data.available_methods }
    }

    loginWithToken(data.access_token)
    return { requires_2fa: false }
  }, [loginWithToken])

  const verify2fa = useCallback(async (tempToken: string, code: string) => {
    const data = await auth.verify2fa(tempToken, code)
    loginWithToken(data.access_token)
  }, [loginWithToken])

  const updateUser = useCallback((updatedUser: User) => {
    setSession((current) => current && { token: current.token, user: updatedUser })
  }, [])

  const register = useCallback(async (email: string, password: string, preferences?: Record<string, string>) => {
    await auth.register(email, password, preferences)
    await login(email, password)
  }, [login])

  const logout = useCallback(async () => {
    const activeToken = localStorage.getItem('token')
    if (!activeToken) return
    await auth.logout(activeToken)
    if (localStorage.getItem('token') === activeToken) clearSession()
  }, [clearSession])

  return (
    <AuthContext.Provider value={{
      user, token, isLoading, sessionUnavailable, retrySession,
      login, verify2fa, loginWithToken, register, updateUser, logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
