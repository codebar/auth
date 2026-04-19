const config = {
  port: process.env.PORT || 3000,
  base_url: process.env.CODEBAR_AUTH_URL || "http://localhost:3000",
  database_url: process.env.DATABASE_URL || "./auth.db",
  allowed_redirects: ["http://localhost:3000/demo"],
  social: {
    github: {
      id: process.env.GITHUB_CLIENT_ID,
      secret: process.env.GITHUB_CLIENT_SECRET,
    },
  },
};

export default config;
