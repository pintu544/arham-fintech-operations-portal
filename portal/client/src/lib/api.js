export class ApiError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR', payload = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.payload = payload
  }
}

const apiBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')

export function apiUrl(path) {
  if (!apiBaseUrl || /^https?:\/\//i.test(path)) return path
  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export async function apiRequest(path, {
  employeeId,
  signal,
  method = 'GET',
  body,
  headers = {}
} = {}) {
  const requestHeaders = { Accept: 'application/json', ...headers }
  if (employeeId) requestHeaders['X-Employee-Id'] = employeeId
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json'

  let response
  try {
    response = await fetch(apiUrl(path), {
      method,
      signal,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body)
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError('Unable to reach the portal server')
  }

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json') ? await response.json() : null
  if (!response.ok) {
    const apiError = payload?.error
    throw new ApiError(apiError?.message || `Request failed with status ${response.status}`, {
      status: response.status,
      code: apiError?.code || 'REQUEST_FAILED',
      payload
    })
  }
  return payload
}
