import { tr } from "./i18n";
import { useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { EditorView, basicSetup } from "codemirror";
import { json } from "@codemirror/lang-json";
import { X } from "lucide-react";
export function Button({
  variant = "default",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "danger" | "quiet";
}) {
  return <button className={`button ${variant} ${className}`} {...props} />;
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <div
      role={error ? "alert" : "status"}
      className={`notice ${error ? "error" : ""}`}
    >
      {children}
    </div>
  );
}
export function Drawer({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="drawer">
          <header>
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button className="icon-button" aria-label={tr("关闭")}>
                <X size={16} />
              </button>
            </Dialog.Close>
          </header>
          <Dialog.Description className="sr-only">
            {title}
            {tr("的操作和详细信息")}
          </Dialog.Description>
          <div className="drawer-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function JsonEditor({
  value,
  onChange,
  label = "JSON",
  readOnly = false,
}: {
  value: string;
  onChange?: (v: string) => void;
  label?: string;
  readOnly?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null),
    view = useRef<EditorView | null>(null),
    change = useRef(onChange);
  change.current = onChange;
  useEffect(() => {
    const v = new EditorView({
      doc: value,
      extensions: [
        basicSetup,
        json(),
        EditorView.lineWrapping,
        EditorView.editable.of(!readOnly),
        EditorView.contentAttributes.of({ "aria-label": label }),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) change.current?.(u.state.doc.toString());
        }),
      ],
      parent: ref.current!,
    });
    view.current = v;
    return () => v.destroy();
  }, [readOnly, label]);
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value)
      v.dispatch({
        changes: { from: 0, to: v.state.doc.length, insert: value },
      });
  }, [value]);
  return <div className="json-editor" ref={ref} />;
}
