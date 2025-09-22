// Sets a global undici ProxyAgent when a proxy URL is configured via env.
// Works for all fetch/undici requests in the Node.js runtime.

// This module has side effects on import. Import it once on server startup
// or at the top of server-side route handlers.

// Note: requires the 'undici' package to be installed.

import { ProxyAgent, setGlobalDispatcher } from 'undici'

let configured = false

function getProxyUrl(): string | undefined {
  // Preference order: custom var, HTTPS, ALL, then HTTP
  return (
    process.env.UNDICI_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.ALL_PROXY ||
    process.env.HTTP_PROXY
  )
}

function setup() {
  if (configured) return

  // Only attempt in Node.js runtime
  if (typeof process === 'undefined' || process.release?.name !== 'node') return

  const proxyUrl = getProxyUrl()
  if (!proxyUrl) return

  try {
    const agent = new ProxyAgent(proxyUrl)
    setGlobalDispatcher(agent)
    configured = true

    if (process.env.DEBUG?.includes('undici-proxy')) {
      // Minimal log for troubleshooting
      console.log(`[undici] Proxy enabled via ${proxyUrl}`)
    }
  } catch (err) {
    // Do not crash the app if proxy config is invalid
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[undici] Failed to configure proxy: ${message}`)
  }
}

// Run immediately on import
setup()

export default setup

