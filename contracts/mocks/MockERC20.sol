// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.8.0;

import "../../node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol";

abstract contract MockERC20 is ERC20 {

    function faucet(address to, uint256 amount) external {
        _mint(to, amount);
    }
}