# TurnerBot

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Discord.js](https://img.shields.io/badge/discord.js-v14-blue.svg)](https://discord.js.org/)
[![License: Custom](https://img.shields.io/badge/License-Custom-yellow.svg)](./LICENSE)

A reliable Discord bot designed to manage and automate Aternos Minecraft servers using Puppeteer and Node.js.

---

## Disclaimers & Important Warnings

This software is an independent tool developed for automation purposes and is not affiliated with, endorsed by, or officially connected to Aternos, Discord, or any related third-party services.

Automated interactions with external web panels carry inherent risks. Running this script may expose your accounts or IP addresses to potential suspensions, bans, or rate limits enforced by target platforms. By using this script, you acknowledge and accept these risks. The author disclaims all liability for any consequences or penalties resulting from the execution of this software.

---

## System Requirements & Compatibility

- **Runtime**: Node.js v18+ (npm required)
- **Network**: SOCKS5 Proxy / Tor
- **Browser**: Thorium (Optional, falls back to Chromium automatically)

### Performance Notes
- Tested and optimized on Debian 13. Resource consumption remains stable at approximately 200MB RAM during standby and under 500MB during active automation cycles.
- Cross-platform compatible, though Windows users should verify path handling for specific automated routines (lines 109-122).

---

## Environment Configuration (.env)

Create a `.env` file in the root directory using the following template:

```env
# Discord bot token
dsToken=

# MongoDB Database connection string
MONGO_URL=

# Aternos account credentials (using a secondary account is recommended)
ATERNOS_USER=
ATERNOS_PASSWORD=

# Optional custom browser path (Puppeteer defaults to Chromium if left empty)
PUPPETEER_THORIUM=
```

## Commands Reference

### Aternos Management

**at.guide:** Setup and connection instructions.

**at.setup <IP> <ServerID> <Password>:** Link an Aternos server to the Discord channel.

**at.status:** Check live server status, active players, version, and software.

**at.start:** Turn on the server.

**at.restart:** Reboot the server.

**at.stop:** Turn off the server.

### General & Administration

**tb.help:** Main help panel.

**tb.help turnerbot:** TurnerBot command categories.

**tb.help aternos:** Aternos command categories.

**tb.help author:** Developer information and support channels.

**tb.fulminate:** Quick process restart (restricted to administrators).

## Donations
If you want to support this proyect to keep alive and get updates!

**Wallet of Satoshi:** anxioustrack35@walletofsatoshi.com

**EVM (ETH, BNB, POL...):** 0x253d1E8c059806A7Fc6E50C68490C6C0C94fa9AB

**Bitcoin:** bc1qqv2ty2uva0eh0xcweuln42u56k5l8tccljtnwr

**Solana:** G6CXowi6T2RWUpNa2oLDvQg5FVLDHGL6DvpXwAGuynKv

**Tron:** TX3EDzDFH6VX96TLHM6wA5y5D8zqxcodmQ

**Stellar:** GBOL6MZM7E6FXJOES7G6OUZS3K2P6Z7I3JXMCWXP4FAMYLFSW7EX77JR

## License

This project is licensed under custom non-commercial terms. Please refer to the LICENSE file for complete terms of use and copyright information.
