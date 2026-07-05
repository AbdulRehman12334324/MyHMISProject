import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import HIMSIntakeForm from "./HIMSIntakeForm";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <HIMSIntakeForm />
  </StrictMode>
);
