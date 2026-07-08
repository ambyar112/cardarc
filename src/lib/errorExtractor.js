// Extract user-friendly error messages from blockchain transaction reverts

/**
 * Extract human-readable error message from Viem/Wagmi error objects
 * Parses revert reasons and converts them to Indonesian user-friendly messages
 */
export function extractTransactionError(error) {
  if (!error) return 'Unknown error'

  // Get the full error message (check multiple possible locations)
  const fullMessage = error.message || error.shortMessage || String(error)
  const details = error.details || ''
  const cause = error.cause?.message || ''
  
  // Combine all error info for pattern matching
  const combinedError = `${fullMessage} ${details} ${cause}`.toLowerCase()

  // ═══════════════════════════════════════════════════════════════
  // PATTERN MATCHING - Convert technical errors to user messages
  // ═══════════════════════════════════════════════════════════════

  // 1. Card not minted / doesn't exist
  if (
    combinedError.includes('tokenid') && combinedError.includes('0') ||
    combinedError.includes('card not minted') ||
    combinedError.includes('token does not exist') ||
    combinedError.includes('erc1155: balance query for the zero address')
  ) {
    return 'Card belum di-mint on-chain. Pastikan contract addresses benar dan card sudah di-mint.'
  }

  // 2. Insufficient balance / User doesn't own the card
  if (
    combinedError.includes('insufficient balance') ||
    combinedError.includes('erc1155: burn amount exceeds balance') ||
    combinedError.includes('balance') && combinedError.includes('0')
  ) {
    return 'Kamu tidak memiliki card ini. Pastikan card ada di wallet kamu.'
  }

  // 3. Not approved / Need marketplace approval
  if (
    combinedError.includes('not approved') ||
    combinedError.includes('erc1155: caller is not token owner nor approved') ||
    combinedError.includes('setapprovalforall')
  ) {
    return 'Marketplace belum di-approve. Silakan approve marketplace terlebih dahulu.'
  }

  // 4. Card already listed
  if (
    combinedError.includes('already listed') ||
    combinedError.includes('listing exists') ||
    combinedError.includes('duplicate listing') ||
    combinedError.includes('card sudah di-list')
  ) {
    return 'Card sudah di-list di marketplace. Cek halaman Profile untuk cancel listing yang lama.'
  }

  // 5. Wrong contract address / Contract not found
  if (
    combinedError.includes('contract not found') ||
    combinedError.includes('code size') && combinedError.includes('0') ||
    combinedError.includes('missing revert data') ||
    combinedError.includes('execution reverted') && !combinedError.includes('reason')
  ) {
    return 'Contract address salah atau tidak ditemukan. Periksa environment variables.'
  }

  // 6. Gas estimation failed (usually means transaction will revert)
  if (
    combinedError.includes('gas required exceeds allowance') ||
    combinedError.includes('gas estimation failed') ||
    combinedError.includes('cannot estimate gas')
  ) {
    return 'Transaksi akan gagal. Kemungkinan card belum di-mint atau tidak ada permission.'
  }

  // 7. Network / RPC errors
  if (
    combinedError.includes('network') ||
    combinedError.includes('timeout') ||
    combinedError.includes('fetch failed') ||
    combinedError.includes('econnrefused')
  ) {
    return 'Network error. Periksa koneksi internet atau coba lagi.'
  }

  // 8. User rejected transaction
  if (
    combinedError.includes('user rejected') ||
    combinedError.includes('user denied') ||
    combinedError.includes('user cancelled')
  ) {
    return 'Transaksi dibatalkan oleh user.'
  }

  // 9. Nonce too low (transaction already submitted)
  if (combinedError.includes('nonce too low')) {
    return 'Transaksi sudah disubmit sebelumnya. Tunggu konfirmasi atau coba lagi.'
  }

  // 10. Insufficient funds for gas
  if (
    combinedError.includes('insufficient funds') ||
    combinedError.includes('not enough balance')
  ) {
    return 'ETH tidak cukup untuk gas fee. Top up wallet kamu terlebih dahulu.'
  }

  // 11. Generic execution reverted (extract reason if available)
  if (combinedError.includes('execution reverted')) {
    // Try to extract revert reason from various formats
    const reasonMatch = combinedError.match(/reason[:\s]+"?([^"]+)"?/i)
    if (reasonMatch && reasonMatch[1]) {
      return `Transaction reverted: ${reasonMatch[1]}`
    }
    return 'Transaction reverted on-chain. Check card ownership dan contract addresses.'
  }

  // ═══════════════════════════════════════════════════════════════
  // FALLBACK - Return shortened version of original error
  // ═══════════════════════════════════════════════════════════════

  // Use shortMessage if available (usually more readable than full message)
  if (error.shortMessage && error.shortMessage.length < 100) {
    return error.shortMessage
  }

  // Truncate long error messages
  const msg = fullMessage.length > 150 
    ? fullMessage.substring(0, 147) + '...'
    : fullMessage

  return msg || 'Transaction failed. Periksa console untuk detail.'
}

/**
 * Check if error is retryable (network issues, not permanent failures)
 */
export function isRetryableError(error) {
  const msg = extractTransactionError(error).toLowerCase()
  
  return (
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('fetch failed') ||
    msg.includes('nonce too low') ||
    msg.includes('coba lagi')
  )
}

/**
 * Check if error is due to missing card on-chain
 */
export function isCardNotMintedError(error) {
  const msg = extractTransactionError(error).toLowerCase()
  return msg.includes('belum di-mint')
}

/**
 * Check if error is due to lack of approval
 */
export function isApprovalError(error) {
  const msg = extractTransactionError(error).toLowerCase()
  return msg.includes('belum di-approve')
}