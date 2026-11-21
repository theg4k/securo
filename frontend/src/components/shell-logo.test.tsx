import { describe, expect, it } from 'vitest'

import { ShellLogo } from '@/components/shell-logo'
import { renderWithProviders } from '@/test/utils'

describe('ShellLogo', () => {
  it('renders the Free Finance mark at the default size', () => {
    const { container } = renderWithProviders(<ShellLogo />)

    const image = container.querySelector('img')!
    expect(image).toBeInTheDocument()
    expect(image).toHaveAttribute('src', '/free-finance-512.png')
    expect(image).toHaveAttribute('alt', 'Free Finance')
    expect(image).toHaveAttribute('width', '24')
    expect(image).toHaveAttribute('height', '24')
  })

  it('honours an explicit size on both axes', () => {
    const { container } = renderWithProviders(<ShellLogo size={64} />)

    const image = container.querySelector('img')!
    expect(image).toHaveAttribute('width', '64')
    expect(image).toHaveAttribute('height', '64')
  })

  it('accepts a className', () => {
    const { container } = renderWithProviders(
      <ShellLogo className="text-primary" />,
    )

    expect(container.querySelector('img')).toHaveClass('text-primary')
  })
})
