// Check Contract Owner Address
// Run: npx hardhat run scripts/checkOwner.cjs --network arc

const hre = require('hardhat')

async function main() {
  const CONTRACT_ADDRESS = '0x37D4259aae3F7B79BFc414A98A58ed050Ca3Ed3A'
  
  console.log('🔍 Checking contract owner...\n')
  
  // Get contract instance
  const ArcCards = await hre.ethers.getContractAt(
    'ArcCardsOptimized',
    CONTRACT_ADDRESS
  )
  
  // Get owner address from contract
  const ownerAddress = await ArcCards.owner()
  console.log('📋 Contract Owner Address:', ownerAddress)
  
  // Get deployer address from private key in .env
  const [deployer] = await hre.ethers.getSigners()
  console.log('🔑 Deployer Address (from .env DEPLOYER_PRIVATE_KEY):', deployer.address)
  
  // Compare
  if (ownerAddress.toLowerCase() === deployer.address.toLowerCase()) {
    console.log('\n✅ MATCH! Deployer IS the contract owner')
    console.log('   You can use this wallet to add minter permissions')
  } else {
    console.log('\n❌ NOT MATCH! Deployer is NOT the contract owner')
    console.log('   You need to use the owner wallet:', ownerAddress)
  }
  
  // Check current wallet balance
  const balance = await hre.ethers.provider.getBalance(deployer.address)
  const balanceEth = hre.ethers.formatEther(balance)
  console.log('\n💰 Deployer Balance:', balanceEth, 'USDC')
  
  if (parseFloat(balanceEth) < 0.001) {
    console.log('⚠️  WARNING: Low balance! Need USDC for gas fees')
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })