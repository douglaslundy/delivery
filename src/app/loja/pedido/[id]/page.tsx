import { Suspense } from "react";
import Tracker from "./tracker";

export default function PedidoPage() {
  return (
    <Suspense fallback={null}>
      <Tracker />
    </Suspense>
  );
}
