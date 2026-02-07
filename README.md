## Usage

```bash
$ npm install # or pnpm install or yarn install
```

### Learn more on the [Solid Website](https://solidjs.com) and come chat with us on our [Discord](https://discord.com/invite/solidjs)

## Available Scripts

In the project directory, you can run:

### `npm run dev`

Runs the app in the development mode.<br>
Open [http://localhost:5173](http://localhost:5173) to view it in the browser.

### `npm run build`

Builds the app for production to the `dist` folder.<br>
It correctly bundles Solid in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.<br>
Your app is ready to be deployed!

## Deployment

Learn more about deploying your application with the [documentations](https://vite.dev/guide/static-deploy.html)

## Enable Sync

1. Deploy a CouchDB instance reachable from the browser (HTTPS recommended).
2. Configure CouchDB CORS to allow your frontend origin.
3. Create a per-user database and user credentials in CouchDB.
4. In the app, open Settings -> Sync and enter:
   - Sync endpoint (example: `https://couch.example.com/dukunuu-db`)
   - CouchDB username and password
   - Toggle "Enable sync"

Notes:

- The endpoint should point directly to the user database.
- For local dev you may need to allow `http://localhost:5173` in CORS.

## Enable AI Features

1. Create an OpenRouter API key.
2. In the app, open Settings -> AI and enter the API key.
3. Select an OpenRouter model if needed.

Notes:

- API keys are stored locally in the browser settings.
