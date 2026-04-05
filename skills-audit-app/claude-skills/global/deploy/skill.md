# deploy

## Description
Build a Vite project, check for errors, report bundle size, and serve a local preview.

## Trigger
TRIGGER when: user says "deploy", "build and preview", "ship it", "build it", or asks to preview the app locally

## References
- `package.json` for build and preview scripts
- `vite.config.ts` for build configuration

## Steps
1. Run `npm run build` to create a production build
2. Check the build output for errors or warnings — stop and report if the build fails
3. Report the bundle size from the `dist/` output (list files and sizes)
4. Run `npm run preview` to serve the built app locally
5. Report the local URL for the user to verify in their browser

## Notes
- This skill handles local build and preview only — it does not deploy to production or push to any hosting service
- If the build fails, diagnose the error and suggest fixes before retrying
- The preview server runs on the port configured in vite.config.ts (typically 4173)
- Always run the build before preview to ensure the latest code is served
