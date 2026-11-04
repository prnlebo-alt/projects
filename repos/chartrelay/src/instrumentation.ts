// Runs once when the server starts. Node-only checks live in a separate module so the Edge bundle never sees them.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./instrumentation-node");
}
