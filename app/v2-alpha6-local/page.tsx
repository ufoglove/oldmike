import { notFound } from "next/navigation";

import { V2Alpha6ManuscriptWorkspace } from "@/components/v2-alpha6/V2Alpha6ManuscriptWorkspace";
import {
  V2_ALPHA6_ENTRY_OPTIONS,
  V2_ALPHA6_LANGUAGE_OPTIONS,
  V2_ALPHA6_PROJECT_OPTIONS,
  alpha6PrototypeEnabled,
} from "@/lib/v2-alpha6/page-authority";

export default function V2Alpha6LocalPage() {
  if (!alpha6PrototypeEnabled()) notFound();
  return <V2Alpha6ManuscriptWorkspace entries={V2_ALPHA6_ENTRY_OPTIONS} languages={V2_ALPHA6_LANGUAGE_OPTIONS} projects={V2_ALPHA6_PROJECT_OPTIONS} />;
}
