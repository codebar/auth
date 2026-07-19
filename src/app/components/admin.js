import { html } from "hono/html";
import { formatISO } from "date-fns";

export const UsersList = ({ users, total }) => html`
  <div class="card">
    <div class="card-header card-header-cb">
      <h3 class="h5 mb-0">Users (${total} total)</h3>
    </div>
    ${
      users && users.length > 0
        ? html`
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Verified</th>
                    <th>Role</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  ${users.map(
                    (user) => html`
                      <tr>
                        <td>${user.name}</td>
                        <td>${user.email}</td>
                        <td>${user.emailVerified ? "✅" : "❌"}</td>
                        <td>
                          <form method="post" action="/admin/user/role">
                            <input
                              type="hidden"
                              name="userId"
                              value="${user.id}"
                            />
                            <select
                              name="role"
                              class="form-select form-select-sm"
                              onchange="this.form.submit()"
                            >
                              <option
                                value="user"
                                ${user.role === "user" ? "selected" : ""}
                              >
                                User
                              </option>
                              <option
                                value="admin"
                                ${user.role === "admin" ? "selected" : ""}
                              >
                                Admin
                              </option>
                            </select>
                          </form>
                        </td>
                        <td class="text-nowrap">
                          ${formatISO(new Date(user.createdAt), {
                            representation: "date",
                          })}
                        </td>
                      </tr>
                    `,
                  )}
                </tbody>
              </table>
            </div>
          `
        : html`<div class="card-body">
            <p class="mb-0 text-muted">No users found.</p>
          </div>`
    }
  </div>
`;
