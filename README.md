# Good Boy Bot

A Discord bot for awarding intentionally meaningless points, with leaderboards that show names without totals.

## Setup

Use Node.js 22 or newer and npm. From this directory:

```sh
npm ci
```

1. Create a bot in the Discord Developer Portal and enable **Message Content Intent**.
2. Invite it to your server with View Channels, Send Messages, and Read Message History permissions. Grant Send Messages in Threads if using threads.
3. Copy `.env.example` to `.env` and replace the placeholders. In PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Configure these environment variables:

   | Variable | Purpose |
   | --- | --- |
   | `DISCORD_TOKEN` | Required bot token. Keep it secret. |
   | `AUTHORIZED_GIVER_ID` | Required Discord user ID allowed to award points and request scores. |
   | `AUTHORIZED_DEDUCT_ID` | Optional comma-separated Discord user IDs allowed to deduct points. The giver is not automatically a deductor. |
   | `DISCLAIMER_TIMER_MS` | Optional inactivity delay in milliseconds; defaults to `120000`. |
   | `SERVER_INVITE_LINK` | Optional invite URL returned by `!gb server`. |

   Enable Developer Mode in Discord to copy user IDs.

5. Check syntax and start the bot:

   ```sh
   npm run check
   npm start
   ```

Keep the process running for the bot to respond.

## Commands

| Command | Behavior |
| --- | --- |
| `!gb help` | Show available commands. |
| `!gb give @user <points>` | Award a positive integer; authorized giver only. |
| `!gb deduct @user <points>` | Remove a positive integer; authorized deductors only. Totals stop at zero. |
| `!gb top` | Show the top three names without totals. |
| `!gb board` | Show all names with positive scores, without totals. |
| `!gb scores` | Show positive scores; only the authorized giver can invoke it. |
| `!gb whoami` | Show your Discord user ID. |
| `!gb server` | Show the configured server invite. |
| `!gb_disclaimer` | Post the points disclaimer. |

**Score privacy:** `!gb scores` replies in the channel where it is invoked. Anyone who can read that channel can see the totals. Use it only in a private channel. Award and deduction commands also contain the point amount in the original message, and the bot logs those commands.

Successful awards and deductions reset a per-channel inactivity timer. When it expires, the bot posts a disclaimer. Timers are held in memory and reset when the process restarts.

## Data and operation

The bot creates `data.json` automatically on the first award or deduction. It contains Discord user IDs and scores. Keep backups private. Run one bot process per data file and use persistent writable storage.

Scores are shared across all servers the bot joins. Large leaderboards may exceed Discord's message length limit.

## Preparing a public repository

Commit the source, documentation, `.env.example`, `package.json`, and `package-lock.json`. The ignore rules exclude `.env`, dependencies, logs, live scores, and temporary score files. Review staged changes before publishing; ignore rules do not remove previously committed files.

Never publish a real bot token. If one is exposed, reset it in the Discord Developer Portal and update your local configuration.

`private: true` in `package.json` prevents accidental npm publishing; it does not prevent a public GitHub repository.

No license has been selected. Public visibility alone does not grant an open-source license; choose one before inviting reuse.
