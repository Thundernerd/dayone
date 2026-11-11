// Regenerates the README screenshots in docs/screenshots/.
//
// Usage: TWITCH_CLIENT_ID=... TWITCH_CLIENT_SECRET=... npm run screenshots

for (const name of ['TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET']) {
  if (!process.env[name]) {
    console.error(`screenshots: credentials missing: set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET (${name} is not set)`)
    process.exit(1)
  }
}
