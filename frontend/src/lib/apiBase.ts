export function apiBaseUrl(hostname: string, configured?: string): string {
  return hostname.endsWith('.vercel.app') ? '/api' : configured ?? 'http://localhost:6101/api'
}
