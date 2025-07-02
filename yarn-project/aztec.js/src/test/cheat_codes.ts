import { EthCheatCodes } from '@aztec/ethereum/eth-cheatcodes';
import type { L1ContractAddresses } from '@aztec/ethereum/l1-contract-addresses';
import { getCanonicalFeeJuice } from '@aztec/protocol-contracts/fee-juice';
import { AztecAddress } from '@aztec/stdlib/aztec-address';
import type { PXE } from '@aztec/stdlib/interfaces/client';

import { Contract } from '../contract/contract.js';
import type { Wallet } from '../wallet/wallet.js';
import { AztecCheatCodes } from './aztec_cheat_codes.js';
import { RollupCheatCodes } from './rollup_cheat_codes.js';

/**
 * A class that provides utility functions for interacting with the chain.
 */
export class CheatCodes {
  constructor(
    /** Cheat codes for L1.*/
    public eth: EthCheatCodes,
    /** Cheat codes for Aztec L2. */
    public aztec: AztecCheatCodes,
    /** Cheat codes for the Aztec Rollup contract on L1. */
    public rollup: RollupCheatCodes,
  ) {}

  static async create(rpcUrls: string[], pxe: PXE): Promise<CheatCodes> {
    const ethCheatCodes = new EthCheatCodes(rpcUrls);
    const aztecCheatCodes = new AztecCheatCodes(pxe);
    const rollupCheatCodes = new RollupCheatCodes(
      ethCheatCodes,
      await pxe.getNodeInfo().then(n => n.l1ContractAddresses),
    );
    return new CheatCodes(ethCheatCodes, aztecCheatCodes, rollupCheatCodes);
  }

  static createRollup(rpcUrls: string[], addresses: Pick<L1ContractAddresses, 'rollupAddress'>): RollupCheatCodes {
    const ethCheatCodes = new EthCheatCodes(rpcUrls);
    return new RollupCheatCodes(ethCheatCodes, addresses);
  }

  /**
   * Warps the L1 timestamp to a target timestamp and mines an L2 block that advances the L2 timestamp to at least
   * the target timestamp. L2 timestamp is not advanced exactly to the target timestamp because it is determined
   * by the slot number, which advances in fixed intervals.
   * This is useful for testing time-dependent contract behavior.
   * @param wallet - The wallet to use for sending the L2 transaction
   * @param targetTimestamp - The target timestamp to warp to (in seconds)
   */
  async warpL2TimeAtLeastTo(wallet: Wallet, targetTimestamp: bigint | number) {
    // We warp the L1 timestamp
    await this.eth.warp(targetTimestamp, { resetBlockInterval: true });

    // Now we mine an L2 block for the L2 timestamp to advance. We achieve that by sending a tx interacting with
    // an arbitrary contract (in our case the fee juice contract).
    const feeJuice = await getCanonicalFeeJuice();
    const contract = await Contract.at(feeJuice.address, feeJuice.artifact, wallet);
    await contract.methods.balance_of_public(AztecAddress.ZERO).send().wait();
  }

  /**
   * Warps the L1 timestamp forward by a specified duration and mines an L2 block that advances the L2 timestamp at
   * least by the duration. L2 timestamp is not advanced exactly by the duration because it is determined by the slot
   * number, which advances in fixed intervals.
   * This is useful for testing time-dependent contract behavior.
   * @param wallet - The wallet to use for sending the L2 transaction
   * @param duration - The duration to advance time by (in seconds)
   */
  async warpL2TimeAtLeastBy(wallet: Wallet, duration: bigint | number) {
    const currentTimestamp = await this.eth.timestamp();
    const targetTimestamp = BigInt(currentTimestamp) + BigInt(duration);
    await this.warpL2TimeAtLeastTo(wallet, targetTimestamp);
  }
}
