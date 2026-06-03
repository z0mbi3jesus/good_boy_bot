require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits } = require("discord.js");

const DATA_PATH = path.join(__dirname, "data.json");
const COMMAND_PREFIX = "!gb";

const TOKEN = process.env.DISCORD_TOKEN;

function normalizeDiscordId(value) {
  if (!value) {
    return null;
  }

  const match = String(value).match(/\d{15,21}/);
  return match ? match[0] : null;
}

const AUTHORIZED_GIVER_ID = normalizeDiscordId(process.env.AUTHORIZED_GIVER_ID);

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
}

async function handleWhoAmI(message) {
  await message.reply(`Your Discord user ID is: ${message.author.id}`);
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
    "!gb top - Show top 3 names only",
    "!gb board - Show all names on the board",
    "!gb scores - Show names with point totals (authorized giver only)",
    "!gb whoami - Show your Discord user ID",
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
  console.log(`Data path: ${DATA_PATH}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) {
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

    await handleHelp(message);
  } catch (error) {
    console.error(error);
    await message.reply("Something broke while processing that command.");
  }
});

client.login(TOKEN);
