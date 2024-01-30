class Api {
  static headers() {
    return {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    }
  }

  static querify(params) {
    return Object
      .keys(params)
      .map(key => key + '=' + params[key])
      .join('&')
  }

  static get(route, params) {
    const query = `${route}?${Api.querify(params)}`
    console.log(query)
    return this.xhr(query, null, 'GET');
  }

  static post(route, params) {
    return this.xhr(route, params, 'POST')
  }

  static xhr(route, params, verb) {
    let host
    if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
      host = `http://${process.env.REACT_APP_SERVER_DOMAIN}:${process.env.REACT_APP_SERVER_PORT}`
    } else {
      host = `https://${process.env.REACT_APP_SERVER_DOMAIN}`
    }
    const url = `${host}${route}`
    let options = {
      method: verb,
      headers: Api.headers()
    }
    if (params) {
      options = Object.assign(options, { body: JSON.stringify(params) })
    }
    return fetch(url, options).then(resp => {
      let json = resp.json();
      if (resp.ok) {
        return json
      }
      return json.then(err => { throw err })
    }).then(json => json.results)
      .catch(console.error);
  }
}
export default Api
