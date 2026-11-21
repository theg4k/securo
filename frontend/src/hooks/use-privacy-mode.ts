const MASK = '\u2022\u2022\u2022\u2022\u2022'
const showValue = (value: string) => value

// Financial values now remain visible; this helper keeps existing display
// components simple while the privacy toggle is removed from the app.
export function usePrivacyMode() {
  return { privacyMode: false, mask: showValue, MASK } as const
}
