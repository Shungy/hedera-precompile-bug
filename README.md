# Hedera HTS precompile bug

This method was used to exploit Pangolin and Heliswap on March 9, 2023: https://docs.google.com/document/d/1vuXi77o_AL9zK_Dnk0oqqgdCc0E6GMRU1SlMCEtvGec

Short of $500K were drained from Pangolin, and only about $2K from Heliswap. However, as seen from the PoC, almost entirety of Hedera DeFi ecosystem (~$30M) was vulnerable.

The exploit requires that the vulnerable contract

1. Holds HTS tokens
2. Allows a user to call an arbitrary contract within the vulnerable contract itself

All UniswapV2 forks were vulnerable due to flashloan callback that exist within the swap function: https://github.com/Uniswap/v2-core/blob/ee547b17853e71ed4e0101ccfd52e70d5acded58/contracts/UniswapV2Pair.sol#L172

The way it works is by a VulnerableContract calling AttackContract delegatecalling precompile to change HTS state as if it is the VulnerableContract. So the AttackContract can make arbitrary HTS state changes in the name of VulnerableContract. The arbitrary contract call pattern is safe in Ethereum (given reentrancy lock or CEI pattern used), because an AttackContract delegatecalling can only change its own state, even if it pretends to be the VulnerableContract (i.e. `msg.sender == VulnerableContract`). However in Hedera, HTS state is unrelated to EVM state, and delegatecalling a precompile will change the HTS state, instead of the state of the calling contract. The fix would be for precompiles to revert if called by a delegatecall.

## Test

Add Hedera testnet credentials to the `.env` file. Then do

```
yarn install
npx hardhat run scripts/testAttack.js
```

This shows that anyone can approve HTS tokens for the VulnerableContract. They can actually directly delegatecall `precompileAddres.transferTokens` to transfer tokens from the VulnerableContract to themselves as well. But this wasn't used in the attack on March 9 due to pair swap function having balances checks after the callback. So the attacker had to first do approval, then transfer out tokens in another transaction without calling the pair contract a second time.
