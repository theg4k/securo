/** URL helpers for serving the SPA from the domain root or a subpath. */
export function normalizeAppBasePath(value: string): string {
  const segments = value.trim().split('/').filter(Boolean)
  return segments.length ? `/${segments.join('/')}/` : '/'
}

export function createAppPaths(basePath: string) {
  const base = normalizeAppBasePath(basePath)
  const basename = base === '/' ? '/' : base.slice(0, -1)
  const apiBaseUrl = `${base}api`.replace(/\/+/g, '/')

  const withBase = (prefix: string, path: string) => {
    const suffix = path.replace(/^\/+/, '')
    return suffix ? `${prefix}/${suffix}` : `${prefix}/`
  }

  return {
    basename,
    apiBaseUrl,
    route: (path: string) => withBase(base === '/' ? '' : basename, path),
    api: (path: string) => withBase(apiBaseUrl, path),
  }
}

export const appPaths = createAppPaths(import.meta.env.BASE_URL)
