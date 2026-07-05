// Approve Marketplace to transfer user's NFTs
// Run: npx hardhat run scripts/approveMarketplace.cjs --network arc

const hre = require('hardhat')

async function main() {
  const CARDS_CONTRACT = '0x37D4259aae3F7B79BFc414A98A58ed050Ca3Ed3A'
  const MARKETPLACE_CONTRACT = '0xD85E15A66C9F2f6a0E4c6C7472a6C0Fe58845438'
  const USER_ADDRESS = '0x33552dEc0bEC4241e16311b28229875354ca362A'
  
  console.log('🔓 Approving marketplace for user...\n')
  console.log('Cards Contract:', CARDS_CONTRACT)
  console.log('Marketplace:', MARKETPLACE_CONTRACT)
  console.log('User:', USER_ADDRESS)
  
  const ArcCards = await hre.ethers.getContractAt('ArcCardsOptimized', CARDS_CONTRACT)
  
  // Check current approval status
  const isApproved = await ArcCards.isApprovedForAll(USER_ADDRESS, MARKETPLACE_CONTRACT)
  console.log('\nCurrent approval status:', isApproved)
  
  if (isApproved) {
    console.log('✅ Already approved!')
    return
  }
  
  // This needs to be called by user's wallet, not deployer
  // Deployer can't approve on behalf of user
  
  console.log('\n⚠️  USER MUST APPROVE MARKETPLACE THEMSELVES!')
  console.log('\nUser needs to call this from their wallet:')
  console.log('──────────────────────────────────────────────────────')
  console.log('Contract: ArcCards (', CARDS_CONTRACT, ')')
  console.log('Function: setApprovalForAll')
  console.log('Parameters:')
  console.log('  operator:', MARKETPLACE_CONTRACT)
  console.log('  approved: true')
  console.log('──────────────────────────────────────────────────────')
  console.log('\nOR use frontend "Approve" button before listing NFT')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })