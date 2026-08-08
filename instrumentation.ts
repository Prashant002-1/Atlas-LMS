export async function register() {
  if (process.env.NEXT_RUNTIME !== "edge") {
    if (!process.env.WORKFLOW_POSTGRES_URL) {
      throw new Error(
        "WORKFLOW_POSTGRES_URL is required. Copy .env.example to .env.local and run npm run workflow:bootstrap."
      );
    }

    const [{ createWorld }, { setWorld }] = await Promise.all([
      import("@workflow/world-postgres"),
      import("workflow/runtime"),
    ]);
    const world = createWorld();
    setWorld(world);
    await world.start();
  }
}
