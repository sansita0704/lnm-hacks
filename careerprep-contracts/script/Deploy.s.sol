pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/InterviewToken.sol";
import "../src/InterviewStake.sol";

contract Deploy is Script {

    function run() external {
        vm.startBroadcast();

        InterviewToken token = new InterviewToken();
        new InterviewStake(address(token));

        vm.stopBroadcast();
    }
}
