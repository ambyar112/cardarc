// Add Minter Role to Wallet Address
// Run: npx hardhat run scripts/addMinter.cjs --network arc

const hre = require('hardhat')

async function main() {
  // TODO: Replace with the wallet address that needs minter permission
  const WALLET_ADDRESS = process.env.MINTER_ADDRESS || '0xYourWalletAddressHere'
  
  // Contract address from .env
  const CONTRACT_ADDRESS = '0x8757D77aaCF0EEFcf18e9e834557de53A216e4da'
  
  const ArcCards = await hre.ethers.getContractAt(
    'ArcCardsOptimized',
    CONTRACT_ADDRESS
  )

  console.log('Adding minter role to:', WALLET_ADDRESS)
  
  const tx = await ArcCards.setApprovedMinter(WALLET_ADDRESS, true)
  console.log('Transaction hash:', tx.hash)
  
  await tx.wait()
  console.log('✅ Minter role granted!')
  
  // Verify
  const isApproved = await ArcCards.approvedMinters(WALLET_ADDRESS)
  console.log('Verification - Is approved minter:', isApproved)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })