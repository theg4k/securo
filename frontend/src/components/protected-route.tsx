import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const { token, isLoading, sessionUnavailable, retrySession } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (sessionUnavailable) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p role="alert">{t('auth.serverError')}</p>
        <Button onClick={retrySession}>{t('common.retry')}</Button>
      </div>
    )
  }

  return <>{children}</>
}
