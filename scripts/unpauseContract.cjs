// Unpause ArcCards Contract
// Run: npx hardhat run scripts/unpauseContract.cjs --network arc

const hre = require('hardhat')

async function main() {
  // New contract address
  const CONTRACT_ADDRESS = '0x85e316283448c192514926eAda9cFF03F0a6A2Ec'
  
  console.log('🔓 Unpausing contract...\n')
  
  const ArcCards = await hre.ethers.getContractAt(
    'ArcCardsOptimized',
    CONTRACT_ADDRESS
  )
  
  // Check current pause status
  const isPaused = await ArcCards.paused()
  console.log('Current pause status:', isPaused)
  
  if (!isPaused) {
    console.log('✅ Contract already unpaused!')
    return
  }
  
  // Unpause contract
  console.log('Calling unpause()...')
  const tx = await ArcCards.unpause()
  console.log('Transaction hash:', tx.hash)
  
  await tx.wait()
  console.log('✅ Contract unpaused!')
  
  // Verify
  const newStatus = await ArcCards.paused()
  console.log('New pause status:', newStatus)
  
  if (!newStatus) {
    console.log('\n🎉 SUCCESS! Contract is now active and ready for minting!')
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })