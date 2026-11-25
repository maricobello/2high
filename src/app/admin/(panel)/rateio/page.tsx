import type { Metadata } from "next";
import { RateioWorkspace } from "@/components/admin/rateio/workspace";

export const metadata: Metadata = { title: "Rateio GD", robots: { index: false } };

export default function RateioPage() {
  return <RateioWorkspace />;
}
