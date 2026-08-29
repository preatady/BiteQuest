import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error?.message || String(error), errorInfo?.componentStack || '');
    this.setState({ errorInfo });
  }

  private handleQuickRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleSafeModeReset = () => {
    try {
      localStorage.removeItem('bitequest_map_mode');
    } catch {
      // ignore
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleFullReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#FDFCF8] flex flex-col items-center justify-center p-6 text-center select-none" id="error-boundary-screen">
          <div className="w-16 h-16 bg-[#FF6B35]/10 rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-sm border border-[#FF6B35]/20 animate-bounce">
            🍜
          </div>
          <h1 className="font-heading text-xl font-bold text-[#2D2926] mb-2">
            {this.props.fallbackTitle || 'Đang làm mới dữ liệu BiteQuest'}
          </h1>
          <p className="text-xs text-[#594139] max-w-sm mb-6 leading-relaxed">
            {this.props.fallbackMessage ||
              'Bản đồ khám phá ẩm thực vừa gặp gián đoạn tạm thời. Hãy thử kết nối lại hoặc khởi động lại ứng dụng.'}
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 mb-6">
            <button
              onClick={this.handleQuickRetry}
              className="h-11 px-6 bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white rounded-full font-heading text-xs font-bold shadow-md shadow-[#FF6B35]/30 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
              id="btn-error-quick-retry"
            >
              <span className="material-symbols-outlined text-[18px]">cached</span>
              <span>Thử kết nối lại</span>
            </button>

            <button
              onClick={this.handleSafeModeReset}
              className="h-11 px-5 bg-stone-100 hover:bg-stone-200 text-[#2D2926] rounded-full font-heading text-xs font-semibold border border-stone-200 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
              id="btn-error-safe-mode"
            >
              <span className="material-symbols-outlined text-[18px]">restart_alt</span>
              <span>Chế độ an toàn</span>
            </button>
          </div>

          {/* Collapsible Error Diagnostics for Developer / Diagnostics */}
          {this.state.error && (
            <div className="max-w-md w-full mt-4 text-left">
              <button
                type="button"
                onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                className="text-[11px] text-stone-400 hover:text-stone-600 transition-colors flex items-center gap-1 mx-auto cursor-pointer"
              >
                <span>{this.state.showDetails ? 'Ẩn chi tiết kỹ thuật' : 'Xem chi tiết lỗi'}</span>
                <span className="material-symbols-outlined text-[14px]">
                  {this.state.showDetails ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              {this.state.showDetails && (
                <div className="mt-2 p-3 bg-stone-900 text-stone-200 rounded-xl text-[11px] font-mono overflow-x-auto max-h-40 border border-stone-800">
                  <div className="text-red-400 font-bold mb-1">{this.state.error.name}: {this.state.error.message}</div>
                  {this.state.error.stack && (
                    <pre className="text-[10px] text-stone-400 whitespace-pre-wrap">{this.state.error.stack.slice(0, 500)}</pre>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
