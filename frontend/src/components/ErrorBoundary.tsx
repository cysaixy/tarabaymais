import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: React.ReactNode;
  /** Optional label shown in the error UI to help identify which area crashed. */
  area?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Class-based error boundary (React requires a class component for this).
 * Catches synchronous render errors and unhandled promise rejections that
 * bubble up through the React tree, replacing the crashed subtree with a
 * recoverable error UI instead of a white screen.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : "Hindi kilalang error.";
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // Surface the full stack in dev so developers can diagnose quickly.
    console.error(
      `[ErrorBoundary${this.props.area ? ` • ${this.props.area}` : ""}]`,
      error,
      info.componentStack,
    );
  }

  private handleRetry = () => {
    this.setState({ hasError: false, message: "" });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-950 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/15">
          <AlertTriangle className="h-8 w-8 text-rose-400" aria-hidden="true" />
        </div>

        <div className="max-w-sm">
          <h2 className="text-xl font-bold text-white">
            May naganap na problema
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {this.props.area
              ? `Hindi ma-load ang ${this.props.area}.`
              : "Hindi ma-load ang page na ito."}
            {" "}I-refresh ang page o subukang muli.
          </p>
          {process.env.NODE_ENV === "development" && this.state.message && (
            <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-slate-800 px-3 py-2 text-left text-xs text-rose-300">
              {this.state.message}
            </pre>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={this.handleRetry}
            className="flex min-h-[48px] items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-500 active:scale-95 cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Subukan muli
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex min-h-[48px] items-center gap-2 rounded-xl border border-slate-700 px-5 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 active:scale-95 cursor-pointer"
          >
            I-refresh ang page
          </button>
        </div>
      </div>
    );
  }
}
