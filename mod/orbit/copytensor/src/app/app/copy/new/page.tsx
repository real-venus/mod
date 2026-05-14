"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import CopyForm from "../../components/CopyForm";

function CopyFormWithTarget() {
  const params = useSearchParams();
  const target = params.get("target") || "";
  return <CopyForm defaultTarget={target} />;
}

export default function NewCopyPage() {
  return (
    <div>
      <h1 className="text-xl font-bold mb-4">New Copy Trade</h1>
      <p className="text-muted text-sm mb-6">
        Mirror a target account's subnet allocations. The engine will
        automatically stake/unstake to match their proportional allocation
        across subnets.
      </p>
      <Suspense fallback={<p className="text-muted">Loading...</p>}>
        <CopyFormWithTarget />
      </Suspense>
    </div>
  );
}
