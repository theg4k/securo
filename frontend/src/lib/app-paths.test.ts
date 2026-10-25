import { describe, expect, it } from 'vitest'
import { createAppPaths, normalizeAppBasePath } from './app-paths'

describe('app URL paths', () => {
  it('normalizes the domain root', () => {
    expect(normalizeAppBasePath('/')).toBe('/')
    expect(createAppPaths('/')).toEqual({
      basename: '/',
      apiBaseUrl: '/api',
      route: expect.any(Function),
      api: expect.any(Function),
    })
    expect(createAppPaths('/').route('/login')).toBe('/login')
    expect(createAppPaths('/').api('/agents')).toBe('/api/agents')
  })

  it('prefixes routes and API URLs when mounted below a path', () => {
    const paths = createAppPaths('/finance/')
    expect(paths.basename).toBe('/finance')
    expect(paths.apiBaseUrl).toBe('/finance/api')
    expect(paths.route('/login')).toBe('/finance/login')
    expect(paths.route('/')).toBe('/finance/')
    expect(paths.api('/agents/123/chat')).toBe('/finance/api/agents/123/chat')
  })
})
