# Windows Delivery Guide

This app can now be delivered as a normal Windows desktop install package.

## Recommended user rollout

1. Build the installer on an internal machine:

```powershell
npm.cmd install
npm.cmd run build:win
```

2. Share the generated installer from `dist\`.
3. Each user installs the app on their own Windows PC.
4. If OpenAI fallback is needed, set `OPENAI_API_KEY` on that PC before launch.
5. If a user already has a supplier list from another machine, import it with the built-in supplier JSON import.

## Where local data is stored

- confirmed payment queue: the app stores it in the current user's Windows app-data folder
- supplier master list: the app stores it in the current user's Windows app-data folder
- the desktop package keeps data separate per user and per machine

## OpenAI key setup

Recommended v1 setup:
- store `OPENAI_API_KEY` as a user-level or machine-level environment variable
- do not put the key in browser code, HTML, or committed files

Optional model override:
- `OPENAI_MODEL`

## Developer commands

- run desktop app in development: `npm.cmd start`
- run browser/server mode only: `npm.cmd run start:web`
- run tests: `npm.cmd test`
- build Windows installer: `npm.cmd run build:win`
