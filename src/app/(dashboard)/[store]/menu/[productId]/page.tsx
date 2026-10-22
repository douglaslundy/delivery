import { Suspense } from "react";
import ProductForm from "./product-form";

export default function ProductFormPage() {
  return (
    <Suspense fallback={<p>Carregando...</p>}>
      <ProductForm />
    </Suspense>
  );
}
