import { Component, type ReactNode } from "react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.props.onError?.(error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{ padding: 16, color: "#b45309", fontSize: 13 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Something went wrong</div>
          <div style={{ color: "#64748b", fontSize: 12 }}>{this.state.error?.message}</div>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ marginTop: 8, padding: "4px 12px", border: "1px solid #e2e8f0", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
