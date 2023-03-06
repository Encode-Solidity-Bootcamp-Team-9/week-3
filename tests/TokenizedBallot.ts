import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {mine} from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import {
    Ballot,
    Ballot__factory,
    ERC20Votes,
    ERC20Votes__factory,
    MyToken,
    MyToken__factory,
} from "../typechain-types";

describe("Tokenized Ballot", async () => {
    const PROPOSALS = ["Chocolate", "Vanilla", "Mint", "Strawberry"];
    const SNAPSHOT_BLOCK_NUMBER = 5;
    const TEST_TOKEN_MINT = 20;
    const TEST_VOTE_AMOUNT = 3;

    let deployer: SignerWithAddress;
    let account1: SignerWithAddress;
    let account2: SignerWithAddress;
    let account3: SignerWithAddress;
    let tokenContract: MyToken;
    let ballotContract: Ballot;

    async function deployBallot(blockNumber: number, openVoting = true) {
        const ballotContractFactory = new Ballot__factory(deployer);
        ballotContract = await ballotContractFactory.deploy(
            PROPOSALS.map((x) => ethers.utils.formatBytes32String(x)),
            tokenContract.address,
            blockNumber
        );
        await ballotContract.deployed();
        if (openVoting) {
            await (await ballotContract.openVoting(1000)).wait();
        }
    }

    before(async () => {
        [deployer, account1, account2, account3] = await ethers.getSigners();

        const tokenContractFactory = new MyToken__factory(deployer);
        tokenContract = await tokenContractFactory.deploy();
        await tokenContract.deployed();
    });

    describe("When the Ballot contract is deployed", async () => {
        before(async () => {
            await deployBallot(SNAPSHOT_BLOCK_NUMBER, false);
        });

        it("defines the proposals as provided in parameters", async () => {
            let idx = 0,
                prop,
                proposals = [];
            try {
                while (true) {
                    prop = await ballotContract.proposals(idx);
                    idx++;
                    proposals.push(prop);
                }
            } catch { }

            expect(
                proposals.map((x) => ethers.utils.parseBytes32String(x.name))
            ).to.deep.equal(PROPOSALS);
        });

        it("defines the block number that will be used to calculate voting power", async () => {
            const blockNumber = await ballotContract.targetBlockNumber();
            expect(blockNumber).to.equal(SNAPSHOT_BLOCK_NUMBER);
        });

        it("uses a valid ERC20Votes token for voting", async () => {
            const tokenAddress = await ballotContract.tokenContract();
            const tokenContractFactory = new MyToken__factory(deployer);
            const tokenUsedInContract = tokenContractFactory.attach(tokenAddress);

            await expect(tokenUsedInContract.getVotes(account1.address)).to.not.be
                .reverted;
            await expect(tokenUsedInContract.getPastVotes(account1.address, 0)).to.not
                .be.reverted;
            await expect(tokenUsedInContract.delegate(account1.address)).to.not.be
                .reverted;
            await expect(tokenUsedInContract.balanceOf(account1.address)).to.not.be
                .reverted;
            await expect(
                tokenUsedInContract.transfer(account1.address, 1)
            ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
        });

        it("voting is not open", async () => {
            expect(await ballotContract.votingOpen()).to.eq(false);
        });
    });

    describe("When a user tries to vote before the specified block number", async () => {
        before(async () => {
            await deployBallot(100);
        });
        it("the vote is not counted", async () => {
            await expect(
                ballotContract.connect(account1).vote(0, TEST_VOTE_AMOUNT)
            ).to.be.revertedWith("ERC20Votes: block not yet mined");
        });
    });

    describe("When a user votes", async () => {
        let voteCountBeforeVote: BigNumber;
        let votingPowerBeforeVote: BigNumber;

        before(async () => {
            const blockNumber = await ethers.provider.getBlock("latest");
            await deployBallot(blockNumber.number + 4);
        });

        beforeEach(async () => {
            //mint vote token for account 1
            const mintTx = await tokenContract.mint(
                account1.address,
                TEST_TOKEN_MINT
            );
            await mintTx.wait();

            //self-delegate vote power
            const delegateTx = await tokenContract
                .connect(account1)
                .delegate(account1.address);
            await delegateTx.wait();

            //mint vote token for account 2
            //Note: tx added to have another block, otherwise votingPower() tries to read from block not yet minted.
            const mintTx2 = await tokenContract.mint(
                account2.address,
                TEST_TOKEN_MINT
            );
            await mintTx2.wait();

            //user vote for proposal index 0 "Chocolate"
            voteCountBeforeVote = (await ballotContract.proposals(0)).voteCount;
            votingPowerBeforeVote = await ballotContract.votingPower(
                account1.address
            );
            console.log(voteCountBeforeVote, votingPowerBeforeVote);
            const voteTx = await ballotContract
                .connect(account1)
                .vote(0, TEST_VOTE_AMOUNT);
            await voteTx.wait();
        });

        it("correct amount is credited to the correct proposal", async () => {
            const voteCountAfterVote = (await ballotContract.proposals(0)).voteCount;
            expect(voteCountAfterVote).to.eq(
                voteCountBeforeVote.add(TEST_VOTE_AMOUNT)
            );
        });

        it("spent voting power is updated", async () => {
            const votingPowerAfterVote = await ballotContract.votingPower(
                account1.address
            );
            expect(votingPowerAfterVote).to.eq(
                votingPowerBeforeVote.sub(TEST_VOTE_AMOUNT)
            );
        });
    });

    describe("When a user votes and he tries to vote with amount greater than his voting power", async () => {
        before(async () => {
            await deployBallot(SNAPSHOT_BLOCK_NUMBER);
        });
        //test by voting with account 3
        it("voting is not successful", async () => {
            await expect(
                ballotContract.connect(account3).vote(0, TEST_VOTE_AMOUNT)
            ).to.be.revertedWith("Insufficient voting power.");
        });
    });

    describe("When resetting the ballot", async () => {
        let blockNumber: number;
        describe("When every voter current balance is still above his spent power", async () => {
            beforeEach(async () => {
                const block = await ethers.provider.getBlock("latest");
                blockNumber = block.number + 3;
                await deployBallot(blockNumber);
                //mint vote token for account 1
                const mintTx = await tokenContract.mint(
                    account1.address,
                    TEST_TOKEN_MINT
                );
                await mintTx.wait();

                //self-delegate vote power
                const delegateTx = await tokenContract
                    .connect(account1)
                    .delegate(account1.address);
                await delegateTx.wait();

                //user vote for proposal index 0 "Chocolate"
                const voteTx = await ballotContract
                    .connect(account1)
                    .vote(0, TEST_VOTE_AMOUNT);
                await voteTx.wait();

                //reset the ballot
                const resetTx = await ballotContract.reset(blockNumber + 1);
                await resetTx.wait();
            });

            it("proposal votes are not changed", async () => {
                const prop = await ballotContract.proposals(0);
                const voteCount = prop.voteCount;
                expect(voteCount).to.eq(TEST_VOTE_AMOUNT);
            });

            it("target block number is updated to new block number", async () => {
                const targetBlock = await ballotContract.targetBlockNumber();
                expect(targetBlock.toNumber()).to.eq(blockNumber + 1);
            });

            it("all voting power spent is not changed", async () => {
                let idx = 0,
                    voter,
                    votingPowerSpent = ethers.BigNumber.from("0");
                try {
                    while (true) {
                        voter = await ballotContract.voters(idx);
                        let votingPower = await ballotContract.votingPowerSpent(voter);
                        votingPowerSpent = votingPowerSpent.add(votingPower);
                        idx++;
                    }
                } catch { }

                expect(votingPowerSpent).to.eq(ethers.BigNumber.from("3"));
            });
        });

        describe("When at least 1 voter current balance is below his spent power", async () => {
            beforeEach(async () => {
                const block = await ethers.provider.getBlock("latest");
                blockNumber = block.number + 4;
                await deployBallot(blockNumber);
                //mint vote token for account 1
                const mintTx = await tokenContract.mint(
                    account1.address,
                    TEST_TOKEN_MINT
                );
                await mintTx.wait();

                //self-delegate vote power
                const delegateTx = await tokenContract
                    .connect(account1)
                    .delegate(account1.address);
                await delegateTx.wait();

                //user vote for proposal index 0 "Chocolate"
                const voteTx = await ballotContract
                    .connect(account1)
                    .vote(0, TEST_VOTE_AMOUNT);
                await voteTx.wait();

                const account1Blance = await tokenContract.balanceOf(account1.address);
                // user reduces his voting power
                const transferTx = await tokenContract
                    .connect(account1)
                    .transfer(account2.address, account1Blance);
                await transferTx.wait();

                //reset the ballot
                const resetTx = await ballotContract.reset(blockNumber + 2);
                await resetTx.wait();
            });

            it("all the proposal votes are set to 0", async () => {
                let idx = 0,
                    prop,
                    voteCounts = [];
                try {
                    while (true) {
                        prop = await ballotContract.proposals(idx);
                        idx++;
                        voteCounts.push(prop.voteCount.toNumber());
                    }
                } catch { }

                voteCounts.forEach((voteCount) => expect(voteCount).to.eq(0));
            });

            it("target block number is updated to new block number", async () => {
                const targetBlock = await ballotContract.targetBlockNumber();
                expect(targetBlock).to.eq(blockNumber + 2);
            });

            it("all voting power spent is set 0", async () => {
                let idx = 0,
                    voter,
                    votingPowerSpent = ethers.BigNumber.from("0");
                try {
                    while (true) {
                        voter = await ballotContract.voters(idx);
                        votingPowerSpent = votingPowerSpent.add(
                            await ballotContract.votingPowerSpent(voter)
                        );
                        idx++;
                    }
                } catch { }

                expect(votingPowerSpent).to.eq(ethers.BigNumber.from("0"));
            });
        });
    });

    describe("When retrieving a winner", async () => {
        before(async () => {
            const blockNumber = await ethers.provider.getBlock("latest");
            await deployBallot(blockNumber.number + 6);
        });
        /**
         * Returns a random integer between min (inclusive) and max (inclusive).
         * The value is no lower than min (or the next integer greater than min
         * if min isn't an integer) and no greater than max (or the next integer
         * lower than max if max isn't an integer).
         * Using Math.round() will give you a non-uniform distribution!
         */
        function getRandomInt(min: number, max: number): number {
            min = Math.ceil(min);
            max = Math.floor(max);
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        it("the proposal with max votes is returned", async () => {
            const signers = await ethers.getSigners();
            const votesMap = new Map<number, any>();
            for (let i = 0; i < PROPOSALS.length; i++) {
                votesMap.set(i, { count: 0 });
            }

            for (let index = 1; index < 3; index++) {
                // mint and delegate
                await (
                    await tokenContract.mint(signers[index].address, TEST_TOKEN_MINT)
                ).wait();
                await (
                    await tokenContract
                        .connect(signers[index])
                        .delegate(signers[index].address)
                ).wait();
            }

            let currentBlock = await ethers.provider.getBlock("latest");
            console.log("currentBlock", currentBlock.number);

            for (let index = 1; index < 3; index++) {
                let voteFor = getRandomInt(0, PROPOSALS.length - 1);
                votesMap.get(voteFor).count++;
                await (
                    await ballotContract
                        .connect(signers[index])
                        .vote(voteFor, TEST_VOTE_AMOUNT)
                ).wait();
            }

            let maxVotes = -1;
            let proposalIndexWithMaxVotes = 0;
            for (let [key, value] of votesMap) {
                if (value.count > maxVotes) {
                    maxVotes = value.count;
                    proposalIndexWithMaxVotes = key;
                }
            }

            const winnerProposalNumber = await ballotContract.winningProposal();
            const winnerProposal = await ballotContract.winnerName();
            const winnerProposalName =
                ethers.utils.parseBytes32String(winnerProposal);

            expect(winnerProposalName).to.eq(PROPOSALS[proposalIndexWithMaxVotes]);
            expect(winnerProposalNumber).to.eq(proposalIndexWithMaxVotes);
        });
    });

    describe("When user tries to vote but the voting ended in some block before", async () => {

        let votingOpenUntil: Number;

        beforeEach(async () => {

            await deployBallot(SNAPSHOT_BLOCK_NUMBER, false);

            //mint vote token for account 1
            const mintTx = await tokenContract.mint(account1.address, TEST_TOKEN_MINT);
            await mintTx.wait();

            //self-delegate vote power
            const delegateTx = await tokenContract.connect(account1).delegate(account1.address);
            await delegateTx.wait();

            let latestBlock = await ethers.provider.getBlock('latest');

            await (await ballotContract.reset(latestBlock.number)).wait();
            await (await ballotContract.openVoting(10)).wait();

            latestBlock = await ethers.provider.getBlock('latest');

            votingOpenUntil = latestBlock.number + 10;

            await mine(15);

        });

        it("should not be allowed to vote", async () => {
            await expect(ballotContract.connect(account1).vote(0, TEST_VOTE_AMOUNT)).to.be.revertedWith('Voting allowed only until block ' + votingOpenUntil);
        });

    });

});
