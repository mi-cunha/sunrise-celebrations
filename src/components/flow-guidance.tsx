import Link from "next/link";

type FlowStep = {
  label: string;
  description: string;
  status: "done" | "current" | "pending";
};

export function FlowProgress({ steps }: { steps: FlowStep[] }) {
  return (
    <section className="mt-6 rounded-2xl border border-[#dbe3dc] bg-white p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[.16em] text-[#28608f]">Fluxo do atendimento</p>
          <h2 className="mt-2 text-xl font-semibold text-[#092f4f]">Onde este cliente está agora</h2>
        </div>
        <div className="grid flex-1 gap-3 md:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.label} className={`rounded-xl border p-4 ${stepTone[step.status]}`}>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-semibold shadow-sm">{index + 1}</span>
                <span className="font-semibold text-[#18352d]">{step.label}</span>
              </div>
              <p className="mt-2 text-sm leading-5 text-slate-600">{step.description}</p>
            </div>
          ))}
        </div>
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
    <section className={`mt-6 rounded-2xl border p-5 ${nextStepTone[tone]}`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[.16em] text-[#28608f]">Próximo passo</p>
          <h2 className="mt-2 text-xl font-semibold text-[#092f4f]">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
          {children}
        </div>
        {action}
        {href && (
          <Link href={href} className="inline-flex rounded-lg bg-[#18352d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#23483d]">
            {ctaLabel}
          </Link>
        )}
      </div>
    </section>
  );
}

const stepTone = {
  done: "border-[#cfe2d3] bg-[#f6fbf7]",
  current: "border-[#c5d7e5] bg-[#f7fbff] ring-1 ring-[#c5d7e5]",
  pending: "border-[#edf1ee] bg-[#fbfaf7]",
} as const;

const nextStepTone = {
  info: "border-[#c5d7e5] bg-[#f7fbff]",
  success: "border-[#cfe2d3] bg-[#f6fbf7]",
  warning: "border-[#ead8ae] bg-[#fffaf0]",
} as const;
