"use client";

import { useState } from "react";

/**
 * One optional question, on the page where someone is deciding whether this is worth paying for.
 *
 * Optional in the way that actually matters: it is not a modal, it does not block the page, and
 * dismissing it takes one click and is remembered. A survey that interrupts the purchase it is trying
 * to understand costs more than the answer is worth.
 */
export function UpgradeSurvey({ question, maxLength }: { question: string; maxLength: number }) {
  const [answer, setAnswer] = useState("");
  const [state, setState] = useState<"open" | "sent" | "closed">("open");
  const [busy, setBusy] = useState(false);

  if (state === "closed") return null;
  if (state === "sent") {
    return <p className="survey-thanks" role="status">Thank you — that genuinely helps.</p>;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!answer.trim() || busy) return;
    setBusy(true);
    try {
      await fetch("/api/activation/survey", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answer: answer.trim() }),
      });
    } catch {
      // Nothing to report and nothing to retry: the answer is a nicety, and telling someone their
      // optional survey failed is worse than losing it.
    }
    setState("sent");
  }

  return (
    <form className="survey" onSubmit={submit}>
      <label className="survey-question" htmlFor="survey-answer">{question}</label>
      <div className="survey-row">
        <input
          id="survey-answer"
          name="answer"
          type="text"
          maxLength={maxLength}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="One line is plenty"
          autoComplete="off"
        />
        <button type="submit" disabled={busy || !answer.trim()}>Send</button>
        <button type="button" className="survey-dismiss" onClick={() => setState("closed")}>No thanks</button>
      </div>
    </form>
  );
}
