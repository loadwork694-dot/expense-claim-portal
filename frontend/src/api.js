const API_URL = import.meta.env?.VITE_API_URL || '/api'

export async function apiRequest(endpoint, { token, method = 'GET', body } = {}) {
  const headers = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  let response
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined
    })
  } catch {
    throw new Error('Unable to reach the server. Check that the backend is running.')
  }

  const text = await response.text()
  let result = null
  if (text.trim()) {
    try {
      result = JSON.parse(text)
    } catch {
      if (response.ok) {
        throw new Error('The server returned an invalid response.')
      }
    }
  }

  if (!response.ok) {
    throw new Error(result?.message || `Request failed (${response.status}).`)
  }
  return result
}

export async function downloadRequest(endpoint, token) {
  let response
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
  } catch {
    throw new Error('Unable to reach the server. Check that the backend is running.')
  }
  if (!response.ok) {
    const text = await response.text()
    let result
    try {
      result = text ? JSON.parse(text) : null
    } catch {
      result = null
    }
    throw new Error(result?.message || `Download failed (${response.status}).`)
  }
  return response.blob()
}
