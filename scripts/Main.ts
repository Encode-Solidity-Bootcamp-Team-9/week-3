import * as dotenv from "dotenv";
import { BaseContract, BigNumber, ContractFactory, ethers } from "ethers";
import {
  Ballot,
  Ballot__factory,
  MyToken,
  MyToken__factory,
} from "../typechain-types";
import { stdin as input, stdout as output } from "node:process";
import * as readline from "node:readline/promises";

// For macOS users
import path from "path";
import { Provider } from "@ethersproject/providers";
import assert from "assert";
dotenv.config({ path: path.resolve(__dirname, "../.env") });
const rl = readline.createInterface({ input, output });

interface Arguments {
  contractName: string;
  contractAddress: string;
  call: any;
}

function parseArguments(): Arguments {
  const args = process.argv.slice(2);

  if (!args || args.length < 2) {
    throw new Error(
      "Invalid number of arguments. Should provide contract name, contract address, function name and optional function parameters.."
    );
  }

  const contractName = args[0];
  const contractAddress = args[1];
  const functionName = args[2];

  const params = [];
  for (let i = 3; i < args.length; i++) {
    const param = args[i];
    params.push(param);
  }

  const argsStruct: Arguments = {
    contractName: contractName,
    contractAddress: contractAddress,
    call: {
      functionName: functionName,
      params: params,
    },
  };

  return argsStruct;
}

function getProvider(): ethers.providers.AlchemyProvider {
  const provider = new ethers.providers.AlchemyProvider(
    "goerli",
    process.env.ALCHEMY_API_KEY
  );
  return provider;
}

function getSigner({
  provider,
  privateKey,
}: {
  provider: Provider;
  privateKey: string;
}): ethers.Wallet {
  const signer = new ethers.Wallet(privateKey, provider);
  return signer;
}

function loadContract(
  signer: ethers.Signer | undefined,
  args: Arguments
): BaseContract {
  let fact;
  switch (args.contractName) {
    case "Ballot":
      fact = new Ballot__factory(signer);
      break;
    case "MyToken":
      fact = new MyToken__factory(signer);
      break;
    default:
      throw new Error("Wrong contract name provided");
  }

  const contract = fact.attach(args.contractAddress);
  return contract;
}

function formatProposal({
  name,
  voteCount,
}: {
  name: string;
  voteCount: BigNumber;
}): { name: string; voteCount: string } {
  return {
    name: ethers.utils.parseBytes32String(name),
    voteCount: ethers.BigNumber.from(voteCount).toString(),
  };
}

async function confirmTx(funName: string, args: []) {
  const answer = await rl.question("Confirm the transaction? [y/N]: ");
  if (answer.toLowerCase() === "y") {
    return;
  }
  console.log("Transaction not confirmed. Exiting.");
  process.exit(1);
}

async function callContractFunction(signer: ethers.Wallet, args: Arguments) {
  let tx;

  if ("MyToken" === args.contractName) {
    const contract = loadContract(signer, args);

    const myToken = contract as MyToken;
    switch (args.call.functionName) {
      case "grantRole":
        const minterRole = await myToken.MINTER_ROLE();
        const assignToAddress = args.call.params[0];
        await confirmTx("grantRole", args.call.params);
        tx = await myToken.grantRole(minterRole, assignToAddress);
        break;

      case "mint":
        const to = args.call.params[0];
        const amount = ethers.utils.parseEther(args.call.params[1]);
        await confirmTx("mint", args.call.params);
        tx = await myToken.mint(to, amount);
        break;

      case "delegate":
        const delegatee = args.call.params[0];
        await confirmTx("delegate", args.call.params);
        tx = await myToken.delegate(delegatee);
        break;

      case "transfer":
        const transferTo = args.call.params[0];
        const transferAmout = ethers.utils.parseEther(args.call.params[1]);
        await confirmTx("transfer", args.call.params);
        tx = await myToken.transfer(transferTo, transferAmout);
        break;

      default:
        console.log("FUNCTION DOES NOT EXIST");
        return;
    }
  } else if ("Ballot" === args.contractName) {
    const contract = loadContract(signer, args);
    const ballot = contract as Ballot;
    switch (args.call.functionName) {
      case "vote":
        const proposal = args.call.params[0];
        const amount = args.call.params[1];
        await confirmTx("vote", args.call.params);
        tx = await ballot.vote(proposal, amount);
        break;

      case "votingPower":
        const address = args.call.params[0];
        tx = await ballot.votingPower(address);
        console.log("Voting Power: ", tx.toString());
        return;

      case "votingOpen":
        tx = await ballot.votingOpen();
        console.log(tx);
        return;

      case "openVoting":
        const umberOfBlocksVotingCanLast = args.call.params[0];
        await confirmTx("openVoting", args.call.params);
        tx = await ballot.openVoting(umberOfBlocksVotingCanLast);
        break;

      case "reset":
        const newBlockNumber = args.call.params[0];
        await confirmTx("reset", args.call.params);
        tx = await ballot.reset(newBlockNumber);
        break;

      case "targetBlockNumber":
        tx = await ballot.targetBlockNumber();
        console.log(tx);
        return;

      case "votingEndsAtBlock":
        tx = await ballot.votingEndsAtBlock();
        console.log(tx);
        return;

      case "votingPowerSpent":
        const vpsAddress = args.call.params[0];
        tx = await ballot.votingPowerSpent(vpsAddress);
        console.log(tx);
        return;

      case "voters":
        const voters: {
          voter: string;
          votingPower: string;
          votingPowerSpent: string;
        }[] = [];
        let i = 0;
        let voter: any | undefined;
        try {
          while (true) {
            voter = await ballot.voters(i);
            i++;
            console.log(voter);
            const votingPower = ethers.utils.formatEther(
              await ballot.votingPower(voter)
            );
            const votingPowerSpent = (await ballot.votingPowerSpent(voter))
              .toNumber()
              .toString();
            voters.push({
              voter,
              votingPower,
              votingPowerSpent,
            });
          }
        } catch {}

        console.table(voters);
        return;

      case "proposals":
        const proposals: { name: string; voteCount: string }[] = [];
        let idx = 0;
        if (args.call.params.length > 0) {
          // we have a specific index as parameter so take only that proposal.
          idx = Number(args.call.params[0]);
          tx = await ballot.proposals(idx);
          proposals.push(formatProposal(tx));
        } else {
          let prop: any | undefined;
          // no index specified, so check all proposal until we fail (outofbound)
          try {
            while (true) {
              prop = await ballot.proposals(idx);
              idx++;
              proposals.push(formatProposal(prop));
            }
          } catch {}
        }
        console.table(proposals);
        return;

      case "winningProposal":
        tx = await ballot.winningProposal();
        console.log("WinningProposal:" + tx);
        return;

      case "winnerName":
        tx = await ballot.winnerName();
        const name = ethers.utils.parseBytes32String(tx);
        console.log("winnerName: " + name);
        return;

      default:
        console.log("FUNCTION DOES NOT EXIST");
        return;
    }
  } else {
    console.log("trying to parse tx");
    const representation = await txToMdTable(args.call.functionName);
    console.log(representation);
  }

  if (tx) {
    const txResponse = await tx.wait();
    console.log("Tx confirmed. Hash: " + txResponse.transactionHash);
    let representation = await txToMdTable(
      txResponse.transactionHash,
      args.call.functionName
    );
    console.log(representation);
  }
}

async function main() {
  const args = parseArguments();
  console.log("Contract name: " + args.contractName);
  console.log("Contract address: " + args.contractAddress);
  console.log("Function called : " + args.call.functionName);
  console.log("Arguments: " + JSON.stringify(args.call.params));

  const privateKey = process.env.PRIVATE_KEY;
  assert(privateKey, "Environment variable 'PRIVATE_KEY' is not set.");

  const signer = getSigner({
    provider: getProvider(),
    privateKey: privateKey!,
  });

  await callContractFunction(signer, args);

  console.log("END");
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function txToMdTable(txHash: string, title: string = "") {
  const provider = getProvider();
  const tx = await provider.getTransaction(txHash);
  const txReceipt = await provider.getTransactionReceipt(txHash);

  const blockNumber: number | undefined = tx.blockNumber;
  const from: string = tx.from;
  const to: string | undefined = tx.to;
  const fee: string = ethers.utils
    .formatEther(tx.gasPrice!.toString())
    .toString();
  const gasLimit = tx.gasLimit.toNumber();
  const gasUsed = txReceipt.gasUsed.toNumber();
  const gas: string = `${gasUsed.toString()} / ${tx.gasLimit.toString()} (${Math.floor(
    (gasUsed * 100) / gasLimit
  )}%)`;
  const decodedInput: string = "-";
  const decodedOutput: string = "-";

  return `
| Transaction type | ${title}                                                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transaction Hash | [${txHash}](https://goerli.etherscan.io/tx/${txHash}) |
| Status           | **✅ Success ✅**                                                                                                                                                       |
| Block            | [${blockNumber}](https://goerli.etherscan.io/block/${blockNumber})                                                                                                                    |
| From             | [${from}](https://goerli.etherscan.io/address/${from})                                            |
| To               | [${to}](https://goerli.etherscan.io/address/${to})                                            |
| Transaction Fee  | ${fee} ETH                                                                                                                                                         |
| Gas              | ${gas}                                                                                                                                                               |
| decoded input    | ${decodedInput}                                                          |
| decoded output   | ${decodedOutput}                                                                                                                                                                       |
`;
}
