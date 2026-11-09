import type { Metadata } from "next";
import { Suspense } from "react";
import { PortalGame } from "@/components/PortalGame";

export const metadata: Metadata = {
  title: "Portal playground",
  description: "A tiny stick-figure portal platformer.",
};

export default function PlayPage() {
  return (
    <Suspense fallback={<div className="portal-game" aria-busy="true" />}>
      <PortalGame />
    </Suspense>
  );
}
