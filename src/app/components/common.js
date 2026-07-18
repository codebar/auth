import { html } from "hono/html";

// Form section wrapper
export const FormSection = ({ children }) => html` <div>${children}</div> `;

// Message display component
export const Message = ({ error, success }) => html`
  ${
    error
      ? html`<div class="pico-background-red-50">
          ${decodeURIComponent(error)}
        </div>`
      : ""
  }
  ${
    success
      ? html`<div class="pico-background-green-50">
          ${decodeURIComponent(success)}
        </div>`
      : ""
  }
`;
