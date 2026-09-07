import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Copy,
  Check,
  Send,
  HelpCircle,
  Code2,
  ShieldCheck,
  Building2,
  Phone,
  Key,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
  DollarSign,
  Plus,
} from 'lucide-react';
import { StoreSettings, Outlet, CashLedger, WAWebhookLog } from '../../types';
import { StorageService } from '../../services/storage';
import {
  parseWAExpenseMessage,
  generateWAResponseSuccess,
  generateWAResponseError,
  generateWAHelpGuide,
  getGoogleAppsScriptTemplate,
} from '../../utils/waParser';
import { formatRp } from '../../utils/formatters';

interface WhatsAppIntegrationTabProps {
  settings: StoreSettings;
  outlets?: Outlet[];
  onSaveSettings: (settings: StoreSettings) => void;
  onNotification?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const WhatsAppIntegrationTab: React.FC<WhatsAppIntegrationTabProps> = ({
  settings,
  outlets = [],
  onSaveSettings,
  onNotification,
}) => {
  // Config state
  const [gatewayProvider, setGatewayProvider] = useState<'fonnte' | 'wablas' | 'twilio' | 'generic'>(
    settings.waGatewayProvider || 'fonnte'
  );
  const [apiToken, setApiToken] = useState(settings.waApiToken || '');
  const [webhookSecret, setWebhookSecret] = useState(settings.waWebhookSecret || '');
  const [authorizedPhones, setAuthorizedPhones] = useState(settings.waAuthorizedPhones || '');
  const [autoReplyEnabled, setAutoReplyEnabled] = useState<boolean>(settings.waAutoReplyEnabled ?? true);
  const [defaultOutletId, setDefaultOutletId] = useState<string>(settings.waDefaultOutletId || 'ALL');

  // Copy state
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedGAS, setCopiedGAS] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  // Live Simulator state
  const [simMessage, setSimMessage] = useState('KELUAR 50000 Beli es batu kristal & sedotan LAGOA');
  const [simSenderPhone, setSimSenderPhone] = useState('081234567890');
  const [simSenderName, setSimSenderName] = useState('Kasir Lagoa');
  const [parsedResult, setParsedResult] = useState<ReturnType<typeof parseWAExpenseMessage> | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simNotice, setSimNotice] = useState<{ success: boolean; message: string; data?: any } | null>(null);

  // Server logs state
  const [logs, setLogs] = useState<WAWebhookLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isGasCodeOpen, setIsGasCodeOpen] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/webhook/whatsapp` : '/api/webhook/whatsapp';

  // Run initial parse on simMessage
  useEffect(() => {
    handleSimulateParse();
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch('/api/webhook/whatsapp/logs');
      if (res.ok) {
        const data = await res.json();
        if (data.logs) {
          setLogs(data.logs);
        }
      }
    } catch (err) {
      console.warn('Gagal memuat log webhook server:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleCopyWebhook = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(webhookUrl);
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2500);
      onNotification?.('URL Webhook berhasil disalin ke clipboard!', 'success');
    }
  };

  const handleCopyGAS = () => {
    const code = getGoogleAppsScriptTemplate(webhookUrl);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedGAS(true);
      setTimeout(() => setCopiedGAS(false), 2500);
      onNotification?.('Skrip Google Apps Script berhasil disalin!', 'success');
    }
  };

  const handleCopySample = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedCommand(text);
      setTimeout(() => setCopiedCommand(null), 2000);
      onNotification?.(`Format "${text}" disalin ke simulator.`, 'info');
      setSimMessage(text);
    }
  };

  const handleSimulateParse = () => {
    const res = parseWAExpenseMessage(
      simMessage,
      outlets,
      defaultOutletId !== 'ALL' ? defaultOutletId : undefined,
      simSenderPhone,
      simSenderName
    );
    setParsedResult(res);
  };

  const handleSimulateSendToCashLedger = async () => {
    handleSimulateParse();
    const parse = parseWAExpenseMessage(
      simMessage,
      outlets,
      defaultOutletId !== 'ALL' ? defaultOutletId : undefined,
      simSenderPhone,
      simSenderName
    );

    if (!parse.isValid) {
      setSimNotice({
        success: false,
        message: parse.error || 'Format pesan tidak valid.',
      });
      return;
    }

    setSimLoading(true);
    setSimNotice(null);

    try {
      // 1. Send to server simulation endpoint
      const response = await fetch('/api/webhook/whatsapp/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawMessage: simMessage,
          sender: simSenderPhone,
          senderName: simSenderName,
          outlets,
          defaultOutletId: defaultOutletId !== 'ALL' ? defaultOutletId : undefined,
        }),
      });

      const serverRes = await response.json();

      // 2. Direct client storage update to ensure instant UI responsiveness
      const cashEntry: CashLedger = {
        id: `cl-wa-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        type: 'OUT',
        category: parse.category,
        amount: parse.amount,
        description: `[WA] ${parse.description} (Pengirim: ${simSenderName || simSenderPhone})`,
        outletId: parse.matchedOutletId || (outlets[0]?.id || 'outlet-main'),
        outletName: parse.matchedOutletName || (outlets[0]?.name || 'Cabang Utama'),
        createdBy: `WhatsApp (${simSenderName || simSenderPhone})`,
        paymentMethod: 'CASH',
        createdAt: new Date().toISOString(),
      };

      StorageService.addCashLedger(cashEntry);

      setSimNotice({
        success: true,
        message: `✓ Sukses! Pengeluaran Rp ${parse.amount.toLocaleString('id-ID')} berhasil dicatat ke Buku Kas (${parse.matchedOutletName}).`,
        data: cashEntry,
      });

      onNotification?.(
        `Pengeluaran [WA] ${formatRp(parse.amount)} berhasil masuk ke Buku Kas!`,
        'success'
      );

      // Refresh logs
      fetchLogs();
    } catch (err: any) {
      setSimNotice({
        success: false,
        message: `Gagal mencatat: ${err?.message || 'Error jaringan'}`,
      });
    } finally {
      setSimLoading(false);
    }
  };

  const handleSaveSettings = () => {
    const updated: StoreSettings = {
      ...settings,
      waGatewayProvider: gatewayProvider,
      waApiToken: apiToken.trim(),
      waWebhookSecret: webhookSecret.trim(),
      waAuthorizedPhones: authorizedPhones.trim(),
      waAutoReplyEnabled: autoReplyEnabled,
      waDefaultOutletId: defaultOutletId,
    };

    onSaveSettings(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
    onNotification?.('Pengaturan Integrasi WhatsApp berhasil disimpan!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Banner Card */}
      <div className="bg-gradient-to-r from-[#1B4332] via-[#2D6A4F] to-[#1B4332] text-[#E8F5E9] p-6 rounded-3xl shadow-xl border border-[#40916C] relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-400/20 text-emerald-300 flex items-center justify-center border border-emerald-400/30">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">
                Integrasi Pencatatan Pengeluaran via WhatsApp
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-emerald-100/90 pl-12.5 max-w-2xl">
              Catat pengeluaran harian kedai otomatis dari chat WhatsApp (Fonnte, Wablas, Twilio, atau Bot). Langsung terhubung ke Buku Kas & Laporan POS.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSaveSettings}
            className="px-5 py-2.5 bg-emerald-400 hover:bg-emerald-300 text-stone-950 font-bold text-xs sm:text-sm rounded-2xl shadow-lg transition-all active:scale-95 cursor-pointer flex items-center gap-2 self-start md:self-auto"
          >
            {saveSuccess ? <Check className="w-4 h-4 text-emerald-950" /> : <ShieldCheck className="w-4 h-4" />}
            <span>{saveSuccess ? 'Tersimpan!' : 'Simpan Pengaturan WA'}</span>
          </button>
        </div>
      </div>

      {/* Webhook URL Live Box */}
      <div className="bg-white p-5 rounded-3xl border border-[#EBE3D5] shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-stone-600">
              Webhook Listener Endpoint URL
            </span>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            HTTP POST Active
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex-1 bg-[#FAF8F5] border border-[#D7CCC8] rounded-2xl px-4 py-2.5 font-mono text-xs text-[#2C1810] break-all select-all flex items-center justify-between">
            <span>{webhookUrl}</span>
          </div>
          <button
            type="button"
            onClick={handleCopyWebhook}
            className="px-4 py-2.5 bg-[#3E2723] hover:bg-[#2B1713] text-amber-200 font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-95"
          >
            {copiedWebhook ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copiedWebhook ? 'Tersalin!' : 'Salin URL'}</span>
          </button>
        </div>
        <p className="text-[11px] text-stone-500">
          Masukkan URL Webhook ini pada dashboard WhatsApp Gateway (Fonnte / Wablas / Twilio / Webhook Forwarder) pada kolom <strong>Webhook URL / Incoming Message URL</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Settings (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-5 rounded-3xl border border-[#EBE3D5] shadow-xs space-y-4">
            <h4 className="font-serif font-bold text-base text-[#3E2723] flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-800" /> Konfigurasi Gateway
            </h4>

            {/* Provider Selection */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#3E2723]">
                Penyedia Gateway WhatsApp
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'fonnte', name: 'Fonnte (Indonesia)' },
                  { id: 'wablas', name: 'Wablas (Indonesia)' },
                  { id: 'twilio', name: 'Twilio API' },
                  { id: 'generic', name: 'Generic / Baileys' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setGatewayProvider(p.id as any)}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                      gatewayProvider === p.id
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-900 shadow-xs'
                        : 'border-[#D7CCC8] hover:bg-[#FAF8F5] text-stone-700'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* API Token */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#3E2723]">
                API Token / Device Token Gateway (Opsional)
              </label>
              <input
                type="text"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder="Contoh: u9gT-XXXXX-FonnteToken"
                className="w-full bg-[#FAF8F5] border border-[#D7CCC8] rounded-xl px-3.5 py-2 text-xs text-[#2C1810] focus:ring-2 focus:ring-amber-500 focus:outline-hidden font-mono"
              />
              <p className="text-[10px] text-stone-400">
                Digunakan jika Anda mengaktifkan pengiriman balasan otomatis dari server melalui API Gateway.
              </p>
            </div>

            {/* Default Outlet */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#3E2723] flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-stone-500" /> Cabang Outlet Default
              </label>
              <select
                value={defaultOutletId}
                onChange={(e) => setDefaultOutletId(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#D7CCC8] rounded-xl px-3.5 py-2 text-xs font-semibold text-[#2C1810] focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              >
                <option value="ALL">Cabang Pertama / Otomatis</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} {o.code ? `(${o.code})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-stone-400">
                Outlet target jika pesan WA tidak menuliskan nama/kode cabang di akhir kalimat.
              </p>
            </div>

            {/* Authorized Phone Whitelist */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#3E2723] flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-stone-500" /> Nomor Pengirim Terotorisasi (Whitelist)
              </label>
              <input
                type="text"
                value={authorizedPhones}
                onChange={(e) => setAuthorizedPhones(e.target.value)}
                placeholder="Contoh: 081234567890, 08987654321"
                className="w-full bg-[#FAF8F5] border border-[#D7CCC8] rounded-xl px-3.5 py-2 text-xs text-[#2C1810] focus:ring-2 focus:ring-amber-500 focus:outline-hidden font-mono"
              />
              <p className="text-[10px] text-stone-400">
                Pisahkan dengan koma. Kosongkan jika ingin mengizinkan seluruh nomor staf/kasir.
              </p>
            </div>

            {/* Auto Reply Toggle */}
            <div className="pt-2 border-t border-[#EBE3D5] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#3E2723] block">
                  Balas Otomatis (Auto-Reply Webhook)
                </span>
                <span className="text-[10px] text-stone-500 block">
                  Kirim struk konfirmasi teks WhatsApp setelah pengeluaran berhasil dicatat.
                </span>
              </div>
              <input
                type="checkbox"
                checked={autoReplyEnabled}
                onChange={(e) => setAutoReplyEnabled(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={handleSaveSettings}
              className="w-full py-2.5 bg-[#3E2723] hover:bg-[#2B1713] text-amber-200 font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer"
            >
              Simpan Konfigurasi
            </button>
          </div>

          {/* Google Apps Script Card Accordion */}
          <div className="bg-white rounded-3xl border border-[#EBE3D5] shadow-xs overflow-hidden">
            <button
              type="button"
              onClick={() => setIsGasCodeOpen(!isGasCodeOpen)}
              className="w-full p-4 text-left flex items-center justify-between hover:bg-[#FAF8F5] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-bold text-[#3E2723]">
                  Skrip Webhook Google Apps Script (Opsional)
                </span>
              </div>
              {isGasCodeOpen ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
            </button>

            {isGasCodeOpen && (
              <div className="p-4 pt-0 border-t border-[#EBE3D5] space-y-3">
                <p className="text-[11px] text-stone-500">
                  Gunakan skrip ini di <strong>Google Apps Script</strong> jika Anda ingin menghubungkan WhatsApp Gateway melalui Spreadsheet / Macro Google.
                </p>
                <pre className="bg-[#2B1713] text-emerald-400 p-3 rounded-xl text-[10px] font-mono overflow-x-auto max-h-48">
                  {getGoogleAppsScriptTemplate(webhookUrl)}
                </pre>
                <button
                  type="button"
                  onClick={handleCopyGAS}
                  className="w-full py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedGAS ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedGAS ? 'Kode GAS Disalin!' : 'Salin Kode Google Apps Script'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Interactive Parser Simulator & Format Guide (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Format Guide Box */}
          <div className="bg-white p-5 rounded-3xl border border-[#EBE3D5] shadow-xs space-y-3">
            <h4 className="font-serif font-bold text-base text-[#3E2723] flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-800" /> Format Perintah WhatsApp
            </h4>

            <div className="bg-emerald-50/80 p-3.5 rounded-2xl border border-emerald-200/80 space-y-2">
              <div className="font-mono text-xs font-bold text-emerald-950 bg-white/90 px-3 py-1.5 rounded-xl border border-emerald-300/60 inline-block">
                KELUAR [Nominal] [Keterangan] [Nama/Kode Outlet]
              </div>
              <p className="text-[11px] text-emerald-900 leading-relaxed">
                Nominal mendukung format angka murni (<code>50000</code>), titik (<code>50.000</code>), format singkatan (<code>50k</code>, <code>1.5jt</code>), atau dengan <code>Rp</code>.
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                Contoh Perintah Cepat (Klik untuk Uji):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { text: 'KELUAR 50000 Beli es batu kristal LAGOA', desc: 'Outlet Lagoa, Kategori Bahan' },
                  { text: 'KELUAR 25k Plastik take away & cup', desc: 'Outlet Default, 25 Ribu' },
                  { text: 'KELUAR 150.000 Token listrik ruko PUSAT', desc: 'Outlet Pusat, Kategori Listrik' },
                  { text: 'BAYAR 250k Gas elpiji 10 tabung', desc: 'Keyword BAYAR, 250 Ribu' },
                ].map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleCopySample(sample.text)}
                    className="p-2.5 rounded-2xl border border-[#D7CCC8] hover:border-emerald-600 bg-[#FAF8F5] hover:bg-emerald-50/50 text-left transition-all group cursor-pointer"
                  >
                    <div className="font-mono text-xs font-bold text-[#3E2723] group-hover:text-emerald-950 flex items-center justify-between">
                      <span className="truncate">{sample.text}</span>
                      <Copy className="w-3 h-3 text-stone-400 group-hover:text-emerald-700 shrink-0 ml-1" />
                    </div>
                    <span className="text-[10px] text-stone-500 block mt-0.5">{sample.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Live Simulator */}
          <div className="bg-white p-5 rounded-3xl border border-[#EBE3D5] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-serif font-bold text-base text-[#3E2723] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600" /> Simulator Pengujian Pesan WA
              </h4>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                Interactive Test
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#3E2723] mb-1">
                  Pesan Teks WhatsApp
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={simMessage}
                    onChange={(e) => {
                      setSimMessage(e.target.value);
                      const res = parseWAExpenseMessage(
                        e.target.value,
                        outlets,
                        defaultOutletId !== 'ALL' ? defaultOutletId : undefined,
                        simSenderPhone,
                        simSenderName
                      );
                      setParsedResult(res);
                    }}
                    placeholder="Contoh: KELUAR 75000 Beli Cup Sealer LAGOA"
                    className="w-full bg-[#FAF8F5] border border-[#D7CCC8] rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-[#2C1810] focus:ring-2 focus:ring-emerald-600 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    No. Pengirim (Simulasi)
                  </label>
                  <input
                    type="text"
                    value={simSenderPhone}
                    onChange={(e) => setSimSenderPhone(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#D7CCC8] rounded-xl px-3 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    Nama Pengirim (Simulasi)
                  </label>
                  <input
                    type="text"
                    value={simSenderName}
                    onChange={(e) => setSimSenderName(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#D7CCC8] rounded-xl px-3 py-1.5 text-xs"
                  />
                </div>
              </div>

              {/* Parsing Breakdown Box */}
              {parsedResult && (
                <div
                  className={`p-4 rounded-2xl border text-xs space-y-2.5 transition-all ${
                    parsedResult.isValid
                      ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                      : 'bg-rose-50/70 border-rose-300 text-rose-950'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5">
                      {parsedResult.isValid ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-700" />
                      )}
                      {parsedResult.isValid ? 'Format Pesan Valid & Terurai' : 'Format Belum Sesuai'}
                    </span>
                    {parsedResult.isValid && (
                      <span className="font-serif font-black text-sm text-emerald-900">
                        {formatRp(parsedResult.amount)}
                      </span>
                    )}
                  </div>

                  {parsedResult.isValid ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-emerald-200/80 text-[11px]">
                      <div>
                        <span className="text-emerald-800/80 block">Deskripsi Pengeluaran:</span>
                        <strong className="text-emerald-950 font-medium">{parsedResult.description}</strong>
                      </div>
                      <div>
                        <span className="text-emerald-800/80 block">Kategori Otomatis:</span>
                        <strong className="text-emerald-950 font-medium">{parsedResult.category}</strong>
                      </div>
                      <div>
                        <span className="text-emerald-800/80 block">Cabang Outlet Terdeteksi:</span>
                        <strong className="text-emerald-950 font-medium">
                          {parsedResult.matchedOutletName} {parsedResult.outletKeyword ? `("${parsedResult.outletKeyword}")` : '(Default)'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-emerald-800/80 block">Metode Kas:</span>
                        <strong className="text-emerald-950 font-medium">Tunai (Kas Toko)</strong>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-rose-800 font-medium">
                      {parsedResult.error || 'Pastikan pesan diawali kata KELUAR lalu nominal.'}
                    </p>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSimulateParse}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Periksa Format
                </button>
                <button
                  type="button"
                  disabled={!parsedResult?.isValid || simLoading}
                  onClick={handleSimulateSendToCashLedger}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{simLoading ? 'Mencatat...' : 'Uji Catat ke Buku Kas Sekarang'}</span>
                </button>
              </div>

              {simNotice && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold ${
                    simNotice.success ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
                  }`}
                >
                  {simNotice.message}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Webhook Activity Logs Table */}
      <div className="bg-white rounded-3xl border border-[#EBE3D5] shadow-xs overflow-hidden">
        <div className="p-5 border-b border-[#EBE3D5] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-800" />
            <h4 className="font-serif font-bold text-base text-[#3E2723]">
              Riwayat Webhook Masuk ({logs.length})
            </h4>
          </div>
          <button
            type="button"
            onClick={fetchLogs}
            disabled={isLoadingLogs}
            className="p-1.5 bg-[#FAF8F5] border border-[#D7CCC8] hover:bg-[#F4EDE4] text-stone-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
            <span>Segarkan Log</span>
          </button>
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-10 px-4 text-xs text-stone-500 space-y-1">
            <MessageSquare className="w-8 h-8 mx-auto text-stone-300 mb-2" />
            <p className="font-bold text-stone-700">Belum ada aktivitas webhook masuk.</p>
            <p>Kirim pesan pengeluaran dari WhatsApp atau gunakan tombol simulator di atas untuk menguji.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAF8F5] text-stone-500 font-bold uppercase text-[10px] tracking-wider border-b border-[#EBE3D5]">
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Pengirim</th>
                  <th className="py-3 px-4">Pesan Masuk</th>
                  <th className="py-3 px-4">Nominal</th>
                  <th className="py-3 px-4">Cabang</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EBE3D5]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                    <td className="py-3 px-4 text-stone-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#3E2723]">{log.senderName || 'Staff'}</div>
                      <div className="text-[10px] text-stone-400 font-mono">{log.sender}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-stone-800 max-w-xs truncate">
                      {log.rawMessage}
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-800">
                      {log.parsedAmount ? formatRp(log.parsedAmount) : '-'}
                    </td>
                    <td className="py-3 px-4 text-stone-700">
                      {log.outletName || '-'}
                    </td>
                    <td className="py-3 px-4">
                      {log.status === 'SUCCESS' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" /> Berhasil
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          <AlertCircle className="w-3 h-3" /> Error
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
