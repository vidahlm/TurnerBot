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
```

## Donations

Wallet of Satoshi: anxioustrack35@walletofsatoshi.com

EVM (ETH, BNB, POL...): 0x253d1E8c059806A7Fc6E50C68490C6C0C94fa9AB

Bitcoin: bc1qqv2ty2uva0eh0xcweuln42u56k5l8tccljtnwr

Solana: G6CXowi6T2RWUpNa2oLDvQg5FVLDHGL6DvpXwAGuynKv

Tron: TX3EDzDFH6VX96TLHM6wA5y5D8zqxcodmQ

Stellar: GBOL6MZM7E6FXJOES7G6OUZS3K2P6Z7I3JXMCWXP4FAMYLFSW7EX77JR