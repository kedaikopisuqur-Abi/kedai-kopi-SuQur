import React, { ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle, Home, Database } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleCleanCache = () => {
    try {
      sessionStorage.clear();
      window.location.href = '/';
    } catch (e) {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FDFBF7] text-[#2B1713] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-[#EBE3D5] rounded-2xl p-6 md:p-8 shadow-xl text-center">
            <div className="w-16 h-16 bg-amber-50 border border-amber-200 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h1 className="font-serif text-2xl font-bold text-[#2B1713] mb-2">
              Terjadi Kendala Tampilan
            </h1>
            <p className="text-sm text-[#735A53] mb-6 leading-relaxed">
              Aplikasi mendeteksi gangguan sementara pada antarmuka. Data transaksi dan stok Anda tetap aman tersimpan di penyimpanan lokal.
            </p>

            {this.state.error && (
              <div className="bg-[#FAF8F5] border border-[#EFECE6] rounded-xl p-3 text-left text-xs font-mono text-stone-600 mb-6 max-h-32 overflow-y-auto">
                <p className="font-semibold text-red-600 mb-1">{this.state.error.name}: {this.state.error.message}</p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="text-[10px] text-stone-400 whitespace-pre-wrap">{this.state.errorInfo.componentStack.slice(0, 300)}...</pre>
                )}
              </div>
            )}

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-3 px-4 bg-[#4A2821] hover:bg-[#381E19] text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Muat Ulang Aplikasi
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="py-2.5 px-3 bg-[#F5F2EB] hover:bg-[#EBE5DA] text-[#4A2821] text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Home className="w-3.5 h-3.5" />
                  Coba Buka Ulang
                </button>
                <button
                  type="button"
                  onClick={this.handleCleanCache}
                  className="py-2.5 px-3 bg-[#F5F2EB] hover:bg-[#EBE5DA] text-[#4A2821] text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Database className="w-3.5 h-3.5" />
                  Segarkan Sesi
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
