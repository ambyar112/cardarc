// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @dev Minimal interface to verify cardId <-> tokenId on ArcCards
interface IArcCards is IERC1155 {
    function tokenIdToCard(uint256 tokenId) external view returns (string memory);
}

/// @title ArcMarketplace
/// @notice Escrow-based marketplace for ArcCards ERC-1155 NFTs.
///         Fixes: cardId is now verified on-chain against tokenId to prevent spoofing.
///                Emergency withdraw now emits an event for auditability.
contract ArcMarketplace is ERC1155Holder, Ownable, ReentrancyGuard {

    IArcCards public immutable arcCards;

    uint256 public feeBps = 250; // 2.5% platform fee (250 basis points)
    address public feeRecipient;

    uint256 private _nextListingId = 1;

    struct Listing {
        uint256 listingId;
        address seller;
        uint256 tokenId;
        string  cardId;
        uint256 price;     // in wei (native token)
        bool    active;
    }

    mapping(uint256 => Listing) public listings;
    // seller => tokenId => listingId (0 = not listed)
    mapping(address => mapping(uint256 => uint256)) public sellerTokenListing;

    event Listed(uint256 indexed listingId, address indexed seller, uint256 tokenId, string cardId, uint256 price);
    event Purchased(uint256 indexed listingId, address indexed buyer, address indexed seller, uint256 price);
    event Cancelled(uint256 indexed listingId, address indexed seller);
    event PriceUpdated(uint256 indexed listingId, uint256 oldPrice, uint256 newPrice);
    event FeeUpdated(uint256 newFeeBps);
    event FeeRecipientUpdated(address indexed newRecipient);
    event EmergencyWithdraw(address indexed owner, uint256 amount);

    constructor(address _arcCards) {
        arcCards     = IArcCards(_arcCards);
        feeRecipient = msg.sender;
        _transferOwnership(msg.sender);
    }

    // ─────────────────────────────────────────────────────────
    // LISTING
    // ─────────────────────────────────────────────────────────

    /// @notice List a card for sale. Card is transferred to escrow.
    /// @param tokenId  The ERC-1155 token ID
    /// @param cardId   The string card identifier (e.g. "ygo-12345") — verified on-chain
    /// @param price    Sale price in wei
    function listCard(uint256 tokenId, string calldata cardId, uint256 price) external nonReentrant {
        require(price > 0, "Price must be > 0");
        require(arcCards.balanceOf(msg.sender, tokenId) >= 1, "You don't own this card");
        require(sellerTokenListing[msg.sender][tokenId] == 0, "Already listed");

        // ✅ FIX SC-02: Verify cardId matches tokenId on-chain — prevents metadata spoofing
        string memory onChainCardId = arcCards.tokenIdToCard(tokenId);
        require(
            keccak256(bytes(onChainCardId)) == keccak256(bytes(cardId)),
            "cardId does not match tokenId"
        );

        // Transfer card from seller to this contract (escrow)
        arcCards.safeTransferFrom(msg.sender, address(this), tokenId, 1, "");

        uint256 listingId = _nextListingId++;
        listings[listingId] = Listing({
            listingId: listingId,
            seller:    msg.sender,
            tokenId:   tokenId,
            cardId:    cardId,
            price:     price,
            active:    true
        });
        sellerTokenListing[msg.sender][tokenId] = listingId;

        emit Listed(listingId, msg.sender, tokenId, cardId, price);
    }

    // ─────────────────────────────────────────────────────────
    // PURCHASE
    // ─────────────────────────────────────────────────────────

    /// @notice Buy a listed card. Send exact price as msg.value.
    function purchase(uint256 listingId) external payable nonReentrant {
        Listing storage l = listings[listingId];
        require(l.active, "Listing not active");
        require(msg.sender != l.seller, "Cannot buy own listing");
        require(msg.value == l.price, "Incorrect payment amount");

        // Mark inactive before transfers (CEI pattern — reentrancy safe)
        l.active = false;
        sellerTokenListing[l.seller][l.tokenId] = 0;

        // Calculate fee
        uint256 fee    = (l.price * feeBps) / 10000;
        uint256 payout = l.price - fee;

        // Transfer card to buyer
        arcCards.safeTransferFrom(address(this), msg.sender, l.tokenId, 1, "");

        // Pay seller
        (bool sellerPaid,) = payable(l.seller).call{value: payout}("");
        require(sellerPaid, "Seller payment failed");

        // Pay platform fee
        if (fee > 0) {
            (bool feePaid,) = payable(feeRecipient).call{value: fee}("");
            require(feePaid, "Fee payment failed");
        }

        emit Purchased(listingId, msg.sender, l.seller, l.price);
    }

    // ─────────────────────────────────────────────────────────
    // CANCEL
    // ─────────────────────────────────────────────────────────

    /// @notice Cancel listing and return card to seller.
    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage l = listings[listingId];
        require(l.active, "Listing not active");
        require(l.seller == msg.sender, "Not your listing");

        l.active = false;
        sellerTokenListing[l.seller][l.tokenId] = 0;

        // Return card to seller
        arcCards.safeTransferFrom(address(this), msg.sender, l.tokenId, 1, "");

        emit Cancelled(listingId, msg.sender);
    }

    // ─────────────────────────────────────────────────────────
    // UPDATE PRICE
    // ─────────────────────────────────────────────────────────

    /// @notice Update price of an active listing.
    function updatePrice(uint256 listingId, uint256 newPrice) external {
        require(newPrice > 0, "Price must be > 0");
        Listing storage l = listings[listingId];
        require(l.active, "Listing not active");
        require(l.seller == msg.sender, "Not your listing");
        uint256 old = l.price;
        l.price = newPrice;
        emit PriceUpdated(listingId, old, newPrice);
    }

    // ─────────────────────────────────────────────────────────
    // VIEW
    // ─────────────────────────────────────────────────────────

    function getListing(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }

    function getActiveListings(uint256 fromId, uint256 count) external view
        returns (Listing[] memory result, uint256 total)
    {
        Listing[] memory temp = new Listing[](count);
        uint256 found = 0;
        uint256 max   = _nextListingId - 1;
        for (uint256 i = fromId; i <= max && found < count; i++) {
            if (listings[i].active) {
                temp[found++] = listings[i];
            }
        }
        result = new Listing[](found);
        for (uint256 i = 0; i < found; i++) result[i] = temp[i];
        total = found;
    }

    // ─────────────────────────────────────────────────────────
    // ADMIN
    // ─────────────────────────────────────────────────────────

    function setFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 1000, "Max fee 10%");
        feeBps = _feeBps;
        emit FeeUpdated(_feeBps);
    }

    function setFeeRecipient(address _recipient) external onlyOwner {
        require(_recipient != address(0), "Zero address");
        feeRecipient = _recipient;
        emit FeeRecipientUpdated(_recipient);
    }

    /// @notice Emergency withdraw — ✅ FIX SC-03: now emits event for auditability
    function withdrawETH() external onlyOwner {
        uint256 amount = address(this).balance;
        require(amount > 0, "Nothing to withdraw");
        (bool ok,) = payable(owner()).call{value: amount}("");
        require(ok, "Withdraw failed");
        emit EmergencyWithdraw(owner(), amount);
    }

    function nextListingId() external view returns (uint256) {
        return _nextListingId;
    }
}
