// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ArcCardsPublic {
    string public name = "ArcCards";
    string public symbol = "ARC";
    string public baseURI;

    mapping(string => uint256) public cardToTokenId;
    mapping(uint256 => string) public tokenIdToCard;
    mapping(uint256 => uint256) private _totalSupply;
    mapping(address => mapping(uint256 => uint256)) private _balances;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    uint256 private _nextTokenId = 1;

    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
    event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values);
    event URI(string value, uint256 indexed id);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event CardMinted(address indexed to, string cardId, uint256 tokenId);

    constructor(string memory uri_) {
        baseURI = uri_;
        emit URI(uri_, 0);
    }

    function setURI(string calldata newuri) external {
        baseURI = newuri;
        emit URI(newuri, 0);
    }

    function uri(uint256 id) external view returns (string memory) {
        return string.concat(baseURI, _toString(id));
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        bytes memory tmp = new bytes(32);
        uint256 i = 32;
        uint256 v = value;
        while (v > 0) {
            i--;
            uint8 digit = uint8(v % 10);
            tmp[i] = bytes1(digit + 0x30);
            v /= 10;
        }
        bytes memory out = new bytes(32 - i);
        for (uint256 j = 0; j < out.length; j++) out[j] = tmp[i + j];
        return string(out);
    }

    function mintCard(string calldata cardId) external {
        uint256 tokenId = _getOrCreateTokenId(cardId);
        _mint(msg.sender, tokenId, 1, "");
        _totalSupply[tokenId]++;
        emit CardMinted(msg.sender, cardId, tokenId);
    }

    function mintCardBatch(string[] calldata cardIds) external {
        uint256 len = cardIds.length;
        require(len > 0 && len <= 100, "Batch: 1-100 only");
        uint256[] memory ids = new uint256[](len);
        uint256[] memory amounts = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            uint256 tokenId = _getOrCreateTokenId(cardIds[i]);
            ids[i] = tokenId;
            amounts[i] = 1;
            _totalSupply[tokenId]++;
            emit CardMinted(msg.sender, cardIds[i], tokenId);
        }
        _mintBatch(msg.sender, ids, amounts, "");
    }

    function balanceOf(address account, uint256 id) external view returns (uint256) {
        return _balances[account][id];
    }

    function balanceOfBatch(address[] calldata accounts, uint256[] calldata ids) external view returns (uint256[] memory) {
        require(accounts.length == ids.length, "batch length mismatch");
        uint256[] memory amounts = new uint256[](accounts.length);
        for (uint256 i = 0; i < accounts.length; i++) { amounts[i] = _balances[accounts[i]][ids[i]]; }
        return amounts;
    }

    function isApprovedForAll(address owner, address operator) external view returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata) external {
        require(from == msg.sender || _operatorApprovals[from][msg.sender], "not approved");
        _transfer(from, to, id, amount);
    }

    function safeBatchTransferFrom(address from, address to, uint256[] calldata ids, uint256[] calldata amounts, bytes calldata) external {
        require(from == msg.sender || _operatorApprovals[from][msg.sender], "not approved");
        _transferBatch(from, to, ids, amounts);
    }

    function _transfer(address from, address to, uint256 id, uint256 amount) internal {
        require(to != address(0), "transfer to zero");
        require(_balances[from][id] >= amount, "insufficient balance");
        _balances[from][id] -= amount;
        _balances[to][id] += amount;
        emit TransferSingle(msg.sender, from, to, id, amount);
    }

    function _transferBatch(address from, address to, uint256[] memory ids, uint256[] memory amounts) internal {
        require(to != address(0), "batch transfer to zero");
        require(ids.length == amounts.length, "mismatch");
        for (uint256 i = 0; i < ids.length; i++) {
            require(_balances[from][ids[i]] >= amounts[i], "batch insufficient balance");
            _balances[from][ids[i]] -= amounts[i];
            _balances[to][ids[i]] += amounts[i];
        }
        emit TransferBatch(msg.sender, from, to, ids, amounts);
    }

    function _mint(address to, uint256 id, uint256 amount, bytes memory) internal {
        _balances[to][id] += amount;
        emit TransferSingle(msg.sender, address(0), to, id, amount);
    }

    function _mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bytes memory) internal {
        for (uint256 i = 0; i < ids.length; i++) { _mint(to, ids[i], amounts[i], ""); }
    }

    function _getOrCreateTokenId(string memory cardId) internal returns (uint256) {
        require(bytes(cardId).length > 0, "Empty cardId");
        if (cardToTokenId[cardId] == 0) {
            uint256 tokenId = _nextTokenId++;
            cardToTokenId[cardId] = tokenId;
            tokenIdToCard[tokenId] = cardId;
        }
        return cardToTokenId[cardId];
    }
}
