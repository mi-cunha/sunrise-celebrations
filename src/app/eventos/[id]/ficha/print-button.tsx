"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full bg-[#0b2742] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#143d63] active:scale-[0.99] print:hidden"
    >
      Imprimir / salvar PDF
    </button>
  );
}
