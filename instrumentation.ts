export async function register() {
  if (process.env.NEXT_RUNTIME !== "edge") {
    const [{ createWorld }, { setWorld }] = await Promise.all([
      import("@workflow/world-postgres"),
      import("workflow/runtime"),
    ]);
    const world = createWorld();
    setWorld(world);
    await world.start();
  }
}
