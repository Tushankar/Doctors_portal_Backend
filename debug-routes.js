// Simple route debug test
import express from "express";
import authRoutes from "./routes/authRoutes.js";

const app = express();

console.log("Auth routes object:", authRoutes);
console.log(
  "Auth routes stack length:",
  authRoutes.stack ? authRoutes.stack.length : "no stack"
);

// Add the auth routes
app.use("/api/v1/auth", authRoutes);

// Test if we can find the route
const router = authRoutes;
if (router && router.stack) {
  console.log("\nRoutes in auth router:");
  router.stack.forEach((layer, index) => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods);
      console.log(`  ${methods[0].toUpperCase()} ${layer.route.path}`);
    } else {
      console.log(`  Middleware ${index}`);
    }
  });
}

console.log("\nStarting test server on port 3001...");
const server = app.listen(3001, () => {
  console.log("Test server running on port 3001");

  // Test the route
  import("axios").then((axios) => {
    axios.default
      .get("http://localhost:3001/api/v1/auth/me")
      .then((response) => {
        console.log("Success:", response.data);
      })
      .catch((error) => {
        console.log(
          "Expected error (no auth):",
          error.response?.status,
          error.response?.data
        );
      })
      .finally(() => {
        server.close();
        process.exit(0);
      });
  });
});
