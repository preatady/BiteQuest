import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error?.message || String(error), errorInfo?.componentStack || '');
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#FDFCF8] flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="w-16 h-16 bg-[#FF6B35]/10 rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-sm border border-[#FF6B35]/20">
            🍜
          </div>
          <h1 className="font-heading text-xl font-bold text-[#2D2926] mb-2">
            {this.props.fallbackTitle || 'Đang làm mới dữ liệu BiteQuest'}
          </h1>
          <p className="text-xs text-[#594139] max-w-sm mb-6 leading-relaxed">
            {this.props.fallbackMessage ||
              'Ứng dụng vừa gặp gián đoạn hiển thị tạm thời. Nhấn nút bên dưới để tiếp tục hành trình khám phá ẩm thực.'}
          </p>
          <button
            onClick={this.handleReset}
            className="h-11 px-6 bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white rounded-full font-heading text-xs font-bold shadow-md shadow-[#FF6B35]/30 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            <span>Khởi động lại ứng dụng</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
