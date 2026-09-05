import "server-only";

import {
  createInsightCard,
  parseChatTurnResult,
  parseDomainSelection,
  sha256Canonical,
  type V2Alpha3DomainSelection,
} from "./contracts.ts";

type ChatRequest = {
  scope: string;
  requestId: string;
  domainSelection: V2Alpha3DomainSelection;
  message: string;
};

type ChatProvider = {
  submit(input: ChatRequest): Promise<unknown>;
};

function bounded(value: string, maximum: number, code: string) {
  const normalized = value.replace(/\r\n?/gu, "\n").trim();
  if (!normalized || normalized.length > maximum) throw new Error(code);
  return normalized;
}

export function validateChatRequest(input: ChatRequest) {
  const scope = bounded(input.scope, 320, "chat_scope_invalid");
  const requestId = bounded(input.requestId, 160, "chat_request_id_invalid");
  const domainSelection = parseDomainSelection(input.domainSelection);
  const message = bounded(input.message, 2_000, "chat_message_invalid");
  return { scope, requestId, domainSelection, message };
}

export function createV2Alpha3ChatCoordinator(provider: ChatProvider) {
  const settled = new Map<string, { requestHash: string; result: ReturnType<typeof parseChatTurnResult> }>();
  const inflight = new Map<string, { requestHash: string; promise: Promise<ReturnType<typeof parseChatTurnResult>> }>();

  return {
    persistenceClass: "PROCESS_LOCAL_SYNTHETIC_FIXTURE_ONLY" as const,
    async run(raw: ChatRequest) {
      const input = validateChatRequest(raw);
      const key = `${input.scope}:${input.requestId}`;
      const requestHash = sha256Canonical({ domainSelectionHash: input.domainSelection.selectionHash, message: input.message });
      const prior = settled.get(key);
      if (prior) {
        if (prior.requestHash !== requestHash) throw new Error("chat_idempotency_conflict");
        return { replayed: true, result: prior.result };
      }
      const active = inflight.get(key);
      if (active) {
        if (active.requestHash !== requestHash) throw new Error("chat_idempotency_conflict");
        return { replayed: true, result: await active.promise };
      }
      const promise = provider.submit(input).then((value) => parseChatTurnResult(value));
      inflight.set(key, { requestHash, promise });
      try {
        const result = await promise;
        settled.set(key, { requestHash, result });
        return { replayed: false, result };
      } finally {
        inflight.delete(key);
      }
    },
  };
}

export function createV2Alpha3SyntheticChatProvider(): ChatProvider {
  return {
    async submit(input) {
      const domain = input.domainSelection.label;
      const direction = input.message;
      const cards = [
        createInsightCard({
          kind: "question",
          title: `${domain}中的可觀察問題與決策張力`,
          researchQuestion: `在「${direction}」情境中，哪些可觀察條件會改變研究參與者的決策？`,
          mechanism: "先辨識問題、利害關係人與可反駁的作用路徑，再選擇方法。",
          value: "把寬泛興趣收斂為可以觀察、比較與被反駁的研究問題。",
          domainFit: `此問題直接受「${domain}」的範圍界線約束。`,
          evidenceBoundary: "UNVERIFIED",
          assumptions: ["目前為概念整理，尚未查詢外部文獻。"],
          nextAction: "比較證據優先、平衡推薦與前沿創新三個研究方向。",
        }),
        createInsightCard({
          kind: "mechanism",
          title: `${domain}中的機制與失效邊界`,
          researchQuestion: `「${direction}」透過何種機制產生效果，又會在何種條件下失效？`,
          mechanism: "以情境、機制與結果三者的可檢驗連結取代單純效果宣稱。",
          value: "讓後續研究同時保留理論貢獻與負向案例。",
          domainFit: `機制假設限定於「${domain}」，跨域外推必須另行驗證。`,
          evidenceBoundary: "ASSUMPTION",
          assumptions: ["機制仍是假設，不能當作已觀察結果。"],
          nextAction: "列出可觀察的支持訊號與失效訊號。",
        }),
        createInsightCard({
          kind: "method",
          title: `${domain}中的可行證據路徑`,
          researchQuestion: `哪些最小資料可以先判斷「${direction}」是否值得進入完整研究？`,
          mechanism: "使用小規模可行性證據先降低資料、倫理與量測風險。",
          value: "在未知樣本與資源下保留專業但不虛構的下一步。",
          domainFit: `方法選擇需符合「${domain}」的場域與資料取得界線。`,
          evidenceBoundary: "UNVERIFIED",
          assumptions: ["樣本、資料權限與倫理條件尚待研究者確認。"],
          nextAction: "建立兩週可行性盤點，再決定完整設計。",
        }),
      ];
      return { schemaId: "old-mike-v2-alpha3/chat-insights/1", domainSelection: input.domainSelection, insights: cards, completionClass: "COMPLETE" };
    },
  };
}

let fixtureCoordinator: ReturnType<typeof createV2Alpha3ChatCoordinator> | null = null;
export function getV2Alpha3FixtureCoordinator() {
  fixtureCoordinator ??= createV2Alpha3ChatCoordinator(createV2Alpha3SyntheticChatProvider());
  return fixtureCoordinator;
}

export function v2Alpha3RoutesEnabled() {
  return process.env.NODE_ENV === "development" && process.env.TEST_FIXTURE === "1" && process.env.OLD_MIKE_V2_ALPHA3_LOCAL_PROTOTYPE === "1";
}

export async function resolveV2Alpha3Principal(request: Request) {
  const { resolveV2Alpha2Principal } = await import("../v2-alpha2/runtime.ts");
  return resolveV2Alpha2Principal(request);
}
