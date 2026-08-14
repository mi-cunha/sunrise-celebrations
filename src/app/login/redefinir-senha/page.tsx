import { SetupNotice } from "@/components/setup-notice";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  if (!hasSupabaseConfig()) return <SetupNotice />;
  return <ResetPasswordForm />;
}
