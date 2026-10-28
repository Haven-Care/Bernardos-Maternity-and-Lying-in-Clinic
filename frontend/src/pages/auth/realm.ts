/** Legacy patient recovery URLs share the same flow and login destination. */
export function useAuthRealm() {
  return {
    loginPath: '/login', forgotPath: '/forgot-password', verifyPath: '/verify-code',
    resetPath: '/reset-password', successPath: '/reset-success',
  }
}

export function recoveryReturnTo(state: unknown): '/patient/account' | undefined {
  return state && typeof state === 'object' && 'returnTo' in state && state.returnTo === '/patient/account'
    ? '/patient/account' : undefined
}
