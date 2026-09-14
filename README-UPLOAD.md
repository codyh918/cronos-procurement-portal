# Managed Funds startup repair

The failed Railway deployment reports ERR_MODULE_NOT_FOUND for /app/server/managed-funds-api.mjs, imported by /app/server.mjs. This package supplies that API module and its shared domain module. Both files are unchanged from the original verified Managed Funds release.

1. Extract GITHUB-ROOT-UPLOAD-managed-funds-startup-fix.zip.
2. Open the existing Atlas GitHub repository root, where package.json and server.mjs are located.
3. Choose Add file > Upload files.
4. Drag both extracted folders, server and src, into the upload area together. Upload the folders themselves so their nested paths are preserved. Do not upload the ZIP, the outer package folder, or README-UPLOAD.md.
5. Before committing, confirm the upload lists exactly these application paths:
   - server/managed-funds-api.mjs
   - src/domain/managedFunds.mjs
6. Commit with: Include Managed Funds server runtime files.
7. Let Railway deploy the new commit. Check that it becomes Active and then open a Managed Funds project.

The SQL migration already succeeded; this repair does not require rerunning SQL or changing environment variables.

If the same missing-module error remains, confirm both paths exist on the GitHub branch connected to Railway and that Railway deployed the new commit. If they do, inspect the build configuration for exclusions from the runtime image. Send the latest Deploy Logs for any new startup error.
