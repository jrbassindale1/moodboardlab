<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1uRA61_R6tcEbgBgx3XIO5A-ZOPNGE6Po

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Start the Azure Functions backend (locally via `npm start` in `../moodboardlab-functions` or the deployed Function App) with `GEMINI_API_KEY` set in app settings (server-side only; do not expose this in the frontend).
3. Run the app:
   `npm run dev`

## Staging Deployment

- `main` deploys to production.
- `staging` deploys to the Azure Static Web Apps staging environment.

Basic flow:

1. Create/update staging branch:
   `git checkout -b staging` (first time) or `git checkout staging`
2. Push staging changes:
   `git push origin staging`
3. Open the staging URL from the GitHub Actions deploy output (environment: `staging`).
4. Merge to `main` only after staging validation.
