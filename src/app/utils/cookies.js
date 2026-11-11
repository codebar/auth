// Helper function to forward Set-Cookie headers from better-auth response
export const forwardCookies = (headers, c) => {
  const setCookieHeaders = headers.getSetCookie?.() || [];
  setCookieHeaders.forEach((cookie) => {
    c.header("Set-Cookie", cookie, { append: true });
  });
};
