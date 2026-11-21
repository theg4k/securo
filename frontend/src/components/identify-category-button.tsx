import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { transactions as transactionsApi } from '@/lib/api'

interface IdentifyCategoryButtonProps {
  transactionId?: string
  description: string
  payee?: string | null
  bankCategory?: string | null
  direction: 'debit' | 'credit'
  disabled?: boolean
  onIdentified: (categoryId: string) => void
}

/** Requests a category for one item and returns it to that item's editor only. */
export function IdentifyCategoryButton({
  transactionId,
  description,
  payee,
  bankCategory,
  direction,
  disabled = false,
  onIdentified,
}: IdentifyCategoryButtonProps) {
  const { t } = useTranslation()
  const [pending, setPending] = useState(false)

  const handleIdentify = async () => {
    if (pending || disabled) return
    setPending(true)
    try {
      const result = await transactionsApi.identifyCategory({
        transaction_id: transactionId,
        description,
        payee,
        bank_category: bankCategory,
        direction,
      })
      if (!result.category_id) {
        toast.info(t('transactions.identifyCategoryNoSuggestion'))
        return
      }
      onIdentified(result.category_id)
      toast.success(
        t('transactions.identifyCategoryApplied', {
          category: result.category_name ?? t('transactions.category'),
        }),
      )
    } catch {
      toast.error(t('transactions.identifyCategoryFailed'))
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-7 shrink-0 gap-1.5 px-2 text-xs"
      disabled={disabled || pending || (!description.trim() && !payee?.trim() && !bankCategory?.trim())}
      onClick={handleIdentify}
    >
      {pending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
      {t('transactions.identifyCategory')}
    </Button>
  )
}
