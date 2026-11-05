import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles/foundations.css";
import "./styles/components.css";
import "./room/room.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");
createRoot(root).render(createElement(App));
