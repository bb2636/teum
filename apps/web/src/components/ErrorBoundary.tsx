import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F5F0EB] p-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-sm">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">
              문제가 발생했습니다
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              일시적인 오류가 발생했습니다. 다시 시도해 주세요.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/';
              }}
              className="w-full py-3 bg-[#4A2C1A] hover:bg-[#3A2010] text-white rounded-full font-medium transition-colors"
            >
              홈으로 돌아가기
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
