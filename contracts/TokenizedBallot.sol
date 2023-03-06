// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

interface IMyToken {
    function getPastVotes(
        address account,
        uint256 blockNumber
    ) external view returns (uint256);
}

contract Ballot is AccessControl {
    struct Proposal {
        bytes32 name;
        uint voteCount;
    }

    mapping(address => uint256) public votingPowerSpent;
    IMyToken public tokenContract;
    Proposal[] public proposals;
    uint256 public targetBlockNumber;

    mapping(address => bool) public hasVoted;
    address[] public voters;

    uint256 public votingEndsAtBlock;
    bool public votingOpen;

    constructor(
        bytes32[] memory proposalNames,
        address _tokenContract,
        uint256 _targetBlockNumber
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        tokenContract = IMyToken(_tokenContract);
        targetBlockNumber = _targetBlockNumber;
        for (uint i = 0; i < proposalNames.length; i++) {
            proposals.push(Proposal({name: proposalNames[i], voteCount: 0}));
        }
    }

    function reset(
        uint256 newBlockNumber
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        bool canKeepVotes = true;
        for (uint i = 0; i < voters.length; ++i) {
            if (
                tokenContract.getPastVotes(voters[i], newBlockNumber) <
                votingPowerSpent[voters[i]]
            ) {
                canKeepVotes = false;
                break;
            }
        }
        targetBlockNumber = newBlockNumber;
        if (!canKeepVotes) {
            for (uint i = 0; i < proposals.length; ++i) {
                proposals[i].voteCount = 0;
            }
            for (uint i = 0; i < voters.length; ++i) {
                votingPowerSpent[voters[i]] = 0;
            }
        }

        votingOpen = false;
    }

    function vote(uint proposal, uint256 amount) external {
        require(votingOpen, "Voting not opened");
        require(
            votingPower(msg.sender) >= amount,
            "Insufficient voting power."
        ); // Require msg.sender to have at least 'amount' voting power

        require(
            block.number <= votingEndsAtBlock,
            string.concat(
                "Voting allowed only until block ",
                Strings.toString(votingEndsAtBlock)
            )
        );

        votingPowerSpent[msg.sender] += amount;
        if (!hasVoted[msg.sender]) {
            hasVoted[msg.sender] = true;
            voters.push(msg.sender);
        }
        proposals[proposal].voteCount += amount; // account the vote count for the proposal of index 'proposal'
    }

    function votingPower(address account) public view returns (uint256) {
        return
            tokenContract.getPastVotes(account, targetBlockNumber) -
            votingPowerSpent[account];
    }

    function winningProposal() public view returns (uint winningProposal_) {
        uint winningVoteCount = 0;
        for (uint p = 0; p < proposals.length; p++) {
            if (proposals[p].voteCount > winningVoteCount) {
                winningVoteCount = proposals[p].voteCount;
                winningProposal_ = p;
            }
        }
    }

    function winnerName() external view returns (bytes32 winnerName_) {
        winnerName_ = proposals[winningProposal()].name;
    }

    function openVoting(
        uint256 _numberOfBlocksVotingCanLast
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!votingOpen, "Voting is open, can not open it again.");
        votingEndsAtBlock = block.number + _numberOfBlocksVotingCanLast;
        votingOpen = true;
    }
}
