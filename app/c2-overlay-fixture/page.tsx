import { notFound } from "next/navigation";
import GuidedResearchCenter from "@/components/GuidedResearchCenter";

export const dynamic = "force-dynamic";

export default function C2OverlayFixturePage() {
  if (process.env.TEST_FIXTURE !== "1" || process.env.C2_OVERLAY_FIXTURE !== "1") notFound();
  return <>
    <nav className="account-toolbar" aria-label="帳號工具列"><a href="#fixture-account">帳號</a></nav>
    <GuidedResearchCenter displayName="版面測試使用者" fixtureMode />
  </>;
}
