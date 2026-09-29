"use client";
import { useActionState } from "react";

export function ActionForm({ action, children, ...props }: Omit<React.ComponentProps<"form">, "action"> & {
  action: (data: FormData) => Promise<void | { error: string }>;
}) {
  const [state, submit, pending] = useActionState<{ error?: string; message?: string }, FormData>(async (_previous, data) => {
    return (await action(data)) ?? { message: "Saved." };
  }, {});
  return <form {...props} action={submit}>
    {children}
    <p role="status" className={`mt-2 text-sm ${state.error ? "text-red-800" : "text-muted"}`}>
      {pending ? "Saving…" : state.error ?? state.message}
    </p>
  </form>;
}
