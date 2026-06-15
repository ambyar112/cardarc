// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title ArcCards ERC-1155
/// @notice Card NFT — only approved minters can mint (owner, marketplace, or backend).
///         selfMint has been REMOVED to prevent permissionless free minting exploits.
contract ArcCards is ERC1155, Ownable {
    string public name = "ArcCards";

    mapping(string => uint256) public cardToTokenId;
    mapping(uint256 => string) public tokenIdToCard;
    mapping(uint256 => uint256) private _totalSupply;

    uint256 private _nextTokenId = 1;

    // Approved minters (e.g. marketplace, gacha backend)
    mapping(address => bool) public approvedMinters;

    // Mint nonces — prevents replay attacks on claimMint
    mapping(bytes32 => bool) public usedNonces;

    event CardMinted(address indexed to, string cardId, uint256 tokenId);
    event MinterUpdated(address indexed minter, bool approved);

    constructor() ERC1155("https://cardarc.vercel.app/api/metadata/{id}") {}

    modifier onlyMinter() {
        require(
            msg.sender == owner() || approvedMinters[msg.sender],
            "Not authorized minter"
        );
        _;
    }

    function setApprovedMinter(address minter, bool approved) external onlyOwner {
        approvedMinters[minter] = approved;
        emit MinterUpdated(minter, approved);
    }

    /// @notice Mint 1 card — callable by owner or approved minters only
    function mintCard(address to, string calldata cardId) external onlyMinter {
        uint256 tokenId = _getOrCreateTokenId(cardId);
        _mint(to, tokenId, 1, "");
        _totalSupply[tokenId]++;
        emit CardMinted(to, cardId, tokenId);
    }

    /// @notice Batch mint — callable by owner or approved minters only
    function mintCardBatch(address to, string[] calldata cardIds) external onlyMinter {
        uint256 len = cardIds.length;
        require(len > 0 && len <= 100, "Batch: 1-100 cards only");
        uint256[] memory ids     = new uint256[](len);
        uint256[] memory amounts = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            uint256 tokenId = _getOrCreateTokenId(cardIds[i]);
            ids[i]     = tokenId;
            amounts[i] = 1;
            _totalSupply[tokenId]++;
            emit CardMinted(to, cardIds[i], tokenId);
        }
        _mintBatch(to, ids, amounts, "");
    }

    /// @notice Claim mint via backend-signed voucher.
    ///         Backend signs (recipient, cardId, nonce) — prevents free minting
    ///         without server authorization, while allowing gasless gacha flow.
    function claimMint(
        string calldata cardId,
        bytes32 nonce,
        bytes calldata signature
    ) external {
        require(!usedNonces[nonce], "Nonce already used");

        // Verify signature — must be signed by owner (backend)
        bytes32 hash = keccak256(
            abi.encodePacked(msg.sender, cardId, nonce)
        );
        bytes32 ethHash = _toEthSignedMessageHash(hash);
        address signer  = _recoverSigner(ethHash, signature);
        require(signer == owner(), "Invalid mint signature");

        usedNonces[nonce] = true;

        uint256 tokenId = _getOrCreateTokenId(cardId);
        _mint(msg.sender, tokenId, 1, "");
        _totalSupply[tokenId]++;
        emit CardMinted(msg.sender, cardId, tokenId);
    }

    function cardBalance(address account, string calldata cardId) external view returns (uint256) {
        uint256 tokenId = cardToTokenId[cardId];
        if (tokenId == 0) return 0;
        return balanceOf(account, tokenId);
    }

    function totalSupply(uint256 id) external view returns (uint256) {
        return _totalSupply[id];
    }

    function setURI(string calldata newuri) external onlyOwner {
        _setURI(newuri);
    }

    // ─── Internal helpers ──────────────────────────────────────

    function _getOrCreateTokenId(string memory cardId) internal returns (uint256) {
        require(bytes(cardId).length > 0, "Empty cardId");
        if (cardToTokenId[cardId] != 0) return cardToTokenId[cardId];
        uint256 tokenId = _nextTokenId++;
        cardToTokenId[cardId]  = tokenId;
        tokenIdToCard[tokenId] = cardId;
        return tokenId;
    }

    function _toEthSignedMessageHash(bytes32 hash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }

    function _recoverSigner(bytes32 ethHash, bytes memory sig) internal pure returns (address) {
        require(sig.length == 65, "Invalid signature length");
        bytes32 r;
        bytes32 s;
        uint8   v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        if (v < 27) v += 27;
        return ecrecover(ethHash, v, r, s);
    }
}
