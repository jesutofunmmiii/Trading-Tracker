"use client";

// Shows the signed-in user's email and a sign-out control.
// Data source: Supabase Auth (current session user).

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SignOutButton } from "@/components/auth/SignOutButton";

export function UserMenu() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  return (
    <div className="flex items-center gap-2">
      {email && (
        <span className="hidden md:inline text-xs text-navy-400 max-w-[14rem] truncate">
          {email}
        </span>
      )}
      <SignOutButton />
    </div>
  );
}
