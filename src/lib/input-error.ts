export class InputError extends Error {}

export async function runFormAction(run: () => Promise<void>): Promise<void | { error: string }> {
  try { await run(); }
  catch (error) {
    if (error instanceof InputError) return { error: error.message };
    throw error;
  }
}
