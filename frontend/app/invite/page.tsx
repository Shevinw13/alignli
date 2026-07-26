"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function InviteRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login");
  }, [router]);
  return null;
}
