// Deploy SIMPLE ArcCards + ArcMarketplace (non-optimized versions)
// These contracts are SMALLER and should deploy successfully
// Run: npx hardhat run scripts/deploySimple.cjs --network arc

const hre = require("hardhat");

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("🚀 DEPLOYING SIMPLE CONTRACTS (Small, proven versions)");
  console.log("=".repeat(60) + "\n");

  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  
  console.log("Network:", hre.network.name);
  console.log("ChainId:", hre.network.config.chainId);
  console.log("Deployer:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH\n");

  if (parseFloat(hre.ethers.formatEther(balance)) < 0.01) {
    console.log("⚠️  WARNING: Low balance! Need at least 0.01 ETH for deployment\n");
  }

  try {
    // Step 1: Deploy ArcCards (simple version - 135 lines)
    console.log("📦 [1/4] Deploying ArcCards (simple version)...");
    const ArcCards = await hre.ethers.getContractFactory("ArcCards");
    const arcCards = await ArcCards.deploy();
    await arcCards.waitForDeployment();
    const cardsAddress = await arcCards.getAddress();
    
    console.log("✅ ArcCards deployed:", cardsAddress);
    
    // Verify bytecode exists
    const cardsCode = await hre.ethers.provider.getCode(cardsAddress);
    if (cardsCode === "0x") {
      throw new Error("❌ FATAL: No bytecode at ArcCards address!");
    }
    console.log("✅ Bytecode verified:", cardsCode.length, "bytes\n");

    // Step 2: Deploy ArcMarketplace
    console.log("🏪 [2/4] Deploying ArcMarketplace...");
    const ArcMarketplace = await hre.ethers.getContractFactory("ArcMarketplace");
    const marketplace = await ArcMarketplace.deploy(cardsAddress);
    await marketplace.waitForDeployment();
    const marketplaceAddress = await marketplace.getAddress();
    
    console.log("✅ ArcMarketplace deployed:", marketplaceAddress);
    
    // Verify bytecode exists
    const marketplaceCode = await hre.ethers.provider.getCode(marketplaceAddress);
    if (marketplaceCode === "0x") {
      throw new Error("❌ FATAL: No bytecode at Marketplace address!");
    }
    console.log("✅ Bytecode verified:", marketplaceCode.length, "bytes\n");

    // Step 3: Link contracts (approve marketplace as minter)
    console.log("🔗 [3/4] Linking contracts...");
    const tx = await arcCards.setApprovedMinter(marketplaceAddress, true);
    await tx.wait();
    console.log("✅ Marketplace approved as minter\n");

    // Step 4: Verify permissions
    console.log("🔍 [4/4] Verifying setup...");
    const isMinter = await arcCards.approvedMinters(marketplaceAddress);
    const owner = await arcCards.owner();
    
    console.log("Contract owner:", owner);
    console.log("Marketplace is minter:", isMinter);
    
    if (!isMinter) {
      throw new Error("❌ FATAL: Marketplace not approved as minter!");
    }
    
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
      console.log("⚠️  WARNING: Owner mismatch!");
    }

    // Success!
    console.log("\n" + "=".repeat(60));
    console.log("✅ DEPLOYMENT SUCCESSFUL!");
    console.log("=".repeat(60));
    console.log("\n📋 Contract Addresses:");
    console.log("   ArcCards:        ", cardsAddress);
    console.log("   ArcMarketplace:  ", marketplaceAddress);
    console.log("\n🔍 Block Explorer:");
    console.log("   Cards:    https://testnet.arcscan.app/address/" + cardsAddress);
    console.log("   Marketplace: https://testnet.arcscan.app/address/" + marketplaceAddress);
    console.log("\n💡 Next Steps:");
    console.log("   1. Update .env:");
    console.log("      VITE_CONTRACT_ADDRESS=" + cardsAddress);
    console.log("      VITE_MARKETPLACE_ADDRESS=" + marketplaceAddress);
    console.log("   2. Update Vercel environment variables");
    console.log("   3. Redeploy frontend to Vercel");
    console.log("   4. Test gacha mint!");
    console.log("\n");

  } catch (error) {
    console.error("\n❌ DEPLOYMENT FAILED!");
    console.error("Error:", error.message);
    console.error("\nFull error:");
    console.error(error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });