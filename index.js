//Made by Vidahlm
const config = require("./config.json");
const tokenUtils = require("./tokenUtils.js");

let msgERR = `msg.reply() ERR:`;

require(`dotenv`).config();

const puppeteer = require(`puppeteer-extra`);
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const path = require("path");
const extensionPath = path.join(__dirname, "addslice_extension");

const { performance } = require(`node:perf_hooks`);
const elapsed = (start) => `${(performance.now() - start).toFixed(0)}ms`;

const axios = require(`axios`);

const dns = require("node:dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const mongoose = require(`mongoose`);

const { Client, GatewayIntentBits, time, MessageFlags, EmbedBuilder } = require(
  `discord.js`,
);

const { status } = require("minecraft-server-util");

const tokenSchema = new mongoose.Schema({
  ownIndex: { type: Number, default: 0 },
  srvIndex: { type: Number, default: 0 },
});

const token = mongoose.model("token", tokenSchema);

const aternosSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true }, // es igual a serverData.mcConfig.id
  pswrd: { type: String, required: true }, // Temporalmente texto plano
  linkedGuilds: [{ type: String }], // Guild es el servidor (Su ID)
  ownerId: { type: String, required: true }, // Id de quien registro por primera vez la Id de Aternos
  plan: { type: String },
});

const aternos = mongoose.model("aternos", aternosSchema);

const serverPlane = new mongoose.Schema({
  guildId: { type: String },
  mcConfig: {
    ip: String,
    id: String,
    status: String,
    players: String,
    version: String,
    software: String,
  },
  cooldowns: { type: Map, of: Number, default: {} },
  lastStatusLog: { type: Number, default: 0 },
  lastStatusCommand: { type: Number, default: 0 },
  plan: { type: String },
});

const server = mongoose.model("server", serverPlane);

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("¡Connected with MongoDB Atlas!");
    client.login(process.env.dsToken);
  })
  .catch((err) => {
    console.error("ERR: MongoDB Connection:", err);
  });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});
//                   /\
// Config && plugins ||

const commandDelay = 1000;
const segundoValue = 1000;
const minutoValue = segundoValue * 60;
const horaValue = minutoValue * 60;
const diaValue = horaValue * 24;
const timeParameter = [
  { type: "second", value: segundoValue },
  { type: "seconds", value: segundoValue },
  { type: "minute", value: minutoValue },
  { type: "minutes", value: minutoValue },
  { type: "hour", value: horaValue },
  { type: "hours", value: horaValue },
  { type: "day", value: diaValue },
  { type: "days", value: diaValue },
];

function veriSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

//          /\
// time Data && Function ||

let browser = null;
let isReconnecting = false;

async function getBrowser() {
  if (!browser || !browser.connected) {
    console.log("[Puppeteer] Starting browser...");
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_THORIUM,
      headless: false,
      userDataDir: path.join(__dirname, "browser_profile"),
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--mute-audio",
        "--no-first-run",
        "--disable-gpu", //  solo activar en linux
        "--no-zygote", // eliminar si es muy lento en linux
        "--disable-background-networking",
        "--disable-blink-features=AutomationControlled",
        "--disable-component-update",
        "--disable-sync",
      ],
    });

    browser.on("disconnected", () => {
      console.warn("[Puppeteer] Browser closed or crashed.");
      browser = null;
    });
  }
  return browser;
}

async function checkBrowser() {
  if (!browser || !browser.connected) {
    if (!isReconnecting) {
      isReconnecting = true;
      try {
        await getBrowser();
      } finally {
        isReconnecting = false;
      }
    }
  }
  return;
}

client.once("clientReady", async () => {
  console.log(`Bot started as ${client.user.tag}`);
  await getBrowser();
  setInterval(checkBrowser, 5000);
});

async function ctrlAternos(serverid, action, serverData, maintenant) {
  const t = performance.now();

  let aternosResponse = "empty";

  if (!browser) {
    console.error("Browser hasn't started");
    return false;
  }
  const currentBrowser = await getBrowser();
  const tPage = performance.now();
  const page = await currentBrowser.newPage();
  await page.evaluateOnNewDocument(() => {
    const style = document.createElement("style");
    style.innerHTML = `
    *, *::before, *::after {
      transition: none !important;
      animation: none !important;
      transition-duration: 0ms !important;
      animation-duration: 0ms !important;
      scroll-behavior: auto !important;
    }
  `;
    document.documentElement.appendChild(style);
  });
  console.log(`[${action}] newPage: ${elapsed(tPage)}`);
  const currentPages = await browser.pages();
  const blankPages = currentPages.filter((p) => p.url() === "about:blank");

  if (blankPages.length > 1) {
    for (let i = 0; i < blankPages.length; i++) {
      if (!blankPages[i].isClosed() && blankPages[i] !== page) {
        await blankPages[i].close();
      }
    }
  }

  const slicePages = currentPages.filter((p) =>
    p.url().includes(`addslice.com`),
  );

  if (slicePages.length > 0) {
    for (let i = 0; i < slicePages.length; i++) {
      if (!slicePages[i].isClosed() && slicePages[i] !== page) {
        await slicePages[i].close();
      }
    }
  }

  const maxPages = 4;

  if (currentPages.length >= maxPages) {
    const pageToClose = currentPages[1] || currentPages[0];

    if (pageToClose && !pageToClose.isClosed()) {
      await pageToClose.close();
      console.log("PAGES: Old page was closed by saturation");
    }
  }

  try {
    page.setDefaultNavigationTimeout(180000);
    page.setRequestInterception(true);

    page.on("request", (req) => {
      if (req.isInterceptResolutionHandled()) return;
      try {
        const resourceType = req.resourceType();

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

        if (blockedTypes.includes(resourceType) || adKeywords.test(req.url())) {
          req.abort();
        } else {
          req.continue();
        }
      } catch (e) {
        console.error(`resourceType ERR:`, e);
        req.continue().catch(() => {});
      }
    });

    let pageStatus;
    let pageSystemFails = 0;
    let pageSystemLimit = false;
    let loopCount = 0;
    let loopMax = 20;

    const tGoto = performance.now();
    await page.goto("https://aternos.org/servers/", {
      waitUntil: "domcontentloaded",
    });
    console.log(`[${action}] go to: ${elapsed(tGoto)}`);
    await veriSleep(500);

    //               /\
    // 1st try{} err ||

    try {
      let actionDone = false;
      let loginDone = false;
      let choosingDone = false;
      let statusTxtwFF;
      while (
        pageSystemLimit === false &&
        loopCount < loopMax &&
        actionDone === false
      ) {
        try {
          if (
            (page.url().includes("/login/") &&
              page.url().includes("aternos") &&
              !loginDone) ||
            (page.url().includes("/go/") &&
              page.url().includes("aternos") &&
              !loginDone)
          ) {
            const tLogin = performance.now();
            pageStatus = "loginAcc";
            await page.waitForSelector("input.username", {
              timeout: 5000,
            });
            await page.click("input.username", { clickCount: 3 });
            await page.type("input.username", process.env.ATERNOS_USER, {
              delay: 30,
            });
            await page.click("input.password", { clickCount: 3 });
            await page.type("input.password", process.env.ATERNOS_PASSWORD, {
              delay: 30,
            });
            await veriSleep(500);
            (await page.evaluate(() => {
              const loginbutton = document.querySelector(".login-button");
              if (loginbutton) loginbutton.click();
            }),
              (pageSystemFails = 0));
            await page
              .waitForNavigation({ waitUntil: "domcontentloaded" })
              .catch(() => {});
            console.log(`[${action}] login: ${elapsed(tLogin)}`);
            loginDone = true;
          } else if (
            page.url().includes("/servers/") &&
            page.url().includes("aternos")
          ) {
            const tChoosing = performance.now();
            if (!choosingDone) {
              pageStatus = "choosingServer";
              pageSystemFails = 0;
              const spinItem = await page.$(
                `.fa-solid.fa-circle-notch.fa-spin`,
              );
              if (!spinItem) {
                await page.waitForSelector(
                  `[data-id="${serverid.replace("#", "")}"]`,
                  { visible: true, timeout: 11000 },
                );
                await veriSleep(500);
                await page.evaluate((id) => {
                  const serveridbutton = document.querySelector(
                    `[data-id="${id.replace("#", "")}"]`,
                  );
                  if (serveridbutton) serveridbutton.click();
                }, serverid);
                pageSystemFails = 0;
                choosingDone = true;
              }
            } else if (choosingDone) {
              const panelLocation = await page
                .waitForFunction(
                  () =>
                    window.location.href.includes("/server/") &&
                    !window.location.href.includes("/servers/"),
                  { timeout: 20000 },
                )
                .catch(() => {});
              if (panelLocation)
                console.log(
                  `[${action}] choosingServer: ${elapsed(tChoosing)}`,
                );
            }
          } else if (
            page.url().includes("/server/") &&
            !page.url().includes("/servers/") &&
            page.url().includes("aternos")
          ) {
            pageStatus = "panelAct";
            const tAction = performance.now();
            let adblockWait;
            try {
              adblockWait = await page.evaluate(() => {
                const adblockButton = document.querySelector(
                  ".btn.btn-white.kSFhJOHmpiCI",
                );
                if (adblockButton) {
                  adblockButton.click();
                  return true;
                }
              });
            } catch {}
            if (adblockWait) {
              await veriSleep(4000);
            }

            try {
              await page.evaluate(() => {
                const alertBody = document.querySelector(`.alert-body`);
                const notificationButton =
                  document.querySelector(".btn.btn-succes");
                if (notificationButton && alertBody) {
                  notificationButton.click();
                }
              });
            } catch {}

            if (action === `start`) {
              const serverTurning = await page
                .$eval(".statuslabel-label", (el) => el.innerText.trim())
                .catch(() => "");
              if (serverTurning.includes(`Online`)) {
                actionDone = true;
              }
              if (serverTurning.includes(`ff`)) {
                let artErr;
                try {
                  await page.waitForSelector("#start", {
                    visible: true,
                    timeout: 10000,
                  });
                } catch (e) {
                  console.error(`waitForSelector ERR:`, e);
                  artErr = true;
                }
                if (artErr) throw new Error(``);
                await veriSleep(500);
                try {
                  await page.evaluate(() => {
                    const startbutton = document.querySelector("#start");
                    if (startbutton) startbutton.click();
                  });
                } catch (e) {
                  console.error(`startbutton ERR:`, e);
                  artErr = true;
                }
                if (artErr) throw new Error(``);

                await page.waitForFunction(
                  () => {
                    const statusCEl =
                      document.querySelector(".statuslabel-label");
                    if (!statusCEl) return false;
                    return true;
                  },
                  { timeout: 20000 },
                );
                statusTxtwFF = await page.$eval(".statuslabel-label", (el) =>
                  el.innerText.trim(),
                );
                if (serverData?.mcConfig)
                  serverData.mcConfig.status = statusTxtwFF;
                serverData.lastStatusLog = Date.now();
                console.log(`[${action}] Action: ${elapsed(tAction)}`);
                await veriSleep(1000);
              } else if (serverTurning === "") {
                loopCount = 0;
              } else if (
                !serverTurning.includes(`ff`) &&
                !serverTurning.includes(`.`)
              ) {
                console.log(
                  `ERR: serverTurning: "${serverTurning}" statuslabel-label doesn't have ff`,
                );
                try {
                  await veriSleep(5000);
                } catch (e) {}
              }
              if (
                serverData?.mcConfig?.status?.includes(`.`) ||
                serverTurning?.includes(`.`)
              ) {
                if (serverData?.mcConfig)
                  serverData.mcConfig.status = serverTurning;
                console.log(
                  `ctrlAternos has succesfully started ${serverData?.mcConfig?.ip}`,
                );
                console.log(`${statusTxtwFF}`);
                console.log(`[${action}] Action: ${elapsed(tAction)}`);
                actionDone = true;
              }
            } else if (action === `stop`) {
              const serverTurning = await page
                .$eval(".statuslabel-label", (el) => el.innerText.trim())
                .catch(() => "");
              if (serverTurning.includes(`Offline`)) {
                actionDone = true;
              }
              if (serverTurning.includes(`nl`)) {
                let artErr;
                try {
                  await page.waitForSelector("#stop", {
                    visible: true,
                    timeout: 10000,
                  });
                } catch (e) {
                  console.error(`waitForSelector ERR:`, e);
                  artErr = true;
                }
                if (artErr) throw new Error(``);
                await veriSleep(500);
                try {
                  await page.evaluate(() => {
                    const stopbutton = document.querySelector("#stop");
                    if (stopbutton) stopbutton.click();
                  });
                } catch (e) {
                  console.error(`stopbutton ERR:`, e);
                  artErr = true;
                }
                if (artErr) throw new Error(``);

                await page.waitForFunction(
                  () => {
                    const statusCEl =
                      document.querySelector(".statuslabel-label");
                    if (!statusCEl) return false;
                    return true;
                  },
                  { timeout: 20000 },
                );
                statusTxtwFF = await page.$eval(".statuslabel-label", (el) =>
                  el.innerText.trim(),
                );
                if (serverData?.mcConfig)
                  serverData.mcConfig.status = statusTxtwFF;
                serverData.lastStatusLog = Date.now();
                console.log(`[${action}] Action: ${elapsed(tAction)}`);
                await veriSleep(1000);
              } else if (serverTurning === "") {
                loopCount = 0;
              } else if (
                !serverTurning.includes(`nl`) &&
                !serverTurning.includes(`.`)
              ) {
                console.log(
                  `ERR: serverTurning: "${serverTurning}" statuslabel-label doesn't have nl`,
                );
                try {
                  await veriSleep(5000);
                } catch (e) {}
              }
              if (
                serverData?.mcConfig?.status?.includes(`.`) ||
                serverTurning?.includes(`.`)
              ) {
                if (serverData?.mcConfig)
                  serverData.mcConfig.status = serverTurning;
                console.log(
                  `ctrlAternos has succesfully closed ${serverData?.mcConfig?.ip}`,
                );
                console.log(`${statusTxtwFF}`);
                console.log(`[${action}] Action: ${elapsed(tAction)}`);
                actionDone = true;
              }
            } else if (action === `restart`) {
              const serverTurning = await page
                .$eval(".statuslabel-label", (el) => el.innerText.trim())
                .catch(() => "");
              if (serverTurning.includes(`Offline`)) {
                return "nRestart";
              }
              if (serverTurning.includes(`nl`)) {
                let artErr;
                try {
                  await page.waitForSelector("#restart", {
                    visible: true,
                    timeout: 10000,
                  });
                } catch (e) {
                  console.error(`waitForSelector ERR:`, e);
                  artErr = true;
                }
                if (artErr) throw new Error(``);
                await veriSleep(500);
                try {
                  await page.evaluate(() => {
                    const restartbutton = document.querySelector("#restart");
                    if (restartbutton) restartbutton.click();
                  });
                } catch (e) {
                  console.error(`restartbutton ERR:`, e);
                  artErr = true;
                }
                if (artErr) throw new Error(``);
                await page.waitForFunction(
                  () => {
                    const statusCEl =
                      document.querySelector(".statuslabel-label");
                    if (!statusCEl) return false;
                    return true;
                  },
                  { timeout: 20000 },
                );
                statusTxtwFF = await page.$eval(".statuslabel-label", (el) =>
                  el.innerText.trim(),
                );
                if (serverData?.mcConfig)
                  serverData.mcConfig.status = statusTxtwFF;
                serverData.lastStatusLog = Date.now();
                console.log(`[${action}] Action: ${elapsed(tAction)}`);
                await veriSleep(1000);
              } else if (serverTurning === "") {
                loopCount = 0;
              } else if (
                !serverTurning.includes(`nl`) &&
                !serverTurning.includes(`.`)
              ) {
                console.log(
                  `ERR: serverTurning: "${serverTurning}" statuslabel-label doesn't have nl`,
                );
                try {
                  await veriSleep(5000);
                } catch (e) {}
              }
              if (
                serverData?.mcConfig?.status?.includes(`.`) ||
                serverTurning?.includes(`.`)
              ) {
                if (serverData?.mcConfig)
                  serverData.mcConfig.status = serverTurning;
                console.log(
                  `ctrlAternos has succesfully restarted ${serverData?.mcConfig?.ip}`,
                );
                console.log(`${statusTxtwFF}`);
                console.log(`[${action}] Action: ${elapsed(tAction)}`);
                actionDone = true;
              }
            } else if (action === `status`) {
              let software = "Unknown";
              let version = "Unknown";
              let players = "Unknown";
              try {
                await page.waitForFunction(
                  () => {
                    const el = document.querySelector(".statuslabel-label");
                    return el && el.innerText.trim().length > 0;
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

                if (serverData?.mcConfig) {
                  serverData.mcConfig.status = data.statusTxt;
                  serverData.mcConfig.software = data.softwareText;
                  serverData.mcConfig.version = data.versionText;
                  serverData.mcConfig.players = data.playersText;
                }
                serverData.lastStatusCommand = Date.now();

                console.log(
                  `ctrlAternos has succesfully checked ${serverData?.mcConfig?.ip} status`,
                );
                console.log(`[${action}] Action: ${elapsed(tAction)}`);
                actionDone = true;
              } catch (e) {
                pageSystemFails++;
                console.error(`ctrlAternos statusAct ERR:`, e);
              }
            } else {
              console.log(`[${action}] LABEL_ERR`);
              pageSystemFails++;
            }

            //               /\
            // 3rd try{} err ||
          }
        } catch (e) {
          console.log(`ERR: ctrlAternos third try{} failed`);
          console.log(`ERR: ${pageStatus} system failed`);
          console.error(e);
          pageSystemFails++;
        }
        if (pageSystemFails === 5) {
          pageSystemLimit = true;
          pageSystemFails = 0;
          return false;
        }
        loopCount++;
        await veriSleep(800);
      }
      return actionDone;

      //               /\
      // 2nd try{} err ||
    } catch (e) {
      console.log(`ERR: ctrlAternos second try{} failed \n`, e);
    } finally {
      if (page && !page.isClosed()) {
        try {
          await page.goto("about:blank", {
            waitUntil: "domcontentloaded",
          });
          console.log(`[${action}] TOTAL: ${elapsed(t)}`);
          console.log(`\nctrlAternos Ended \n--------------------\n`);
        } catch (e) {
          console.error(`about:blank closing ERR:`, e);
        }
      }
    }
    if (loopCount >= loopMax) {
      console.log("ERR: ctrlAternos overpassed the tries loop limit");
    }
  } catch (error) {
    console.error("ERR: ctrlAternos first try{} failed\n", error);
    return false;
  }
}
//                          /\
// Browser actions function ||

const queueAct = [];
let isProcessing = false;
async function queueProcessing() {
  if (isProcessing || queueAct.length === 0) return;
  isProcessing = true;

  try {
    while (queueAct.length > 0) {
      const task = queueAct.shift();

      try {
        await task.run();
      } catch (err) {
        console.error("task.run() ERR:", err);
      } finally {
      }
    }
  } catch (e) {
    console.error("queueProcessing ERR: ", e);
  } finally {
    isProcessing = false;
  }
}
//                           /\
// Queue management function ||

async function shutdown() {
  console.log("\n[Shutdown] Turning Bot off...");

  if (browser) {
    console.log("[Shutdown] Closing Chromium stance...");
    await browser.close();
  }

  await mongoose.disconnect();
  console.log("[Shutdown] MongoDB connection closed");

  process.exit(0);
}
//                    /\
// Shut down function ||

client.on(`messageCreate`, async (msg) => {
  let timeTextParameter;
  let serverData;
  try {
    serverData = await server.findOneAndUpdate(
      { guildId: msg.guildId },
      { $setOnInsert: { guildId: msg.guildId, mcConfig: {}, cooldowns: {} } },
      { upsert: true, returnDocument: "after" },
    );
  } catch (e) {
    console.error(`DB ERR:`, e);
    return;
  }
  if (!serverData) {
    serverData = await server.create({ guildId: msg.guildId });
    console.log(serverData);
  }

  let aternosData;
  try {
    if (serverData.mcConfig?.id) {
      aternosData = await aternos.findOne({ id: serverData.mcConfig.id });
    }
  } catch (e) {
    console.error(`DB ERR al buscar Aternos:`, e);
  }

  let msecondsRes = 0;
  let maintenant = Date.now();
  let msgSplited = msg.content.split(" ");
  let dbKey = msgSplited[0].toLowerCase().replaceAll(".", "_");
  let lastCommandLogTime = serverData.cooldowns?.get(dbKey) || 0;

  function timeConversor() {
    if (msecondsRes < segundoValue * 60) {
      msecondsRes = Math.ceil(msecondsRes / segundoValue);
      msecondsRes === 1
        ? (timeTextParameter = timeParameter[0].type)
        : (timeTextParameter = timeParameter[1].type);
    } else if (
      msecondsRes >= segundoValue * 60 &&
      msecondsRes < minutoValue * 60
    ) {
      msecondsRes = Math.ceil(msecondsRes / minutoValue);
      msecondsRes === 1
        ? (timeTextParameter = timeParameter[2].type)
        : (timeTextParameter = timeParameter[3].type);
    } else if (
      msecondsRes >= minutoValue * 60 &&
      msecondsRes < horaValue * 24
    ) {
      msecondsRes = Math.ceil(msecondsRes / horaValue);
      msecondsRes === 1
        ? (timeTextParameter = timeParameter[4].type)
        : (timeTextParameter = timeParameter[5].type);
    } else if (msecondsRes >= horaValue * 24 && msecondsRes < diaValue * 7) {
      msecondsRes = Math.ceil(msecondsRes / diaValue);
      msecondsRes === 1
        ? (timeTextParameter = timeParameter[6].type)
        : (timeTextParameter = timeParameter[7].type);
    }
  }

  //                          /\
  // Data && vars  && configs ||

  //Text Receiving ||
  //               \/

  async function cooldownEmbed() {
    try {
      const cooldownEmbed = new EmbedBuilder()
        .setColor(0x605f63) // Gris cooldown
        .setTitle(`Cooldown...`)
        .setDescription(
          `You will be able to use this command again in ${msecondsRes} ${timeTextParameter}`,
        )
        .setFooter({ text: `${msg.author?.displayName}` })
        .setTimestamp();

      await msg.reply({ embeds: [cooldownEmbed] });
    } catch (e) {
      console.error(msgERR, e);
    }
  }

  async function msgReply(message) {
    try {
      const payload =
        typeof message === "string"
          ? { content: message, failIfNotExists: false }
          : { failIfNotExists: false, ...message };

      return await msg.reply(payload);
    } catch (e) {
      if (e.code === 50035 || e.code === 10008) {
        return await msg.channel.send(message).catch(() => {});
      }
      console.error(msgERR, e);
    }
  }

  if (msg.author?.bot === false && mongoose.connection.readyState === 1) {
    //

    {
      if (
        msg.content.startsWith(`at.start`) &&
        (serverData.mcConfig?.ip || serverData.mcConfig?.id) &&
        maintenant - lastCommandLogTime > commandDelay * 60
      ) {
        if (!browser) {
          await msgReply("TurnerBot hasn't started yet, try again");
          return;
        }
        serverData.cooldowns?.set(dbKey, maintenant);
        let cIStart = true;
        if (
          serverData.mcConfig?.status !== "Offline" &&
          serverData.lastStatusLog + commandDelay * 60 * 2 > Date.now()
        ) {
          msecondsRes = Date.now() - serverData.lastStatusLog;
          timeConversor();
          if (!isNaN(msecondsRes) && timeTextParameter !== undefined) {
            cIStart = false;
            await msgReply(
              `Server status was ${serverData.mcConfig?.status} ${msecondsRes} ${timeTextParameter} ago`,
            );
          }
        }

        if (cIStart) {
          await serverData.save();
          if (isProcessing === true || queueAct.length > 0) {
            const queuePosition = queueAct.length + 1;
            await msgReply(
              `TurnerBot is processing another task currently. Your position in the queue is **#${queuePosition}**.`,
            );
          } else {
            await msgReply(
              `<a:loading:1548513293830848603> **${serverData.mcConfig?.ip}** is turning On...`,
            );

            const wasQueued = isProcessing;
            queueAct.push({
              run: async () => {
                if (wasQueued) {
                  await msgReply(
                    `<a:loading:1548513293830848603
    > Starting **${serverData.mcConfig?.ip}** server...`,
                  );
                }
                try {
                  const aternosResult = await ctrlAternos(
                    serverData.mcConfig?.id,
                    "start",
                    serverData,
                    maintenant,
                  );
                  await serverData.save();
                  if (aternosResult) {
                    await msgReply(`**${serverData.mcConfig?.ip}** is Online`);
                    return;
                  } else if (!aternosResult || aternosResult === false) {
                    await msgReply(
                      "An error ocurred starting the server, no answer from the host website",
                    );
                  }
                } catch {}
              },
            });
            queueProcessing();
            return;
          }
        } else if (
          (msg.content.startsWith(`at.start`) && !serverData.mcConfig?.id) ||
          (msg.content.startsWith(`at.start`) && !serverData.mcConfig?.ip)
        ) {
          await msgReply(`You didn't provided an ip or id, use at.setup first`);
        } else if (
          msg.content.startsWith(`at.start`) &&
          maintenant - lastCommandLogTime < commandDelay * 60
        ) {
          msecondsRes = commandDelay * 60 - (maintenant - lastCommandLogTime);
          timeConversor();
          await cooldownEmbed();
        }
      }

      {
        if (
          msg.content.startsWith(`at.stop`) &&
          (serverData.mcConfig?.ip || serverData.mcConfig?.id) &&
          maintenant - lastCommandLogTime > commandDelay * 30
        ) {
          if (!browser) {
            await msgReply("TurnerBot hasn't started yet, try again");
            return;
          }
          serverData.cooldowns?.set(dbKey, maintenant);
          let cIStop = true;
          if (
            serverData.mcConfig?.status !== "Online" &&
            serverData.lastStatusLog + commandDelay * 30 > Date.now()
          ) {
            msecondsRes = Date.now() - serverData.lastStatusLog;
            timeConversor();
            if (!isNaN(msecondsRes) && timeTextParameter !== undefined) {
              cIStop = false;
              await msgReply(
                `Server status was ${serverData.mcConfig?.status} ${msecondsRes} ${timeTextParameter} ago`,
              );
            }
          }

          if (cIStop) {
            await serverData.save();
            if (isProcessing === true || queueAct.length > 0) {
              const queuePosition = queueAct.length + 1;
              await msgReply(
                `TurnerBot is processing another task currently. Your position in the queue is **#${queuePosition}**.`,
              );
            } else {
              await msgReply(
                `<a:loading:1548513293830848603
> **${serverData.mcConfig?.ip}** is turning Off...`,
              );
            }
            const wasQueued = isProcessing;
            queueAct.push({
              run: async () => {
                if (wasQueued) {
                  await msgReply(
                    `<a:loading:1548513293830848603
    > Closing **${serverData.mcConfig?.ip}** server...`,
                  );
                }
                try {
                  const aternosResult = await ctrlAternos(
                    serverData.mcConfig?.id,
                    "stop",
                    serverData,
                    maintenant,
                  );
                  await serverData.save();
                  if (aternosResult) {
                    await msgReply(`**${serverData.mcConfig?.ip}** is Offline`);
                    return;
                  } else if (!aternosResult || aternosResult === false) {
                    await msgReply(
                      "An error ocurred closing the server, no answer from the host website",
                    );
                  }
                } catch {}
              },
            });
            queueProcessing();
            return;
          }
        } else if (
          (msg.content.startsWith(`at.stop`) && !serverData.mcConfig?.id) ||
          (msg.content.startsWith(`at.stop`) && !serverData.mcConfig?.ip)
        ) {
          await msgReply(`You didn't provided an ip or id, use at.setup first`);
        } else if (
          msg.content.startsWith(`at.stop`) &&
          maintenant - lastCommandLogTime < commandDelay * 30
        ) {
          msecondsRes = commandDelay * 30 - (maintenant - lastCommandLogTime);
          timeConversor();
          await cooldownEmbed();
        }
      }

      {
        if (
          msg.content.startsWith(`at.restart`) &&
          (serverData.mcConfig?.ip || serverData.mcConfig?.id) &&
          maintenant - lastCommandLogTime > commandDelay * 60
        ) {
          if (!browser) {
            await msgReply("TurnerBot hasn't started yet, try again");
            return;
          }
          serverData.cooldowns?.set(dbKey, maintenant);
          let cIRestart = true;
          if (
            serverData.mcConfig?.status !== "Online" &&
            serverData.lastStatusLog + commandDelay * 60 * 2 > Date.now()
          ) {
            msecondsRes = Date.now() - serverData.lastStatusLog;
            timeConversor();
            if (!isNaN(msecondsRes) && timeTextParameter !== undefined) {
              cIRestart = false;
              await msgReply(
                `Server status was ${serverData.mcConfig?.status} ${msecondsRes} ${timeTextParameter} ago`,
              );
            }
          }

          if (cIRestart) {
            await serverData.save();
            if (isProcessing === true || queueAct.length > 0) {
              const queuePosition = queueAct.length + 1;
              await msgReply(
                `TurnerBot is processing another task currently. Your position in the queue is **#${queuePosition}**.`,
              );
            } else {
              await msgReply(
                `<a:loading:1548513293830848603
> **${serverData.mcConfig?.ip}** is Restarting...`,
              );
            }
            const wasQueued = isProcessing;
            queueAct.push({
              run: async () => {
                if (wasQueued) {
                  await msgReply(
                    `<a:loading:1548513293830848603
    > Restarting **${serverData.mcConfig?.ip}** server...`,
                  );
                }
                try {
                  const aternosResult = await ctrlAternos(
                    serverData.mcConfig?.id,
                    "restart",
                    serverData,
                    maintenant,
                  );
                  await serverData.save();
                  if (aternosResult === "nRestart") {
                    await msgReply(`**${serverData.mcConfig?.ip}** is Offline`);
                  } else if (aternosResult) {
                    await msgReply(`**${serverData.mcConfig?.ip}** Restarted`);
                    return;
                  } else if (!aternosResult || aternosResult === false) {
                    await msgReply(
                      "An error ocurred restarting the server, no answer from the host website",
                    );
                  }
                } catch {}
              },
            });
            queueProcessing();
            return;
          }
        } else if (
          (msg.content.startsWith(`at.restart`) && !serverData.mcConfig?.id) ||
          (msg.content.startsWith(`at.restart`) && !serverData.mcConfig?.ip)
        ) {
          await msgReply(`You didn't provided an ip or id, use at.setup first`);
        } else if (
          msg.content.startsWith(`at.restart`) &&
          maintenant - lastCommandLogTime < commandDelay * 60
        ) {
          msecondsRes = commandDelay * 60 - (maintenant - lastCommandLogTime);
          timeConversor();
          await cooldownEmbed();
        }
      }

      {
        if (
          msg.content.startsWith(`at.status`) &&
          serverData.mcConfig?.id &&
          maintenant - lastCommandLogTime > commandDelay * 5
        ) {
          serverData.cooldowns?.set(dbKey, maintenant);
          await serverData.save();

          const statusColor = (statusText) => {
            if (!statusText) return 0x605f63; // Gris
            const st = statusText.toLowerCase();
            if (st.includes("online")) return 0x24d166; // Verde
            if (st.includes("offline")) return 0xe74c3c; // Rojo
            return 0xf1c40f; // Amarillo
          };

          if (
            serverData.lastStatusCommand + commandDelay * 60 * 2 <
            Date.now()
          ) {
            if (isProcessing === true || queueAct.length > 0) {
              const queuePosition = queueAct.length + 1;
              await msgReply(
                `TurnerBot is processing another task currently. Your position in the queue is **#${queuePosition}**.`,
              );
            } else {
              await msgReply(
                `<a:loading:1548513293830848603
> Searching the status of **${serverData.mcConfig?.ip}**...`,
              );
            }

            const wasQueued = isProcessing;
            queueAct.push({
              run: async () => {
                if (wasQueued) {
                  await msgReply(
                    `<a:loading:1548513293830848603
    > Verifying **${serverData.mcConfig?.ip}** server...`,
                  );
                }
                try {
                  const aternosResult = await ctrlAternos(
                    serverData.mcConfig?.id,
                    "status",
                    serverData,
                    maintenant,
                  );
                  await serverData.save();

                  if (aternosResult === true) {
                    if (serverData.mcConfig?.status) {
                      try {
                        const statusEmbed = new EmbedBuilder()
                          .setColor(statusColor(serverData.mcConfig?.status))
                          .setTitle(`${serverData.mcConfig?.ip}`)
                          .addFields(
                            {
                              name: "Status:",
                              value: `\`${serverData.mcConfig?.status}\``,
                              inline: false,
                            },
                            {
                              name: "Players:",
                              value: `\`${serverData.mcConfig?.players}\``,
                              inline: true,
                            },
                            {
                              name: "Version:",
                              value: `\`${serverData.mcConfig?.version}\``,
                              inline: true,
                            },
                            {
                              name: "Software:",
                              value: `\`${serverData.mcConfig?.software}\``,
                              inline: true,
                            },
                          )
                          .setFooter({ text: `${msg.author?.displayName}` })
                          .setTimestamp();

                        await msgReply({ embeds: [statusEmbed] });
                      } catch (e) {
                        console.error(msgERR, e);
                      }
                    }
                  } else if (!aternosResult || aternosResult === false) {
                    await msgReply(
                      "An error ocurred searching the server's data, no answer from the host website",
                    );
                  }
                } catch {}
              },
            });
            queueProcessing();
            return;
          } else if (
            serverData.lastStatusCommand + commandDelay * 60 * 2 >
            Date.now()
          ) {
            msecondsRes = Date.now() - serverData.lastStatusCommand;
            const statusSec = Math.floor(msecondsRes / 1000);
            if (serverData.mcConfig?.status) {
              try {
                const statusOldEmbed = new EmbedBuilder()
                  .setColor(statusColor(serverData.mcConfig?.status))
                  .setTitle(`Server: ${serverData.mcConfig?.ip}`)
                  .addFields(
                    {
                      name: "Status:",
                      value: `\`${serverData.mcConfig?.status}\``,
                      inline: true,
                    },
                    {
                      name: "Players:",
                      value: `\`${serverData.mcConfig?.players}\``,
                      inline: true,
                    },
                    {
                      name: "Version:",
                      value: `\`${serverData.mcConfig?.version}\``,
                      inline: true,
                    },
                    {
                      name: "Software:",
                      value: `\`${serverData.mcConfig?.software}\``,
                      inline: true,
                    },
                    {
                      name: "",
                      value: `-# Check cooldown: *${statusSec}s/120s*`,
                    },
                  )
                  .setFooter({ text: `${msg.author?.displayName}` })
                  .setTimestamp();

                await msgReply({ embeds: [statusOldEmbed] });
              } catch (e) {
                console.error(msgERR, e);
              }
            }
          }
        } else if (
          (msg.content.startsWith(`at.status`) && !serverData.mcConfig?.id) ||
          (msg.content.startsWith(`at.status`) && !serverData.mcConfig?.ip)
        ) {
          await msgReply(`You didn't provided an ip or id, use at.setup first`);
        } else if (
          msg.content.startsWith(`at.status`) &&
          maintenant - lastCommandLogTime < commandDelay * 5
        ) {
          msecondsRes = commandDelay * 5 - (maintenant - lastCommandLogTime);
          timeConversor();
          await cooldownEmbed();
        }
      }

      {
        if (
          msg.content.startsWith(`at.setup`) &&
          maintenant - lastCommandLogTime > commandDelay
        ) {
          const ip = msgSplited[1]?.trim();
          const serverId = msgSplited[2]?.trim();
          const password = msgSplited[3]?.trim();

          if (!ip || !serverId || !password) {
            await msgReply(
              `you didn't provided a valid setup. Example: "at.setup <IP> <ServerID> <Password> \n-# *Don't share your password with nobody unless you want them to connect your Minecraft server with their Discord using a Paid Plan*`,
            );
            await msg.delete().catch(() => {});
            return;
          }

          let existingData = await aternos.findOne({ id: serverId });

          if (existingData) {
            if (existingData.pswrd !== password) {
              await msgReply(`You placed your ID or Password wrong`);
              await msg.delete().catch(() => {});
              return;
            }

            const isAlreadyLinked = existingData.linkedGuilds.includes(
              msg.guildId,
            );
            if (!isAlreadyLinked && existingData.linkedGuilds.length >= 1) {
              await msgReply(
                `You have a Free plan and this Id is already logged into another Discord server, upgrade your plan to be able to use TurnerBot in more than 1 server at once`,
              );
              await msg.delete().catch(() => {});
              return;
            }
          }

          const ownerToSet = existingData
            ? existingData.ownerId
            : msg.author?.id;
          aternosData = await aternos.findOneAndUpdate(
            { id: serverId },
            {
              $set: { pswrd: password, ownerId: ownerToSet },
              $addToSet: { linkedGuilds: msg.guildId },
            },
            { upsert: true, returnDocument: "after" },
          );

          if (serverData?.mcConfig) {
            serverData.mcConfig.ip = ip;
            serverData.mcConfig.id = serverId;
          }
          serverData.cooldowns?.set(dbKey, maintenant);

          try {
            await msgReply(
              `[IP: **${serverData?.mcConfig?.ip}**], [ID: **${serverData?.mcConfig?.id}**] stablished, you are the only person that can change the password related to your ID, and the preference for any ticket in our server, use "at.delete" to erase your credentials`,
            );
          } catch (e) {
            console.error(msgERR, e);
          }

          serverData.cooldowns?.set(dbKey, maintenant);
          await serverData.save();
          await msg.delete().catch(() => {});
          return;
        } else if (
          msg.content.startsWith(`at.setup`) &&
          maintenant - lastCommandLogTime < commandDelay
        ) {
          msecondsRes = commandDelay - (maintenant - lastCommandLogTime);
          timeConversor();
          await cooldownEmbed();
          await msg.delete().catch(() => {});
        }
      }

      {
        if (
          msg.content.startsWith(`at.delete`) &&
          maintenant - lastCommandLogTime > commandDelay
        ) {
          if (aternosData && msg.author?.id === aternosData?.ownerId) {
            await aternos.deleteOne({ id: serverData.mcConfig?.id });
            if (serverData?.mcConfig) {
              serverData.mcConfig.ip = "Empty";
              serverData.mcConfig.id = "Empty";
              serverData.mcConfig.status = "N/A";
              serverData.mcConfig.version = "Empty";
              serverData.mcConfig.players = "N/A";
              serverData.mcConfig.software = "Empty";
            }
            await serverData.save();
            await msgReply(`All your credentials have been deleted`);
          } else {
            if (msg.author?.id !== aternosData?.ownerId && aternosData) {
              await msgReply(
                `Only the user who registered the credentials can erase them`,
              );
            } else if (!aternosData) {
              await msgReply(`You don't have any credentials to erase`);
            }
          }
        } else if (
          msg.content.startsWith(`at.delete`) &&
          maintenant - lastCommandLogTime < commandDelay
        ) {
          msecondsRes = commandDelay - (maintenant - lastCommandLogTime);
          timeConversor();
          await cooldownEmbed();
        }
      }

      {
        if (
          msg.content.startsWith(`at.changepass`) &&
          maintenant - lastCommandLogTime > commandDelay
        ) {
          if (aternosData?.pswrd) {
            if (msg.author?.id !== aternosData?.ownerId) {
              await msgReply(`Only who registered the password can change it`);
            }

            if (!msgSplited[1] || !msgSplited[2]) {
              await msgReply(
                `you didn't provided a valid change. Example: "at.changepass <Old Password> <New Password> \n-# *Don't share your password unless you want them to connect your Minecraft server with their Discord by Paid Plan*`,
              );
              await msg.delete();
              return;
            }
            if (msg.author?.id === aternosData?.ownerId) {
              aternosData.pswrd = msgSplited[2].trim();
              await aternosData.save();
              await msgReply(
                `Password stablished, use "at.delete" to erase your credentials or "at.password" to see your current password`,
              );
              msg.delete();
            }
          } else if (!aternosData?.pswrd) {
            await msgReply(`This server doesn't have a password`);
            return;
          }
        } else if (
          msg.content.startsWith(`at.changepass`) &&
          maintenant - lastCommandLogTime < commandDelay
        ) {
          msecondsRes = commandDelay - (maintenant - lastCommandLogTime);
          timeConversor();
          await cooldownEmbed();
        }
      }

      {
        if (
          msg.content.startsWith(`at.password`) &&
          maintenant - lastCommandLogTime > commandDelay
        ) {
          if (!aternosData?.pswrd) {
            await msgReply(`This server doesn't have a password`);
            return;
          }

          if (msg.content.includes(`here`)) {
            await msgReply(
              `Your current password is /spoiler ||${aternosData?.pswrd}|| \n-# *${serverData.mcConfig?.ip}*`,
            );
            return;
          }

          if (msg.author?.id === aternosData?.ownerId) {
            try {
              msg.author.send(
                `Your current password is ||${aternosData?.pswrd}|| \n-# *${serverData.mcConfig?.ip}*`,
              );
            } catch {
              await msgReply(
                `I couldn't send you the password via DM, use "at.password here" if you want to see it in this channel \n-# *(anyone else will see it)*`,
              );
            }
          } else if (
            msg.content.startsWith(`at.password`) &&
            msg.author?.id !== aternosData?.ownerId
          ) {
            await msgReply(
              `Only who registered the password can see it, for now`,
            );
          }
        } else if (
          msg.content.startsWith(`at.password`) &&
          maintenant - lastCommandLogTime < commandDelay
        ) {
        }
      }

      // ADMIN COMMANDS BELOW

      {
        if (config.admin?.includes(msg.author?.id)) {
          //
          if (msg.content.includes(`at.newPlan`)) {
            if (msgSplited[1] && msgSplited[2] && msgSplited[3]) {
              if (
                !msgSplited[1].includes(`OWN`) &&
                !msgSplited[1].includes(`SRV`)
              ) {
                await msgReply(
                  `you didn't provided a valid plan. Example: "at.newPlan <OWN>/<SRV> <dsID> <Plan> \n-# *Don't share your password with nobody unless you want them to connect your Minecraft server with their Discord using a Paid Plan*`,
                );
                await msg.delete();
                return;
              }
              let planWho = msgSplited[1]?.toUpperCase();
              let userId = msgSplited[2];
              let planType = msgSplited[3];

              if (
                ![
                  "11",
                  "12",
                  "13",
                  "14",
                  "15",
                  "21",
                  "22",
                  "23",
                  "24",
                  "25",
                  "31",
                  "32",
                  "33",
                  "34",
                  "35",
                  "41",
                  "42",
                  "43",
                  "44",
                  "45",
                  "51",
                  "52",
                  "53",
                  "54",
                  "55",
                ].includes(planType) ||
                !userId
              ) {
                await msgReply(
                  `Unvalid plan type, example: <23>, where the first number is the amount of Discord Servers that can have the same minecraft ID, and where the second number means the users that can use the Token \n \n -# *Only accepts 1 to 5 in both digits`,
                );
                return;
              }

              const updateField =
                planWho === "OWN" ? { ownIndex: 1 } : { srvIndex: 1 };
              const counterDoc = await token.findOneAndUpdate(
                {}, // Filtro vacío para usar el documento único de contadores
                { $inc: updateField },
                { upsert: true, returnDocument: "after" },
              );

              const currentIndex =
                planWho === "OWN" ? counterDoc.ownIndex : counterDoc.srvIndex;
              const generatedToken = tokenUtils.generateToken(
                planWho,
                currentIndex,
                userId,
                planType,
              );

              await msgReply(
                `**New plan**\n` +
                  `• **Type:** \`${planWho}\`\n` +
                  `• **Index:** \`#${currentIndex}\`\n` +
                  `• **User:** <@${userId}>\n` +
                  `• **Token:** \`${generatedToken}\``,
              );
            } else if (!msgSplited[1] || !msgSplited[2] || !msgSplited[3]) {
              await msgReply(
                `you didn't provided a valid plan. Example: "at.newPlan <OWN>/<SRV> <dsID> <Plan> \n-# *Don't share your password with nobody unless you want them to connect your Minecraft server with their Discord using a Paid Plan*`,
              );
              await msg.delete();
              return;
            }
          }
        }
      }

      //                /\
      // Text Receiving ||
    }
  } else if (
    msg.author?.bot === false &&
    mongoose.connection.readyState === 0
  ) {
    console.log(`ERR: mongoose isn't ready`);
  }
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

//                  /\
// Shut down system ||
