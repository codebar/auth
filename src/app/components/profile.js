import { html } from "hono/html";
import { format } from "date-fns";

export const UserInfo = ({ user }) => html`
  <div class="card">
    <div class="card-header card-header-cb">
      <h2 class="h5 mb-0">User Information</h2>
    </div>
    <div class="card-body">
      <dl class="row mb-0">
        <dt class="col-sm-3">Name</dt>
        <dd class="col-sm-9">${user.name}</dd>
        <dt class="col-sm-3">Email</dt>
        <dd class="col-sm-9">${user.email}</dd>
        <dt class="col-sm-3">Email verified</dt>
        <dd class="col-sm-9">${user.emailVerified ? "Yes" : "No"}</dd>
        <dt class="col-sm-3">Member since</dt>
        <dd class="col-sm-9">
          ${format(new Date(user.createdAt), "dd MMM yyyy")}
        </dd>
      </dl>
    </div>
  </div>
`;
