// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.8.0;

import "./MockERC20.sol";

contract Bat is MockERC20 {
    constructor() ERC20("brave browser token", "BAT") {}
}
