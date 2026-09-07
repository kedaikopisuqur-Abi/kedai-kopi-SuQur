import { Outlet } from '../types';

export interface WAParsedExpense {
  isValid: boolean;
  command?: string;
  amount: number;
  description: string;
  outletKeyword?: string;
  matchedOutletId?: string;
  matchedOutletName?: string;
  category: string;
  paymentMethod: 'CASH' | 'TRANSFER' | 'QRIS' | 'OTHER';
  rawMessage: string;
  senderPhone?: string;
  senderName?: string;
  error?: string;
}

/**
 * Parses numeric string supporting multiple Indonesian currency notations:
 * Examples: '50000', '50.000', '50,000', 'Rp 50.000', '50k', '50.5k', '50rb', '1.5jt', '2jt'
 */
export function parseIndonesianAmount(amountStr: string): number | null {
  if (!amountStr) return null;
  let clean = amountStr.trim().toLowerCase();

  // Remove currency prefix
  clean = clean.replace(/^rp\.?\s*/i, '').trim();

  // Handle 'jt' (juta / million)
  if (clean.endsWith('jt') || clean.endsWith('juta')) {
    const numPart = clean.replace(/jt|juta/g, '').replace(/,/g, '.').trim();
    const val = parseFloat(numPart);
    return isNaN(val) ? null : Math.round(val * 1_000_000);
  }

  // Handle 'k' / 'rb' (ribu / thousand)
  if (clean.endsWith('k') || clean.endsWith('rb') || clean.endsWith('ribu')) {
    const numPart = clean.replace(/k|rb|ribu/g, '').replace(/,/g, '.').trim();
    const val = parseFloat(numPart);
    return isNaN(val) ? null : Math.round(val * 1_000);
  }

  // Standard numeric string: remove thousand dots or commas
  // e.g. "50.000" -> "50000" or "50,000" -> "50000"
  const normalized = clean.replace(/\./g, '').replace(/,/g, '');
  const val = parseInt(normalized, 10);
  return isNaN(val) || val <= 0 ? null : val;
}

/**
 * Heuristic classifier to auto-detect operational category from description
 */
export function classifyExpenseCategory(description: string): string {
  const desc = description.toLowerCase();

  if (/bahan|biji|kopi|susu|creamer|sirup|syrup|cup|sedotan|plastik|es\s*batu|es\s*kristal|teh|gula|snack|makanan|roti|topping|boba|matcha|packaging|dus|botol/i.test(desc)) {
    return 'Belanja Bahan Baku';
  }
  if (/listrik|pln|token|air|pdam|wifi|indihome|biznet|internet|pulsa|kuota/i.test(desc)) {
    return 'Listrik & Air';
  }
  if (/sewa|kontrak|lapak|ruko|kebersihan|iuran\s*rt|retribusi|sampah/i.test(desc)) {
    return 'Sewa Tempat';
  }
  if (/gaji|kasbon|bonus|insentif|lembur|upah|honor/i.test(desc)) {
    return 'Gaji Karyawan';
  }
  if (/iklan|ads|brosur|spanduk|banner|marketing|promo|flyer|endorse/i.test(desc)) {
    return 'Pemasaran & Iklan';
  }
  if (/servis|perbaikan|mesin|grinder|espresso|alat|kabel|lampu|pompa|kran|renovasi|cat|baut|obeng/i.test(desc)) {
    return 'Pemeliharaan Alat';
  }

  return 'Pengeluaran Operasional WA';
}

/**
 * Main parser for WhatsApp expense command:
 * Format: KELUAR [Nominal] [Keterangan] [Nama/Kode Outlet]
 * Example: KELUAR 50000 Beli es batu LAGOA
 * Example: KELUAR 25k Plastik take away
 * Example: KELUAR 150.000 Token listrik ruko PUSAT
 */
export function parseWAExpenseMessage(
  rawMessage: string,
  availableOutlets: Outlet[] = [],
  defaultOutletId?: string,
  senderPhone?: string,
  senderName?: string
): WAParsedExpense {
  if (!rawMessage || typeof rawMessage !== 'string') {
    return {
      isValid: false,
      amount: 0,
      description: '',
      category: 'Pengeluaran Operasional WA',
      paymentMethod: 'CASH',
      rawMessage: rawMessage || '',
      error: 'Pesan kosong atau tidak valid.',
    };
  }

  const trimmed = rawMessage.trim();

  // Allowed expense trigger keywords
  // e.g. KELUAR, PENGELUARAN, EXPENSE, OUT, BAYAR, BIAYA, KAS KELUAR, BELANJA
  const commandRegex = /^(KELUAR|PENGELUARAN|EXPENSE|OUT|BAYAR|BIAYA|KAS\s+KELUAR|BELANJA)\s+(.+)$/i;
  const match = trimmed.match(commandRegex);

  if (!match) {
    return {
      isValid: false,
      amount: 0,
      description: '',
      category: 'Pengeluaran Operasional WA',
      paymentMethod: 'CASH',
      rawMessage: trimmed,
      senderPhone,
      senderName,
      error: 'Format perintah tidak dikenali. Gunakan awalan: KELUAR [Nominal] [Keterangan] [Outlet opsional]',
    };
  }

  const command = match[1].toUpperCase();
  const restOfMessage = match[2].trim();

  // Tokenize rest of message by whitespace
  const tokens = restOfMessage.split(/\s+/);
  if (tokens.length < 2) {
    return {
      isValid: false,
      command,
      amount: 0,
      description: '',
      category: 'Pengeluaran Operasional WA',
      paymentMethod: 'CASH',
      rawMessage: trimmed,
      senderPhone,
      senderName,
      error: 'Parameter tidak lengkap. Contoh format: KELUAR 50000 Beli es batu LAGOA',
    };
  }

  // First token is expected to be nominal (e.g. 50000, 50k, Rp50.000, Rp.50.000)
  let amountToken = tokens[0];
  let descStartIndex = 1;

  // If format is "Rp 50000" where "Rp" and amount are separated by space
  if (/^rp\.?$/i.test(tokens[0]) && tokens.length >= 3) {
    amountToken = tokens[0] + tokens[1];
    descStartIndex = 2;
  }

  const parsedAmount = parseIndonesianAmount(amountToken);
  if (!parsedAmount || parsedAmount <= 0) {
    return {
      isValid: false,
      command,
      amount: 0,
      description: restOfMessage,
      category: 'Pengeluaran Operasional WA',
      paymentMethod: 'CASH',
      rawMessage: trimmed,
      senderPhone,
      senderName,
      error: `Nominal tidak valid: "${amountToken}". Contoh nominal yang benar: 50000, 50k, 50.000, atau Rp 50.000.`,
    };
  }

  // The remaining tokens represent description and optional outlet suffix
  const descTokens = tokens.slice(descStartIndex);
  if (descTokens.length === 0) {
    return {
      isValid: false,
      command,
      amount: parsedAmount,
      description: '',
      category: 'Pengeluaran Operasional WA',
      paymentMethod: 'CASH',
      rawMessage: trimmed,
      senderPhone,
      senderName,
      error: 'Keterangan pengeluaran belum diisi. Contoh: KELUAR 50000 Beli es batu',
    };
  }

  // Check if the last token (or last 2 tokens) matches any outlet
  let matchedOutlet: Outlet | undefined = undefined;
  let outletKeyword: string | undefined = undefined;
  let finalDescTokens = [...descTokens];

  if (availableOutlets.length > 0) {
    // 1. Try matching last 2 tokens (e.g. "KEDAI PUSAT")
    if (descTokens.length >= 2) {
      const lastTwo = `${descTokens[descTokens.length - 2]} ${descTokens[descTokens.length - 1]}`.toLowerCase();
      const match2 = availableOutlets.find(
        (o) =>
          o.name.toLowerCase() === lastTwo ||
          o.name.toLowerCase().includes(lastTwo) ||
          (o.code && o.code.toLowerCase() === lastTwo) ||
          o.id.toLowerCase() === lastTwo
      );
      if (match2) {
        matchedOutlet = match2;
        outletKeyword = lastTwo;
        finalDescTokens = descTokens.slice(0, -2);
      }
    }

    // 2. If not matched, try matching the very last token (e.g. "LAGOA", "PUSAT", "CABANG-1")
    if (!matchedOutlet && descTokens.length >= 2) {
      const lastOne = descTokens[descTokens.length - 1].toLowerCase().replace(/^\[|\]$/g, '');
      const match1 = availableOutlets.find(
        (o) =>
          o.name.toLowerCase() === lastOne ||
          o.name.toLowerCase().includes(lastOne) ||
          (o.code && o.code.toLowerCase() === lastOne) ||
          o.id.toLowerCase() === lastOne
      );
      if (match1) {
        matchedOutlet = match1;
        outletKeyword = lastOne;
        finalDescTokens = descTokens.slice(0, -1);
      }
    }
  }

  // Fallback to default outlet or first outlet if not specified
  if (!matchedOutlet) {
    if (defaultOutletId && defaultOutletId !== 'ALL') {
      matchedOutlet = availableOutlets.find((o) => o.id === defaultOutletId);
    }
    if (!matchedOutlet && availableOutlets.length > 0) {
      matchedOutlet = availableOutlets[0];
    }
  }

  const finalDescription = finalDescTokens.join(' ').trim();
  if (!finalDescription) {
    return {
      isValid: false,
      command,
      amount: parsedAmount,
      description: '',
      category: 'Pengeluaran Operasional WA',
      paymentMethod: 'CASH',
      rawMessage: trimmed,
      senderPhone,
      senderName,
      error: 'Keterangan pengeluaran tidak boleh kosong.',
    };
  }

  const category = classifyExpenseCategory(finalDescription);

  return {
    isValid: true,
    command,
    amount: parsedAmount,
    description: finalDescription,
    outletKeyword,
    matchedOutletId: matchedOutlet?.id || 'outlet-main',
    matchedOutletName: matchedOutlet?.name || 'Cabang Utama',
    category,
    paymentMethod: 'CASH',
    rawMessage: trimmed,
    senderPhone,
    senderName,
  };
}

/**
 * Formats a clean, high-contrast WhatsApp confirmation reply message
 */
export function generateWAResponseSuccess(
  parsed: WAParsedExpense,
  ledgerId: string,
  storeName: string = 'Kedai Su-Qur POS',
  remainingBranchCash?: number
): string {
  const formattedRp = `Rp ${parsed.amount.toLocaleString('id-ID')}`;
  const nowStr = new Date().toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  let balanceLine = '';
  if (typeof remainingBranchCash === 'number') {
    balanceLine = `\n💰 *Sisa Saldo Kas Cabang:* Rp ${remainingBranchCash.toLocaleString('id-ID')}`;
  }

  return (
    `✅ *PENGELUARAN BERHASIL DICATAT*\n` +
    `🏪 *${storeName}*\n` +
    `────────────────────────\n` +
    `💵 *Nominal:* ${formattedRp}\n` +
    `📝 *Keterangan:* ${parsed.description}\n` +
    `📂 *Kategori:* ${parsed.category}\n` +
    `🏢 *Cabang Outlet:* ${parsed.matchedOutletName}\n` +
    `💳 *Metode:* Tunai (Kas Toko)\n` +
    `🆔 *ID Kas:* \`${ledgerId}\`\n` +
    `⏰ *Waktu:* ${nowStr}${balanceLine}\n` +
    `────────────────────────\n` +
    `_Data otomatis tersinkronisasi ke Buku Kas & Laporan POS._`
  );
}

/**
 * Creates a direct WhatsApp Web / App chat link with prefilled confirmation text
 */
export function getWhatsAppDirectLink(phone: string, messageText: string): string {
  let cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '62' + cleanPhone.slice(1);
  }
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
}

/**
 * Sends an automated confirmation reply via WhatsApp API (Fonnte, Wablas, Twilio, etc.)
 */
export async function sendWAAutoReply(
  recipientPhone: string,
  messageText: string,
  gatewayConfig?: {
    provider?: 'fonnte' | 'wablas' | 'twilio' | 'generic';
    apiToken?: string;
    targetUrl?: string;
  }
): Promise<{ success: boolean; error?: string; response?: any }> {
  if (!recipientPhone || !messageText) {
    return { success: false, error: 'Nomor tujuan atau pesan kosong.' };
  }

  let cleanPhone = recipientPhone.replace(/[^0-9]/g, '');
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '62' + cleanPhone.slice(1);
  }

  const provider = gatewayConfig?.provider || 'fonnte';
  const token = gatewayConfig?.apiToken;

  if (!token) {
    return {
      success: true,
      error: 'Token belum diisi. Gunakan direct link wa.me.',
      response: { directLink: getWhatsAppDirectLink(cleanPhone, messageText) },
    };
  }

  try {
    if (provider === 'fonnte') {
      const res = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: cleanPhone,
          message: messageText,
        }),
      });
      const data = await res.json();
      return { success: data.status === true || res.ok, response: data };
    } else if (provider === 'wablas') {
      const res = await fetch('https://kudus.wablas.com/api/send-message', {
        method: 'POST',
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: cleanPhone,
          message: messageText,
        }),
      });
      const data = await res.json();
      return { success: data.status === true || res.ok, response: data };
    } else if (gatewayConfig?.targetUrl) {
      // Generic Webhook POST
      const res = await fetch(gatewayConfig.targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          phone: cleanPhone,
          recipient: cleanPhone,
          message: messageText,
          text: messageText,
        }),
      });
      const data = await res.json().catch(() => ({ ok: res.ok }));
      return { success: res.ok, response: data };
    }
  } catch (err: any) {
    console.warn('[WA Auto-Reply Bot] Send error:', err);
    return { success: false, error: err?.message || String(err) };
  }

  return { success: false, error: 'Provider tidak didukung.' };
}

/**
 * Formats a WhatsApp error response with helpful tips
 */
export function generateWAResponseError(errorMessage: string, rawMessage?: string): string {
  return (
    `❌ *GAGAL MENCATAT PENGELUARAN*\n` +
    `────────────────────────\n` +
    `⚠️ *Penyebab:* ${errorMessage}\n\n` +
    `📖 *Format yang Benar:*\n` +
    `\`KELUAR [Nominal] [Keterangan] [Nama/Kode Outlet]\`\n\n` +
    `💡 *Contoh:*\n` +
    `• \`KELUAR 50000 Beli es batu LAGOA\`\n` +
    `• \`KELUAR 25k Plastik take away\`\n` +
    `• \`KELUAR 150.000 Token listrik PUSAT\`\n` +
    `────────────────────────\n` +
    (rawMessage ? `_Pesan Anda: "${rawMessage}"_` : '')
  );
}

/**
 * Formats full help & guide message for WhatsApp bot commands
 */
export function generateWAHelpGuide(storeName: string = 'Su-Qur POS', outlets: Outlet[] = []): string {
  const outletListStr =
    outlets.length > 0
      ? outlets.map((o) => `• *${o.name}* (Kode: \`${o.code || o.id}\`)`).join('\n')
      : '• Cabang Utama';

  return (
    `🤖 *PANDUAN BOT WHATSAPP ${storeName.toUpperCase()}*\n` +
    `────────────────────────\n` +
    `Anda dapat mencatat pengeluaran operasional toko langsung dari WhatsApp.\n\n` +
    `📌 *Format Perintah Pengeluaran:*\n` +
    `\`KELUAR [Nominal] [Keterangan] [Cabang]\`\n\n` +
    `💡 *Contoh Perintah:*\n` +
    `1️⃣ \`KELUAR 50000 Beli es batu kristal LAGOA\`\n` +
    `2️⃣ \`KELUAR 35k Cup sealer 2 roll\`\n` +
    `3️⃣ \`KELUAR 150.000 Isi token listrik ruko PUSAT\`\n` +
    `4️⃣ \`BAYAR 250k Gas elpiji 10 tabung\`\n\n` +
    `🏢 *Daftar Cabang Terdaftar:*\n` +
    `${outletListStr}\n\n` +
    `────────────────────────\n` +
    `_Kirim \`HELP\` atau \`FORMAT\` kapan saja untuk melihat panduan ini._`
  );
}

/**
 * Ready-to-use Google Apps Script listener template
 */
export function getGoogleAppsScriptTemplate(appWebhookUrl: string): string {
  return `/**
 * Google Apps Script - WhatsApp Webhook Forwarder & Logger
 * Su-Qur POS Multi-Outlet Expense Integration
 */

var POS_WEBHOOK_URL = "${appWebhookUrl || 'https://your-domain.com/api/webhook/whatsapp'}";

function doPost(e) {
  try {
    var rawData = e.postData.contents;
    var json = JSON.parse(rawData);

    // Forward payload to Su-Qur POS Express Backend
    var options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(json),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(POS_WEBHOOK_URL, options);
    var resText = response.getContentText();

    return ContentService.createTextOutput(resText)
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Su-Qur POS WhatsApp Webhook Gateway is Active!");
}
`;
}
