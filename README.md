# week-3
Week 3 Weekend Project

### Clone and build project

First we clone the project from the remote git repository.
```bash
# This clones the source code
$ git clone https://github.com/Encode-Solidity-Bootcamp-Team-9/week-3.git
$ cd week-3
```

Install the dependencies and compile the project.
```bash
$ yarn install
$ yarn hardhat compile
```

Set the contract addresses in a variable.
```bash
$ set TOKEN_CONTRACT_ADDRESS 0xf25c12A84C430eEDdEfb25779dAa42ED0328DdF5
$ set BALLOT_CONTRACT_ADDRESS 0x82Be4D82591407DB52E2B360F6502B4D96811A2e
```

Create a `.env` file and paste in your wallet private key and Alchemy api key. Both are necessary.
```
PRIVATE_KEY="***"
ALCHEMY_API_KEY="***"
```

### Deploy contracts

To deploy the contracts, `Deployment.ts` can be used. The script will prompt you for the type of contract you want to deploy and ask you for additonal parameters if needed.

```
$ yarn run ts-node --files ./scripts/Deployment.ts
Wallet address: 0x180b30Cca80073E5a2807CA3343dB96A2C0A6995
Balance: 9832704907716562628
Do you want to deploy Token [1] or Ballot Contract [2] or exit [3]: 1
Deploying MyToken contract
MyToken contract address: 0x8A43A1A0bBcC6a2247cEcc359693E137Ff602988
```

### Funcstion calls

To call a function use `Main.ts` and following arguments:
`<CONTRACT_NAME> <CONTRACT_ADDRESS> <FUNCTION_NAME> <FUNCTION_PARAMETER_1> <FUNCTION_PARAMETER_2> ...`

All the possible interactions are implemented in `./scripts/Main.ts` script. Example of function calls:

```bash
# To grant a minter role
$ arn run ts-node --files ./scripts/Main.ts  "MyToken" "$TOKEN_CONTRACT_ADDRESS" 'grantRole' '0x45fc87eaf51c84a7a747b4f9d8d09342468c37e1'
Contract name: MyToken
Contract address: 0xf25c12A84C430eEDdEfb25779dAa42ED0328DdF5
Function called : grantRole
Arguments: ["0x45fc87eaf51c84a7a747b4f9d8d09342468c37e1"]
Confirm the transaction? [y/N]: y
Tx confirmed. Hash: 0x2cd868450eded1566e341cdac092d56ec8f88f029d8d756016018d95ef60cb3f
```

```bash
# To mint 10 voting tokens
$ yarn run ts-node --files ./scripts/Main.ts  "MyToken" "$TOKEN_CONTRACT_ADDRESS" 'mint' '0x180b30Cca80073E5a2807CA3343dB96A2C0A6995' 10
Contract name: MyToken
Contract address: 0xf25c12A84C430eEDdEfb25779dAa42ED0328DdF5
Function called : mint
Arguments: ["0x180b30Cca80073E5a2807CA3343dB96A2C0A6995","10"]
Confirm the transaction? [y/N]: y
Tx confirmed. Hash: 0x77c2f214d5b112d04684e96a7d17ed1e1f0d5120b2bb34d9ca76b9612d2d7b66
```

```bash
# To delegate
$ yarn run ts-node --files ./scripts/Main.ts  "MyToken" "$TOKEN_CONTRACT_ADDRESS" 'delegate' '0xd780e093642dB07E439B073132fB4074f1C381E3'
Contract name: MyToken
Contract address: 0xf25c12A84C430eEDdEfb25779dAa42ED0328DdF5
Function called : delegate
Arguments: ["0xd780e093642dB07E439B073132fB4074f1C381E3"]
Confirm the transaction? [y/N]: y
Tx confirmed. Hash: 0x532d803a3a074ace6bb346befaa5bace9279818d9ccbc95dcd7580359d006887
```

```bash
# To open voting and set voting period to 200 blocks
$ yarn run ts-node --files ./scripts/Main.ts  "Ballot" "$BALLOT_TOKEN_ADDRESS" 'openVoting' 200
Contract name: Ballot
Contract address: 0x82Be4D82591407DB52E2B360F6502B4D96811A2e
Function called : openVoting
Arguments: ["200"]
Confirm the transaction? [y/N]: y
Tx confirmed. Hash: 0x5a3c077b12dc829307b52185dcfcbc719ef8ceaa85877ae2e7b9178692b76ce1
```

```bash
# To see proposals
$ yarn run ts-node --files ./scripts/Main.ts  "Ballot" "$BALLOT_TOKEN_ADDRESS" 'proposals'
Contract name: Ballot
Contract address: 0x82Be4D82591407DB52E2B360F6502B4D96811A2e
Function called : proposals
Arguments: []
┌─────────┬────────┬────────────┐
│ (index) │  name  │ voteCount  │
├─────────┼────────┼────────────┤
│    0    │ 'Bear' │ '10000102' │
│    1    │ 'Bull' │   '211'    │
└─────────┴────────┴────────────┘
```

```bash
# To vote for proposal 0 with 1 vote
$ yarn run ts-node --files ./scripts/Main.ts  "Ballot" "$BALLOT_TOKEN_ADDRESS" 'vote' 0 1
Contract name: Ballot
Contract address: 0x82Be4D82591407DB52E2B360F6502B4D96811A2e
Function called : vote
Arguments: ["0","1"]
Confirm the transaction? [y/N]: y
Tx confirmed. Hash: 0x137cfc2591a2df11fe8abe2f6cb8980b7bf35623d136cc6bdc808a12a6295980
```
