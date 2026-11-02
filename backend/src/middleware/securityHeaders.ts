import {
  contentSecurityPolicy,
  crossOriginOpenerPolicy,
  crossOriginResourcePolicy,
  originAgentCluster,
  referrerPolicy,
  strictTransportSecurity,
  xContentTypeOptions,
  xDnsPrefetchControl,
  xDownloadOptions,
  xFrameOptions,
  xPermittedCrossDomainPolicies,
  xXssProtection,
} from 'helmet'

/**
 * The headers `helmet()` sends by default, as its separate middlewares.
 *
 * helmet ships CommonJS and ESM typings that disagree about its default
 * export. Local `tsc` resolves the ESM one, where `helmet()` is callable;
 * Vercel's build check resolves the CommonJS one, where the default import is
 * the module object, and every backend deploy since helmet was added failed on
 * it. The named middlewares are typed the same in both, so this list builds
 * everywhere. X-Powered-By is left to `app.disable('x-powered-by')`.
 */
export const securityHeaders = [
  contentSecurityPolicy(),
  crossOriginOpenerPolicy(),
  crossOriginResourcePolicy(),
  originAgentCluster(),
  referrerPolicy(),
  strictTransportSecurity(),
  xContentTypeOptions(),
  xDnsPrefetchControl(),
  xDownloadOptions(),
  xFrameOptions(),
  xPermittedCrossDomainPolicies(),
  xXssProtection(),
]
