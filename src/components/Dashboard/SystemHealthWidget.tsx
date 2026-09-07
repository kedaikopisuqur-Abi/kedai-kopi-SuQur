import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Wrench,
  Wifi,
  Building2,
  DollarSign,
  Layers,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import {
  SystemHealthReport,
  HealthIssue,
  PillarStatus,
  runSystemHealthCheck,
  executeAutoFix,
} from '../../utils/systemHealth';

interface SystemHealthWidgetProps {
  onRefreshData?: () => void;
  activeOutletId?: string;
}

export const SystemHealthWidget: React.FC<SystemHealthWidgetProps> = ({
  onRefreshData,
  activeOutletId,
}) => {
  const [report, setReport] = useState<SystemHealthReport>(() => runSystemHealthCheck());
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [fixingActionKey, setFixingActionKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);

  const handleScan四周 = useCallback(() => {
    setIsScanning(true);
    setTimeout(() => {
      const newReport = runSystemHealthCheck();
      setReport(newReport);
      setIsScanning(false);
    }, 400);
  }, []);

  useEffect(() => {
    const handleHealthUpdate = (e: any) => {
      if (e.detail) {
        setReport(e.detail);
      }
    };
    window.addEventListener('system_health_updated', handleHealthUpdate);
    return () => {
      window.removeEventListener('system_health_updated', handleHealthUpdate);
    };
  }, []);

  const handleExecuteFix = useCallback(
    async (actionKey: string) => {
      setFixingActionKey(actionKey);
      try {
        const res = await executeAutoFix(actionKey, { targetOutletId: activeOutletId });
        setReport(res.report);
        setToastMessage(res.message);
        if (onRefreshData) {
          onRefreshData();
        }
      } catch (err: any) {
        setToastMessage(`⚠️ Gagal melakukan perbaikan: ${err?.message || 'Terjadi kesalahan'}`);
      } finally {
        setFixingActionKey(null);
        setTimeout(() => {
          setToastMessage(null);
        }, 4000);
      }
    },
    [activeOutletId, onRefreshData]
  );

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (score >= 70) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-rose-700 bg-rose-50 border-rose-200';
  };

  const getPillarIcon = (category: string) => {
    switch (category) {
      case 'connection':
        return <Wifi className="w-3 h-3" />;
      case 'outlet_id':
        return <Building2 className="w-3 h-3" />;
      case 'cogs_hpp':
        return <DollarSign className="w-3 h-3" />;
      case 'stock_sync':
      default:
        return <Layers className="w-3 h-3" />;
    }
  };

  const isAllHealthy = report.totalIssues === 0 && report.healthScore >= 90;

  return (
    <div
      id="system-health-widget"
      className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-2xs transition-all space-y-3"
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="p-2.5 bg-slate-900 text-white rounded-xl border border-slate-800 shadow-sm flex items-center justify-between text-xs font-medium"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-white text-[11px] underline ml-2 shrink-0 cursor-pointer"
            >
              Tutup
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Compact Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
        {/* Left: Score & Status */}
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          <div
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center border shrink-0 ${
              isAllHealthy
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : report.healthScore >= 70
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            {isAllHealthy ? (
              <ShieldCheck className="w-4 h-4" />
            ) : (
              <ShieldAlert className="w-4 h-4" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-900">Integritas Sistem</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${getScoreColor(
                  report.healthScore
                )}`}
              >
                {report.healthScore}% Sehat
              </span>
              {report.totalIssues > 0 && (
                <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                  {report.totalIssues} Perlu Perbaikan
                </span>
              )}
            </div>
          </div>

          {/* 4 Mini Pillar Badges */}
          <div className="hidden sm:flex items-center gap-1.5 ml-1 flex-wrap">
            {(Object.values(report.pillars) as PillarStatus[]).map((p) => {
              const ok = p.status === 'healthy';
              return (
                <div
                  key={p.category}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border ${
                    ok
                      ? 'bg-slate-50 text-slate-700 border-slate-200'
                      : 'bg-amber-50 text-amber-900 border-amber-200'
                  }`}
                  title={`${p.name}: ${p.summary}`}
                >
                  {getPillarIcon(p.category)}
                  <span>{p.name.split(' ')[0]}</span>
                  {ok ? (
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Actions & Toggle */}
        <div className="flex items-center gap-1.5 shrink-0 self-end lg:self-center">
          <button
            onClick={handleScan四周}
            disabled={isScanning || fixingActionKey !== null}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all disabled:opacity-50 cursor-pointer"
            title="Pindai Ulang Seluruh Parameter Sistem"
          >
            <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Memindai...' : 'Pindai'}</span>
          </button>

          {report.totalIssues > 0 && (
            <button
              onClick={() => handleExecuteFix('fix_all_issues')}
              disabled={fixingActionKey !== null}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
            >
              <Wrench
                className={`w-3 h-3 text-amber-400 ${
                  fixingActionKey === 'fix_all_issues' ? 'animate-spin' : ''
                }`}
              />
              <span>
                {fixingActionKey === 'fix_all_issues' ? 'Memperbaiki...' : 'Perbaiki Otomatis'}
              </span>
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer"
            title={isExpanded ? 'Tutup Rincian' : 'Buka Rincian'}
          >
            <span className="text-[11px]">{isExpanded ? 'Tutup' : 'Rincian'}</span>
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Expandable Section: Pillars & Issues */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="pt-2 border-t border-slate-100 space-y-2.5"
          >
            {/* 4 Pillars Status Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.values(report.pillars) as PillarStatus[]).map((pillar) => {
                const isHealthy = pillar.status === 'healthy';
                const isWarning = pillar.status === 'warning';

                return (
                  <div
                    key={pillar.category}
                    className={`p-2 rounded-lg border text-xs ${
                      isHealthy
                        ? 'bg-slate-50 border-slate-200'
                        : isWarning
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-rose-50 border-rose-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-slate-900 truncate text-[11px]">
                        {pillar.name}
                      </span>
                      {isHealthy ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                      {pillar.summary}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Detected Issues List or All-Healthy State */}
            {report.totalIssues === 0 ? (
              <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center gap-2 text-emerald-900 text-xs">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-medium text-[11px]">
                  Semua sistem, HPP, alokasi outletId, dan antrean data lokal dalam kondisi optimal 100%.
                </span>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
                {report.issues.map((issue: HealthIssue) => {
                  const isCritical = issue.severity === 'critical';
                  const isWarning = issue.severity === 'warning';
                  const isExpandedItem = expandedIssueId === issue.id;
                  const isFixing =
                    fixingActionKey === issue.actionKey || fixingActionKey === 'fix_all_issues';

                  return (
                    <div
                      key={issue.id}
                      className={`p-2.5 rounded-lg border text-xs ${
                        isCritical
                          ? 'bg-rose-50/70 border-rose-200'
                          : isWarning
                          ? 'bg-amber-50/70 border-amber-200'
                          : 'bg-blue-50/70 border-blue-200'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`px-1 py-0.2 rounded text-[8.5px] font-black uppercase ${
                                isCritical
                                  ? 'bg-rose-600 text-white'
                                  : isWarning
                                  ? 'bg-amber-600 text-white'
                                  : 'bg-blue-600 text-white'
                              }`}
                            >
                              {issue.severity}
                            </span>
                            <span className="font-bold text-slate-900 text-xs">{issue.title}</span>
                            <span className="text-[9.5px] text-slate-500 bg-white px-1 py-0.2 rounded border border-slate-200 font-mono">
                              {issue.impactedCount} item
                            </span>
                          </div>
                          <p className="text-[10.5px] text-slate-600">{issue.description}</p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                          {issue.details && issue.details.length > 0 && (
                            <button
                              onClick={() =>
                                setExpandedIssueId(isExpandedItem ? null : issue.id)
                              }
                              className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
                            >
                              {isExpandedItem ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>
                          )}

                          <button
                            onClick={() => handleExecuteFix(issue.actionKey)}
                            disabled={isFixing}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                              isCritical
                                ? 'bg-rose-700 hover:bg-rose-800 text-white'
                                : isWarning
                                ? 'bg-amber-700 hover:bg-amber-800 text-white'
                                : 'bg-slate-900 hover:bg-slate-800 text-white'
                            } disabled:opacity-50`}
                          >
                            <Wrench className={`w-2.5 h-2.5 ${isFixing ? 'animate-spin' : ''}`} />
                            <span>{isFixing ? 'Memproses...' : issue.actionLabel}</span>
                          </button>
                        </div>
                      </div>

                      {isExpandedItem && issue.details && (
                        <div className="mt-1.5 pt-1.5 border-t border-slate-200 text-[10px] text-slate-700 bg-white/90 p-1.5 rounded font-mono">
                          <ul className="list-disc list-inside space-y-0.5">
                            {issue.details.map((det, idx) => (
                              <li key={idx}>{det}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
