/**
 * QRIS Auto-Payment Notifier & Webhook Listener Utility
 * Provides real-time polling, webhook simulation, audio chimes, and Indonesian Text-to-Speech
 */
import { Transaction } from '../types';
import { playSuccessSound } from './audio';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export interface QRISPaymentPayload {
  txId: string;
  invoiceNo: string;
  amount: number;
  paymentMethod: 'qris';
  paidAt: string;
  referenceNo?: string;
  payerName?: string;
  issuer?: string; // e.g. BCA, Gopay, OVO, ShopeePay, Dana
}

type QRISCallback = (payload: QRISPaymentPayload) => void;

// In-memory active listeners
const activeListeners = new Map<string, () => void>();
const qrisBroadcastChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('sq_qris_payments')
  : null;

/**
 * Play Audio Chime and Indonesian Text-to-Speech (TTS) Voice for QRIS Success
 */
export const playQRISSuccessSound = (amount: number, customMessage?: string): void => {
  try {
    // 1. Play Web Audio API Chime
    if (typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const audioCtx = new AudioContextClass();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = 'sine';
        // Melodic Chime C5 (523.25 Hz) -> G5 (783.99 Hz) -> C6 (1046.5 Hz)
        const now = audioCtx.currentTime;
        oscillator.frequency.setValueAtTime(523.25, now);
        oscillator.frequency.setValueAtTime(783.99, now + 0.15);
        oscillator.frequency.setValueAtTime(1046.5, now + 0.3);

        gainNode.gain.setValueAtTime(0.25, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start(now);
        oscillator.stop(now + 0.65);
      }
    }

    // 2. Indonesian Text-to-Speech (TTS)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Stop any pending speech
      const formattedAmount = amount.toLocaleString('id-ID');
      const textToSpeak = customMessage || `Pembayaran QRIS berhasil sebesar ${formattedAmount} rupiah.`;
      
      const speech = new SpeechSynthesisUtterance(textToSpeak);
      speech.lang = 'id-ID';
      speech.rate = 1.0;
      speech.pitch = 1.0;
      
      // Select Indonesian voice if available
      const voices = window.speechSynthesis.getVoices();
      const idVoice = voices.find(v => v.lang.includes('id') || v.lang.includes('ID') || v.name.toLowerCase().includes('indonesia'));
      if (idVoice) {
        speech.voice = idVoice;
      }

      window.speechSynthesis.speak(speech);
    }
  } catch (err) {
    console.debug('QRIS Audio/TTS error:', err);
    // Fallback to basic audio utility
    playSuccessSound(amount, customMessage);
  }
};

/**
 * Trigger or broadcast a verified QRIS payment event (from Webhook / Simulation / Partner Callback)
 */
export const dispatchQRISPaymentSuccess = (payload: QRISPaymentPayload): void => {
  if (typeof window === 'undefined') return;

  // 1. Post to local BroadcastChannel for multi-tab sync
  if (qrisBroadcastChannel) {
    try {
      qrisBroadcastChannel.postMessage({ type: 'QRIS_PAID', payload });
    } catch (e) {}
  }

  // 2. Dispatch custom Window event for local component listeners
  const event = new CustomEvent('sq_qris_paid', { detail: payload });
  window.dispatchEvent(event);

  // 3. Mark transaction status in sessionStorage / localStorage for quick lookup
  try {
    const paidList = JSON.parse(sessionStorage.getItem('sq_paid_qris_txs') || '[]');
    if (!paidList.includes(payload.txId)) {
      paidList.push(payload.txId);
      sessionStorage.setItem('sq_paid_qris_txs', JSON.stringify(paidList));
    }
  } catch (e) {}
};

/**
 * Start listening for QRIS payment status via Polling + Webhook/Broadcast listeners + Firestore Snapshot
 */
export const startQRISPaymentWatcher = (
  tx: Transaction,
  onPaid: (payload: QRISPaymentPayload) => void,
  options?: { pollIntervalMs?: number; timeoutMs?: number }
): (() => void) => {
  const txId = tx.id;
  const pollInterval = options?.pollIntervalMs || 2500;
  let isSubscribed = true;
  let pollTimer: any = null;
  let firestoreUnsub: (() => void) | null = null;

  // Handler when payment detected
  const handlePaymentDetected = (payload: QRISPaymentPayload) => {
    if (!isSubscribed) return;
    isSubscribed = false;
    cleanup();
    onPaid(payload);
  };

  // A. Window Event Listener (Local / Simulated / Webhook bridge)
  const onLocalEvent = (e: any) => {
    const detail = e.detail as QRISPaymentPayload;
    if (detail && (detail.txId === txId || detail.invoiceNo === tx.invoiceNo)) {
      handlePaymentDetected(detail);
    }
  };
  window.addEventListener('sq_qris_paid', onLocalEvent);

  // B. BroadcastChannel Listener (Multi-tab or background worker)
  const onBroadcastMessage = (e: MessageEvent) => {
    if (e.data?.type === 'QRIS_PAID' && e.data?.payload) {
      const p = e.data.payload as QRISPaymentPayload;
      if (p.txId === txId || p.invoiceNo === tx.invoiceNo) {
        handlePaymentDetected(p);
      }
    }
  };
  if (qrisBroadcastChannel) {
    qrisBroadcastChannel.addEventListener('message', onBroadcastMessage);
  }

  // C. Firestore Real-time Snapshot Watcher (if synced to cloud)
  try {
    if (db && txId) {
      const txRef = doc(db, 'transactions', txId);
      firestoreUnsub = onSnapshot(txRef, (snapshot) => {
        if (!isSubscribed) return;
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data && (data.status === 'completed' || data.paymentStatus === 'paid' || data.isPaid === true)) {
            handlePaymentDetected({
              txId,
              invoiceNo: tx.invoiceNo || `INV-${txId}`,
              amount: tx.total,
              paymentMethod: 'qris',
              paidAt: new Date().toISOString(),
              referenceNo: data.qrisRefNo || `REF-QRIS-${Date.now().toString().slice(-6)}`,
              issuer: data.qrisIssuer || 'QRIS Merchant',
            });
          }
        }
      }, (err) => {
        console.debug('Firestore QRIS watcher non-blocking error:', err);
      });
    }
  } catch (e) {
    // Non-blocking
  }

  // D. Polling Fallback: Check local storage / session verification
  pollTimer = setInterval(() => {
    if (!isSubscribed) return;
    try {
      const paidList = JSON.parse(sessionStorage.getItem('sq_paid_qris_txs') || '[]');
      if (paidList.includes(txId)) {
        handlePaymentDetected({
          txId,
          invoiceNo: tx.invoiceNo || `INV-${txId}`,
          amount: tx.total,
          paymentMethod: 'qris',
          paidAt: new Date().toISOString(),
          referenceNo: `QRIS-${Date.now().toString().slice(-6)}`,
          issuer: 'QRIS Auto-Sync',
        });
      }
    } catch (e) {}
  }, pollInterval);

  // Cleanup function
  const cleanup = () => {
    isSubscribed = false;
    if (pollTimer) clearInterval(pollTimer);
    window.removeEventListener('sq_qris_paid', onLocalEvent);
    if (qrisBroadcastChannel) {
      qrisBroadcastChannel.removeEventListener('message', onBroadcastMessage);
    }
    if (firestoreUnsub) {
      try {
        firestoreUnsub();
      } catch (e) {}
    }
    activeListeners.delete(txId);
  };

  activeListeners.set(txId, cleanup);
  return cleanup;
};

/**
 * Stop any active payment watcher for a transaction ID
 */
export const stopQRISPaymentWatcher = (txId: string): void => {
  const cleanup = activeListeners.get(txId);
  if (cleanup) {
    cleanup();
  }
};
