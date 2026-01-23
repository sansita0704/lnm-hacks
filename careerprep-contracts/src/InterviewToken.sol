// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract InterviewToken is ERC20 {
    constructor() ERC20("InterviewToken", "INT") {
        _mint(msg.sender, 1000000 ether);
    }
}
