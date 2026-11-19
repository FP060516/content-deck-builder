/** Next.js calls this once when the server starts: boot the background job worker. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startWorker } = await import("./lib/jobs/worker");
    startWorker();
  }
}
