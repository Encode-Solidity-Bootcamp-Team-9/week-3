import { ethers, Wallet } from "ethers";
import { Ballot__factory, MyToken__factory } from "../typechain-types";
import { stdin as input, stdout as output } from 'node:process';
import * as dotenv from "dotenv";
import * as readline from 'node:readline/promises';

const rl = readline.createInterface({ input, output });

// For macOS users
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") })

async function main() {

    // Setting provider
    const provider = new ethers.providers.AlchemyProvider(
        "goerli",
        getEnvVariableValue("ALCHEMY_API_KEY")
    );

    // Create / Initiate our wallet
    const wallet = new ethers.Wallet(getEnvVariableValue("PRIVATE_KEY"));

    //connect wallet to the provider
    const signer = wallet.connect(provider);
    console.log("Wallet address: " + wallet.address);

    //retrieve signer balance
    const balance = await signer.getBalance();
    console.log("Balance: " + balance.toString());

    const answer = await rl.question('Do you want to deploy Token [1] or Ballot Contract [2] or exit [3]: ');

    switch (answer) {
        case '1':
            await deployToken(signer);
            break;
        case '2':
            const tokenAddress = await rl.question('Token address: ');
            const proposals = await rl.question('Proposals, separated with `,`: ');
            const blockNumber = await rl.question('Voting snapshot block number: ');

            const proposalsSplitted = proposals.split(',');
            if (!proposals || proposalsSplitted.length === 0) {
                throw new Error('No proposals provided');
            }

            console.log("Parsed proposals: " + JSON.stringify(proposalsSplitted));

            await deployContract(signer, tokenAddress, proposalsSplitted, blockNumber);
            break;
        default:
            console.log("Exiting.");
            process.exit(1);
    }
}

function getEnvVariableValue(varName: string): string {
    const varValue = process.env[varName];
    if (!varValue || varValue.length < 1) {
        throw new Error(`Must provide a valid value for key ${varName}. Check your.env file!`);
    };
    return varValue;
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

async function deployToken(signer: Wallet) {
    console.log("Deploying MyToken contract");
    const tokenContractFactory = new MyToken__factory(signer);
    const tokenContract = await tokenContractFactory.deploy();
    await tokenContract.deployed();
    console.log("MyToken contract address: " + tokenContract.address);
}
async function deployContract(signer: Wallet, tokenAddress: string, proposals: string[], blockNumber: string) {
    console.log("Deploying Ballot contract");
    const ballotContractFactory = new Ballot__factory(signer);
    const ballotContract = await ballotContractFactory.deploy(proposals.map(x => ethers.utils.formatBytes32String(x)), tokenAddress, blockNumber);
    await ballotContract.deployed();
    console.log("Ballot contract address: " + ballotContract.address);
}

