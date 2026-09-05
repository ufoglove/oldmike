import Link from "next/link";

export default function AuthShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <main className="login-page"><div className="login-atmosphere" /><section className="login-card" aria-labelledby="auth-title">
    <div className="brand-mark large" aria-hidden="true"><span>麥</span></div><p className="eyebrow">{eyebrow}</p><h1 id="auth-title">{title}</h1><p className="login-copy">{description}</p>{children}
    <p className="fine-print">Research integrity · Fresh verification · Project-first memory</p>
  </section></main>;
}
