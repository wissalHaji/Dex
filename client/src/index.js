import React from "react";
import ReactDOM from "react-dom";
import App from "./layout/App";
import reportWebVitals from "./reportWebVitals";
import { generateStore, Drizzle } from "@drizzle/store";
import drizzleOptions from "./drizzle/drizzleOptions";
import logger from "redux-logger";
import { Provider as ReduxProvider } from "react-redux";
import { DrizzleProvider } from "./drizzle/drizzleContext";
import LoadingContainer from "./pages/LodingContainer";

import "bootstrap/dist/css/bootstrap.min.css";
import "./assets/scss/index.scss";

const store = generateStore({
  drizzleOptions,
  appMiddlewares: [logger],
});

const drizzle = new Drizzle(drizzleOptions, store);

ReactDOM.render(
  <React.StrictMode>
    <ReduxProvider store={drizzle.store}>
      <DrizzleProvider drizzle={drizzle}>
        <LoadingContainer>
          <App />
        </LoadingContainer>
      </DrizzleProvider>
    </ReduxProvider>
  </React.StrictMode>,
  document.getElementById("root")
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
