// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.8.0;

import "./MockERC20.sol";

contract Zrx is MockERC20 {
    constructor() ERC20("0x token", "ZRX") {}
}
