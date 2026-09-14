"use client";

import { useState, useTransition } from "react";
import { startMockInterview, scoreMockInterview } from "@/lib/interview-practice/actions";
import type { MockScoring } from "@/lib/ai/mock-interview-schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Step = "idle" | "answering" | "result";

export default function MockInterview({ jobId }: { jobId: string }) {
  const [step, setStep] = useState<Step>("idle");
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<MockScoring | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function begin() {
    setError(null);
    startTransition(async () => {
      const res = await startMockInterview(jobId);
      if (res.ok) {
        setQuestions(res.questions);
        setAnswers(res.questions.map(() => ""));
        setStep("answering");
      } else setError(res.error);
    });
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const qa = questions.map((question, i) => ({ question, answer: answers[i] ?? "" }));
      const res = await scoreMockInterview(jobId, qa);
      if (res.ok) {
        setResult(res.result);
        setStep("result");
      } else setError(res.error);
    });
  }

  function reset() {
    setStep("idle");
    setQuestions([]);
    setAnswers([]);
    setResult(null);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {step === "idle" && (
        <div>
          <p className="text-sm text-muted-foreground">
            AI sẽ tạo {`5`} câu hỏi phỏng vấn dựa trên tin này. Trả lời rồi nhận nhận xét & điểm.
          </p>
          <Button className="mt-3" onClick={begin} disabled={isPending}>
            {isPending ? "Đang tạo câu hỏi..." : "Bắt đầu phỏng vấn thử"}
          </Button>
        </div>
      )}

      {step === "answering" && (
        <div className="flex flex-col gap-4">
          {questions.map((q, i) => (
            <div key={i}>
              <p className="font-medium text-foreground">Câu {i + 1}: {q}</p>
              <Textarea
                className="mt-1"
                rows={3}
                value={answers[i] ?? ""}
                onChange={(e) => setAnswers((a) => a.map((v, j) => (j === i ? e.target.value : v)))}
                placeholder="Câu trả lời của bạn..."
              />
            </div>
          ))}
          <Button onClick={submit} disabled={isPending} className="self-start">
            {isPending ? "Đang chấm..." : "Nộp & chấm điểm"}
          </Button>
        </div>
      )}

      {step === "result" && result && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="text-3xl font-bold text-brand-gradient">{result.overall.score}/100</div>
            <p className="mt-1 text-sm text-foreground">{result.overall.summary}</p>
            {result.overall.tips.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                {result.overall.tips.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            )}
          </div>
          <div className="flex flex-col gap-3">
            {result.perAnswer.map((a, i) => (
              <div key={i} className="rounded-xl border border-border p-3">
                <p className="text-sm font-medium text-foreground">Câu {i + 1}: {questions[i]}</p>
                <p className="mt-1 text-sm text-primary">Điểm: {a.score}/10</p>
                <p className="mt-1 text-sm text-muted-foreground">{a.feedback}</p>
              </div>
            ))}
          </div>
          <Button variant="outline" onClick={reset} className="self-start">Làm lại</Button>
        </div>
      )}
    </div>
  );
}
