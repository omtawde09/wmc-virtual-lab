# Bundled web app goes here

The Android app is a WebView shell that loads the **same React frontend** used by
the Windows version. The build output is served over
`https://appassets.androidplatform.net/` via `WebViewAssetLoader`.

## How to bundle the frontend

From the repo root:

```bash
cd frontend
npm install
npm run build          # outputs frontend/dist/
```

Then copy the build into this folder (replacing the placeholder `index.html`):

```bash
# from repo root, PowerShell
Remove-Item android/app/src/main/assets/index.html
Copy-Item frontend/dist/* android/app/src/main/assets/ -Recurse -Force
```

Resulting layout:

```
assets/
 ├─ index.html          # from dist
 ├─ assets/             # dist JS/CSS (hashed)
 └─ …                   # favicon, etc.
```

No Vite `base` change is needed — the asset loader serves from the domain root,
so the default `/` base resolves correctly, and client-side React Router routes
fall back to `index.html` (handled in `MainActivity.shouldInterceptRequest`).

## Dev mode (live reload against the Vite dev server)

Instead of bundling, point a **debug** build at your machine's dev server by
setting `DEV_SERVER_URL` in `app/build.gradle.kts` (debug buildType), e.g.
`"http://10.0.2.2:5173"` for the emulator or `"http://<your-LAN-IP>:5173"` for a
physical phone on the same network. Cleartext to those hosts is already allowed
in `res/xml/network_security_config.xml`.
