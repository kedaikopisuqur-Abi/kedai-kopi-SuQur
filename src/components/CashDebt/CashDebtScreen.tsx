import React, { useState } from 'react';
import { CashLedger, CapitalRecord, DebtRecord, DebtPayment, Outlet, User, Ingredient, FixedAsset } from '../../types';
import { CashLedgerTab } from './CashLedgerTab';
import { CapitalRecordsTab } from './CapitalRecordsTab';
import { DebtReceivablesTab } from './DebtReceivablesTab';
import { FixedAssetsTab } from './FixedAssetsTab';
import {
  Wallet,
  Coins,
  CreditCard,
  Building2,
  HelpCircle,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { motion } from 'motion/react';

interface CashDebtScreenProps {
  cashLedgers: CashLedger[];
  capitalRecords: CapitalRecord[];
  debtRecords: DebtRecord[];
  fixedAssets?: FixedAsset[];
  outlets: Outlet[];
  activeOutlet: Outlet | null;
  currentUser: User;
  ingredients?: Ingredient[];
  onAddCashLedger: (ledger: CashLedger) => void;
  onDeleteCashLedger: (id: string) => void;
  onAddCapitalRecord: (record: CapitalRecord, autoAddToCashLedger?: boolean) => void;
  onDeleteCapitalRecord: (id: string) => void;
  onAddDebtRecord: (record: DebtRecord) => void;
  onAddDebtPayment: (
    debtId: string,
    payment: DebtPayment,
    autoRecordCashLedger?: boolean
  ) => void;
  onDeleteDebtRecord: (id: string) => void;
  onAddFixedAsset?: (asset: FixedAsset, autoRecordCashLedger?: boolean) => void;
  onUpdateFixedAsset?: (asset: FixedAsset) => void;
  onDeleteFixedAsset?: (id: string) => void;
}

export type CashDebtSubTab = 'CASH_LEDGER' | 'CAPITAL' | 'DEBT_RECEIVABLE' | 'FIXED_ASSETS';

export const CashDebtScreen: React.FC<CashDebtScreenProps> = ({
  cashLedgers,
  capitalRecords,
  debtRecords,
  fixedAssets = [],
  outlets,
  activeOutlet,
  currentUser,
  ingredients,
  onAddCashLedger,
  onDeleteCashLedger,
  onAddCapitalRecord,
  onDeleteCapitalRecord,
  onAddDebtRecord,
  onAddDebtPayment,
  onDeleteDebtRecord,
  onAddFixedAsset,
  onUpdateFixedAsset,
  onDeleteFixedAsset,
}) => {
  const [activeTab, setActiveTab] = useState<CashDebtSubTab>('CASH_LEDGER');

  const unpaidDebtCount = debtRecords.filter((d) => d.status !== 'PAID').length;

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Top Main Navigation Tabs */}
      <div className="bg-white p-2.5 rounded-2xl border border-[#D7CCC8]/60 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-stone-100/80 rounded-xl">
          {/* Sub-tab 1: Buku Kas */}
          <button
            onClick={() => setActiveTab('CASH_LEDGER')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'CASH_LEDGER'
                ? 'bg-amber-800 text-white shadow-xs'
                : 'text-[#5D4037] hover:text-[#2B1713] hover:bg-stone-200/60'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Buku Kas</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === 'CASH_LEDGER' ? 'bg-amber-900 text-amber-100' : 'bg-stone-200 text-stone-700'
              }`}
            >
              {cashLedgers.length}
            </span>
          </button>

          {/* Sub-tab 2: Aset & Peralatan (CAPEX) */}
          <button
            onClick={() => setActiveTab('FIXED_ASSETS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'FIXED_ASSETS'
                ? 'bg-amber-800 text-white shadow-xs'
                : 'text-[#5D4037] hover:text-[#2B1713] hover:bg-stone-200/60'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>Aset & Peralatan (CAPEX)</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === 'FIXED_ASSETS' ? 'bg-amber-900 text-amber-100' : 'bg-stone-200 text-stone-700'
              }`}
            >
              {fixedAssets.length}
            </span>
          </button>

          {/* Sub-tab 3: Pencatatan Modal */}
          <button
            onClick={() => setActiveTab('CAPITAL')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'CAPITAL'
                ? 'bg-amber-800 text-white shadow-xs'
                : 'text-[#5D4037] hover:text-[#2B1713] hover:bg-stone-200/60'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>Setoran Modal</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === 'CAPITAL' ? 'bg-amber-900 text-amber-100' : 'bg-stone-200 text-stone-700'
              }`}
            >
              {capitalRecords.length}
            </span>
          </button>

          {/* Sub-tab 4: Hutang & Piutang */}
          <button
            onClick={() => setActiveTab('DEBT_RECEIVABLE')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'DEBT_RECEIVABLE'
                ? 'bg-amber-800 text-white shadow-xs'
                : 'text-[#5D4037] hover:text-[#2B1713] hover:bg-stone-200/60'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Hutang & Piutang</span>
            {unpaidDebtCount > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'DEBT_RECEIVABLE' ? 'bg-rose-900 text-rose-100' : 'bg-rose-100 text-rose-700'
                }`}
              >
                {unpaidDebtCount} aktif
              </span>
            )}
          </button>
        </div>

        {/* Current Active Outlet Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#FAF3DD]/80 border border-[#D7CCC8]/60 rounded-xl text-xs">
          <Building2 className="w-4 h-4 text-amber-800 shrink-0" />
          <span className="text-[#5D4037] font-medium hidden sm:inline">Cabang Sesi:</span>
          <span className="font-bold text-[#2B1713]">{activeOutlet?.name || 'Semua Cabang'}</span>
        </div>
      </div>

      {/* Sub-tab Content Render */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'CASH_LEDGER' && (
          <CashLedgerTab
            cashLedgers={cashLedgers}
            outlets={outlets}
            activeOutlet={activeOutlet}
            currentUser={currentUser}
            ingredients={ingredients}
            onAddLedger={onAddCashLedger}
            onDeleteLedger={onDeleteCashLedger}
          />
        )}

        {activeTab === 'FIXED_ASSETS' && (
          <FixedAssetsTab
            fixedAssets={fixedAssets}
            outlets={outlets}
            activeOutlet={activeOutlet}
            currentUser={currentUser}
            onAddAsset={onAddFixedAsset || (() => {})}
            onUpdateAsset={onUpdateFixedAsset}
            onDeleteAsset={onDeleteFixedAsset || (() => {})}
          />
        )}

        {activeTab === 'CAPITAL' && (
          <CapitalRecordsTab
            capitalRecords={capitalRecords}
            outlets={outlets}
            activeOutlet={activeOutlet}
            currentUser={currentUser}
            onAddCapital={onAddCapitalRecord}
            onDeleteCapital={onDeleteCapitalRecord}
          />
        )}

        {activeTab === 'DEBT_RECEIVABLE' && (
          <DebtReceivablesTab
            debtRecords={debtRecords}
            outlets={outlets}
            activeOutlet={activeOutlet}
            currentUser={currentUser}
            onAddDebt={onAddDebtRecord}
            onAddPayment={onAddDebtPayment}
            onDeleteDebt={onDeleteDebtRecord}
          />
        )}
      </motion.div>
    </div>
  );
};
