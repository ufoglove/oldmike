import AuthForm from "@/components/AuthForm";
import type { RegistrationMode } from "@/lib/auth-config";

export default function LoginForm({ registrationMode }: { registrationMode: RegistrationMode }) {
  return <AuthForm mode="login" registrationMode={registrationMode} />;
}
