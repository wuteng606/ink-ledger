import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { QuickApp } from "./QuickApp";
import { LedgerProvider } from "./lib/store";
import "./styles/app.css";
import "./styles/quick.css";

const isQuick = new URLSearchParams(window.location.search).get("view") === "quick";
if (!("__TAURI_INTERNALS__" in window)) document.body.classList.add("in-browser");
if (isQuick) document.body.classList.add("quick-mode");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LedgerProvider>{isQuick ? <QuickApp /> : <App />}</LedgerProvider>
  </React.StrictMode>
);
