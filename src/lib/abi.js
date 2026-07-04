// ArcCards ERC-1155 + ArcMarketplace (Public Minting - No Approval Required)
// ArcCards:       0x37D4259aae3F7B79BFc414A98A58ed050Ca3Ed3A
// ArcMarketplace: 0xD85E15A66C9F2f6a0E4c6C7472a6C0Fe58845438
// Network: Arc Testnet (Chain ID: 5042002)
// Deployer: 0x7778b915e86fBf35d9E1cB7fD5d3fD8A6c0bEBFB
// Block Explorer: https://testnet.arcscan.app

export const ARC_CARDS_ADDRESS       = import.meta.env.VITE_CONTRACT_ADDRESS
export const ARC_MARKETPLACE_ADDRESS = import.meta.env.VITE_MARKETPLACE_ADDRESS

// ── ArcCards ABI (secure version — selfMint removed) ─────────
export const ARC_CARDS_ABI = [
  // Constructor
  { inputs: [], stateMutability: "nonpayable", type: "constructor" },

  // Events
  { anonymous: false, inputs: [
    { indexed: true,  name: "to",      type: "address" },
    { indexed: false, name: "cardId",  type: "string"  },
    { indexed: false, name: "tokenId", type: "uint256" },
  ], name: "CardMinted", type: "event" },
  { anonymous: false, inputs: [
    { indexed: true, name: "minter",   type: "address" },
    { indexed: false, name: "approved", type: "bool"   },
  ], name: "MinterUpdated", type: "event" },
  { anonymous: false, inputs: [
    { indexed: true,  name: "operator", type: "address"   },
    { indexed: true,  name: "from",     type: "address"   },
    { indexed: true,  name: "to",       type: "address"   },
    { indexed: false, name: "ids",      type: "uint256[]" },
    { indexed: false, name: "values",   type: "uint256[]" },
  ], name: "TransferBatch", type: "event" },
  { anonymous: false, inputs: [
    { indexed: true,  name: "operator", type: "address" },
    { indexed: true,  name: "from",     type: "address" },
    { indexed: true,  name: "to",       type: "address" },
    { indexed: false, name: "id",       type: "uint256" },
    { indexed: false, name: "value",    type: "uint256" },
  ], name: "TransferSingle", type: "event" },

  // Read
  { inputs: [{ name: "account", type: "address" }, { name: "id", type: "uint256" }],
    name: "balanceOf", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "account", type: "address" }, { name: "cardId", type: "string" }],
    name: "cardBalance", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "", type: "string" }],
    name: "cardToTokenId", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "", type: "uint256" }],
    name: "tokenIdToCard", outputs: [{ type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "id", type: "uint256" }],
    name: "totalSupply", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [],
    name: "name", outputs: [{ type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [],
    name: "owner", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "account", type: "address" }, { name: "operator", type: "address" }],
    name: "isApprovedForAll", outputs: [{ type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "", type: "address" }],
    name: "approvedMinters", outputs: [{ type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "", type: "bytes32" }],
    name: "usedNonces", outputs: [{ type: "bool" }], stateMutability: "view", type: "function" },

  // Write — minter-only
  { inputs: [{ name: "to", type: "address" }, { name: "cardId", type: "string" }],
    name: "mintCard", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "to", type: "address" }, { name: "cardIds", type: "string[]" }],
    name: "mintCardBatch", outputs: [], stateMutability: "nonpayable", type: "function" },

  // Write — user claim via signed voucher (replaces selfMint)
  { inputs: [
    { name: "cardId",    type: "string"  },
    { name: "nonce",     type: "bytes32" },
    { name: "signature", type: "bytes"   },
  ], name: "claimMint", outputs: [], stateMutability: "nonpayable", type: "function" },

  // Write — ERC-1155 standard
  { inputs: [
    { name: "from",  type: "address" },
    { name: "to",    type: "address" },
    { name: "id",    type: "uint256" },
    { name: "value", type: "uint256" },
    { name: "data",  type: "bytes"   },
  ], name: "safeTransferFrom", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "operator", type: "address" }, { name: "approved", type: "bool" }],
    name: "setApprovalForAll", outputs: [], stateMutability: "nonpayable", type: "function" },

  // Write — owner only
  { inputs: [{ name: "minter", type: "address" }, { name: "approved", type: "bool" }],
    name: "setApprovedMinter", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "newuri", type: "string" }],
    name: "setURI", outputs: [], stateMutability: "nonpayable", type: "function" },
]

// ── ArcMarketplace ABI (secure version — cardId verified on-chain) ──
export const ARC_MARKETPLACE_ABI = [
  // Events
  { anonymous: false, inputs: [
    { indexed: true,  name: "listingId", type: "uint256" },
    { indexed: true,  name: "seller",    type: "address" },
    { indexed: false, name: "tokenId",   type: "uint256" },
    { indexed: false, name: "cardId",    type: "string"  },
    { indexed: false, name: "price",     type: "uint256" },
  ], name: "Listed", type: "event" },
  { anonymous: false, inputs: [
    { indexed: true, name: "listingId", type: "uint256" },
    { indexed: true, name: "buyer",     type: "address" },
    { indexed: true, name: "seller",    type: "address" },
    { indexed: false, name: "price",    type: "uint256" },
  ], name: "Purchased", type: "event" },
  { anonymous: false, inputs: [
    { indexed: true, name: "listingId", type: "uint256" },
    { indexed: true, name: "seller",    type: "address" },
  ], name: "Cancelled", type: "event" },
  { anonymous: false, inputs: [
    { indexed: true,  name: "listingId", type: "uint256" },
    { indexed: false, name: "oldPrice",  type: "uint256" },
    { indexed: false, name: "newPrice",  type: "uint256" },
  ], name: "PriceUpdated", type: "event" },
  { anonymous: false, inputs: [
    { indexed: false, name: "newFeeBps", type: "uint256" },
  ], name: "FeeUpdated", type: "event" },
  { anonymous: false, inputs: [
    { indexed: true, name: "owner",  type: "address" },
    { indexed: false, name: "amount", type: "uint256" },
  ], name: "EmergencyWithdraw", type: "event" },

  // Write
  { inputs: [
    { name: "tokenId", type: "uint256" },
    { name: "price",   type: "uint256" },
  ], name: "listCard", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "listingId", type: "uint256" }],
    name: "purchase", outputs: [], stateMutability: "payable", type: "function" },
  { inputs: [{ name: "listingId", type: "uint256" }],
    name: "cancelListing", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "listingId", type: "uint256" }, { name: "newPrice", type: "uint256" }],
    name: "updatePrice", outputs: [], stateMutability: "nonpayable", type: "function" },

  // Read
  { inputs: [{ name: "listingId", type: "uint256" }],
    name: "getListing",
    outputs: [{ components: [
      { name: "listingId", type: "uint256" },
      { name: "seller",    type: "address" },
      { name: "tokenId",   type: "uint256" },
      { name: "cardId",    type: "string"  },
      { name: "price",     type: "uint256" },
      { name: "active",    type: "bool"    },
    ], type: "tuple" }],
    stateMutability: "view", type: "function" },
  { inputs: [{ name: "fromId", type: "uint256" }, { name: "count", type: "uint256" }],
    name: "getActiveListings",
    outputs: [
      { components: [
        { name: "listingId", type: "uint256" },
        { name: "seller",    type: "address" },
        { name: "tokenId",   type: "uint256" },
        { name: "cardId",    type: "string"  },
        { name: "price",     type: "uint256" },
        { name: "active",    type: "bool"    },
      ], name: "result", type: "tuple[]" },
      { name: "total", type: "uint256" },
    ],
    stateMutability: "view", type: "function" },
  { inputs: [{ name: "", type: "address" }, { name: "", type: "uint256" }],
    name: "sellerTokenListing", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [],
    name: "feeBps", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [],
    name: "nextListingId", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [],
    name: "arcCards", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
]
