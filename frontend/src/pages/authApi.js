const API_URL = import.meta.env?.VITE_API_URL || '/api'

export async function sendAuthRequest(endpoint, payload, { allowMessageOnly = false } = {}) {
  let response
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new Error('Unable to reach the server. Please make sure the backend is running.')
  }

  const responseText = await response.text()
  let result = null
  if (responseText.trim()) {
    try {
      result = JSON.parse(responseText)
    } catch {
      if (response.ok) {
        throw new Error('The server returned an invalid response. Please try again.')
      }
    }
  }

  if (!response.ok) {
    throw new Error(
      result?.message || `The server returned an error (${response.status}). Please try again.`
    )
  }

  if (!result?.token || !result?.user) {
    if (allowMessageOnly && result?.message) {
      return result
    }
    throw new Error('The server returned an empty or incomplete response. Please try again.')
  }

  return result
}
