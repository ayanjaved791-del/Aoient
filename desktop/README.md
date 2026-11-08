# Aoient desktop app

An Electron window onto the live Aoient web app, for Windows, macOS and Linux.
Features ship with the website; this shell only adds the desktop parts:
its own window and icon, a single instance, the `aoient://` link that brings
Google sign-in back from the system browser, an offline screen, and
self-updates on Windows and Linux (AppImage).

## Releasing

`.github/workflows/desktop.yml` builds all three platforms and publishes a
GitHub Release `v<version>` whenever `desktop/` changes on `main` or the
development branch (or when run by hand from the Actions tab). Raise
`version` in `package.json` to ship a new release. The website's `/download`
page lists the files of the newest release automatically.

The installers are not signed with paid certificates: Windows shows
"Windows protected your PC" (More info → Run anyway) and macOS asks to
confirm in System Settings → Privacy & Security. Signing can be added later
with an Apple Developer ID and a Windows code-signing certificate.

## Google sign-in

Google refuses sign-in inside embedded app windows, so the app opens it in
the system browser with `app=desktop` on the return address. `/auth/callback`
then sends the code to `/auth/desktop`, which opens
`aoient://auth/callback?code=…`; the app loads `/auth/callback` in its own
window, where the PKCE verifier lives, and finishes the sign-in. The code is
useless without that verifier.

## Local development

```bash
cd desktop && npm install
AOIENT_APP_URL=http://localhost:3000 npm start
```

`npm run dist` builds installers for the current platform into `dist/`.
