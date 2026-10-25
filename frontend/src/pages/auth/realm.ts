/** Legacy patient recovery URLs share the same flow and login destination. */
export function useAuthRealm() {
  return {
    loginPath: '/login', forgotPath: '/forgot-password', verifyPath: '/verify-code',
    resetPath: '/reset-password', successPath: '/reset-success',
  }
}
