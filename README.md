// Developed by Vidahlm

Copyright: We allow any modification unless it has unmoral and difamatory content, uses another name ontop of ours (TurnerBot) or doesn't has credits of mine nor my wallet; Vidahlm. We don't allow the commercial use of this repository.

Disclaimer: This script and all of our supporters aren't related to Aternos nor Discord and any service or page used by this bot. 
By running this script you are exposing yourself to get your account banned, even from IP, we disassociate ourselves from anything that could happen to your account.


Local dependencies: 
-Node Package Manager (npm)
-SOCK5 (Tor)
-Thorium //(Optional)

index.js has been tested in Debian 13. It consumes 200MB RAM in standby and less than 500MB while working.
Lines 109-122 may provoque errors on windows. It is pretty compatible.


Example for .env content:

.env("
# Discord bot token:
dsToken=

# MongoDB Database:
MONGO_URL=

# Your aternos account credentials. You may want to use a secondary account
ATERNOS_USER=
ATERNOS_PASSWORD=

# Thorium path, if you don't fill this, puppeter will use Chromium by default... Note: Garbage.
PUPPETEER_THORIUM=
")

// Markdown in development.