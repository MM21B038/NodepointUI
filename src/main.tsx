import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
// Removed "aframe" import as it's causing conflicts with aframe-extras, which is not directly used.

createRoot(document.getElementById("root")!).render(<App />);