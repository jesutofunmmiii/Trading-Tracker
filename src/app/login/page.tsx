import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Sign in — Trading Dashboard" };

export default function LoginPage() {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-gold-400 font-bold tracking-wider text-sm uppercase">
            Mission Control
          </p>
          <p className="mt-1 text-sm text-navy-400">Trading Dashboard</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Access your trading dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="h-64" />}>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
