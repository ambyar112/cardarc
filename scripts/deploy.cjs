const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH");

  // 1. Deploy ArcCards
  console.log("\n[1/2] Deploying ArcCards...");
  const ArcCards = await hre.ethers.getContractFactory("ArcCards");
  const arcCards = await ArcCards.deploy();
  await arcCards.waitForDeployment();
  const arcCardsAddr = await arcCards.getAddress();
  console.log("✅ ArcCards deployed to:", arcCardsAddr);

  // 2. Deploy ArcMarketplace
  console.log("\n[2/2] Deploying ArcMarketplace...");
  const ArcMarketplace = await hre.ethers.getContractFactory("ArcMarketplace");
  const marketplace = await ArcMarketplace.deploy(arcCardsAddr);
  await marketplace.waitForDeployment();
  const marketplaceAddr = await marketplace.getAddress();
  console.log("✅ ArcMarketplace deployed to:", marketplaceAddr);

  // 3. Approve marketplace as minter on ArcCards
  console.log("\n[3/3] Setting marketplace as approved minter...");
  const tx = await arcCards.setApprovedMinter(marketplaceAddr, true);
  await tx.wait();
  console.log("✅ Marketplace approved as minter");

  console.log("\n═══════════════════════════════════════");
  console.log("DEPLOYMENT COMPLETE — update .env:");
  console.log("VITE_CONTRACT_ADDRESS=" + arcCardsAddr);
  console.log("VITE_MARKETPLACE_ADDRESS=" + marketplaceAddr);
  console.log("═══════════════════════════════════════");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
