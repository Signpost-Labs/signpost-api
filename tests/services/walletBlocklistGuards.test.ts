import { blocklistWallet, unblocklistWallet } from '../../src/services/walletBlocklist';
import { blockWalletDb, unblockWalletDb } from '../../src/db';

describe('wallet_blocklist guards (issue #109)', () => {
  it('blocklistWallet rejects empty or whitespace wallet', async () => {
    await expect(blocklistWallet('')).rejects.toThrow('wallet cannot be empty');
    await expect(blocklistWallet('   ')).rejects.toThrow('wallet cannot be empty');
  });

  it('blocklistWallet rejects reason exceeding 500 characters', async () => {
    const longReason = 'x'.repeat(501);
    await expect(blocklistWallet('G_TEST_WALLET', longReason)).rejects.toThrow(
      'reason length cannot exceed 500 characters'
    );
  });

  it('unblocklistWallet rejects empty wallet', async () => {
    await expect(unblocklistWallet('')).rejects.toThrow('wallet cannot be empty');
  });

  it('blockWalletDb rejects empty wallet and over-length reason', async () => {
    await expect(blockWalletDb('', 'reason')).rejects.toThrow('wallet cannot be empty');
    await expect(blockWalletDb('G_TEST_WALLET', 'x'.repeat(501))).rejects.toThrow(
      'reason length cannot exceed 500 characters'
    );
  });

  it('unblockWalletDb rejects empty wallet', async () => {
    await expect(unblockWalletDb('')).rejects.toThrow('wallet cannot be empty');
  });
});
