# Secret Santa web app

React app built with [Vite](https://vite.dev). The server in `../server`
serves the production build from `build/`.

| Command | What it does |
|---|---|
| `npm start` | Development server with hot reload. |
| `npm run build` | Production build into `build/`. |
| `npm run preview` | Serves the production build locally. |

The API address comes from environment variables, read at build time from
the environment or `.env` files:

- `REACT_APP_SERVER_DOMAIN`: the server's domain. Production builds call
  `https://<domain>`.
- `REACT_APP_SERVER_PORT`: the port, used by development builds only, which
  call `http://<domain>:<port>`.

For example, the production build on the server:

    NODE_ENV=production REACT_APP_SERVER_DOMAIN=secret-santa.fedutia.fr npm run build

The `REACT_APP_` names are kept from Create React App so existing build
commands keep working; `vite.config.js` replaces them in the code.
