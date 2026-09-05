import { notFound } from "next/navigation";
import GuidedResearchCenter from "@/components/GuidedResearchCenter";

export const dynamic = "force-dynamic";

export default function C2R3ResearchStartFixturePage() {
  if (process.env.TEST_FIXTURE !== "1" || process.env.C2R3_RESEARCH_START_FIXTURE !== "1") notFound();
  return <>
    <nav className="account-toolbar" aria-label="帳號工具列"><a href="#fixture-account">帳號</a></nav>
    <GuidedResearchCenter displayName="C2R3 測試使用者" fixtureMode fixtureProject={false} />
  </>;
}
