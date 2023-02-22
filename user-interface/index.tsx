import React from "react";
import ReactDOM from "react-dom";
import { App } from "./App";

// Importing the Bootstrap CSS
import "bootstrap/dist/css/bootstrap.min.css";

const root = document.createElement("div");
document.body.appendChild(root);
ReactDOM.render(<App />, root);
