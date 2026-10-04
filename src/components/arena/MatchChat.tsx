import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
  authorName: string;
  avatarUrl?: string | null;
};

export const QUICK_MESSAGES = [
  "Boa jogada! 👏",
  "Boa sorte 🍀",
  "Ups… 😅",
  "Estou a pensar 🤔",
  "GG 🔥",
];

type Props = {
  messages: ChatMessage[];
  onSend: (body: string) => void | Promise<void>;
  disabled?: boolean;
  title?: string;
};

export function MatchChat({
  messages,
  onSend,
  disabled = false,
  title = "Chat da partida",
}: Props) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  async function submit(body: string) {
    const text = body.trim();
    if (!text || disabled || sending) return;
    setSending(true);
    try {
      await onSend(text);
      setValue("");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="arena-card mt-5 flex flex-col overflow-hidden" aria-label={title}>
      <h2 className="border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>

      <div className="max-h-56 min-h-24 space-y-2 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Sem mensagens. Diz olá ao teu adversário.
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex gap-2 ${m.mine ? "flex-row-reverse" : ""}`}>
              {m.avatarUrl ? (
                <img
                  src={m.avatarUrl}
                  alt=""
                  className="mt-0.5 size-7 shrink-0 rounded-full bg-surface-2"
                />
              ) : (
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-xs">
                  {m.authorName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className={`max-w-[78%] ${m.mine ? "text-right" : ""}`}>
                <p className="text-[11px] text-muted-foreground">
                  {m.authorName} ·{" "}
                  {new Date(m.createdAt).toLocaleTimeString("pt-PT", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <p
                  className={`mt-0.5 inline-block rounded-2xl px-3 py-1.5 text-sm ${
                    m.mine ? "bg-primary text-primary-foreground" : "bg-surface-2 text-foreground"
                  }`}
                >
                  {m.body}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <div className="flex gap-1.5 overflow-x-auto border-t border-border px-3 py-2">
        {QUICK_MESSAGES.map((quick) => (
          <button
            key={quick}
            type="button"
            disabled={disabled || sending}
            onClick={() => void submit(quick)}
            className="shrink-0 rounded-full bg-surface-2 px-3 py-1 text-xs disabled:opacity-50"
          >
            {quick}
          </button>
        ))}
      </div>

      <form
        className="flex items-center gap-2 border-t border-border px-3 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(value);
        }}
      >
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Escreve uma mensagem…"
          maxLength={280}
          disabled={disabled}
          aria-label="Mensagem"
          className="h-10"
        />
        <Button
          type="submit"
          size="icon"
          className="size-10 shrink-0"
          disabled={disabled || sending}
        >
          <Send className="size-4" aria-hidden="true" />
          <span className="sr-only">Enviar</span>
        </Button>
      </form>
    </section>
  );
}
