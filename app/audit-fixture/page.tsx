import TopicLabFrontierRadar from "@/components/TopicLabFrontierRadar";

export const dynamic = "force-dynamic";

export default function AuditFixturePage() {
  return <div style={{ maxWidth: 390, margin: "0 auto", fontFamily: "system-ui" }}>
    <TopicLabFrontierRadar initialView="lab" />
  </div>;
}
