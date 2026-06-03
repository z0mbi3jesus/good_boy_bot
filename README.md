# Good Boy Bot (Discord)

A simple Discord bot with intentionally meaningless points.

Rules this bot enforces:
- Only one authorized Discord user can give points.
- Point totals are only visible to the authorized giver.
- Only the top 3 users are shown, by name only.

## Setup

1. Create a Discord bot in the Discord Developer Portal.
2. Enable **MESSAGE CONTENT INTENT** for the bot.
3. Invite the bot to your server with permissions to read/send messages.
4. Copy `.env.example` to `.env` and fill in values:
   - `DISCORD_TOKEN`
   - `AUTHORIZED_GIVER_ID`
5. Install and run:

```bash
npm install
npm start
```

## Commands

- `!gb help`
- `!gb give @user <points>` (only the authorized giver can run this)
- `!gb top`
- `!gb board`
- `!gb scores` (authorized giver only)
- `!gb whoami`

Public leaderboard output contains names only, never point amounts.

## GitHub Repository Checklist

Before pushing this project to GitHub:

1. Keep secrets only in `.env` (never commit real tokens).
2. Use `.env.example` as the template for required variables.
3. Rotate your bot token if it has ever been shared.
4. Keep `node_modules` and local `data.json` out of version control.

If you are starting a new GitHub repo from this folder:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```
