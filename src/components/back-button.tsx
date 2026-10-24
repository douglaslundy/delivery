"use client";

import { useRouter } from "next/navigation";

// Volta para a pagina anterior; sem historico (aba nova), vai para `fallback`.
export default function BackButton({ fallback }: { fallback: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="back"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
    >
      ← Voltar
    </button>
  );
}
