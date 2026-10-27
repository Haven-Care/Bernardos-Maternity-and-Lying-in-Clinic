/** Bound authentication waits, including SDK initialization and token refresh. */
export async function withTimeout<T>(operation: PromiseLike<T>, milliseconds: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(message)
      error.name = 'TimeoutError'
      reject(error)
    }, milliseconds)
  })
  try {
    return await Promise.race([operation, timeout])
  } finally {
    clearTimeout(timer)
  }
}
