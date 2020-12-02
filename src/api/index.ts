export function request (server: string, uri: string, options: any = {}) {
  return window
    .fetch(`http://${server}${uri}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${window.localStorage.getItem('token')}`,
        ...(options.headers || {})
      }
    })
    .then((res) => res.json())
    .then(res => {
      if (res.code !== 200) {
        throw new Error(res.data)
      }

      return res.data
    })
}

export function get (server: string, uri: string, params?: any) {
  if (!params) {
    return request(server, uri)
  }

  const query = Object.keys(params)
    .filter((key) => params[key] !== undefined)
    .map(
      (key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
    )
    .join('&')

  return request(server, query.length > 0 ? `${uri}?${query}` : uri)
}

export function post (server: string, uri: string, data: any) {
  return request(server, uri, {
    method: 'post',
    body: JSON.stringify(data),
    headers: {
      'Content-Type': 'application/json;charset=UTF-8'
    }
  })
}

export function deletee (server: string, uri: string, data: any) {
  return request(server, uri, {
    method: 'DELETE',
    body: JSON.stringify(data),
    headers: {
      'Content-Type': 'application/json;charset=UTF-8'
    }
  })
}

export function put (server: string, uri: string, data: any) {
  return request(server, uri, {
    method: 'PUT',
    body: JSON.stringify(data),
    headers: {
      'Content-Type': 'application/json;charset=UTF-8'
    }
  })
}
