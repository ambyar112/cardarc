// DEBUG SCRIPT: Listing Issue Troubleshooter
// Usage: node scripts/debugListingIssue.cjs <userAddress> <cardId>
// Example: node scripts/debugListingIssue.cjs 0x123... ribrianne-085

require('dotenv').config();
const { ethers } = require('ethers');
const { createClient } = require('@supabase/supabase-js');

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════

const RPC_URL = 'https://rpc-testnet.arcscan.app';
const CARDS_ADDRESS = process.env.VITE_CONTRACT_ADDRESS;
const MARKETPLACE_ADDRESS = process.env.VITE_MARKETPLACE_ADDRESS;

const CARDS_ABI = [
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  'function cardToTokenId(string memory cardId) view returns (uint256)',
  'function tokenIdToCard(uint256 tokenId) view returns (string)',
  'function isApprovedForAll(address owner, address operator) view returns (bool)',
];

const MARKETPLACE_ABI = [
  'function sellerTokenListing(address seller, uint256 tokenId) view returns (uint256)',
  'function listings(uint256 listingId) view returns (uint256 listingId, address seller, uint256 tokenId, string cardId, uint256 price, bool active)',
];

// ═══════════════════════════════════════════════════════════════════════════
// MAIN DEBUG FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

async function debugListingIssue(userAddress, cardId) {
  console.log('\n🔍 ARC LISTING ISSUE DEBUGGER\n');
  console.log('═'.repeat(70));
  console.log(`User Address: ${userAddress}`);
  console.log(`Card ID:      ${cardId}`);
  console.log('═'.repeat(70));

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const cardsContract = new ethers.Contract(CARDS_ADDRESS, CARDS_ABI, provider);
  const marketplaceContract = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, provider);
  
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  );

  const issues = [];
  const recommendations = [];

  try {
    // ─────────────────────────────────────────────────────────────────────
    // 1. CHECK DATABASE
    // ─────────────────────────────────────────────────────────────────────
    
    console.log('\n📊 STEP 1: Checking Database (Supabase)...\n');
    
    const { data: dbCard, error: dbError } = await supabase
      .from('collection')
      .select('*')
      .eq('id', cardId)
      .eq('owner', userAddress.toLowerCase())
      .single();

    if (dbError || !dbCard) {
      console.log('❌ Card NOT found in database for this user');
      console.log('   Possible reasons:');
      console.log('   - Card already sold/transferred');
      console.log('   - Wrong cardId or userAddress');
      console.log('   - Database out of sync');
      issues.push('CARD_NOT_IN_DB');
      recommendations.push('Refresh database or check if card was sold');
    } else {
      console.log('✅ Card found in database:');
      console.log(`   Name:         ${dbCard.name}`);
      console.log(`   Tier:         ${dbCard.tier}`);
      console.log(`   Set ID:       ${dbCard.setId}`);
      console.log(`   NFT Token ID: ${dbCard.nft_token_id ?? 'NOT SET'}`);
      console.log(`   Owner:        ${dbCard.owner}`);
      console.log(`   Minted:       ${dbCard.minted ? 'Yes' : 'No'}`);
      
      if (!dbCard.minted) {
        console.log('\n⚠️  WARNING: Card marked as NOT MINTED in database');
        issues.push('NOT_MINTED_IN_DB');
      }
      
      if (!dbCard.nft_token_id && dbCard.nft_token_id !== 0) {
        console.log('\n⚠️  WARNING: No tokenId in database');
        issues.push('NO_TOKEN_ID_IN_DB');
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 2. CHECK BLOCKCHAIN - Get TokenId
    // ─────────────────────────────────────────────────────────────────────
    
    console.log('\n⛓️  STEP 2: Checking Blockchain (On-Chain)...\n');
    
    let tokenId;
    try {
      tokenId = await cardsContract.cardToTokenId(cardId);
      tokenId = Number(tokenId);
      
      if (tokenId === 0) {
        console.log('❌ Card NOT MINTED on blockchain');
        console.log('   TokenId mapping returns 0 (unminted)');
        issues.push('NOT_MINTED_ON_CHAIN');
        recommendations.push('Mint card first before listing using mintCardNFT()');
      } else {
        console.log(`✅ Card minted on blockchain`);
        console.log(`   Token ID: ${tokenId}`);
      }
    } catch (e) {
      console.log('❌ Error querying tokenId:', e.message);
      issues.push('BLOCKCHAIN_QUERY_FAILED');
    }

    // ─────────────────────────────────────────────────────────────────────
    // 3. CHECK OWNERSHIP (Balance)
    // ─────────────────────────────────────────────────────────────────────
    
    if (tokenId && tokenId > 0) {
      console.log('\n👤 STEP 3: Checking NFT Ownership...\n');
      
      try {
        const balance = await cardsContract.balanceOf(userAddress, tokenId);
        const balanceNum = Number(balance);
        
        console.log(`   User balance for tokenId ${tokenId}: ${balanceNum}`);
        
        if (balanceNum === 0) {
          console.log('❌ USER DOES NOT OWN THIS NFT!');
          console.log('   Possible reasons:');
          console.log('   - NFT never minted to this address');
          console.log('   - NFT already transferred/sold');
          console.log('   - NFT currently listed (in marketplace escrow)');
          issues.push('NOT_OWNED');
          recommendations.push('Check if NFT was transferred or is already listed');
        } else {
          console.log('✅ User owns this NFT');
        }
      } catch (e) {
        console.log('❌ Error checking balance:', e.message);
        issues.push('BALANCE_CHECK_FAILED');
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 4. CHECK APPROVAL
    // ─────────────────────────────────────────────────────────────────────
    
    console.log('\n🔓 STEP 4: Checking Marketplace Approval...\n');
    
    try {
      const isApproved = await cardsContract.isApprovedForAll(userAddress, MARKETPLACE_ADDRESS);
      
      if (isApproved) {
        console.log('✅ Marketplace is approved to transfer user\'s NFTs');
      } else {
        console.log('❌ Marketplace NOT APPROVED');
        console.log('   User must approve marketplace first');
        issues.push('NOT_APPROVED');
        recommendations.push('Call setApprovalForAll(marketplaceAddress, true)');
      }
    } catch (e) {
      console.log('❌ Error checking approval:', e.message);
      issues.push('APPROVAL_CHECK_FAILED');
    }

    // ─────────────────────────────────────────────────────────────────────
    // 5. CHECK IF ALREADY LISTED
    // ─────────────────────────────────────────────────────────────────────
    
    if (tokenId && tokenId > 0) {
      console.log('\n📋 STEP 5: Checking Existing Listings...\n');
      
      try {
        const existingListingId = await marketplaceContract.sellerTokenListing(userAddress, tokenId);
        const listingIdNum = Number(existingListingId);
        
        if (listingIdNum > 0) {
          console.log(`⚠️  NFT ALREADY LISTED!`);
          console.log(`   Listing ID: ${listingIdNum}`);
          
          // Get listing details
          const listing = await marketplaceContract.listings(listingIdNum);
          console.log(`   Seller:  ${listing[1]}`);
          console.log(`   TokenId: ${listing[2]}`);
          console.log(`   CardId:  ${listing[3]}`);
          console.log(`   Price:   ${ethers.formatEther(listing[4])} ETH`);
          console.log(`   Active:  ${listing[5]}`);
          
          issues.push('ALREADY_LISTED');
          recommendations.push(`Cancel existing listing #${listingIdNum} first`);
        } else {
          console.log('✅ NFT not currently listed');
        }
      } catch (e) {
        console.log('❌ Error checking listings:', e.message);
        issues.push('LISTING_CHECK_FAILED');
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 6. CHECK CARD-TOKEN MAPPING
    // ─────────────────────────────────────────────────────────────────────
    
    if (tokenId && tokenId > 0) {
      console.log('\n🔗 STEP 6: Verifying Card-Token Mapping...\n');
      
      try {
        const onChainCardId = await cardsContract.tokenIdToCard(tokenId);
        
        console.log(`   On-chain cardId for tokenId ${tokenId}: "${onChainCardId}"`);
        console.log(`   Expected cardId from input:             "${cardId}"`);
        
        if (onChainCardId.toLowerCase() !== cardId.toLowerCase()) {
          console.log('❌ CARD ID MISMATCH!');
          console.log('   The tokenId does not match the cardId');
          console.log('   This will cause CardMismatch revert');
          issues.push('CARD_MISMATCH');
          recommendations.push('Use correct tokenId for this cardId');
        } else {
          console.log('✅ Card-Token mapping verified');
        }
      } catch (e) {
        console.log('❌ Error checking mapping:', e.message);
        issues.push('MAPPING_CHECK_FAILED');
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // SUMMARY
    // ─────────────────────────────────────────────────────────────────────
    
    console.log('\n' + '═'.repeat(70));
    console.log('📊 DIAGNOSTIC SUMMARY');
    console.log('═'.repeat(70));
    
    if (issues.length === 0) {
      console.log('\n✅ NO ISSUES DETECTED!');
      console.log('   Listing should work. If it still fails, check:');
      console.log('   - Gas settings');
      console.log('   - Network connection');
      console.log('   - Wallet approval in UI');
    } else {
      console.log(`\n❌ FOUND ${issues.length} ISSUE(S):\n`);
      issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
      
      if (recommendations.length > 0) {
        console.log('\n💡 RECOMMENDED ACTIONS:\n');
        recommendations.forEach((rec, i) => {
          console.log(`   ${i + 1}. ${rec}`);
        });
      }
    }
    
    console.log('\n' + '═'.repeat(70));

  } catch (e) {
    console.error('\n❌ FATAL ERROR:', e.message);
    console.error(e);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CLI RUNNER
// ═══════════════════════════════════════════════════════════════════════════

const userAddress = process.argv[2];
const cardId = process.argv[3];

if (!userAddress || !cardId) {
  console.log('Usage: node scripts/debugListingIssue.cjs <userAddress> <cardId>');
  console.log('Example: node scripts/debugListingIssue.cjs 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb ribrianne-085');
  process.exit(1);
}

if (!ethers.isAddress(userAddress)) {
  console.error('❌ Invalid Ethereum address');
  process.exit(1);
}

debugListingIssue(userAddress, cardId).catch(console.error);