"use client";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

export function SubmitButton(props: React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return <Button {...props} disabled={props.disabled || pending}>{pending ? "Saving…" : props.children}</Button>;
}
