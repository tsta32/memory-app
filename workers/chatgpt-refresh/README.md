# ChatGPT catalog refresh from the PWA

This optional relay lets the app run the existing private GitHub workflow on
demand. The app flushes pending writes and compares its seven data entries
against a fresh Worker read before dispatch. The relay submits only to the
fixed private repository and workflow. It checks the exact run and its
post-publish verification step, then compares the committed receipt with the
app snapshot hash. It sends no catalog data to the browser.

Until the trusted relay origin is set in `chatgpt-refresh-config.js`, the
button is disabled. Existing app sync and the Codex workflow operate as before.

## One-time deployment

1. In [GitHub token settings](https://github.com/settings/personal-access-tokens/new)
   create a fine-grained token restricted to `tsta32/memory-app-private`.
   Give it **Actions: Read and write** and **Contents: Read-only**. Use an
   expiration and rotate it before expiration.
2. Sign in to the authorized [Cloudflare Workers account](https://dash.cloudflare.com/)
   with Wrangler. In this directory, deploy using the checked-in
   `wrangler.toml`. Its allowlist is the production app's origin. The rate
   limiting binding is required. Keep the token in the relay's
   `GITHUB_TOKEN` secret. The existing Worker secret stays in GitHub Actions.
3. Set `REFRESH_KEY_SHA256` in the relay's secrets. This is the SHA-256 hex of
   the lowercase SHA-256 hex of `memory-app:chatgpt-refresh:v1:` concatenated
   with the existing app sync code. Here is one way to set it without
   echoing the code or placing it in command-line arguments:

   ```bash
   read -rsp 'App sync code: ' memory_refresh_code
   printf '\n'
   printf %s "$memory_refresh_code" |
     node -e 'const c=require("node:crypto"),f=require("node:fs"),h=s=>c.createHash("sha256").update(s).digest("hex");process.stdout.write(h(h("memory-app:chatgpt-refresh:v1:"+f.readFileSync(0,"utf8")))+"\n")' |
     npx wrangler secret put REFRESH_KEY_SHA256
   unset memory_refresh_code
   ```

   Set `GITHUB_TOKEN` through [Cloudflare Worker secrets settings](https://dash.cloudflare.com/)
   or with `npx wrangler secret put GITHUB_TOKEN` and its hidden input.
   Never place these values in source files, the ChatGPT conversation or
   browser configuration.
4. Set the public HTTPS relay origin, without a trailing slash, in
   `chatgpt-refresh-config.js`. Review and deploy the app. On the iPhone
   press **설정 → ChatGPT용 문장 목록 갱신** and wait for success.

The browser sends a derived refresh credential, scoped by the relay to the
refresh operation. It sends the original sync code only to the existing
learning Worker. The derived credential is still sensitive. The relay keeps
no persistent storage. There is no GitHub schedule. Status polling occurs
only for a request the user starts from the button.

## Reading in ChatGPT after a refresh

Use the read-only GitHub app with access to the private repository. Ask it to
read the newest `memory-library/status.json` and `catalog.json` together from
the same verified commit, and to analyze verified user before/after edits.
The latest successful time shown by the app corresponds to the receipt's
`checkedAt`. If ChatGPT cannot retrieve that revision, it should report the
access or freshness failure before proceeding. A read-only connector may lag
a new commit. No device can establish the state of unsent edits on other devices.
