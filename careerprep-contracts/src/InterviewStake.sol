// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./InterviewToken.sol";

contract InterviewStake {
    InterviewToken public immutable token;
    address public immutable admin;
    uint256 public constant STAKE_AMOUNT = 0.5 ether;

    // Track user stakes
    mapping(address => uint256) public userStakes;

    /* ----------------------------- EVENTS ----------------------------- */
    event Staked(address indexed user, uint256 amount);
    event Rewarded(address indexed user, uint256 amount);
    event Slashed(address indexed user, uint256 amount);

    /* ---------------------------- MODIFIERS --------------------------- */
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin allowed");
        _;
    }

    /* --------------------------- CONSTRUCTOR -------------------------- */
    constructor(address _token) {
        require(_token != address(0), "Invalid token address");
        token = InterviewToken(_token);
        admin = msg.sender;
    }

    /* ---------------------------- FUNCTIONS --------------------------- */

    // User stakes tokens (after approve)
    function stake() external {
        require(
            token.transferFrom(msg.sender, address(this), STAKE_AMOUNT),
            "Token transfer failed"
        );

        userStakes[msg.sender] += STAKE_AMOUNT;
        emit Staked(msg.sender, STAKE_AMOUNT);
    }

    // PASS → refund tokens to candidate
    function reward(address user) external onlyAdmin {
        uint256 amount = userStakes[user];
        require(amount > 0, "No stake found");

        userStakes[user] = 0;
        require(token.transfer(user, amount), "Transfer failed");

        emit Rewarded(user, amount);
    }

    // FAIL → slash tokens to admin
    function slash(address user) external onlyAdmin {
        uint256 amount = userStakes[user];
        require(amount > 0, "No stake found");

        userStakes[user] = 0;
        require(token.transfer(admin, amount), "Transfer failed");

        emit Slashed(user, amount);
    }
}
