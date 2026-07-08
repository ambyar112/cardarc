const { ethers } = require('hardhat')
require('dotenv').config()

const ARC_CARDS_ADDRESS = process.env.VITE_CONTRACT_ADDRESS
const ARC_MARKETPLACE_ADDRESS = process.env.VITE_MARKETPLACE_ADDRESS

// Test cards - replace with actual failed cards from screenshot
const TEST_CARDS = [
  'Blackwing - Jetstream the Blue Sky',
  'Bouganian',
  'Brain Crusher',
  'Borreload eXcharge Dragon'
]

const ARC_CARDS_ABI = [
  'function balanceOf(address account, uint256 id) external view returns (uint256)',
  'function cardToTokenId(string memory cardId) external view returns (uint256)',
  'function isApprovedForAll(address account, address operator) external view returns (bool)',
  'function tokenIdToCard(uint256 tokenId) external view returns (string)',
]

const ARC_MARKETPLACE_ABI = [
  'function getListing(uint256 listingId) external view returns (tuple(uint256 listingId, address seller, uint256 tokenId, string cardId, uint256 price, bool active))',
  'function sellerTokenListing(address seller, uint256 tokenId) external view returns (uint256)',
  'function nextListingId() external view returns (uint256)',
]

async function main() {
  const [signer] = await ethers.getSigners()
  const userAddress = signer.address
  
  console.log('\n🔍 DIAGNOSING BULK LISTING REVERT REASONS\n')
  console.log('User Address:', userAddress)
  console.log('ArcCards:', ARC_CARDS_ADDRESS)
  console.log('Marketplace:', ARC_MARKETPLACE_ADDRESS)
  console.log('━'.repeat(80))

  const arcCards = new ethers.Contract(ARC_CARDS_ADDRESS, ARC_CARDS_ABI, signer)
  const marketplace = new ethers.Contract(ARC_MARKETPLACE_ADDRESS, ARC_MARKETPLACE_ABI, signer)

  // Check global marketplace approval FIRST
  console.log('\n📋 GLOBAL MARKETPLACE APPROVAL CHECK')
  const isApproved = await arcCards.isApprovedForAll(userAddress, ARC_MARKETPLACE_ADDRESS)
  console.log('Is Marketplace Approved:', isApproved ? '✅ YES' : '❌ NO')
  
  if (!isApproved) {
    console.log('\n⚠️  CRITICAL: Marketplace not approved!')
    console.log('This will cause ALL listings to revert.')
    console.log('User must call: setApprovalForAll(marketplace, true)')
    console.log('━'.repeat(80))
  }

  // Check each card
  for (const cardId of TEST_CARDS) {
    console.log(`\n🎴 Checking: ${cardId}`)
    console.log('─'.repeat(80))

    try {
      // 1. Get tokenId
      const tokenId = await arcCards.cardToTokenId(cardId)
      console.log('TokenId:', tokenId.toString())

      if (tokenId.toString() === '0') {
        console.log('❌ ISSUE: TokenId is 0 - card not minted or wrong cardId!')
        continue
      }

      // 2. Check ownership
      const balance = await arcCards.balanceOf(userAddress, tokenId)
      console.log('Balance:', balance.toString())
      
      if (balance.toString() === '0') {
        console.log('❌ ISSUE: User does not own this NFT!')
        console.log('   Possible reasons:')
        console.log('   - Card not minted yet')
        console.log('   - Card was transferred/sold')
        console.log('   - Wrong wallet connected')
        continue
      } else {
        console.log('✅ Ownership: OK')
      }

      // 3. Check if already listed
      const existingListingId = await marketplace.sellerTokenListing(userAddress, tokenId)
      console.log('Existing Listing ID:', existingListingId.toString())
      
      if (existingListingId.toString() !== '0') {
        console.log('⚠️  WARNING: Already listed! Must cancel first.')
        
        // Get listing details
        const listing = await marketplace.getListing(existingListingId)
        console.log('   Listing Details:')
        console.log('   - Price:', ethers.formatEther(listing.price), 'ETH')
        console.log('   - Active:', listing.active)
        console.log('   - Can list again ONLY if: active = false')
        
        if (listing.active) {
          console.log('❌ ISSUE: Active listing exists - CANNOT list again!')
          continue
        }
      }

      // 4. Verify cardId mapping consistency
      const mappedCardId = await arcCards.tokenIdToCard(tokenId)
      if (mappedCardId !== cardId) {
        console.log('❌ ISSUE: CardId mapping mismatch!')
        console.log('   Expected:', cardId)
        console.log('   On-chain:', mappedCardId)
        continue
      } else {
        console.log('✅ CardId Mapping: OK')
      }

      console.log('\n✅ This card SHOULD list successfully!')
      console.log('   If still reverting, check:')
      console.log('   1. Price is valid (> 0)')
      console.log('   2. Contract not paused')
      console.log('   3. Gas limit sufficient')

    } catch (error) {
      console.log('❌ ERROR:', error.message)
    }
  }

  // Summary
  console.log('\n' + '━'.repeat(80))
  console.log('📊 DIAGNOSIS SUMMARY')
  console.log('━'.repeat(80))
  
  if (!isApproved) {
    console.log('\n🚨 ROOT CAUSE: MARKETPLACE NOT APPROVED')
    console.log('   Fix: Run approval transaction FIRST:')
    console.log('   await arcCards.setApprovalForAll(marketplace, true)')
  } else {
    console.log('\n✅ Marketplace approved - check individual card issues above')
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('FATAL ERROR:', error)
    process.exit(1)
  })