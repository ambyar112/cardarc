// Mint NFT for specific user on NEW contract
// Run: npx hardhat run scripts/mintForUser.cjs --network arc

const hre = require('hardhat')

async function main() {
  const NEW_CONTRACT = '0x37D4259aae3F7B79BFc414A98A58ed050Ca3Ed3A'
  
  // User's wallet address (update this!)
  const USER_ADDRESS = '0x33552dEc0bEC4241e16311b28229875354ca362A'
  
  console.log('🎴 Minting NFT for user on NEW contract...\n')
  console.log('Contract:', NEW_CONTRACT)
  console.log('User:', USER_ADDRESS)
  
  const ArcCards = await hre.ethers.getContractAt('ArcCardsOptimized', NEW_CONTRACT)
  
  // Mint a few test cards
  const cardIds = [
    'sv08-036', // Ceruledge ex
    'sv08-001', // Test card 1
    'sv08-002', // Test card 2
  ]
  
  for (const cardId of cardIds) {
    try {
      console.log(`\nMinting ${cardId}...`)
      const tx = await ArcCards.mintCard(USER_ADDRESS, cardId)
      console.log('TX Hash:', tx.hash)
      
      const receipt = await tx.wait()
      console.log('✅ Minted successfully!')
      
      // Get token ID from event
      const event = receipt.logs.find(log => {
        try {
          const parsed = ArcCards.interface.parseLog(log)
          return parsed.name === 'CardMinted'
        } catch {
          return false
        }
      })
      
      if (event) {
        const parsed = ArcCards.interface.parseLog(event)
        console.log('Token ID:', parsed.args.tokenId.toString())
      }
      
    } catch (error) {
      console.log('❌ Failed:', error.message)
    }
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('DONE! User now has NEW NFTs on NEW contract')
  console.log('These can be listed on NEW marketplace')
  console.log('='.repeat(60))
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })