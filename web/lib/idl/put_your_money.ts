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
      "name": "accept",
      "discriminator": [
        65,
        150,
        70,
        216,
        133,
        6,
        107,
        4
      ],
      "accounts": [
        {
          "name": "signer",
          "signer": true
        },
        {
          "name": "bet",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "expectedVersion",
          "type": "u32"
        }
      ]
    },
    {
      "name": "cancel",
      "discriminator": [
        232,
        219,
        223,
        41,
        219,
        236,
        220,
        190
      ],
      "accounts": [
        {
          "name": "signer",
          "signer": true
        },
        {
          "name": "bet",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "bet"
              }
            ]
          }
        },
        {
          "name": "creator",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "confirmOutcome",
      "discriminator": [
        206,
        182,
        94,
        28,
        119,
        44,
        106,
        238
      ],
      "accounts": [
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "bet",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "bet"
              }
            ]
          }
        },
        {
          "name": "creator",
          "writable": true
        },
        {
          "name": "opponent"
        },
        {
          "name": "creatorToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "opponentToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "opponent"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "counterOffer",
      "discriminator": [
        212,
        52,
        120,
        221,
        104,
        231,
        68,
        97
      ],
      "accounts": [
        {
          "name": "signer",
          "signer": true
        },
        {
          "name": "bet",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "expectedVersion",
          "type": "u32"
        },
        {
          "name": "creatorStake",
          "type": "u64"
        },
        {
          "name": "opponentStake",
          "type": "u64"
        },
        {
          "name": "creatorSide",
          "type": {
            "defined": {
              "name": "side"
            }
          }
        },
        {
          "name": "termsHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "eventDeadline",
          "type": "i64"
        },
        {
          "name": "oracle",
          "type": {
            "option": {
              "defined": {
                "name": "oracleCondition"
              }
            }
          }
        }
      ]
    },
    {
      "name": "createBet",
      "discriminator": [
        197,
        42,
        153,
        2,
        59,
        63,
        143,
        246
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "bet",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "arg",
                "path": "betId"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "bet"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "betId",
          "type": "u64"
        },
        {
          "name": "opponent",
          "type": "pubkey"
        },
        {
          "name": "creatorSide",
          "type": {
            "defined": {
              "name": "side"
            }
          }
        },
        {
          "name": "creatorStake",
          "type": "u64"
        },
        {
          "name": "opponentStake",
          "type": "u64"
        },
        {
          "name": "termsHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "resolution",
          "type": {
            "defined": {
              "name": "resolutionKind"
            }
          }
        },
        {
          "name": "oracle",
          "type": {
            "option": {
              "defined": {
                "name": "oracleCondition"
              }
            }
          }
        },
        {
          "name": "acceptDeadline",
          "type": "i64"
        },
        {
          "name": "eventDeadline",
          "type": "i64"
        }
      ]
    },
    {
      "name": "fund",
      "discriminator": [
        218,
        188,
        111,
        221,
        152,
        113,
        174,
        7
      ],
      "accounts": [
        {
          "name": "funder",
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "bet",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "bet"
              }
            ]
          }
        },
        {
          "name": "funderToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "initializeConfig",
      "discriminator": [
        208,
        127,
        21,
        1,
        194,
        190,
        196,
        70
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "resolver",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "proposeOutcome",
      "docs": [
        "Mutual bets: propose a winner (or `Void` to call it off by agreement)."
      ],
      "discriminator": [
        147,
        78,
        55,
        89,
        179,
        236,
        26,
        248
      ],
      "accounts": [
        {
          "name": "signer",
          "signer": true
        },
        {
          "name": "bet",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "outcome",
          "type": {
            "defined": {
              "name": "outcome"
            }
          }
        }
      ]
    },
    {
      "name": "refundExpired",
      "discriminator": [
        118,
        153,
        164,
        244,
        40,
        128,
        242,
        250
      ],
      "accounts": [
        {
          "name": "payer",
          "docs": [
            "Anyone can crank expirations (the resolver worker does it automatically)."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "bet",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "bet"
              }
            ]
          }
        },
        {
          "name": "creator",
          "writable": true
        },
        {
          "name": "opponent"
        },
        {
          "name": "creatorToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "opponentToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "opponent"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "rejectOutcome",
      "discriminator": [
        55,
        241,
        227,
        85,
        185,
        147,
        199,
        178
      ],
      "accounts": [
        {
          "name": "signer",
          "signer": true
        },
        {
          "name": "bet",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "resolveOracle",
      "discriminator": [
        88,
        89,
        32,
        52,
        205,
        171,
        184,
        249
      ],
      "accounts": [
        {
          "name": "resolver",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "bet",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "bet"
              }
            ]
          }
        },
        {
          "name": "creator",
          "writable": true
        },
        {
          "name": "opponent"
        },
        {
          "name": "creatorToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "opponentToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "opponent"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "winner",
          "type": {
            "defined": {
              "name": "side"
            }
          }
        },
        {
          "name": "resolvedValue",
          "type": "i64"
        }
      ]
    },
    {
      "name": "takePublic",
      "docs": [
        "Public (open) oracle bets: the first taker becomes the opponent and funds their side."
      ],
      "discriminator": [
        78,
        248,
        26,
        103,
        208,
        105,
        13,
        234
      ],
      "accounts": [
        {
          "name": "taker",
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "bet",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "bet"
              }
            ]
          }
        },
        {
          "name": "takerToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "expectedVersion",
          "type": "u32"
        }
      ]
    },
    {
      "name": "updateConfig",
      "discriminator": [
        29,
        158,
        252,
        191,
        10,
        83,
        219,
        99
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        }
      ],
      "args": [
        {
          "name": "resolver",
          "type": "pubkey"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "bet",
      "discriminator": [
        147,
        23,
        35,
        59,
        15,
        75,
        155,
        32
      ]
    },
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    }
  ],
  "events": [
    {
      "name": "betAccepted",
      "discriminator": [
        166,
        249,
        182,
        77,
        85,
        31,
        225,
        100
      ]
    },
    {
      "name": "betCancelled",
      "discriminator": [
        32,
        179,
        128,
        184,
        125,
        193,
        106,
        104
      ]
    },
    {
      "name": "betCreated",
      "discriminator": [
        32,
        153,
        105,
        71,
        188,
        72,
        107,
        114
      ]
    },
    {
      "name": "betExpired",
      "discriminator": [
        43,
        67,
        162,
        239,
        216,
        73,
        136,
        104
      ]
    },
    {
      "name": "betFunded",
      "discriminator": [
        99,
        10,
        45,
        116,
        88,
        99,
        255,
        104
      ]
    },
    {
      "name": "betSettled",
      "discriminator": [
        57,
        145,
        224,
        160,
        62,
        119,
        227,
        206
      ]
    },
    {
      "name": "betTaken",
      "discriminator": [
        162,
        28,
        144,
        183,
        71,
        253,
        173,
        242
      ]
    },
    {
      "name": "betVoided",
      "discriminator": [
        216,
        148,
        125,
        143,
        72,
        172,
        152,
        77
      ]
    },
    {
      "name": "counterOffered",
      "discriminator": [
        177,
        179,
        131,
        30,
        16,
        1,
        34,
        54
      ]
    },
    {
      "name": "outcomeProposed",
      "discriminator": [
        100,
        79,
        89,
        60,
        234,
        81,
        68,
        43
      ]
    },
    {
      "name": "outcomeRejected",
      "discriminator": [
        174,
        99,
        4,
        71,
        157,
        129,
        235,
        220
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidStake",
      "msg": "Stakes must be greater than zero"
    },
    {
      "code": 6001,
      "name": "selfBet",
      "msg": "You can't bet against yourself"
    },
    {
      "code": 6002,
      "name": "invalidDeadlines",
      "msg": "Deadlines must be in the future and in order"
    },
    {
      "code": 6003,
      "name": "invalidOracle",
      "msg": "Oracle condition must be set for oracle bets and only for oracle bets"
    },
    {
      "code": 6004,
      "name": "notParticipant",
      "msg": "Only the two participants can do that"
    },
    {
      "code": 6005,
      "name": "invalidState",
      "msg": "The bet is not in the right state for that"
    },
    {
      "code": 6006,
      "name": "versionMismatch",
      "msg": "The offer changed; refresh to see the latest terms"
    },
    {
      "code": 6007,
      "name": "ownProposal",
      "msg": "You can't accept or counter your own offer"
    },
    {
      "code": 6008,
      "name": "acceptDeadlinePassed",
      "msg": "The offer has expired"
    },
    {
      "code": 6009,
      "name": "fundingDeadlinePassed",
      "msg": "The funding window has closed"
    },
    {
      "code": 6010,
      "name": "alreadyFunded",
      "msg": "You have already funded this bet"
    },
    {
      "code": 6011,
      "name": "notResolver",
      "msg": "Only the configured resolver can resolve oracle bets"
    },
    {
      "code": 6012,
      "name": "notOracleBet",
      "msg": "This bet is not resolved by an oracle"
    },
    {
      "code": 6013,
      "name": "notMutualBet",
      "msg": "This bet is resolved by mutual agreement"
    },
    {
      "code": 6014,
      "name": "eventNotOver",
      "msg": "The event deadline has not passed yet"
    },
    {
      "code": 6015,
      "name": "outcomeMismatch",
      "msg": "The reported value does not support that outcome"
    },
    {
      "code": 6016,
      "name": "ownOutcome",
      "msg": "You can't confirm your own proposed outcome"
    },
    {
      "code": 6017,
      "name": "notExpired",
      "msg": "Nothing to refund yet"
    },
    {
      "code": 6018,
      "name": "notAdmin",
      "msg": "Only the admin can do that"
    },
    {
      "code": 6019,
      "name": "wrongMint",
      "msg": "That token is not the configured USDC mint"
    },
    {
      "code": 6020,
      "name": "publicMustBeOracle",
      "msg": "Only price-oracle bets can be public"
    },
    {
      "code": 6021,
      "name": "notPublic",
      "msg": "This bet isn't open to the public (or someone already took it)"
    },
    {
      "code": 6022,
      "name": "overflow",
      "msg": "Math overflow"
    }
  ],
  "types": [
    {
      "name": "bet",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "betId",
            "type": "u64"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "opponent",
            "type": "pubkey"
          },
          {
            "name": "creatorSide",
            "type": {
              "defined": {
                "name": "side"
              }
            }
          },
          {
            "name": "creatorStake",
            "type": "u64"
          },
          {
            "name": "opponentStake",
            "type": "u64"
          },
          {
            "name": "version",
            "docs": [
              "Increments on every counteroffer. Accepting requires naming the exact version."
            ],
            "type": "u32"
          },
          {
            "name": "lastProposer",
            "docs": [
              "The party who made the current proposal (and therefore cannot accept it)."
            ],
            "type": "pubkey"
          },
          {
            "name": "termsHash",
            "docs": [
              "sha256 of the canonical JSON of the human-readable terms."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "resolution",
            "type": {
              "defined": {
                "name": "resolutionKind"
              }
            }
          },
          {
            "name": "oracle",
            "type": {
              "option": {
                "defined": {
                  "name": "oracleCondition"
                }
              }
            }
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "acceptDeadline",
            "type": "i64"
          },
          {
            "name": "fundingDeadline",
            "type": "i64"
          },
          {
            "name": "eventDeadline",
            "type": "i64"
          },
          {
            "name": "resolveDeadline",
            "type": "i64"
          },
          {
            "name": "state",
            "type": {
              "defined": {
                "name": "betState"
              }
            }
          },
          {
            "name": "creatorFunded",
            "type": "bool"
          },
          {
            "name": "opponentFunded",
            "type": "bool"
          },
          {
            "name": "proposedOutcome",
            "type": {
              "option": {
                "defined": {
                  "name": "outcome"
                }
              }
            }
          },
          {
            "name": "proposedBy",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "winner",
            "type": {
              "option": {
                "defined": {
                  "name": "side"
                }
              }
            }
          },
          {
            "name": "resolvedValue",
            "docs": [
              "Oracle price * 1e6 recorded at resolution, for display/audit."
            ],
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "settledAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "vaultBump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "betAccepted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bet",
            "type": "pubkey"
          },
          {
            "name": "by",
            "type": "pubkey"
          },
          {
            "name": "version",
            "type": "u32"
          },
          {
            "name": "fundingDeadline",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "betCancelled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bet",
            "type": "pubkey"
          },
          {
            "name": "by",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "betCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bet",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "opponent",
            "type": "pubkey"
          },
          {
            "name": "creatorStake",
            "type": "u64"
          },
          {
            "name": "opponentStake",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "betExpired",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bet",
            "type": "pubkey"
          },
          {
            "name": "refundedCreator",
            "type": "u64"
          },
          {
            "name": "refundedOpponent",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "betFunded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bet",
            "type": "pubkey"
          },
          {
            "name": "by",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "active",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "betSettled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bet",
            "type": "pubkey"
          },
          {
            "name": "winnerSide",
            "type": {
              "defined": {
                "name": "side"
              }
            }
          },
          {
            "name": "winner",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "resolvedValue",
            "type": {
              "option": "i64"
            }
          }
        ]
      }
    },
    {
      "name": "betState",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "proposed"
          },
          {
            "name": "accepted"
          },
          {
            "name": "active"
          },
          {
            "name": "awaitingConfirmation"
          },
          {
            "name": "settled"
          },
          {
            "name": "cancelled"
          },
          {
            "name": "expired"
          },
          {
            "name": "void"
          }
        ]
      }
    },
    {
      "name": "betTaken",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bet",
            "type": "pubkey"
          },
          {
            "name": "taker",
            "type": "pubkey"
          },
          {
            "name": "version",
            "type": "u32"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "fundingDeadline",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "betVoided",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bet",
            "type": "pubkey"
          },
          {
            "name": "refundedCreator",
            "type": "u64"
          },
          {
            "name": "refundedOpponent",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "conditionKind",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "touchAbove"
          },
          {
            "name": "touchBelow"
          },
          {
            "name": "aboveAt"
          },
          {
            "name": "belowAt"
          }
        ]
      }
    },
    {
      "name": "config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "resolver",
            "type": "pubkey"
          },
          {
            "name": "usdcMint",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "counterOffered",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bet",
            "type": "pubkey"
          },
          {
            "name": "by",
            "type": "pubkey"
          },
          {
            "name": "version",
            "type": "u32"
          },
          {
            "name": "creatorSide",
            "type": {
              "defined": {
                "name": "side"
              }
            }
          },
          {
            "name": "creatorStake",
            "type": "u64"
          },
          {
            "name": "opponentStake",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "feedId",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "solUsd"
          },
          {
            "name": "btcUsd"
          },
          {
            "name": "ethUsd"
          }
        ]
      }
    },
    {
      "name": "oracleCondition",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "feed",
            "type": {
              "defined": {
                "name": "feedId"
              }
            }
          },
          {
            "name": "kind",
            "type": {
              "defined": {
                "name": "conditionKind"
              }
            }
          },
          {
            "name": "threshold",
            "docs": [
              "USD price * 1e6"
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "outcome",
      "docs": [
        "A mutual-resolution proposal: one side won, or call the whole thing off."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "yes"
          },
          {
            "name": "no"
          },
          {
            "name": "void"
          }
        ]
      }
    },
    {
      "name": "outcomeProposed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bet",
            "type": "pubkey"
          },
          {
            "name": "by",
            "type": "pubkey"
          },
          {
            "name": "outcome",
            "type": {
              "defined": {
                "name": "outcome"
              }
            }
          }
        ]
      }
    },
    {
      "name": "outcomeRejected",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bet",
            "type": "pubkey"
          },
          {
            "name": "by",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "resolutionKind",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "oracle"
          },
          {
            "name": "mutual"
          }
        ]
      }
    },
    {
      "name": "side",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "yes"
          },
          {
            "name": "no"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "betSeed",
      "type": "bytes",
      "value": "[98, 101, 116]"
    },
    {
      "name": "configSeed",
      "type": "bytes",
      "value": "[99, 111, 110, 102, 105, 103]"
    },
    {
      "name": "vaultSeed",
      "type": "bytes",
      "value": "[118, 97, 117, 108, 116]"
    }
  ]
};
