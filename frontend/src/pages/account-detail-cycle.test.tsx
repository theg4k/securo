/**
 * The cycle window a credit card's date fields produce, and what it makes the
 * page ask the API for.
 *
 * `lib/credit-card-cycle.test.ts` covers the arithmetic. This covers the wiring,
 * which is where the bug actually lived: the page decided it was on the open
 * cycle whenever the window matched no bill, so touching a date field made it
 * request unbilled transactions only over a period that had already closed,
 * and the charges those bills carry disappeared from a window that had just
 * been made wider.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'

import AccountDetailPage from '@/pages/account-detail'
import { i18n, renderWithProviders } from '@/test/utils'

const api = vi.hoisted(() => ({
  accounts: {
    get: vi.fn(),
    bills: vi.fn(),
    summary: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
  },
  transactions: { list: vi.fn(), update: vi.fn(), delete: vi.fn(), create: vi.fn() },
  dashboard: { projectedTransactions: vi.fn() },
  categories: { list: vi.fn() },
  categoryGroups: { list: vi.fn() },
}))

vi.mock('@/lib/api', () => ({
  accounts: api.accounts,
  transactions: api.transactions,
  dashboard: api.dashboard,
  categories: api.categories,
  categoryGroups: api.categoryGroups,
}))

vi.mock('@/hooks/use-display-locale', () => ({
  useDisplayLocale: () => 'en-US',
  useDateLocale: () => 'en-US',
}))

vi.mock('@/hooks/use-privacy-mode', () => ({
  usePrivacyMode: () => ({ mask: (value: string) => value, privacyMode: false, MASK: '***' }),
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: { preferences: { currency_display: 'BRL' } } }),
}))

vi.mock('@/contexts/workspace-context', () => ({
  useWorkspace: () => ({ canWrite: true }),
}))

// Closes on the 30th, bills due on the 10th. The newest bill is due
// 2026-05-10, so the cycle that is still open starts on 2026-04-30.
const account = {
  id: 'acc-1',
  name: 'Card',
  type: 'credit_card',
  currency: 'BRL',
  balance: -280,
  is_active: true,
  credit_limit: 5000,
  statement_close_day: 30,
  payment_due_day: 10,
}

const bills = [
  { id: 'bill-apr', account_id: 'acc-1', external_id: 'a', due_date: '2026-04-10', total_amount: 125, currency: 'BRL', minimum_payment: null },
  { id: 'bill-may', account_id: 'acc-1', external_id: 'b', due_date: '2026-05-10', total_amount: 280, currency: 'BRL', minimum_payment: null },
]

/** The cycle header. Matching on the month alone is ambiguous: the timeline
 *  bar for the same cycle carries the same text. */
function cycleHeader() {
  return screen
    .getAllByRole('button')
    .find((b) => b.getAttribute('aria-haspopup') === 'dialog' && /\d{4}|-/.test(b.textContent ?? ''))!
}

/** Every `transactions.list` call the page has made, oldest first. */
function txCalls() {
  return api.transactions.list.mock.calls.map(([args]) => args as Record<string, unknown>)
}

beforeEach(async () => {
  vi.clearAllMocks()
  await i18n.changeLanguage('en')
  vi.setSystemTime(new Date('2026-09-08T12:00:00'))
  api.accounts.get.mockResolvedValue(account)
  api.accounts.bills.mockResolvedValue(bills)
  api.accounts.list.mockResolvedValue([account])
  api.accounts.summary.mockResolvedValue({
    monthly_income: 0, monthly_expenses: 0, projected_income: 0, projected_expenses: 0,
  })
  api.transactions.list.mockResolvedValue({ items: [], total: 0 })
  api.dashboard.projectedTransactions.mockResolvedValue([])
  api.categories.list.mockResolvedValue([])
  api.categoryGroups.list.mockResolvedValue([])
})

async function renderPage() {
  const rendered = renderWithProviders(<AccountDetailPage />, {
    route: '/accounts/acc-1',
    path: '/accounts/:id',
  })
  await waitFor(() => expect(api.transactions.list).toHaveBeenCalled())
  return rendered
}

describe('credit card cycle window', () => {
  it('keeps the bank statement total after payment and navigates October to November', async () => {
    vi.setSystemTime(new Date('2026-10-24T12:00:00'))
    api.accounts.get.mockResolvedValue({ ...account, statement_close_day: 14, payment_due_day: 21 })
    api.accounts.bills.mockResolvedValue([
      { ...bills[0], id: 'bill-sep', due_date: '2026-09-21', total_amount: 7358.48 },
      { ...bills[1], id: 'bill-oct', due_date: '2026-10-21', total_amount: 10001.16 },
    ])
    api.accounts.summary.mockImplementation((_id, _from, _to, billId) => Promise.resolve({
      monthly_income: 0, monthly_expenses: billId ? 3280.38 : 0,
      projected_income: 0, projected_expenses: billId ? 3712.06 : 6152.57,
    }))
    const { user } = await renderPage()

    await waitFor(() => expect(cycleHeader()).toHaveTextContent('Nov 2026'))
    expect(txCalls().at(-1)).toMatchObject({ from: '2026-10-14', to: '2026-11-13', unbilled_only: true })
    await user.click(screen.getByTitle('Previous cycle'))
    await waitFor(() => expect(cycleHeader()).toHaveTextContent('Oct 2026'))
    expect(screen.getByText(i18n.t('accounts.cycleBillTotal')).parentElement).toHaveTextContent('10,001.16')
    expect(screen.getByText(i18n.t('accounts.utilization')).parentElement?.parentElement).toHaveTextContent('10,001.16')
    expect(screen.getByRole('button', { name: /Oct 2026.*10,001.16/ })).toBeInTheDocument()

    await user.click(screen.getByTitle('Next cycle'))
    await waitFor(() => expect(cycleHeader()).toHaveTextContent('Nov 2026'))
    expect(txCalls().at(-1)).toMatchObject({ from: '2026-10-14', to: '2026-11-13', unbilled_only: true })
    await waitFor(() => expect(screen.getByText(i18n.t('accounts.cycleBillTotal')).parentElement).toHaveTextContent('6,152.57'))
  })

  it('converts the original bank statement total when displaying primary currency', async () => {
    vi.setSystemTime(new Date('2026-10-24T12:00:00'))
    api.accounts.get.mockResolvedValue({ ...account, currency: 'USD', statement_close_day: 14, payment_due_day: 21 })
    api.accounts.bills.mockResolvedValue([
      { ...bills[1], id: 'bill-oct', due_date: '2026-10-21', currency: 'USD', total_amount: 100, total_amount_primary: 500 },
    ])
    api.accounts.summary.mockResolvedValue({ monthly_expenses: 0, projected_expenses: 0, monthly_expenses_primary: 0, projected_expenses_primary: 0 })
    const { user } = await renderPage()
    await user.click(screen.getByTitle('Previous cycle'))
    await waitFor(() => expect(cycleHeader()).toHaveTextContent('Oct 2026'))
    await user.click(screen.getByRole('button', { name: /^BRL$/ }))
    expect(screen.getByText(i18n.t('accounts.cycleBillTotal')).parentElement).toHaveTextContent('500.00')
  })

  it('asks for unbilled transactions only on the cycle that is still open', async () => {
    await renderPage()

    // No bill is due after today, so the page opens on the trailing cycle.
    // Excluding already-billed rows there is the whole point of the flag:
    // the window overlaps the newest closed bill's range.
    await waitFor(() => {
      const last = txCalls().at(-1)!
      expect(last.unbilled_only).toBe(true)
      expect(String(last.from) >= '2026-04-30').toBe(true)
    })
  })

  it('does not ask for unbilled transactions only on a bill cycle', async () => {
    const { user } = await renderPage()

    await user.click(await screen.findByTitle('Previous cycle'))

    await waitFor(() => {
      const last = txCalls().at(-1)!
      expect(last.bill_id).toBe('bill-may')
      expect(last.unbilled_only).toBeUndefined()
    })
  })

  it('does not ask for unbilled transactions only on a hand-picked range', async () => {
    const { user } = await renderPage()

    // Land on a real bill first, then move the end date off it. The window
    // still covers everything the bill cycle did, so nothing about the edit
    // may remove a transaction from the answer.
    await user.click(await screen.findByTitle('Previous cycle'))
    await waitFor(() => expect(txCalls().at(-1)!.bill_id).toBe('bill-may'))

    await user.click(cycleHeader())
    await user.click(await screen.findByRole('button', { name: '5/10/2026' }))
    await user.click(await screen.findByRole('button', { name: '15' }))

    await waitFor(() => {
      const last = txCalls().at(-1)!
      expect(last.to).toBe('2026-05-15')
      expect(last.bill_id).toBeUndefined()
      // The regression: this used to be `true`, and the R$280 bill's charges
      // vanished from a window five days wider than the one that showed them.
      expect(last.unbilled_only).toBeUndefined()
    })
  })

  it('names a hand-picked range by its own dates instead of a statement month', async () => {
    const { user } = await renderPage()

    await user.click(await screen.findByTitle('Previous cycle'))
    await user.click(cycleHeader())
    await user.click(await screen.findByRole('button', { name: '5/10/2026' }))
    await user.click(await screen.findByRole('button', { name: '15' }))

    // Before the fix this read "Jun 2026", naming the window after a bill it
    // has no claim to.
    await waitFor(() => expect(cycleHeader().textContent).toMatch(/11 Apr - 15 May/i))
  })
})
