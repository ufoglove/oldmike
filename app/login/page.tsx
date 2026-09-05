import AuthShell from "@/components/AuthShell";
import LoginForm from "@/components/LoginForm";
import { publicAuthStatus } from "@/lib/auth-config";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const { registrationMode } = publicAuthStatus();
  return <AuthShell eyebrow="EVIDENCE-FIRST RESEARCH" title="老麥科研工作台" description="使用已驗證的研究者帳號登入工作台。正式研究資料只會在授權的個人 Workspace 中讀取。">
    <LoginForm registrationMode={registrationMode} />
  </AuthShell>;
}
