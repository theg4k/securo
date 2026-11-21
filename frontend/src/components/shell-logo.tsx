interface ShellLogoProps {
  size?: number
  className?: string
}

export function ShellLogo({ size = 24, className }: ShellLogoProps) {
  return (
    <img
      src="/free-finance-512.png"
      alt="Free Finance"
      width={size}
      height={size}
      className={className}
      draggable={false}
    />
  )
}

interface ShellWordmarkProps {
  height?: number
  className?: string
}

export function ShellWordmark({ height = 20, className }: ShellWordmarkProps) {
  return (
    <img
      src="/free-finance.png"
      alt="Free Finance"
      width={Math.round(height * (1000 / 254))}
      height={height}
      className={className}
      draggable={false}
    />
  )
}
