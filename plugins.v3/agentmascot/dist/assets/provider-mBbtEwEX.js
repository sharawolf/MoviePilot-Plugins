function unwrapResponse(response) {
  if (response && typeof response === 'object' && ['success', 'message', 'data'].every(key => Object.hasOwn(response, key)) && Object.keys(response).length === 3) {
    if (response.success !== true) throw new Error(response.message || 'AgentMascot request failed')
    return response.data
  }
  return response
}

export { unwrapResponse as u };
