import React from "react";
import { createRoot } from "react-dom/client";
import HostedApp from "./HostedApp.jsx";
import "./styles.css";
import "./car.css";

class ErrorBoundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    if (this.state.error)
      return (
        <main className="fatal">
          <h1>Let’s get back on track.</h1>
          <p>
            Something interrupted the tutor. Your saved progress is still on
            this device.
          </p>
          <button onClick={() => location.reload()}>Reload Wortwerk</button>
        </main>
      );
    return this.props.children;
  }
}
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HostedApp />
    </ErrorBoundary>
  </React.StrictMode>,
);
