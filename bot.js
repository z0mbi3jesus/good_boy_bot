require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits } = require("discord.js");

const DATA_PATH = path.join(__dirname, "data.json");

const COMMAND_PREFIX = "!gb";

const TOKEN = process.env.DISCORD_TOKEN;
const SERVER_INVITE_LINK = process.env.SERVER_INVITE_LINK || null;
const DISCLAIMER_MESSAGE =
  "Daily reminder that Good Boy  Points™ are not worth anything. They can not be redeemed, transferred, traded, bartered,  swapped, cashed in, ransomed, delivered, relocated, exchanged, transacted, commuted, substituted, switched, bargained, haggled, interchanged, harnessed, utilized, exploited, fulfilled, brokered and/or leveraged for anything of value.";
const DISCLAIMER_TIMER_MS =
  parsePositiveInteger(process.env.DISCLAIMER_TIMER_MS) || 120000;
const disclaimerTimersByChannel = new Map();

function normalizeDiscordId(value) {
  if (!value) {
    return null;
  }

  const match = String(value).match(/\d{15,21}/);
  return match ? match[0] : null;
}

const AUTHORIZED_GIVER_ID = normalizeDiscordId(process.env.AUTHORIZED_GIVER_ID);

// Support a single ID or comma-separated list of IDs for deductors.
function parseAuthorizedDeductIds(value) {
  if (!value) return new Set();
  return new Set(
    String(value)
      .split(",")
      .map((v) => normalizeDiscordId(v))
      .filter(Boolean)
  );
}

const AUTHORIZED_DEDUCT_IDS = parseAuthorizedDeductIds(process.env.AUTHORIZED_DEDUCT_ID);

if (!TOKEN) {
  throw new Error("Missing DISCORD_TOKEN in environment.");
}

if (!AUTHORIZED_GIVER_ID) {
  throw new Error(
    "Missing or invalid AUTHORIZED_GIVER_ID in environment. It must contain a Discord user ID."
  );
}

function loadData() {
  if (!fs.existsSync(DATA_PATH)) {
    return { users: {} };
  }

  const raw = fs.readFileSync(DATA_PATH, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed.users || typeof parsed.users !== "object") {
    parsed.users = {};
  }

  return parsed;
}

function saveData(data) {
  // Write atomically to avoid partial writes if the process is interrupted.
  const tempPath = `${DATA_PATH}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, DATA_PATH);
}

function parsePositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function scheduleDisclaimer(channel) {
  const channelId = channel?.id;
  if (!channelId) {
    return;
  }

  const existingTimer = disclaimerTimersByChannel.get(channelId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(async () => {
    disclaimerTimersByChannel.delete(channelId);

    try {
      await channel.send(DISCLAIMER_MESSAGE);
    } catch (error) {
      console.error(
        `[disclaimer] Failed to send inactivity disclaimer to channel ${channelId}`,
        error
      );
    }
  }, DISCLAIMER_TIMER_MS);

  disclaimerTimersByChannel.set(channelId, timer);
}

async function handleGive(message, args) {
  console.log(
    `[give] author=${message.author.id} content=${JSON.stringify(message.content)}`
  );

  if (message.author.id !== AUTHORIZED_GIVER_ID) {
    await message.reply(
      `Only the authorized good boy giver can award points. Your user ID is ${message.author.id}.`
    );
    return;
  }

  const target = message.mentions.users.first();
  const points = parsePositiveInteger(args[3]);

  if (!target || !points) {
    await message.reply("Usage: !gb give @user <positive-integer-points>");
    return;
  }

  if (target.bot) {
    await message.reply("Bots cannot receive good boy points.");
    return;
  }

  const data = loadData();
  data.users[target.id] = (data.users[target.id] || 0) + points;
  saveData(data);

  const verifyData = loadData();
  if (!verifyData.users[target.id]) {
    await message.reply("Award failed to persist. Check bot logs for write errors.");
    return;
  }

  await message.reply(`Award recorded for ${target}. Totals stay hidden.`);
  scheduleDisclaimer(message.channel);
}

async function handleDeduct(message, args) {
  console.log(
    `[deduct] author=${message.author.id} content=${JSON.stringify(message.content)}`
  );

  if (!AUTHORIZED_DEDUCT_IDS.has(message.author.id)) {
    await message.reply(
      `Only an authorized deductor can remove points. Your user ID is ${message.author.id}.`
    );
    return;
  }

  const target = message.mentions.users.first();
  const points = parsePositiveInteger(args[3]);

  if (!target || !points) {
    await message.reply("Usage: !gb deduct @user <positive-integer-points>");
    return;
  }

  if (target.bot) {
    await message.reply("Bots cannot have points removed.");
    return;
  }

  const data = loadData();
  data.users[target.id] = Math.max(0, (data.users[target.id] || 0) - points);
  saveData(data);

  const verifyData = loadData();
  if (verifyData.users[target.id] === undefined) {
    await message.reply("Deduct failed to persist. Check bot logs for write errors.");
    return;
  }

  await message.reply(`Deduction recorded for ${target}. Totals stay hidden.`);
  scheduleDisclaimer(message.channel);
}

async function handleWhoAmI(message) {
  await message.reply(`Your Discord user ID is: ${message.author.id}`);
}

async function handleServerLink(message) {
  if (!SERVER_INVITE_LINK) {
    await message.reply("Server invite link is not configured yet.");
    return;
  }

  await message.reply(`Join our Discord server: ${SERVER_INVITE_LINK}`);
}

async function handleTop(message) {
  const data = loadData();
  const topThree = Object.entries(data.users)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3);

  if (topThree.length === 0) {
    await message.reply("No good boys on the board yet.");
    return;
  }

  const lines = await Promise.all(
    topThree.map(async ([userId], index) => {
      try {
        const user = await message.client.users.fetch(userId);
        return `${index + 1}. ${user.username}`;
      } catch {
        return `${index + 1}. Unknown User`;
      }
    })
  );

  await message.reply(`Top 3 Good Boys:\n${lines.join("\n")}`);
}

async function handleBoard(message) {
  const data = loadData();
  const boardEntries = Object.entries(data.users)
    .filter(([, points]) => Number(points) > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  if (boardEntries.length === 0) {
    await message.reply("No good boys on the board yet.");
    return;
  }

  const lines = await Promise.all(
    boardEntries.map(async ([userId], index) => {
      try {
        const user = await message.client.users.fetch(userId);
        return `${index + 1}. ${user.username}`;
      } catch {
        return `${index + 1}. Unknown User`;
      }
    })
  );

  await message.reply(`Good Boys on the Board:\n${lines.join("\n")}`);
}

async function handleScores(message) {
  if (message.author.id !== AUTHORIZED_GIVER_ID) {
    await message.reply("Only the authorized good boy giver can view point totals.");
    return;
  }

  const data = loadData();
  const scoreEntries = Object.entries(data.users)
    .filter(([, points]) => Number(points) > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  if (scoreEntries.length === 0) {
    await message.reply("No good boys on the board yet.");
    return;
  }

  const lines = await Promise.all(
    scoreEntries.map(async ([userId, points], index) => {
      try {
        const user = await message.client.users.fetch(userId);
        return `${index + 1}. ${user.username}: ${points}`;
      } catch {
        return `${index + 1}. Unknown User: ${points}`;
      }
    })
  );

  await message.reply(`Full Good Boy Scores:\n${lines.join("\n")}`);
}

async function handleHelp(message) {
  const helpText = [
    "Good Boy Bot Commands:",
    "!gb help - Show this command list",
    "!gb give @user <points> - Give points (authorized giver only)",
    "!gb deduct @user <points> - Remove points (authorized deductor only)",
    "!gb server - Show the server invite link",
    "!gb top - Show top 3 names only",
    "!gb board - Show all names on the board",
    "!gb scores - Show names with point totals (authorized giver only)",
    "!gb whoami - Show your Discord user ID",
    "!gb_disclaimer - Post the Good Boy Points disclaimer",
    "",
    "Public commands never reveal point totals."
  ].join("\n");

  await message.reply(helpText);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("clientReady", () => {
  console.log(`Good Boy Bot logged in as ${client.user.tag}`);
  console.log(`Authorized giver ID: ${AUTHORIZED_GIVER_ID}`);
  console.log(
    `Authorized deduct IDs: ${Array.from(AUTHORIZED_DEDUCT_IDS).join(",") || "(none)"}`
  );
  console.log(`Data path: ${DATA_PATH}`);
  console.log(`Disclaimer timer: ${DISCLAIMER_TIMER_MS}ms`);
  console.log(`Server invite configured: ${Boolean(SERVER_INVITE_LINK)}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) {
    return;
  }

  if (message.content.trim().toLowerCase() === "!gb_disclaimer") {
    try {
      await message.channel.send(DISCLAIMER_MESSAGE);
    } catch (error) {
      console.error(error);
      await message.reply("Couldn't post the disclaimer right now.");
    }
    return;
  }

  if (!message.content.startsWith(COMMAND_PREFIX)) {
    return;
  }

  const args = message.content.trim().split(/\s+/);
  const subcommand = (args[1] || "help").toLowerCase();

  try {
    if (subcommand === "give") {
      await handleGive(message, args);
      return;
    }

    if (subcommand === "deduct") {
      await handleDeduct(message, args);
      return;
    }

    if (subcommand === "top") {
      await handleTop(message);
      return;
    }

    if (subcommand === "board") {
      await handleBoard(message, args);
      return;
    }

    if (subcommand === "scores") {
      await handleScores(message);
      return;
    }

    if (subcommand === "whoami") {
      await handleWhoAmI(message);
      return;
    }

    if (subcommand === "server") {
      await handleServerLink(message);
      return;
    }

    await handleHelp(message);
  } catch (error) {
    console.error(error);
    await message.reply("Something broke while processing that command.");
  }
});

client.login(TOKEN);
