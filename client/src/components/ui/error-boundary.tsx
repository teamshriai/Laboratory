import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  /** Rendered instead of the children after an error; `reset` retries. */
  fallback: (reset: () => void) => ReactNode
  /** Changing this clears a caught error (e.g. a different record id). */
  resetKey?: unknown
  children: ReactNode
}

interface State {
  failed: boolean
  resetKey: unknown
}

/**
 * Contains a rendering failure to one part of the screen (a drawer, a panel)
 * so the rest of the application keeps working. Details go to the console in
 * development only; users see a plain explanation and a way to retry.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, resetKey: this.props.resetKey }

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true }
  }

  static getDerivedStateFromProps(props: Props, state: State) {
    return props.resetKey === state.resetKey
      ? null
      : { failed: false, resetKey: props.resetKey }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error(error, info.componentStack)
  }

  reset = () => this.setState({ failed: false })

  render() {
    return this.state.failed
      ? this.props.fallback(this.reset)
      : this.props.children
  }
}
