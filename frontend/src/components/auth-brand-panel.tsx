import { useTranslation } from 'react-i18next'

// Left-hand brand panel for the auth/onboarding screens. The transparent
// Free Finance wordmark sits over a dark field with a soft multicolor aurora.
export function AuthBrandPanel() {
  const { t } = useTranslation()

  return (
    <div
      className="relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between"
      style={{
        background:
          'linear-gradient(150deg, #171717 0%, #111111 52%, #0A0A0A 100%)',
      }}
    >
      {/* Soft animated aurora */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="securo-aurora securo-aurora-1" />
        <div className="securo-aurora securo-aurora-2" />
        <div className="securo-aurora securo-aurora-3" />
      </div>

      {/* Depth: gentle vignette toward the edges */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(115% 90% at 78% 8%, transparent 42%, rgba(0, 0, 0, 0.38) 100%)',
        }}
      />

      {/* Wordmark */}
      <div className="relative">
        <img src="/free-finance.png" alt={t('app.name')} className="h-auto w-48 object-contain" />
      </div>

      {/* Tagline */}
      <div className="relative max-w-md space-y-5">
        <h2 className="text-[2.6rem] font-semibold leading-[1.08] tracking-tight">
          {t('setup.brandTagline')}
        </h2>
        <p className="max-w-sm text-base leading-relaxed text-white/70">
          {t('setup.brandSubtitle')}
        </p>
        <div className="flex items-center gap-2.5 pt-1 text-xs font-medium text-white/55">
          <span>{t('setup.brandOpen')}</span>
          <span className="h-1 w-1 rounded-full bg-white/35" />
          <span>{t('setup.brandSelfHosted')}</span>
          <span className="h-1 w-1 rounded-full bg-white/35" />
          <span>{t('setup.brandPrivate')}</span>
        </div>
      </div>
    </div>
  )
}
