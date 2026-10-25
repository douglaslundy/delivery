import type { Metadata } from "next";
import Storefront from "./storefront";

export const metadata: Metadata = { title: "Cardápio" };

export default function LojaPage() {
  return <Storefront />;
}
