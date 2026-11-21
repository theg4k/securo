// Securo currently ships a fixed dark theme, with no runtime theme cycle.
export type ThemeChoice = 'dark'

export function nextTheme(_theme?: string): ThemeChoice {
  return 'dark'
}

export const THEME_LABEL_KEY: Record<ThemeChoice, string> = {
  dark: 'settings.themeDark',
}
