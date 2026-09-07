import React from 'react';
import { StockTransfer, StoreSettings } from '../../types';
import { formatRp } from '../../utils/formatters';
import { Printer, X, CheckCircle2, Clock, Truck, ShieldCheck, AlertCircle } from 'lucide-react';

interface SuratJalanModalProps {
  transfer: StockTransfer | null;
  settings: StoreSettings;
  onClose: () => void;
  onReceive?: (transferId: string) => void;
  onCancel?: (transferId: string) => void;
  canManage?: boolean;
}

export const SuratJalanModal: React.FC<SuratJalanModalProps> = ({
  transfer,
  settings,
  onClose,
  onReceive,
  onCancel,
  canManage = true,
}) => {
  if (!transfer) return null;

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (status: StockTransfer['status']) => {
    switch (status) {
      case 'IN_TRANSIT':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1 rounded-full text-xs font-bold">
            <Clock className="w-3.5 h-3.5 text-amber-700" /> Dalam Pengiriman (In Transit)
          </span>
        );
      case 'RECEIVED':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 border border-emerald-300 px-3 py-1 rounded-full text-xs font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> Diterima & Stok Masuk (Received)
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 bg-red-100 text-red-900 border border-red-300 px-3 py-1 rounded-full text-xs font-bold">
            <AlertCircle className="w-3.5 h-3.5 text-red-700" /> Pengiriman Dibatalkan (Cancelled)
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-[#E6D5C3] space-y-6 my-8 print:border-none print:shadow-none print:m-0 print:p-4">
        {/* Actions header (Hidden during print) */}
        <div className="flex items-center justify-between border-b border-[#E6D5C3] pb-4 print:hidden">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#D4A373]" />
            <h3 className="font-extrabold text-base text-[#2B1713]">
              Surat Jalan Pengiriman Stok Su-Qur
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-[#3E2723] hover:bg-[#4E342E] text-[#FAF3DD] font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-[#D4A373]" /> Cetak / PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Official Printable Surat Jalan Document Sheet */}
        <div className="border-2 border-[#3E2723] rounded-2xl p-6 bg-[#FAF3DD]/20 space-y-5 print:border print:p-4 text-xs text-[#2B1713]">
          {/* Header Brand */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-[#3E2723] pb-4 gap-2">
            <div>
              <h1 className="text-xl font-black tracking-tight text-[#3E2723] uppercase">
                {settings.storeName || 'KEDAI SU-QUR'}
              </h1>
              <p className="text-[11px] text-[#8D6E63] font-medium">
                {settings.tagline || settings.storeTagline || 'Authentic Signature Coffee & Beverages'}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {settings.address || settings.storeAddress || 'Pusat Distribusi & Pergudangan Logistik Su-Qur'}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-base font-black text-[#3E2723]">SURAT JALAN SUPLAI</div>
              <div className="text-xs font-mono font-bold text-[#8D6E63]">{transfer.transferNumber}</div>
              <div className="mt-1">{getStatusBadge(transfer.status)}</div>
            </div>
          </div>

          {/* Transfer Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-[#E6D5C3]">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#8D6E63] block">Cabang Asal (Pengirim)</span>
              <span className="font-bold text-[#2B1713]">{transfer.fromOutletName}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#8D6E63] block">Cabang Tujuan (Penerima)</span>
              <span className="font-bold text-emerald-800">{transfer.toOutletName}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#8D6E63] block">Tanggal & Waktu</span>
              <span className="font-medium text-gray-700">
                {new Date(transfer.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#8D6E63] block">Dibuat Oleh</span>
              <span className="font-medium text-gray-700">{transfer.createdBy}</span>
            </div>
          </div>

          {/* Driver & Vehicle */}
          {(transfer.driverName || transfer.vehicleNumber) && (
            <div className="bg-white p-3 rounded-xl border border-[#E6D5C3] flex flex-wrap gap-4 text-xs">
              {transfer.driverName && (
                <div>
                  <span className="text-[10px] text-gray-500 font-bold block uppercase">Driver / Kurir:</span>
                  <span className="font-bold text-[#3E2723]">{transfer.driverName}</span>
                </div>
              )}
              {transfer.vehicleNumber && (
                <div>
                  <span className="text-[10px] text-gray-500 font-bold block uppercase">No. Kendaraan:</span>
                  <span className="font-mono font-bold text-[#3E2723]">{transfer.vehicleNumber}</span>
                </div>
              )}
            </div>
          )}

          {/* Items Table */}
          <div className="border border-[#3E2723] rounded-xl overflow-hidden bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#3E2723] text-[#FAF3DD] font-bold">
                <tr>
                  <th className="py-2.5 px-3 w-8 text-center">No</th>
                  <th className="py-2.5 px-3">Nama Bahan Baku</th>
                  <th className="py-2.5 px-3 text-center">Kuantitas</th>
                  <th className="py-2.5 px-3 text-right">Estimasi HPP Satuan</th>
                  <th className="py-2.5 px-3 text-right">Total Nilai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6D5C3]">
                {transfer.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="py-2 px-3 text-center text-gray-500">{idx + 1}</td>
                    <td className="py-2 px-3 font-bold text-[#2B1713]">{item.ingredientName}</td>
                    <td className="py-2 px-3 text-center font-extrabold text-[#3E2723]">
                      {item.amount} <span className="font-normal text-gray-500 text-[10px]">{item.unit}</span>
                    </td>
                    <td className="py-2 px-3 text-right text-gray-600 font-mono">
                      {formatRp(item.costPerUnit)}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-[#8D6E63] font-mono">
                      {formatRp(item.totalCost || item.amount * item.costPerUnit)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-[#FAF3DD]/80 font-bold border-t border-[#3E2723]">
                <tr>
                  <td colSpan={4} className="py-2 px-3 text-right text-[#3E2723]">
                    Total Estimasi Nilai Suplai:
                  </td>
                  <td className="py-2 px-3 text-right text-[#2B1713] text-sm">
                    {formatRp(transfer.totalEstimatedValue || 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Notes */}
          {transfer.notes && (
            <div className="bg-white p-3 rounded-xl border border-[#E6D5C3]">
              <span className="text-[10px] font-bold uppercase text-[#8D6E63] block">Catatan Pengiriman:</span>
              <p className="text-gray-700 italic mt-0.5">{transfer.notes}</p>
            </div>
          )}

          {/* Signature Columns */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-dashed border-[#8D6E63] text-center text-[10px]">
            <div className="space-y-12">
              <span className="font-bold text-[#3E2723] block">Pengirim (Pusat / Hub)</span>
              <div className="border-b border-gray-400 mx-4"></div>
              <span className="text-gray-600 block">({transfer.createdBy})</span>
            </div>
            <div className="space-y-12">
              <span className="font-bold text-[#3E2723] block">Driver / Ekspedisi</span>
              <div className="border-b border-gray-400 mx-4"></div>
              <span className="text-gray-600 block">({transfer.driverName || '........................'})</span>
            </div>
            <div className="space-y-12">
              <span className="font-bold text-emerald-900 block">Penerima (Cabang Outlet)</span>
              <div className="border-b border-gray-400 mx-4"></div>
              <span className="text-gray-600 block">
                ({transfer.receivedBy || '........................'})
              </span>
            </div>
          </div>

          {transfer.receivedAt && (
            <div className="text-[10px] text-emerald-700 text-center font-bold bg-emerald-50 p-2 rounded-lg border border-emerald-200">
              Barang telah diterima dan stok ditambahkan pada {new Date(transfer.receivedAt).toLocaleString('id-ID')} oleh {transfer.receivedBy}.
            </div>
          )}
        </div>

        {/* Action Controls for Status Transitions (Hidden in Print) */}
        {canManage && transfer.status === 'IN_TRANSIT' && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-[#E6D5C3] print:hidden">
            {onCancel && (
              <button
                onClick={() => {
                  if (window.confirm('Yakin ingin membatalkan pengiriman surat jalan ini? Stok akan dikembalikan ke Pusat.')) {
                    onCancel(transfer.id);
                  }
                }}
                className="px-4 py-2 rounded-xl text-red-600 border border-red-200 hover:bg-red-50 text-xs font-bold transition-colors w-full sm:w-auto"
              >
                Batalkan Pengiriman & Kembalikan Stok
              </button>
            )}

            {onReceive && (
              <button
                onClick={() => {
                  if (window.confirm(`Konfirmasi penerimaan barang untuk ${transfer.toOutletName}? Stok fisik outlet akan bertambah otomatis.`)) {
                    onReceive(transfer.id);
                  }
                }}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <CheckCircle2 className="w-4 h-4" /> Konfirmasi Terima Barang (Update Stok Outlet)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
