require("@nomicfoundation/hardhat-ethers");
require("dotenv").config(); // ✅ load .env ke process.env

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.26", // ✅ Updated to match contract version
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    // Arc Testnet - Primary and only network
    arc: {
      url: "https://rpc.testnet.arc.network",
      chainId: 5042002,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
};
