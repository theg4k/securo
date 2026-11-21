export const DEFAULT_THEME_COLOR = '#EC4899'

export function normalizeThemeColor(color: string): string {
  // Replace the former stock dark-mode indigo while preserving admin-picked colors.
  return color.toLowerCase() === '#818cf8' ? DEFAULT_THEME_COLOR : color
}

function contrastingForeground(color: string): string {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16) / 255)
  const luminance = channels
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0)

  return luminance > 0.179 ? '#0C0D12' : '#FFFFFF'
}

export function setThemeColor(themeColor: string | null) {
  const root = document.documentElement
  const color = themeColor ? normalizeThemeColor(themeColor) : null

  if (color) {
    root.style.setProperty('--primary', color)
    root.style.setProperty('--primary-foreground', contrastingForeground(color))
    root.style.setProperty('--ring', color)
    root.style.setProperty('--sidebar-primary', color)
    root.style.setProperty('--sidebar-primary-foreground', contrastingForeground(color))

    const accentBg = `color-mix(in srgb, ${color}, black 90%)`
    const mutedBg = `color-mix(in srgb, ${color}, black 94%)`
    root.style.setProperty('--accent', accentBg)
    root.style.setProperty('--sidebar-accent', accentBg)
    root.style.setProperty('--muted', mutedBg)

    const accentFg = `color-mix(in srgb, ${color}, white 20%)`
    root.style.setProperty('--accent-foreground', accentFg)
    root.style.setProperty('--sidebar-accent-foreground', accentFg)
  } else {
    root.style.removeProperty('--primary')
    root.style.removeProperty('--primary-foreground')
    root.style.removeProperty('--ring')
    root.style.removeProperty('--sidebar-primary')
    root.style.removeProperty('--sidebar-primary-foreground')
    root.style.removeProperty('--accent')
    root.style.removeProperty('--accent-foreground')
    root.style.removeProperty('--muted')
    root.style.removeProperty('--sidebar-accent')
    root.style.removeProperty('--sidebar-accent-foreground')
  }
}
