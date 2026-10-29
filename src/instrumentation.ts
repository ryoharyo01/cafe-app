import type { Instrumentation } from 'next'

// Tangkap semua error server yang tidak di-handle (route handler, server component, proxy)
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { writeLog, describeError } = await import('@/lib/logger')
  const { message, stack } = describeError(err)
  const digest = typeof err === 'object' && err !== null && 'digest' in err ? String(err.digest) : undefined
  const header = (name: string) => {
    const v = request.headers[name]
    return Array.isArray(v) ? v[0] : v
  }

  await writeLog({
    source: 'server',
    context: `unhandled.${context.routeType}`,
    message,
    stack,
    meta: { method: request.method, routePath: context.routePath, digest },
    url: request.path,
    user_agent: header('user-agent'),
    ip: header('x-forwarded-for')?.split(',')[0].trim() || header('x-real-ip'),
  })
}
