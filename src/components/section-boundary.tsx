import { Component, type ErrorInfo, type ReactNode } from "react";

import { logger } from "@/lib/logger";

type Props = {
  name: string;
  children: ReactNode;
  fallback?: ReactNode;
};

type State = { hasError: boolean };

/**
 * Local error boundary for a page section.
 * Isolates data-shape failures so one broken block doesn't blank the whole page.
 */
export class SectionBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error(`section:${this.props.name}`, error.message, {
      stack: info.componentStack ?? undefined,
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      this.props.fallback ?? (
        <p className="text-sm" role="alert" style={{ color: "var(--pf-cinnabar)" }}>
          Не удалось показать раздел «{this.props.name}».
        </p>
      )
    );
  }
}
