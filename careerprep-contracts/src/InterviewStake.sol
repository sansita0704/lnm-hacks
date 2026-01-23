pragma solidity ^0.8.20;

import "./InterviewToken.sol";

contract InterviewStake {

    InterviewToken public token;
    address public admin;
    uint public stakeAmount = 2 ether;

    constructor(address _token) {
        token = InterviewToken(_token);
        admin = msg.sender;
    }

    function stake() public {
        token.transferFrom(msg.sender, address(this), stakeAmount);
    }

    function reward(address user) public {
        require(msg.sender == admin);
        token.transfer(user, stakeAmount);
    }
}
