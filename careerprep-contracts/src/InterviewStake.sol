pragma solidity ^0.8.20;

import "./InterviewToken.sol";

contract InterviewStake {

    InterviewToken public token;
    address public admin;
    uint public stakeAmount = 0.5 ether;
    
    // Track user stakes for settlement
    mapping(address => uint) public userStakes;

    constructor(address _token) {
        token = InterviewToken(_token);
        admin = msg.sender;
    }

    // Lock tokens in escrow
    function stake() public {
        token.transferFrom(msg.sender, address(this), stakeAmount);
        userStakes[msg.sender] += stakeAmount;
    }

    // PASS: Refund tokens to candidate
    function reward(address user) public {
        require(msg.sender == admin, "Only admin can reward");
        uint amount = userStakes[user];
        require(amount > 0, "No stake found");
        userStakes[user] = 0;
        token.transfer(user, amount);
    }
    
    // FAIL: Slash tokens to admin wallet
    function slash(address user) public {
        require(msg.sender == admin, "Only admin can slash");
        uint amount = userStakes[user];
        require(amount > 0, "No stake found");
        userStakes[user] = 0;
        token.transfer(admin, amount);
    }
}
