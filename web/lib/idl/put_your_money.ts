/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/put_your_money.json`.
 */
export type PutYourMoney = {
  "address": "9gCvDMSSSqsCARyrubQTwUcC88U52YvM7CCd1zuUGZiG",
  "metadata": {
    "name": "putYourMoney",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "PutYourMoney: peer-to-peer USDC bet escrow"
  },
  "instructions": [
    {
      "name": "ping",
      "discriminator": [
        173,
        0,
        94,
        236,
        73,
        133,
        225,
        153
      ],
      "accounts": [],
      "args": []
    }
  ]
};
