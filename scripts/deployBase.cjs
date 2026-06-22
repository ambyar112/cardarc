/**
 * ═══════════════════════════════════════════════════════════════════════
 * BASE L2 DEPLOYMENT SCRIPT
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Deploys ArcCards + ArcMarketplace to Arc Testnet
 * 
 * Usage:
 *   npx hardhat run scripts/deployBase.cjs --network arc
 * ═══════════════════════════════════════════════════════════════════════
 */

const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const chainId = (await hre.ethers.provider.getNetwork()).chainId;
  
  console.log("\n╔═══════════════════════════════════════════════════════════════╗");
  console.log("║  🚀 ARCC DEPLOYMENT TO ARC NETWORK                         ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");
  console.log(`Network: ${network} (chainId: ${chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))} ETH\n`);

  // ═══════════════════════════════════════════════════════════════════
  // STEP 1: Deploy ArcCardsOptimized
  // ═══════════════════════════════════════════════════════════════════
  
  console.log("📦 [1/3] Deploying ArcCardsOptimized...");
  const ArcCards = await hre.ethers.getContractFactory("ArcCardsOptimized");
  const arcCards = await ArcCards.deploy();
  await arcCards.waitForDeployment();
  const cardsAddress = await arcCards.getAddress();
  
  console.log(`✅ ArcCardsOptimized: ${cardsAddress}`);
  console.log(`   Gas used: ${(await arcCards.deploymentTransaction().wait()).gasUsed.toString()}\n`);

  // ═══════════════════════════════════════════════════════════════════
  // STEP 2: Deploy ArcMarketplaceOptimized
  // ═══════════════════════════════════════════════════════════════════
  
  console.log("🏪 [2/3] Deploying ArcMarketplaceOptimized...");
  const ArcMarketplace = await hre.ethers.getContractFactory("ArcMarketplaceOptimized");
  const marketplace = await ArcMarketplace.deploy(cardsAddress);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  
  console.log(`✅ ArcMarketplaceOptimized: ${marketplaceAddress}`);
  console.log(`   Gas used: ${(await marketplace.deploymentTransaction().wait()).gasUsed.toString()}\n`);

  // ═══════════════════════════════════════════════════════════════════
  // STEP 3: Link Contracts & Setup
  // ═══════════════════════════════════════════════════════════════════
  
  console.log("🔗 [3/3] Linking contracts...");
  const linkTx = await arcCards.setApprovedMinter(marketplaceAddress, true);
  await linkTx.wait();
  
  console.log(`✅ Marketplace approved as minter\n`);

  // ═══════════════════════════════════════════════════════════════════
  // DEPLOYMENT SUMMARY
  // ═══════════════════════════════════════════════════════════════════
  
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║  ✅ DEPLOYMENT COMPLETE                                      ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");
  console.log("📋 Contract Addresses:");
  console.log(`   ArcCardsOptimized:    ${cardsAddress}`);
  console.log(`   ArcMarketplaceOptimized: ${marketplaceAddress}\n`);
  
  console.log("🔍 Block Explorers:");
  console.log(`   ArcCards:    https://testnet.arcscan.app/address/${cardsAddress}`);
  console.log(`   Marketplace: https://testnet.arcscan.app/address/${marketplaceAddress}\n`);
  
  console.log("💡 Next Steps:");
  console.log("   1. Verify contracts on BaseScan:");
  console.log(`      npx hardhat verify --network ${network} ${cardsAddress}`);
  console.log(`      npx hardhat verify --network ${network} ${marketplaceAddress} ${cardsAddress}`);
  console.log("   2. Update frontend config (wagmi.js) with new addresses");
  console.log("   3. Test all functions on testnet before mainnet");
  console.log("   4. Fund deployer with ~0.01 ETH for ongoing admin operations\n");
  
  // Save deployment info to file
  const fs = require("fs");
  const path = require("path");
  const deploymentInfo = {
    network,
    chainId,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      ArcCardsOptimized: cardsAddress,
      ArcMarketplaceOptimized: marketplaceAddress,
    },
    blockExplorer: "https://testnet.arcscan.app",
  };
  
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const filename = `${network}-${chainId}.json`;
  fs.writeFileSync(
    path.join(deploymentsDir, filename),
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log(`💾 Deployment info saved to: deployments/${filename}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });