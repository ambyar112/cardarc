// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ArcCards Public Mint ERC-1155
contract ArcCards {
    string public name = "ArcCards";
    string public symbol = "ARC";

    mapping(uint256 => string) private _uri;
    mapping(address => mapping(uint256 => uint256)) private _balances;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    mapping(string => uint256) public cardToTokenId;
    mapping(uint256 => string) public tokenIdToCard;
    mapping(uint256 => uint256) private _totalSupply;

    uint256 private _nextTokenId = 1;
    uint256 public mintFee = 0;

    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
    event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values);
    event URI(string value, uint256 indexed id);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event CardMinted(address indexed to, string cardId, uint256 tokenId);
    event MintFeeUpdated(uint256 fee);

    constructor() {
        _setURI("https://cardarc.vercel.app/api/metadata/{id}");
    }

    function setURI(string calldata newuri) external {
        _setURI(newuri);
    }
    function _setURI(string memory newuri) internal {
        _uri[0] = newuri;
        emit URI(newuri, 0);
    }
    function uri(uint256 id) public view returns (string memory) {
        string memory base = _uri[0];
        bytes memory b = bytes(base);
        bytes memory result = new bytes(b.length);
        for (uint256 i = 0; i < b.length; i++) result[i] = b[i];
        bytes memory tokenHex = bytes(hex(id));
        uint256 start = 0;
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] == '{') {
                start = i + 1;
                break;
            }
        }
        if (start > 0) {
            result = new bytes(start - 1 + tokenHex.length + 1);
            for (uint256 i = 0; i < start - 1; i++) result[i] = b[i];
            for (uint256 i = 0; i < tokenHex.length; i++) result[start - 1 + i] = tokenHex[i];
            result[start - 1 + tokenHex.length] = '}';
        }
        return string(result);
    }

    function mintFeeSet(uint256 fee) external {
        mintFee = fee;
        emit MintFeeUpdated(fee);
    }

    function balanceOf(address account, uint256 id) public view returns (uint256) {
        return _balances[account][id];
    }

    function balanceOfBatch(address[] calldata accounts, uint256[] calldata ids) external view returns (uint256[] memory) {
        require(accounts.length == ids.length, "batch length mismatch");
        uint256[] memory amounts = new uint256[](accounts.length);
        for (uint256 i = 0; i < accounts.length; i++) {
            amounts[i] = _balances[accounts[i]][ids[i]];
        }
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

    function mintCard(string calldata cardId) external payable {
        if (mintFee > 0) {
            require(msg.value >= mintFee, "Insufficient mint fee");
        }
        uint256 tokenId = _getOrCreateTokenId(cardId);
        _mint(msg.sender, tokenId, 1, "");
        _totalSupply[tokenId]++;
        emit CardMinted(msg.sender, cardId, tokenId);
    }

    function mintCardBatch(string[] calldata cardIds) external payable {
        require(cardIds.length > 0 && cardIds.length <= 100, "Batch: 1-100");
        if (mintFee > 0) {
            require(msg.value >= mintFee * cardIds.length, "Insufficient mint fee");
        }
        uint256[] memory ids = new uint256[](cardIds.length);
        for (uint256 i = 0; i < cardIds.length; i++) {
            uint256 tokenId = _getOrCreateTokenId(cardIds[i]);
            ids[i] = tokenId;
            _mint(msg.sender, tokenId, 1, "");
            _totalSupply[tokenId]++;
            emit CardMinted(msg.sender, cardIds[i], tokenId);
        }
        emit TransferBatch(msg.sender, address(0), msg.sender, ids, new uint256[](cardIds.length));
    }

    function totalSupply(uint256 id) external view returns (uint256) {
        return _totalSupply[id];
    }

    function cardBalance(address account, string calldata cardId) external view returns (uint256) {
        uint256 tokenId = cardToTokenId[cardId];
        if (tokenId == 0) return 0;
        return _balances[account][tokenId];
    }

    function _mint(address to, uint256 id, uint256 amount, bytes memory) internal {
        _balances[to][id] += amount;
        emit TransferSingle(msg.sender, address(0), to, id, amount);
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
