/**
 * lib/solana.ts
 * Solana RPC utilities — server-side ONLY.
 * NEVER import from client components or pages.
 */

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';

let _conn: Connection | null = null;

export function getConnection(): Connection {
  if (_conn) return _conn;
  const rpcUrl =
    process.env.RPC_URL_PRIVATE ||
    process.env.NEXT_PUBLIC_RPC_URL ||
    'https://api.mainnet-beta.solana.com';
  _conn = new Connection(rpcUrl, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60_000,
  });
  return _conn;
}

let _treasury: Keypair | null = null;

export function getTreasuryKeypair(): Keypair {
  if (_treasury) return _treasury;
  const raw = process.env.TREASURY_PRIVATE_KEY;
  if (!raw) throw new Error('TREASURY_PRIVATE_KEY env variable is not set');
  try {
    const bytes = JSON.parse(raw) as number[];
    if (!Array.isArray(bytes) || bytes.length !== 64) throw new Error('Must be 64 bytes');
    _treasury = Keypair.fromSecretKey(Uint8Array.from(bytes));
    return _treasury;
  } catch (e) {
    throw new Error(`TREASURY_PRIVATE_KEY invalid: ${String(e)}`);
  }
}

export function getTreasuryPublicKey(): string {
  return process.env.NEXT_PUBLIC_TREASURY_WALLET || '';
}

export interface TxValidationResult {
  valid: boolean;
  actualLamports: number;
  sender: string;
  receiver: string;
  error?: string;
}

export async function validateSolTransaction(
  txHash: string,
  expectedSenderWallet: string,
  expectedReceiverWallet: string,
  expectedLamports: number,
  toleranceLamports = 5_000,
): Promise<TxValidationResult> {
  const conn = getConnection();
  try {
    const tx = await conn.getParsedTransaction(txHash, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    });
    if (!tx) return { valid: false, actualLamports: 0, sender: '', receiver: '', error: 'Transaction not found' };
    if (tx.meta?.err) return { valid: false, actualLamports: 0, sender: '', receiver: '', error: `On-chain error: ${JSON.stringify(tx.meta.err)}` };

    const instructions = tx.transaction?.message?.instructions ?? [];
    let totalToTreasury = 0;
    let foundSender = '';
    let foundReceiver = '';

    for (const ix of instructions) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = (ix as any).parsed;
      if (parsed?.type === 'transfer' && parsed?.info?.destination === expectedReceiverWallet) {
        totalToTreasury += Number(parsed.info.lamports ?? 0);
        foundSender = String(parsed.info.source ?? '');
        foundReceiver = String(parsed.info.destination ?? '');
      }
    }

    if (!foundSender) return { valid: false, actualLamports: 0, sender: '', receiver: '', error: 'No transfer to treasury found in tx' };
    if (foundSender.toLowerCase() !== expectedSenderWallet.toLowerCase()) {
      return { valid: false, actualLamports: totalToTreasury, sender: foundSender, receiver: foundReceiver, error: `Sender mismatch: expected ${expectedSenderWallet}, got ${foundSender}` };
    }
    const diff = Math.abs(totalToTreasury - expectedLamports);
    if (diff > toleranceLamports) {
      return { valid: false, actualLamports: totalToTreasury, sender: foundSender, receiver: foundReceiver, error: `Amount mismatch: expected ${expectedLamports} lamports, got ${totalToTreasury}` };
    }
    return { valid: true, actualLamports: totalToTreasury, sender: foundSender, receiver: foundReceiver };
  } catch (e) {
    return { valid: false, actualLamports: 0, sender: '', receiver: '', error: `RPC error: ${String(e)}` };
  }
}

export interface PayoutTxResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

export async function sendSolFromTreasury(
  recipientWallet: string,
  amountSol: number,
): Promise<PayoutTxResult> {
  if (amountSol < 0.000001) return { success: false, error: `Amount too small: ${amountSol} SOL` };
  try {
    const conn = getConnection();
    const treasury = getTreasuryKeypair();
    const recipient = new PublicKey(recipientWallet);
    const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
    const balance = await conn.getBalance(treasury.publicKey, 'confirmed');
    if (balance < lamports + 10_000) {
      return { success: false, error: `Treasury balance insufficient: has ${balance} lamports, needs ${lamports + 10_000}` };
    }
    const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: treasury.publicKey, toPubkey: recipient, lamports }));
    const txHash = await sendAndConfirmTransaction(conn, tx, [treasury], { commitment: 'confirmed', maxRetries: 3 });
    return { success: true, txHash };
  } catch (e) {
    return { success: false, error: `Send failed: ${String(e)}` };
  }
}

export async function getTreasuryBalance(): Promise<number> {
  try {
    const conn = getConnection();
    const treasury = getTreasuryKeypair();
    const balance = await conn.getBalance(treasury.publicKey, 'confirmed');
    return balance / LAMPORTS_PER_SOL;
  } catch { return -1; }
}
