"use client";

import { useRouter } from "next/navigation";
import { Feedback, useAction } from "../feedback";

export default function DeleteProduct({ storeId, productId, name }: { storeId: string; productId: string; name: string }) {
  const router = useRouter();
  const { busy, msg, run } = useAction();

  async function remove() {
    if (!window.confirm(`Excluir o produto "${name}"?`)) return;
    if (await run(() => fetch(`/api/stores/${storeId}/products/${productId}`, { method: "DELETE" }), "Produto excluído.")) {
      router.refresh();
    }
  }

  return (
    <>
      <button type="button" className="btn-danger" disabled={busy} onClick={remove}>
        Excluir
      </button>
      <Feedback msg={msg} />
    </>
  );
}
