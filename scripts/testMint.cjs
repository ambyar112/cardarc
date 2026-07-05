// Test Mint on New Contract
// Run: npx hardhat run scripts/testMint.cjs --network arc

const hre = require('hardhat')

async function main() {
  const NEW_CONTRACT = '0x37D4259aae3F7B79BFc414A98A58ed050Ca3Ed3A'
  const OLD_CONTRACT = '0x8757D77aaCF0EEFcf18e9e834557de53A216e4da'
  
  console.log('🧪 Testing mint functionality...\n')
  
  const [signer] = await hre.ethers.getSigners()
  console.log('Testing with wallet:', signer.address)
  
  // Test NEW contract
  console.log('\n📋 NEW CONTRACT:', NEW_CONTRACT)
  const newContract = await hre.ethers.getContractAt('ArcCardsOptimized', NEW_CONTRACT)
  
  try {
    const isPaused = await newContract.paused()
    console.log('  - Paused:', isPaused)
    
    const owner = await newContract.owner()
    console.log('  - Owner:', owner)
    
    // Try to mint
    console.log('  - Attempting mint...')
    const tx = await newContract.mintCard(signer.address, 'test-card-123')
    console.log('  - TX Hash:', tx.hash)
    
    await tx.wait()
    console.log('  - ✅ MINT SUCCESSFUL on NEW contract!')
    
  } catch (error) {
    console.log('  - ❌ MINT FAILED on NEW contract')
    console.log('  - Error:', error.message)
  }
  
  // Test OLD contract
  console.log('\n📋 OLD CONTRACT:', OLD_CONTRACT)
  const oldContract = await hre.ethers.getContractAt('ArcCardsOptimized', OLD_CONTRACT)
  
  try {
    const isPaused = await oldContract.paused()
    console.log('  - Paused:', isPaused)
    
    const isApproved = await oldContract.approvedMinters(signer.address)
    console.log('  - Is Approved Minter:', isApproved)
    
    // Try to mint
    console.log('  - Attempting mint...')
    const tx = await oldContract.mintCard(signer.address, 'test-card-456')
    console.log('  - TX Hash:', tx.hash)
    
    await tx.wait()
    console.log('  - ✅ MINT SUCCESSFUL on OLD contract!')
    
  } catch (error) {
    console.log('  - ❌ MINT FAILED on OLD contract (expected!)')
    console.log('  - Error:', error.message)
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('SUMMARY:')
  console.log('- NEW contract should allow anyone to mint')
  console.log('- OLD contract should reject (onlyMinter restriction)')
  console.log('='.repeat(60))
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })