// Developed by Vidahlm
const config = require("./config.json");

const errorMessagePrefix = "Message reply error:";

require("dotenv").config();

const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const path = require("node:path");

const { performance } = require("node:perf_hooks");
const calculateElapsedTime = (startTime) =>
  `${(performance.now() - startTime).toFixed(0)}ms`;

const dns = require("node:dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const mongoose = require("mongoose");

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActivityType,
} = require("discord.js");

const aternosSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  pswrd: { type: String, required: true },
  linkedGuilds: [{ type: String }],
  ownerId: { type: String, required: true },
  plan: { type: String },
});

const AternosModel = mongoose.model("aternos", aternosSchema);

const serverSchema = new mongoose.Schema({
  guildId: { type: String },
  mcConfig: {
    type: {
      ip: String,
      id: String,
      status: String,
      players: String,
      version: String,
      software: String,
    },
    default: {},
  },
  cooldowns: { type: Map, of: Number, default: {} },
  lastStatusLog: { type: Number, default: 0 },
  lastStatusCommand: { type: Number, default: 0 },
  plan: { type: String },
});

const ServerModel = mongoose.model("server", serverSchema);

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("Connected to MongoDB Atlas successfully.");
    client.login(process.env.dsToken);
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
  });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const commandDelay = 1000;
const secondValue = 1000;
const minuteValue = secondValue * 60;
const hourValue = minuteValue * 60;
const dayValue = hourValue * 24;

const timeParameters = [
  { type: "second", value: secondValue },
  { type: "seconds", value: secondValue },
  { type: "minute", value: minuteValue },
  { type: "minutes", value: minuteValue },
  { type: "hour", value: hourValue },
  { type: "hours", value: hourValue },
  { type: "day", value: dayValue },
  { type: "days", value: dayValue },
];

function delayExecution(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let browserInstance = null;
let isReconnecting = false;

async function getBrowser() {
  if (!browserInstance || !browserInstance.connected) {
    console.log("Initializing Puppeteer browser...");
    browserInstance = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      headless: false,
      userDataDir: path.join(__dirname, "browser_profile"),
      args: [
        "--proxy-server=socks5://127.0.0.1:9050",
        "--disable-extensions",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--mute-audio",
        "--no-first-run",
        "--disable-background-networking",
        "--disable-blink-features=AutomationControlled",
        "--disable-component-update",
        "--disable-sync",
      ],
    });

    browserInstance.on("disconnected", () => {
      console.warn("Browser instance disconnected or crashed.");
      browserInstance = null;
    });
  }
  return browserInstance;
}

async function checkBrowserStatus() {
  if (!browserInstance || !browserInstance.connected) {
    if (!isReconnecting) {
      isReconnecting = true;
      try {
        await getBrowser();
      } finally {
        isReconnecting = false;
      }
    }
  }
}

client.once("clientReady", async () => {
  console.log(`Bot started as ${client.user.tag}`);

  client.user.setPresence({
    activities: [
      {
        name: "tb.help",
        type: ActivityType.Playing,
      },
    ],
    status: "online",
  });

  await getBrowser();
  setInterval(checkBrowserStatus, 5000);
});

async function controlAternosServer(serverId, actionType, serverData) {
  const startTime = performance.now();

  if (!browserInstance) {
    console.error("Browser instance not active.");
    return false;
  }

  const currentBrowser = await getBrowser();
  const page = await currentBrowser.newPage();

  await page.evaluateOnNewDocument(() => {
    const styleElement = document.createElement("style");
    styleElement.innerHTML = `
      *, *::before, *::after {
        transition: none !important;
        animation: none !important;
        transition-duration: 0ms !important;
        animation-duration: 0ms !important;
        scroll-behavior: auto !important;
      }
    `;
    document.documentElement.appendChild(styleElement);
  });

  const currentPages = await browserInstance.pages();
  const blankPages = currentPages.filter((p) => p.url() === "about:blank");
  if (blankPages.length > 1) {
    for (let i = 0; i < blankPages.length; i++) {
      if (!blankPages[i].isClosed() && blankPages[i] !== page) {
        await blankPages[i].close();
      }
    }
  }

  try {
    page.setDefaultNavigationTimeout(180000);
    page.setRequestInterception(true);

    page.on("request", (request) => {
      if (request.isInterceptResolutionHandled()) return;
      try {
        const resourceType = request.resourceType();
        const blockedTypes = [
          "image",
          "font",
          "media",
          "texttrack",
          "object",
          "beacon",
          "imageset",
        ];
        const adKeywords =
          /(doubleclick|google-analytics|googletagmanager|analytics|adsystem|adsense|tracker|pixel)/i;

        if (
          blockedTypes.includes(resourceType) ||
          adKeywords.test(request.url())
        ) {
          request.abort();
        } else {
          request.continue();
        }
      } catch (error) {
        request.continue().catch(() => {});
      }
    });

    let pageStatus;
    let systemFailures = 0;
    let systemLimitReached = false;
    let loopCount = 0;
    const maxLoops = 20;

    await page.goto("https://aternos.org/servers/", {
      waitUntil: "domcontentloaded",
    });
    await delayExecution(500);

    let actionCompleted = false;
    let loginCompleted = false;
    let serverChoosingCompleted = false;
    let statusTextResult;

    while (!systemLimitReached && loopCount < maxLoops && !actionCompleted) {
      try {
        if (
          (page.url().includes("/login/") &&
            page.url().includes("aternos") &&
            !loginCompleted) ||
          (page.url().includes("/go/") &&
            page.url().includes("aternos") &&
            !loginCompleted)
        ) {
          pageStatus = "loginAccount";
          await page.waitForSelector("input.username", { timeout: 5000 });
          await page.click("input.username", { clickCount: 3 });
          await page.type("input.username", process.env.ATERNOS_USER, {
            delay: 30,
          });
          await page.click("input.password", { clickCount: 3 });
          await page.type("input.password", process.env.ATERNOS_PASSWORD, {
            delay: 30,
          });
          await delayExecution(500);

          await page.evaluate(() => {
            const loginButton = document.querySelector(".login-button");
            if (loginButton) loginButton.click();
          });

          systemFailures = 0;
          await page
            .waitForNavigation({ waitUntil: "domcontentloaded" })
            .catch(() => {});
          loginCompleted = true;
        } else if (
          page.url().includes("/servers/") &&
          page.url().includes("aternos")
        ) {
          if (!serverChoosingCompleted) {
            pageStatus = "choosingServer";
            systemFailures = 0;
            const spinner = await page.$(".fa-solid.fa-circle-notch.fa-spin");
            if (!spinner) {
              await page.waitForSelector(
                `[data-id="${serverId.replace("#", "")}"]`,
                {
                  visible: true,
                  timeout: 11000,
                },
              );
              await delayExecution(500);
              await page.evaluate((id) => {
                const serverButton = document.querySelector(
                  `[data-id="${id.replace("#", "")}"]`,
                );
                if (serverButton) serverButton.click();
              }, serverId);
              systemFailures = 0;
              serverChoosingCompleted = true;
            }
          }
        } else if (
          page.url().includes("/server/") &&
          !page.url().includes("/servers/") &&
          page.url().includes("aternos")
        ) {
          pageStatus = "panelActive";

          try {
            await page.evaluate(() => {
              const adblockButton = document.querySelector(
                ".btn.btn-white.kSFhJOHmpiCI",
              );
              if (adblockButton) adblockButton.click();
            });
          } catch {}

          try {
            await page.evaluate(() => {
              const alertBody = document.querySelector(".alert-body");
              const notificationButton =
                document.querySelector(".btn.btn-succes");
              if (notificationButton && alertBody) notificationButton.click();
            });
          } catch {}

          if (actionType === "start") {
            const serverTurning = await page
              .$eval(".statuslabel-label", (el) => el.innerText.trim())
              .catch(() => "");
            if (serverTurning.includes("Online")) {
              actionCompleted = "alreadyOnline";
            }
            if (serverTurning.includes("ff")) {
              await page.waitForSelector("#start", {
                visible: true,
                timeout: 10000,
              });
              await delayExecution(500);
              await page.evaluate(() => {
                const startButton = document.querySelector("#start");
                if (startButton) startButton.click();
              });

              await page.waitForFunction(
                () => document.querySelector(".statuslabel-label"),
                { timeout: 20000 },
              );
              statusTextResult = await page.$eval(".statuslabel-label", (el) =>
                el.innerText.trim(),
              );

              serverData.mcConfig.status = statusTextResult;
              serverData.lastStatusLog = Date.now();
              await delayExecution(1000);
              actionCompleted = true;
            }
          } else if (actionType === "stop") {
            const serverTurning = await page
              .$eval(".statuslabel-label", (el) => el.innerText.trim())
              .catch(() => "");
            if (serverTurning.includes("Offline")) {
              actionCompleted = "alreadyOffline";
            }
            if (serverTurning.includes("nl")) {
              await page.waitForSelector("#stop", {
                visible: true,
                timeout: 10000,
              });
              await delayExecution(500);
              await page.evaluate(() => {
                const stopButton = document.querySelector("#stop");
                if (stopButton) stopButton.click();
              });

              await page.waitForFunction(
                () => document.querySelector(".statuslabel-label"),
                { timeout: 20000 },
              );
              statusTextResult = await page.$eval(".statuslabel-label", (el) =>
                el.innerText.trim(),
              );

              serverData.mcConfig.status = statusTextResult;
              serverData.lastStatusLog = Date.now();
              await delayExecution(1000);
              actionCompleted = true;
            }
          } else if (actionType === "restart") {
            const serverTurning = await page
              .$eval(".statuslabel-label", (el) => el.innerText.trim())
              .catch(() => "");
            if (serverTurning.includes("Offline")) {
              return "offlineRestart";
            }
            if (serverTurning.includes("nl")) {
              await page.waitForSelector("#restart", {
                visible: true,
                timeout: 10000,
              });
              await delayExecution(500);
              await page.evaluate(() => {
                const restartButton = document.querySelector("#restart");
                if (restartButton) restartButton.click();
              });

              await page.waitForFunction(
                () => document.querySelector(".statuslabel-label"),
                { timeout: 20000 },
              );
              statusTextResult = await page.$eval(".statuslabel-label", (el) =>
                el.innerText.trim(),
              );

              serverData.mcConfig.status = statusTextResult;
              serverData.lastStatusLog = Date.now();
              await delayExecution(1000);
              actionCompleted = true;
            }
          } else if (actionType === "status") {
            try {
              await page.waitForFunction(
                () => {
                  const element = document.querySelector(".statuslabel-label");
                  return element && element.innerText.trim().length > 0;
                },
                { timeout: 20000 },
              );

              const data = await page.evaluate(() => {
                const statusEl = document.querySelector(".statuslabel-label");
                const softEl = document.querySelector("#software");
                const verEl = document.querySelector("#version");
                const playEl = document.querySelector(
                  ".live-status-box-value.js-players",
                );

                if (!statusEl) return null;

                return {
                  statusTxt: statusEl ? statusEl.innerText.trim() : "N/A",
                  softwareText: softEl ? softEl.innerText.trim() : "N/A",
                  versionText: verEl ? verEl.innerText.trim() : "N/A",
                  playersText: playEl ? playEl.innerText.trim() : "N/A",
                };
              });

              serverData.mcConfig.status = data.statusTxt;
              serverData.mcConfig.software = data.softwareText;
              serverData.mcConfig.version = data.versionText;
              serverData.mcConfig.players = data.playersText;
              serverData.lastStatusCommand = Date.now();
              actionCompleted = true;
            } catch (error) {
              systemFailures++;
            }
          }
        }
      } catch (error) {
        systemFailures++;
      }

      if (systemFailures === 5) {
        systemLimitReached = true;
        return false;
      }
      loopCount++;
      await delayExecution(800);
    }
    return actionCompleted;
  } catch (error) {
    console.error("Control execution error:", error);
    return false;
  } finally {
    if (page && !page.isClosed()) {
      await page
        .goto("about:blank", { waitUntil: "domcontentloaded" })
        .catch(() => {});
      await page.close().catch(() => {});
    }
  }
}

const actionQueue = [];
let isQueueProcessing = false;

async function processQueue() {
  if (isQueueProcessing || actionQueue.length === 0) return;
  isQueueProcessing = true;

  try {
    while (actionQueue.length > 0) {
      const task = actionQueue.shift();
      try {
        await task.run();
      } catch (error) {
        console.error("Task execution error:", error);
      }
    }
  } finally {
    isQueueProcessing = false;
  }
}

async function shutdownBot() {
  if (browserInstance) {
    await browserInstance.close();
  }
  await mongoose.disconnect();
  process.exit(0);
}

client.on("messageCreate", async (message) => {
  const helpColor = 0x59ffff;
  let timeTextParameter;
  let serverData;

  try {
    serverData = await ServerModel.findOneAndUpdate(
      { guildId: message.guildId },
      {
        $setOnInsert: { guildId: message.guildId, mcConfig: {}, cooldowns: {} },
      },
      { upsert: true, returnDocument: "after" },
    );
  } catch (error) {
    return;
  }

  let aternosData;
  try {
    if (serverData.mcConfig?.id) {
      aternosData = await AternosModel.findOne({ id: serverData.mcConfig.id });
    }
  } catch (error) {}

  let timeRemaining = 0;
  let currentTime = Date.now();
  let commandArgs = message.content.split(" ");
  let commandKey = commandArgs[0].toLowerCase().replaceAll(".", "_");
  let lastCommandTimestamp = serverData.cooldowns?.get(commandKey) || 0;
  let savedMessage;
  const isAdmin = config.admin?.includes(message.author.id);

  function convertTime() {
    if (timeRemaining < secondValue * 60) {
      timeRemaining = Math.ceil(timeRemaining / secondValue);
      timeRemaining === 1
        ? (timeTextParameter = timeParameters[0].type)
        : (timeTextParameter = timeParameters[1].type);
    } else if (
      timeRemaining >= secondValue * 60 &&
      timeRemaining < minuteValue * 60
    ) {
      timeRemaining = Math.ceil(timeRemaining / minuteValue);
      timeRemaining === 1
        ? (timeTextParameter = timeParameters[2].type)
        : (timeTextParameter = timeParameters[3].type);
    } else if (
      timeRemaining >= minuteValue * 60 &&
      timeRemaining < hourValue * 24
    ) {
      timeRemaining = Math.ceil(timeRemaining / hourValue);
      timeRemaining === 1
        ? (timeTextParameter = timeParameters[4].type)
        : (timeTextParameter = timeParameters[5].type);
    } else if (
      timeRemaining >= hourValue * 24 &&
      timeRemaining < dayValue * 7
    ) {
      timeRemaining = Math.ceil(timeRemaining / dayValue);
      timeRemaining === 1
        ? (timeTextParameter = timeParameters[6].type)
        : (timeTextParameter = timeParameters[7].type);
    }
  }

  async function sendCooldownEmbed() {
    try {
      const cooldownEmbed = new EmbedBuilder()
        .setColor(0x605f63)
        .setTitle("Cooldown")
        .setDescription(
          `You can use this command again in ${timeRemaining}${timeTextParameter}.`,
        )
        .setFooter({ text: message.author?.displayName })
        .setTimestamp();

      await message.reply({ embeds: [cooldownEmbed] });
    } catch (error) {}
  }

  async function replyMessage(contentPayload) {
    try {
      const payload =
        typeof contentPayload === "string"
          ? { content: contentPayload, failIfNotExists: false }
          : { failIfNotExists: false, ...contentPayload };
      return await message.reply(payload);
    } catch (error) {
      if (error.code === 50035 || error.code === 10008) {
        return await message.channel.send(contentPayload).catch(() => {});
      }
    }
  }

  if (message.author?.bot === false && mongoose.connection.readyState === 1) {
    if (
      message.content.toLowerCase().startsWith("at.guide") &&
      currentTime - lastCommandTimestamp > commandDelay
    ) {
      if (!browserInstance) {
        await replyMessage("TurnerBot has not started yet, please try again.");
        return;
      }
      serverData.cooldowns?.set(commandKey, currentTime);
      await serverData.save();

      const guideEmbed = new EmbedBuilder()
        .setColor(helpColor)
        .setTitle("Guide")
        .addFields({
          name: "How to connect TurnerBot with Aternos",
          value:
            "1. Go to aternos.org/servers and enter your server. Find the server code starting with '#' below the Aternos button. Click Connect and save the IP.\n2. Use `at.setup <IP> <ServerID> <Password>`.\n3. Keep your credentials secure.",
        });

      await replyMessage({ embeds: [guideEmbed] });
    }

    if (
      message.content.toLowerCase().startsWith("at.start") &&
      (serverData.mcConfig?.ip || serverData.mcConfig?.id) &&
      currentTime - lastCommandTimestamp > commandDelay * 60
    ) {
      if (!browserInstance) {
        await replyMessage("TurnerBot has not started yet, please try again.");
        return;
      }
      serverData.cooldowns?.set(commandKey, currentTime);
      let canStart = true;
      if (
        serverData.mcConfig?.status !== "Offline" &&
        serverData.lastStatusLog + commandDelay * 60 * 2 > Date.now()
      ) {
        timeRemaining = Date.now() - serverData.lastStatusLog;
        convertTime();
        if (!isNaN(timeRemaining) && timeTextParameter !== undefined) {
          canStart = false;
          await replyMessage(
            `Server status was ${serverData.mcConfig?.status} ${timeRemaining}${timeTextParameter} ago.`,
          );
        }
      }

      if (canStart) {
        await serverData.save();
        if (isQueueProcessing || actionQueue.length > 0) {
          const queuePosition = actionQueue.length + 1;
          savedMessage = await replyMessage(
            `TurnerBot processing queue is full. Position: **#${queuePosition}**.`,
          );
        } else {
          savedMessage = await replyMessage(
            `**${serverData.mcConfig?.ip}** is turning on...`,
          );
          const wasQueued = isQueueProcessing;
          actionQueue.push({
            run: async () => {
              if (wasQueued) {
                await savedMessage.edit(
                  `Starting **${serverData.mcConfig?.ip}** server...`,
                );
              }
              try {
                const result = await controlAternosServer(
                  serverData.mcConfig?.id,
                  "start",
                  serverData,
                );
                await serverData.save();
                if (result === "alreadyOnline") {
                  await savedMessage.edit(
                    `**${serverData.mcConfig?.ip}** is already online.`,
                  );
                } else if (result) {
                  await savedMessage.edit(
                    `**${serverData.mcConfig?.ip}** has been turned on.`,
                  );
                } else {
                  await savedMessage.edit(
                    "An error occurred starting the server. No response from host.",
                  );
                }
              } catch (error) {}
            },
          });
          processQueue();
          return;
        }
      }
    }

    if (
      message.content.toLowerCase().startsWith("at.stop") &&
      (serverData.mcConfig?.ip || serverData.mcConfig?.id) &&
      currentTime - lastCommandTimestamp > commandDelay * 30
    ) {
      if (!browserInstance) {
        await replyMessage("TurnerBot has not started yet, please try again.");
        return;
      }
      serverData.cooldowns?.set(commandKey, currentTime);
      let canStop = true;
      if (
        serverData.mcConfig?.status !== "Online" &&
        serverData.lastStatusLog + commandDelay * 30 > Date.now()
      ) {
        timeRemaining = Date.now() - serverData.lastStatusLog;
        convertTime();
        if (!isNaN(timeRemaining) && timeTextParameter !== undefined) {
          canStop = false;
          await replyMessage(
            `Server status was ${serverData.mcConfig?.status} ${timeRemaining}${timeTextParameter} ago.`,
          );
        }
      }

      if (canStop) {
        await serverData.save();
        if (isQueueProcessing || actionQueue.length > 0) {
          const queuePosition = actionQueue.length + 1;
          savedMessage = await replyMessage(
            `TurnerBot processing queue is full. Position: **#${queuePosition}**.`,
          );
        } else {
          savedMessage = await replyMessage(
            `**${serverData.mcConfig?.ip}** is turning off...`,
          );
        }
        const wasQueued = isQueueProcessing;
        actionQueue.push({
          run: async () => {
            if (wasQueued) {
              await savedMessage.edit(
                `Closing **${serverData.mcConfig?.ip}** server...`,
              );
            }
            try {
              const result = await controlAternosServer(
                serverData.mcConfig?.id,
                "stop",
                serverData,
              );
              await serverData.save();
              if (result === "alreadyOffline") {
                await savedMessage.edit(
                  `**${serverData.mcConfig?.ip}** is already offline.`,
                );
              } else if (result) {
                await savedMessage.edit(
                  `**${serverData.mcConfig?.ip}** has been turned off.`,
                );
              } else {
                await savedMessage.edit(
                  "An error occurred closing the server. No response from host.",
                );
              }
            } catch (error) {}
          },
        });
        processQueue();
        return;
      }
    }

    if (
      message.content.toLowerCase().startsWith("at.restart") &&
      (serverData.mcConfig?.ip || serverData.mcConfig?.id) &&
      currentTime - lastCommandTimestamp > commandDelay * 60
    ) {
      if (!browserInstance) {
        await replyMessage("TurnerBot has not started yet, please try again.");
        return;
      }
      serverData.cooldowns?.set(commandKey, currentTime);
      let canRestart = true;
      if (
        serverData.mcConfig?.status !== "Online" &&
        serverData.lastStatusLog + commandDelay * 60 * 2 > Date.now()
      ) {
        timeRemaining = Date.now() - serverData.lastStatusLog;
        convertTime();
        if (!isNaN(timeRemaining) && timeTextParameter !== undefined) {
          canRestart = false;
          await replyMessage(
            `Server status was ${serverData.mcConfig?.status} ${timeRemaining}${timeTextParameter} ago.`,
          );
        }
      }

      if (canRestart) {
        await serverData.save();
        if (isQueueProcessing || actionQueue.length > 0) {
          const queuePosition = actionQueue.length + 1;
          await replyMessage(
            `TurnerBot is busy. Position in queue: **#${queuePosition}**.`,
          );
        } else {
          savedMessage = await replyMessage(
            `Restarting **${serverData.mcConfig?.ip}** server...`,
          );
        }
        const wasQueued = isQueueProcessing;
        actionQueue.push({
          run: async () => {
            try {
              const result = await controlAternosServer(
                serverData.mcConfig?.id,
                "restart",
                serverData,
              );
              await serverData.save();
              if (result === "offlineRestart") {
                await savedMessage.edit(
                  `**${serverData.mcConfig?.ip}** is offline.`,
                );
              } else if (result) {
                await savedMessage.edit(
                  `**${serverData.mcConfig?.ip}** has been restarted.`,
                );
              } else {
                await savedMessage.edit(
                  "An error occurred restarting the server.",
                );
              }
            } catch (error) {}
          },
        });
        processQueue();
        return;
      }
    }

    if (
      message.content.toLowerCase().startsWith("at.status") &&
      serverData.mcConfig?.id &&
      currentTime - lastCommandTimestamp > commandDelay * 5
    ) {
      serverData.cooldowns?.set(commandKey, currentTime);
      await serverData.save();

      const getStatusColor = (statusText) => {
        if (!statusText) return 0x605f63;
        const st = statusText.toLowerCase();
        if (st.includes("online")) return 0x24d166;
        if (st.includes("offline")) return 0xe74c3c;
        return 0xf1c40f;
      };

      if (serverData.lastStatusCommand + commandDelay * 60 * 2 < Date.now()) {
        if (isQueueProcessing || actionQueue.length > 0) {
          const queuePosition = actionQueue.length + 1;
          savedMessage = await replyMessage(
            `TurnerBot is busy. Position in queue: **#${queuePosition}**.`,
          );
        } else {
          savedMessage = await replyMessage(
            `Checking **${serverData.mcConfig?.ip}** server status...`,
          );
        }

        const wasQueued = isQueueProcessing;
        actionQueue.push({
          run: async () => {
            try {
              const result = await controlAternosServer(
                serverData.mcConfig?.id,
                "status",
                serverData,
              );
              await serverData.save();

              if (result === true && serverData.mcConfig?.status) {
                const statusEmbed = new EmbedBuilder()
                  .setColor(getStatusColor(serverData.mcConfig?.status))
                  .setTitle(`${serverData.mcConfig?.ip}`)
                  .addFields(
                    {
                      name: "Status",
                      value: `\`${serverData.mcConfig?.status}\``,
                      inline: false,
                    },
                    {
                      name: "Players",
                      value: `\`${serverData.mcConfig?.players}\``,
                      inline: true,
                    },
                    {
                      name: "Version",
                      value: `\`${serverData.mcConfig?.version}\``,
                      inline: true,
                    },
                    {
                      name: "Software",
                      value: `\`${serverData.mcConfig?.software}\``,
                      inline: true,
                    },
                  )
                  .setFooter({ text: message.author?.displayName })
                  .setTimestamp();

                savedMessage.edit({ content: null, embeds: [statusEmbed] });
              } else {
                savedMessage.edit("An error occurred retrieving server data.");
              }
            } catch (error) {}
          },
        });
        processQueue();
        return;
      } else {
        timeRemaining = Date.now() - serverData.lastStatusCommand;
        const secondsElapsed = Math.floor(timeRemaining / 1000);
        if (serverData.mcConfig?.status) {
          const oldStatusEmbed = new EmbedBuilder()
            .setColor(getStatusColor(serverData.mcConfig?.status))
            .setTitle(`Server: ${serverData.mcConfig?.ip}`)
            .addFields(
              {
                name: "Status",
                value: `\`${serverData.mcConfig?.status}\``,
                inline: true,
              },
              {
                name: "Players",
                value: `\`${serverData.mcConfig?.players}\``,
                inline: true,
              },
              {
                name: "Version",
                value: `\`${serverData.mcConfig?.version}\``,
                inline: true,
              },
              {
                name: "Software",
                value: `\`${serverData.mcConfig?.software}\``,
                inline: true,
              },
              { name: "", value: `-# Cooldown: *${secondsElapsed}s/120s*` },
            )
            .setFooter({ text: message.author?.displayName })
            .setTimestamp();

          await replyMessage({ embeds: [oldStatusEmbed] });
        }
      }
    }

    if (
      message.content.toLowerCase().startsWith("at.setup") &&
      currentTime - lastCommandTimestamp > commandDelay
    ) {
      const ip = commandArgs[1]?.trim();
      const serverId = commandArgs[2]?.trim();
      const password = commandArgs[3]?.trim();

      if (!ip || !serverId || !password) {
        await replyMessage(
          "Invalid setup format. Example: `at.setup <IP> <ServerID> <Password>`",
        );
        await message.delete().catch(() => {});
        return;
      }

      let existingData = await AternosModel.findOne({ id: serverId });
      if (existingData) {
        if (existingData.pswrd !== password) {
          await replyMessage("Incorrect ID or password provided.");
          await message.delete().catch(() => {});
          return;
        }

        const isLinked = existingData.linkedGuilds.includes(message.guildId);
        if (!isLinked && existingData.linkedGuilds.length >= 1) {
          await replyMessage(
            "Server limit reached. This ID is already linked to another Discord server.",
          );
          await message.delete().catch(() => {});
          return;
        }
      }

      const ownerToSet = existingData
        ? existingData.ownerId
        : message.author?.id;
      aternosData = await AternosModel.findOneAndUpdate(
        { id: serverId },
        {
          $set: { pswrd: password, ownerId: ownerToSet },
          $addToSet: { linkedGuilds: message.guildId },
        },
        { upsert: true, returnDocument: "after" },
      );

      serverData.mcConfig.ip = ip;
      serverData.mcConfig.id = serverId;
      serverData.cooldowns?.set(commandKey, currentTime);
      await serverData.save();

      await replyMessage(
        `Successfully linked IP **${ip}** and ID **${serverId}**.`,
      );
      await message.delete().catch(() => {});
      return;
    }

    if (
      message.content.toLowerCase().startsWith("at.delete") &&
      currentTime - lastCommandTimestamp > commandDelay
    ) {
      if (aternosData && message.author?.id === aternosData?.ownerId) {
        await AternosModel.deleteOne({ id: serverData.mcConfig?.id });
        serverData.mcConfig = {
          ip: "Empty",
          id: "Empty",
          status: "N/A",
          version: "Empty",
          players: "N/A",
          software: "Empty",
        };
        await serverData.save();
        await replyMessage("All your credentials have been deleted.");
      } else {
        await replyMessage(
          "You do not have permission or credentials to delete.",
        );
      }
    }

    if (
      message.content.toLowerCase().startsWith("at.changepass") &&
      currentTime - lastCommandTimestamp > commandDelay
    ) {
      if (aternosData?.pswrd) {
        if (message.author?.id !== aternosData?.ownerId) {
          await replyMessage("Only the owner can change the password.");
          return;
        }
        if (!commandArgs[1] || !commandArgs[2]) {
          await replyMessage(
            "Invalid format. Example: `at.changepass <OldPassword> <NewPassword>`",
          );
          await message.delete().catch(() => {});
          return;
        }
        aternosData.pswrd = commandArgs[2].trim();
        await aternosData.save();
        await replyMessage("Password updated successfully.");
        message.delete().catch(() => {});
      } else {
        await replyMessage("This server has no password registered.");
      }
    }

    if (
      message.content.toLowerCase().startsWith("at.password") &&
      currentTime - lastCommandTimestamp > commandDelay
    ) {
      if (!aternosData?.pswrd) {
        await replyMessage("This server has no password registered.");
        return;
      }
      if (message.content.includes("here")) {
        await replyMessage(`Current password: ||${aternosData?.pswrd}||`);
        return;
      }
      if (message.author?.id === aternosData?.ownerId) {
        try {
          await message.author.send(
            `Current password for ${serverData.mcConfig?.ip}: ||${aternosData?.pswrd}||`,
          );
          await replyMessage("Password sent via Direct Message.");
        } catch {
          await replyMessage(
            "Could not send DM. Use `at.password here` to view it in chat.",
          );
        }
      } else {
        await replyMessage("Only the owner can view the password.");
      }
    }

    if (
      message.content.toLowerCase().startsWith("tb.help") &&
      currentTime - lastCommandTimestamp > commandDelay
    ) {
      if (message.content.toLowerCase().includes("author")) {
        try {
          const authorEmbed = new EmbedBuilder()
            .setColor(0x00dece)
            .setTitle("Author & Support Panel")
            .addFields(
              {
                name: "Creator",
                value: "Developed by Vidahlm.",
                inline: false,
              },
              {
                name: "Wallet of Satoshi",
                value: "`anxioustrack35@walletofsatoshi.com`",
                inline: false,
              },
              {
                name: "Crypto Support",
                value:
                  "EVM: `0x253d1E8c059806A7Fc6E50C68490C6C0C94fa9AB`\nSolana: `G6CXowi6T2RWUpNa2oLDvQg5FVLDHGL6DvpXwAGuynKv`\nBitcoin: `bc1qqv2ty2uva0eh0xcweuln42u56k5l8tccljtnwr`",
                inline: false,
              },
            )
            .setFooter({ text: "Made by Vidahlm" });

          await replyMessage({ embeds: [authorEmbed] });
          return;
        } catch (error) {}
      }

      const fieldsTb = [
        {
          name: "Commands",
          value: "`tb.help author` to check developer and support information",
        },
      ];
      if (isAdmin) {
        fieldsTb.push({
          name: "Admin Commands",
          value: "`tb.fulminate` trigger a quick process restart",
        });
      }

      if (message.content.toLowerCase().includes("turnerbot")) {
        const helpEmbedTb = new EmbedBuilder()
          .setColor(helpColor)
          .setTitle("TurnerBot Commands")
          .addFields(fieldsTb);
        await replyMessage({ embeds: [helpEmbedTb] });
        return;
      } else if (message.content.toLowerCase().includes("aternos")) {
        const helpEmbedAt = new EmbedBuilder()
          .setColor(helpColor)
          .setTitle("Aternos Commands")
          .addFields({
            name: "Commands",
            value:
              "`at.guide` setup guide\n`at.setup` link server\n`at.status` check status\n`at.start` turn on\n`at.restart` reboot\n`at.stop` turn off",
          });
        await replyMessage({ embeds: [helpEmbedAt] });
        return;
      }

      const helpEmbed = new EmbedBuilder()
        .setColor(helpColor)
        .setTitle("Help")
        .addFields(
          {
            name: "Info",
            value: "Minecraft server management bot for Aternos.",
          },
          {
            name: "Categories",
            value: "`tb.help turnerbot`\n`tb.help aternos`\n`tb.help author`",
          },
        )
        .setFooter({ text: "Made by Vidahlm" });

      await replyMessage({ embeds: [helpEmbed] });
    }

    if (isAdmin) {
      if (message.content.toLowerCase().startsWith("tb.fulminate")) {
        console.log("Crashing out process...");
        await replyMessage("Fulminating myself...");
        setTimeout(() => {
          process.exit(1);
        }, 1000);
      }
    }
  }
});

process.on("SIGINT", shutdownBot);
process.on("SIGTERM", shutdownBot);
