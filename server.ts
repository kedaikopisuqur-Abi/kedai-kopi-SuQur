import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { createServer as createViteServer } from 'vite';

// Safe resolution for __dirname across both ESM (tsx dev) and CJS (production esbuild bundle)
const getDirname = () => {
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }
  try {
    if (typeof import.meta !== 'undefined' && import.meta.url) {
      return path.dirname(fileURLToPath(import.meta.url));
    }
  } catch (e) {
    // Ignore and fallback to cwd
  }
  return process.cwd();
};

const currentDir = getDirname();

// Lazy initialization for OpenAI / OpenRouter client
let openRouterClient: OpenAI | null = null;
function getOpenRouterClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY belum dikonfigurasi di server environment.');
  }
  if (!openRouterClient) {
    openRouterClient = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey,
      defaultHeaders: {
        'HTTP-Referer': process.env.YOUR_SITE_URL || process.env.APP_URL || '',
        'X-Title': process.env.YOUR_SITE_NAME || 'Su-Qur POS',
      },
    });
  }
  return openRouterClient;
}

// API Keys rotation list from environment variables
const API_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_KEY_1,
  process.env.GEMINI_KEY_2,
  process.env.GEMINI_KEY_3,
].filter(Boolean) as string[];

let currentKeyIndex = 0;

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // In-memory buffer of recent WhatsApp webhook logs (up to 50 entries)
  const webhookLogs: Array<{
    id: string;
    timestamp: string;
    sender: string;
    senderName?: string;
    rawMessage: string;
    parsedAmount?: number;
    parsedDescription?: string;
    outletName?: string;
    status: 'SUCCESS' | 'IGNORED' | 'ERROR';
    responseMessage?: string;
    error?: string;
    cashRecord?: any;
  }> = [];

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasGeminiKey: API_KEYS.length > 0,
      totalKeys: API_KEYS.length,
      hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
      webhookLogsCount: webhookLogs.length,
    });
  });

  // Webhook Verification (GET) for Meta WhatsApp Cloud API / Webhook Checkers
  app.get(['/api/webhook/whatsapp', '/api/webhook/wa'], (req, res) => {
    const hubMode = req.query['hub.mode'];
    const hubChallenge = req.query['hub.challenge'];
    const hubVerifyToken = req.query['hub.verify_token'];

    if (hubMode === 'subscribe' && hubChallenge) {
      console.log('[WA Webhook] Verified Meta challenge:', hubVerifyToken);
      return res.status(200).send(hubChallenge);
    }

    res.json({
      status: 'active',
      service: 'Su-Qur POS WhatsApp Webhook Gateway',
      time: new Date().toISOString(),
      instructions: 'Send POST requests with message & sender payload.',
    });
  });

  // Get recent WhatsApp webhook logs
  app.get('/api/webhook/whatsapp/logs', (req, res) => {
    res.json({
      success: true,
      logs: webhookLogs.slice(0, 50),
    });
  });

  // Helper to extract message, sender, senderName from diverse WA Gateway payloads
  function extractWAPayload(body: any) {
    let rawMessage =
      body?.message ||
      body?.text ||
      body?.Body ||
      body?.content ||
      body?.msg ||
      body?.data?.message ||
      body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body ||
      '';

    let sender =
      body?.sender ||
      body?.phone ||
      body?.From ||
      body?.from ||
      body?.data?.sender ||
      body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from ||
      'Unknown';

    let senderName =
      body?.name ||
      body?.pushName ||
      body?.ProfileName ||
      body?.profile?.name ||
      body?.entry?.[0]?.changes?.[0]?.value?.contacts?.[0]?.profile?.name ||
      'Staff';

    // Normalize phone number (strip "whatsapp:" prefix from Twilio)
    if (typeof sender === 'string') {
      sender = sender.replace(/^whatsapp:\+?/i, '').replace(/^\+/, '');
    }

    return { rawMessage: String(rawMessage).trim(), sender: String(sender).trim(), senderName: String(senderName).trim() };
  }

  // Parse amount in Indonesian format (e.g. 50000, 50k, 50.000, Rp 50.000, 1.5jt)
  function parseAmount(amountStr: string): number | null {
    if (!amountStr) return null;
    let clean = amountStr.trim().toLowerCase().replace(/^rp\.?\s*/i, '');

    if (clean.endsWith('jt') || clean.endsWith('juta')) {
      const numPart = clean.replace(/jt|juta/g, '').replace(/,/g, '.').trim();
      const val = parseFloat(numPart);
      return isNaN(val) ? null : Math.round(val * 1_000_000);
    }
    if (clean.endsWith('k') || clean.endsWith('rb') || clean.endsWith('ribu')) {
      const numPart = clean.replace(/k|rb|ribu/g, '').replace(/,/g, '.').trim();
      const val = parseFloat(numPart);
      return isNaN(val) ? null : Math.round(val * 1_000);
    }

    const normalized = clean.replace(/\./g, '').replace(/,/g, '');
    const val = parseInt(normalized, 10);
    return isNaN(val) || val <= 0 ? null : val;
  }

  // Auto classify category
  function classifyCategory(desc: string): string {
    const d = desc.toLowerCase();
    if (/bahan|biji|kopi|susu|creamer|sirup|syrup|cup|sedotan|plastik|es\s*batu|es\s*kristal|teh|gula|snack|makanan|roti|topping|packaging/i.test(d)) {
      return 'Belanja Bahan Baku';
    }
    if (/listrik|pln|token|air|pdam|wifi|indihome|biznet|internet|pulsa|kuota/i.test(d)) {
      return 'Listrik & Air';
    }
    if (/sewa|kontrak|lapak|ruko|kebersihan|retribusi|sampah/i.test(d)) {
      return 'Sewa Tempat';
    }
    if (/gaji|kasbon|bonus|insentif|lembur|upah|honor/i.test(d)) {
      return 'Gaji Karyawan';
    }
    if (/iklan|ads|brosur|spanduk|banner|marketing|promo|flyer/i.test(d)) {
      return 'Pemasaran & Iklan';
    }
    if (/servis|perbaikan|mesin|grinder|espresso|alat|kabel|lampu|pompa/i.test(d)) {
      return 'Pemeliharaan Alat';
    }
    return 'Pengeluaran Operasional WA';
  }

  // Core handler for WhatsApp expense processing
  function processWAExpenseLogic(rawMessage: string, sender: string, senderName: string, outlets: any[] = [], defaultOutletId?: string) {
    const trimmed = rawMessage.trim();

    // Check help / info commands
    if (/^(HELP|BANTUAN|MENU|INFO|FORMAT)$/i.test(trimmed)) {
      const helpText =
        `🤖 *PANDUAN BOT WHATSAPP SU-QUR POS*\n` +
        `────────────────────────\n` +
        `Format mencatat pengeluaran operasional:\n` +
        `\`KELUAR [Nominal] [Keterangan] [Cabang]\`\n\n` +
        `💡 *Contoh Perintah:*\n` +
        `1️⃣ \`KELUAR 50000 Beli es batu kristal LAGOA\`\n` +
        `2️⃣ \`KELUAR 25k Plastik take away\`\n` +
        `3️⃣ \`KELUAR 150.000 Token listrik ruko PUSAT\`\n` +
        `4️⃣ \`BAYAR 250k Gas elpiji 10 tabung\`\n` +
        `────────────────────────\n` +
        `_Data otomatis masuk ke Buku Kas & Laporan POS._`;

      return {
        isHelp: true,
        success: true,
        reply: helpText,
        message: helpText,
      };
    }

    const commandRegex = /^(KELUAR|PENGELUARAN|EXPENSE|OUT|BAYAR|BIAYA|KAS\s+KELUAR|BELANJA)\s+(.+)$/i;
    const match = trimmed.match(commandRegex);

    if (!match) {
      return {
        isValid: false,
        success: false,
        error: 'Format perintah tidak dikenali. Gunakan awalan: KELUAR [Nominal] [Keterangan] [Cabang]',
        reply:
          `❌ *FORMAT PERINTAH TIDAK SESUAI*\n` +
          `────────────────────────\n` +
          `Gunakan format:\n\`KELUAR [Nominal] [Keterangan] [Cabang]\`\n\n` +
          `Contoh: \`KELUAR 50000 Beli es batu LAGOA\``,
      };
    }

    const restOfMessage = match[2].trim();
    const tokens = restOfMessage.split(/\s+/);
    if (tokens.length < 2) {
      return {
        isValid: false,
        success: false,
        error: 'Parameter tidak lengkap. Contoh: KELUAR 50000 Beli es batu LAGOA',
        reply: `❌ *PARAMETER KURANG*\nContoh: \`KELUAR 50000 Beli es batu LAGOA\``,
      };
    }

    let amountToken = tokens[0];
    let descStartIndex = 1;
    if (/^rp\.?$/i.test(tokens[0]) && tokens.length >= 3) {
      amountToken = tokens[0] + tokens[1];
      descStartIndex = 2;
    }

    const parsedAmount = parseAmount(amountToken);
    if (!parsedAmount || parsedAmount <= 0) {
      return {
        isValid: false,
        success: false,
        error: `Nominal tidak valid: "${amountToken}"`,
        reply: `❌ *NOMINAL TIDAK VALID*\nContoh nominal yang benar: 50000, 50k, 50.000, atau Rp 50.000.`,
      };
    }

    const descTokens = tokens.slice(descStartIndex);
    let matchedOutlet: any = null;
    let finalDescTokens = [...descTokens];

    if (outlets && outlets.length > 0) {
      if (descTokens.length >= 2) {
        const lastTwo = `${descTokens[descTokens.length - 2]} ${descTokens[descTokens.length - 1]}`.toLowerCase();
        const m = outlets.find(
          (o: any) =>
            o.name?.toLowerCase() === lastTwo ||
            o.name?.toLowerCase().includes(lastTwo) ||
            o.code?.toLowerCase() === lastTwo ||
            o.id?.toLowerCase() === lastTwo
        );
        if (m) {
          matchedOutlet = m;
          finalDescTokens = descTokens.slice(0, -2);
        }
      }
      if (!matchedOutlet && descTokens.length >= 2) {
        const lastOne = descTokens[descTokens.length - 1].toLowerCase().replace(/^\[|\]$/g, '');
        const m = outlets.find(
          (o: any) =>
            o.name?.toLowerCase() === lastOne ||
            o.name?.toLowerCase().includes(lastOne) ||
            o.code?.toLowerCase() === lastOne ||
            o.id?.toLowerCase() === lastOne
        );
        if (m) {
          matchedOutlet = m;
          finalDescTokens = descTokens.slice(0, -1);
        }
      }
    }

    if (!matchedOutlet) {
      if (defaultOutletId && outlets && outlets.length > 0) {
        matchedOutlet = outlets.find((o: any) => o.id === defaultOutletId);
      }
      if (!matchedOutlet && outlets && outlets.length > 0) {
        matchedOutlet = outlets[0];
      }
    }

    const finalDescription = finalDescTokens.join(' ').trim();
    if (!finalDescription) {
      return {
        isValid: false,
        success: false,
        error: 'Keterangan pengeluaran tidak boleh kosong.',
        reply: `❌ *KETERANGAN KOSONG*\nContoh: \`KELUAR 50000 Beli es batu LAGOA\``,
      };
    }

    const category = classifyCategory(finalDescription);
    const outletName = matchedOutlet?.name || 'Cabang Utama';
    const outletId = matchedOutlet?.id || 'outlet-main';
    const cashId = `cl-wa-${Date.now()}`;
    const formattedRp = `Rp ${parsedAmount.toLocaleString('id-ID')}`;
    const nowStr = new Date().toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const cashEntry = {
      id: cashId,
      date: new Date().toISOString().split('T')[0],
      type: 'OUT',
      category,
      amount: parsedAmount,
      description: `[WA] ${finalDescription} (Pengirim: ${senderName || sender})`,
      outletId,
      outletName,
      createdBy: `WhatsApp (${senderName || sender})`,
      paymentMethod: 'CASH',
      createdAt: new Date().toISOString(),
    };

    const replyMessage =
      `✅ *PENGELUARAN BERHASIL DICATAT*\n` +
      `🏪 *Su-Qur POS*\n` +
      `────────────────────────\n` +
      `💵 *Nominal:* ${formattedRp}\n` +
      `📝 *Keterangan:* ${finalDescription}\n` +
      `📂 *Kategori:* ${category}\n` +
      `🏢 *Cabang Outlet:* ${outletName}\n` +
      `💳 *Metode:* Tunai (Kas Toko)\n` +
      `🆔 *ID Kas:* \`${cashId}\`\n` +
      `⏰ *Waktu:* ${nowStr}\n` +
      `────────────────────────\n` +
      `_Data otomatis tersimpan ke Buku Kas & Laporan POS._`;

    return {
      isValid: true,
      success: true,
      amount: parsedAmount,
      description: finalDescription,
      category,
      outletId,
      outletName,
      cashEntry,
      reply: replyMessage,
      message: replyMessage,
      text: replyMessage,
    };
  }

  // Webhook Listener (POST) for WhatsApp Gateway (Fonnte, Wablas, Twilio, Generic)
  app.post(['/api/webhook/whatsapp', '/api/webhook/wa'], async (req, res) => {
    const { rawMessage, sender, senderName } = extractWAPayload(req.body);

    console.log(`[WA Webhook] Received from ${sender} (${senderName}): "${rawMessage}"`);

    if (!rawMessage) {
      const logEntry = {
        id: `walog-${Date.now()}`,
        timestamp: new Date().toISOString(),
        sender: sender || 'Unknown',
        senderName,
        rawMessage: JSON.stringify(req.body),
        status: 'ERROR' as const,
        error: 'Payload tidak memiliki teks pesan.',
      };
      webhookLogs.unshift(logEntry);
      return res.status(400).json({ success: false, error: 'Pesan kosong.' });
    }

    const result = processWAExpenseLogic(rawMessage, sender, senderName);

    const logEntry = {
      id: `walog-${Date.now()}`,
      timestamp: new Date().toISOString(),
      sender,
      senderName,
      rawMessage,
      parsedAmount: result.amount,
      parsedDescription: result.description,
      outletName: result.outletName,
      status: (result.success ? 'SUCCESS' : 'ERROR') as 'SUCCESS' | 'ERROR',
      responseMessage: result.reply,
      error: result.error,
      cashRecord: result.cashEntry,
    };
    webhookLogs.unshift(logEntry);
    if (webhookLogs.length > 100) webhookLogs.pop();

    // Respond back in gateway-friendly formats (Fonnte: reply, Wablas: message, Twilio: text)
    return res.status(200).json({
      success: result.success,
      reply: result.reply,
      message: result.reply,
      text: result.reply,
      data: result.cashEntry,
      error: result.error,
    });
  });

  // Simulator API endpoint for POS Settings testing
  app.post('/api/webhook/whatsapp/simulate', (req, res) => {
    const { rawMessage, sender = '6281234567890', senderName = 'Admin Kasir', outlets = [], defaultOutletId } = req.body;

    if (!rawMessage || typeof rawMessage !== 'string') {
      return res.status(400).json({ success: false, error: 'Pesan simulasi harus diisi.' });
    }

    const result = processWAExpenseLogic(rawMessage, sender, senderName, outlets, defaultOutletId);

    const logEntry = {
      id: `walog-sim-${Date.now()}`,
      timestamp: new Date().toISOString(),
      sender,
      senderName: `(Simulasi) ${senderName}`,
      rawMessage,
      parsedAmount: result.amount,
      parsedDescription: result.description,
      outletName: result.outletName,
      status: (result.success ? 'SUCCESS' : 'ERROR') as 'SUCCESS' | 'ERROR',
      responseMessage: result.reply,
      error: result.error,
      cashRecord: result.cashEntry,
    };
    webhookLogs.unshift(logEntry);

    return res.status(200).json({
      success: result.success,
      reply: result.reply,
      message: result.reply,
      data: result.cashEntry,
      error: result.error,
    });
  });

  // Gemini AI Chat API endpoint with automatic key rotation on quota exhaustion (429 / RESOURCE_EXHAUSTED)
  app.post('/api/chat', async (req, res) => {
    const { prompt, model, systemInstruction } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ success: false, error: 'Prompt diperlukan dalam request body.' });
    }

    if (API_KEYS.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Tidak ada API key Gemini yang terpasang di server (GEMINI_API_KEY / GEMINI_KEY_1..3).',
      });
    }

    let attempts = 0;
    const targetModel = model || 'gemini-3.7-flash';

    while (attempts < API_KEYS.length) {
      const activeKey = API_KEYS[currentKeyIndex];
      try {
        const ai = new GoogleGenAI({
          apiKey: activeKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const response = await ai.models.generateContent({
          model: targetModel,
          contents: prompt,
          config: systemInstruction
            ? {
                systemInstruction,
              }
            : undefined,
        });

        return res.json({
          success: true,
          text: response.text,
          keyIndexUsed: currentKeyIndex,
        });
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        console.warn(`[Gemini API] Error on key index ${currentKeyIndex}:`, errorMsg);

        if (
          errorMsg.includes('429') ||
          errorMsg.includes('RESOURCE_EXHAUSTED') ||
          errorMsg.includes('quota') ||
          errorMsg.includes('Quota')
        ) {
          // Switch to next API key in rotation
          currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
          attempts++;
          continue; // Try next key in rotation immediately
        }

        return res.status(500).json({
          success: false,
          error: errorMsg,
        });
      }
    }

    res.status(429).json({
      success: false,
      error: 'Semua kuota server AI sedang habis. Silakan coba beberapa saat lagi.',
    });
  });

  // OpenRouter AI Chat API proxy endpoint (powered by OpenAI SDK)
  app.post('/api/openrouter/chat', async (req, res) => {
    const { messages, model = 'openai/gpt-4o', prompt } = req.body;

    const formattedMessages =
      Array.isArray(messages) && messages.length > 0
        ? messages
        : prompt
        ? [{ role: 'user', content: prompt }]
        : [];

    if (formattedMessages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Request harus menyertakan array messages atau teks prompt.',
      });
    }

    try {
      const openai = getOpenRouterClient();
      const completion = await openai.chat.completions.create({
        model,
        messages: formattedMessages,
      });

      const replyContent = completion.choices?.[0]?.message?.content || '';

      return res.json({
        success: true,
        text: replyContent,
        choices: completion.choices,
        usage: completion.usage,
      });
    } catch (error: any) {
      console.error('[OpenRouter API] Error:', error);
      return res.status(500).json({
        success: false,
        error: error?.message || 'Gagal menghubungi OpenRouter API.',
      });
    }
  });

  // Vite middleware for development vs static production serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const possibleDistPaths = [
      path.join(process.cwd(), 'dist'),
      typeof __dirname !== 'undefined' ? __dirname : '',
      path.resolve('dist'),
    ].filter(Boolean);

    const distPath =
      possibleDistPaths.find((p) => fs.existsSync(path.join(p, 'index.html'))) ||
      path.join(process.cwd(), 'dist');

    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server berjalan di http://0.0.0.0:${PORT}`);
  });
}

// Process-level safety handlers to prevent unexpected crashes in container runtime
process.on('unhandledRejection', (reason) => {
  console.warn('[Server] Unhandled Rejection absorbed safely:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught Exception absorbed safely:', err);
});

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
