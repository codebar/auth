import { html } from "hono/html";

// Message display component
export const Message = ({ error, success, info } = {}) => html`
  ${
    error
      ? html`<div class="alert alert-cb-error mb-3">
          ${decodeURIComponent(error)}
        </div>`
      : ""
  }
  ${
    success
      ? html`<div class="alert alert-cb-success mb-3">
          ${decodeURIComponent(success)}
        </div>`
      : ""
  }
  ${
    info
      ? html`<div class="alert alert-cb-info mb-3">
          ${decodeURIComponent(info)}
        </div>`
      : ""
  }
`;
