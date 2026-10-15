# TurnerBot

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Discord.js](https://img.shields.io/badge/discord.js-v14-blue.svg)](https://discord.js.org/)
[![License: ISC](https://img.shields.io/badge/License-ISC-yellow.svg)](https://opensource.org/licenses/ISC)

A reliable Discord bot designed to manage and automate Aternos Minecraft servers using Puppeteer and Node.js.

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