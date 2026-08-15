import Link from "next/link";

type FlowStep = {
  label: string;
  description: string;
  status: "done" | "current" | "pending";
};

export function FlowProgress({ steps }: { steps: FlowStep[] }) {
  return (
    <section className="mt-4 rounded-lg border border-[#d9ded8] bg-[#fffdf8] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#083653]">Jornada do evento</h2>
      </div>
      <div className="grid gap-2 md:grid-cols-4">
        {steps.map((step, index) => (
          <div key={step.label} className={`rounded-lg border px-3 py-2 ${stepTone[step.status]}`}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#5f7180]">{index + 1}</span>
              <span className="text-sm font-semibold text-[#092f38]">{step.label}</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-[#5f7180]">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function NextStepCard({
  action,
  children,
  ctaLabel = "Abrir",
  description,
  href,
  title,
  tone = "info",
}: {
  action?: React.ReactNode;
  children?: React.ReactNode;
  ctaLabel?: string;
  description: string;
  href?: string;
  title: string;
  tone?: "info" | "success" | "warning";
}) {
  return (
    <section className={`mt-3 rounded-lg border px-3 py-2 ${nextStepTone[tone]}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#0f5f8f]">Próximo passo</p>
          <h2 className="mt-1 text-base font-semibold text-[#092f38]">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-[#5f7180]">{description}</p>
          {children}
        </div>
        {action}
        {href && (
          <Link href={href} className="inline-flex rounded-md bg-[#083653] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0f5f8f]">
            {ctaLabel}
          </Link>
        )}
      </div>
    </section>
  );
}

const stepTone = {
  done: "border-[#2f7d62]/25 bg-[#2f7d62]/8",
  current: "border-[#0f5f8f]/35 bg-[#dcecf6]",
  pending: "border-[#d9ded8] bg-white",
} as const;

const nextStepTone = {
  info: "border-[#0f5f8f]/35 bg-[#dcecf6]",
  success: "border-[#2f7d62]/25 bg-[#2f7d62]/8",
  warning: "border-[#b7791f]/30 bg-[#b7791f]/10",
} as const;
