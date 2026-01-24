// contracts/InterviewStakeABI.ts
export const InterviewStakeABI = [
    "function stake() external",
    "function reward(address user) external",
    "function slash(address user) external",
    "function userStakes(address) view returns (uint256)",
    "function admin() view returns (address)",
    "event Staked(address indexed user, uint256 amount)",
    "event Rewarded(address indexed user, uint256 amount)",
    "event Slashed(address indexed user, uint256 amount)"
  ];
  