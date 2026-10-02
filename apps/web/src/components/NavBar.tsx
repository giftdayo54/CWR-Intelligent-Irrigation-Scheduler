"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearSession, getUser, StoredUser } from "@/lib/auth";
import { useRouter } from "next/navigation";

export function NavBar() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const router = useRouter();

  useEffect(() => {
    setUser(getUser());
  }, []);

  function logout() {
    clearSession();
    setUser(null);
    router.push("/login");
  }

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold text-cwr-green">
          CWR &amp; Intelligent Irrigation Scheduler
        </Link>
        <nav className="flex items-center gap-4 text-sm text-stone-600">
          <Link href="/">Dashboard</Link>
          <Link href="/setup">Setup</Link>
          <Link href="/et0">ET0 Calculator</Link>
          {user ? (
            <>
              <span className="text-stone-400">{user.name}</span>
              <button onClick={logout} className="btn-secondary">
                Log out
              </button>
            </>
          ) : (
            <Link href="/login" className="btn-primary">
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
