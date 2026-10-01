// Everything is bundled from npm (no CDN scripts): React, the compiled Tailwind stylesheet and the font come in here.
import { createRoot } from "react-dom/client";
import "./styles/app.css";
import { App } from "./App.jsx";

createRoot(document.getElementById("root")).render(<App />);
