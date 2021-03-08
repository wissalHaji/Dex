// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.8.0;
pragma experimental ABIEncoderV2;

import "../node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../node_modules/@openzeppelin/contracts/math/SafeMath.sol";

/**
 * 1. build token registry to record all tokens used in DEX
 * 2. build the DEX wallet that keeps track of spent tokens and
 *   allow users to send and withdraw tokens.
 */

contract Dex {
    using SafeMath for uint256;

    // Token reggistry
    struct Token {
        bytes32 ticker;
        address tokenAddress;
    }
    mapping(bytes32 => Token) public tokens;
    bytes32[] public tokenList; 

    // Dex Wallet
    mapping(address => mapping(bytes32 => uint256)) public traderBalances;

    // Orders-
    enum Side {BUY, SELL}

    struct Order {
        uint256 id;
        Side side;
        address trader;
        bytes32 ticker;
        uint256 amount;
        uint256 filled;
        uint256 price;
        uint256 date;
    }
    // Order book
    // buy orders sorted in decreasing order
    // sell order sorted in increasing order
    mapping(bytes32 => mapping(Side => Order[])) orderBook;

    event NewTrade(
        uint256 tradeId,
        uint256 orderId,
        bytes32 indexed ticker,
        address indexed trader1,
        address indexed trader2,
        uint256 amount,
        uint256 price,
        uint256 date
    );

    address private admin;
    bytes32 constant DAI = bytes32("DAI");
    uint256 public nextOrderId;
    uint256 public nextTradeId;

    constructor() {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Access restricted only to admin");
        _;
    }

    modifier tokenExists(bytes32 ticker) {
        require(
            tokens[ticker].tokenAddress != address(0),
            "this token does not exist"
        );
        _;
    }

    modifier tokenIsNotDai(bytes32 ticker) {
        require(ticker != DAI, "cannot trade DAI");
        _;
    }

    function addToken(bytes32 ticker, address tokenAddress) external onlyAdmin {
        tokens[ticker] = Token(ticker, tokenAddress);
        tokenList.push(ticker);
    }

    function deposit(uint256 amount, bytes32 ticker)
        external
        tokenExists(ticker)
    {
        IERC20(tokens[ticker].tokenAddress).transferFrom(
            msg.sender,
            address(this),
            amount
        );
        traderBalances[msg.sender][ticker] = traderBalances[msg.sender][ticker]
            .add(amount);
    }

    function withdraw(uint256 amount, bytes32 ticker)
        external
        tokenExists(ticker)
    {
        require(
            traderBalances[msg.sender][ticker] >= amount,
            "Balance not enough."
        );
        IERC20(tokens[ticker].tokenAddress).transfer(msg.sender, amount);
        traderBalances[msg.sender][ticker] = traderBalances[msg.sender][ticker]
            .sub(amount);
    }

    // if BUY user should have enough balance
    // if SELL user should have the amount to sell from the ticker
    function createLimitOrder(
        Side side,
        bytes32 ticker,
        uint256 amount,
        uint256 price
    ) external tokenExists(ticker) tokenIsNotDai(ticker) {
        if (side == Side.SELL) {
            require(
                traderBalances[msg.sender][ticker] >= amount,
                "NOT enough token in balance."
            );
        } else {
            require(
                traderBalances[msg.sender][DAI] >= price.mul(amount),
                "DAI balance too low."
            );
        }
        Order[] storage orders = orderBook[ticker][side];
        orders.push(
            Order(
                nextOrderId,
                side,
                msg.sender,
                ticker,
                amount,
                0,
                price,
                block.timestamp
            )
        );
        // sort the array
        // if SELL ascendant - IF BUY descendant
        uint256 i = (orders.length > 0) ? orders.length.sub(1) : 0;
        while (i > 0) {
            if (side == Side.SELL && orders[i].price > orders[i - 1].price)
                break;
            if (side == Side.BUY && orders[i].price < orders[i - 1].price)
                break;
            Order memory temp = orders[i - 1];
            orders[i - 1] = orders[i];
            orders[i] = temp;
            i = i.sub(1);
        }
        nextOrderId = nextOrderId.add(1);
    }

    // scan the order book to match the market order
    // with limit orders that can best fill the order
    function createMarketOrder(
        bytes32 ticker,
        uint256 amount,
        Side side
    ) external tokenExists(ticker) tokenIsNotDai(ticker) {
        if (side == Side.SELL) {
            require(
                traderBalances[msg.sender][ticker] >= amount,
                "NOT enough token in balance."
            );
        }
        Order[] storage orders =
            orderBook[ticker][side == Side.BUY ? Side.SELL : Side.BUY];
        uint256 i;
        uint256 remaining = amount; //how much tokens remaining in the market order
        // Matching algorithm -- while the order is not completely filled
        while (i < orders.length && remaining > 0) {
            uint256 available = orders[i].amount.sub(orders[i].filled);
            uint256 matched = (remaining > available) ? available : remaining;
            remaining = remaining.sub(matched);
            orders[i].filled = orders[i].filled.add(matched);
            emit NewTrade(
                nextTradeId,
                orders[i].id,
                ticker,
                orders[i].trader,
                msg.sender,
                matched,
                orders[i].price,
                block.timestamp
            );
            //update the token balance for the two traders
            // If buy market order == BUY -> decrease trader 2 and increase trader 1
            // If sell market order == SELL -> increase trader 2 and decrease trader 1
            if (side == Side.SELL) {
                traderBalances[msg.sender][ticker] = traderBalances[msg.sender][
                    ticker
                ]
                    .sub(matched);
                traderBalances[msg.sender][DAI] = traderBalances[msg.sender][
                    DAI
                ]
                    .add(matched.mul(orders[i].price));
                traderBalances[orders[i].trader][ticker] = traderBalances[
                    orders[i].trader
                ][ticker]
                    .add(matched);
                traderBalances[orders[i].trader][DAI] = traderBalances[
                    orders[i].trader
                ][DAI]
                    .sub(matched.mul(orders[i].price));
            }
            if (side == Side.BUY) {
                require(
                    traderBalances[msg.sender][DAI] >=
                        matched * orders[i].price,
                    "Not enough DAI in balance"
                );
                traderBalances[msg.sender][ticker] = traderBalances[msg.sender][
                    ticker
                ]
                    .add(matched);
                traderBalances[msg.sender][DAI] = traderBalances[msg.sender][
                    DAI
                ]
                    .sub(matched.mul(orders[i].price));
                traderBalances[orders[i].trader][ticker] = traderBalances[
                    orders[i].trader
                ][ticker]
                    .sub(matched);
                traderBalances[orders[i].trader][DAI] = traderBalances[
                    orders[i].trader
                ][DAI]
                    .add(matched.mul(orders[i].price));
            }
            nextTradeId = nextTradeId.add(1);
            i = i.add(1);
        }
        // clear the order book from the filled orders
        // delete filled order by shifting the remaining orders
        i = 0;
        while (i < orders.length && orders[i].filled == orders[i].amount) {
            for (uint256 j = i; j < orders.length - 1; j++) {
                orders[j] = orders[j + 1];
            }
            orders.pop();
            i++;
        }
    }

    function getOrders(bytes32 ticker, Side side)
        external
        view
        returns (Order[] memory)
    {
        return orderBook[ticker][side];
    }

    function getTokens() external view returns (Token[] memory) {
        Token[] memory _tokens = new Token[](tokenList.length);
        for (uint256 i = 0; i < tokenList.length; i++) {
            _tokens[i] = Token(
                tokens[tokenList[i]].ticker,
                tokens[tokenList[i]].tokenAddress
            );
        }
        return _tokens;
    }
}
