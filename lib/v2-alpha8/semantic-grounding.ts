type MaterialLike = {
  kind: string;
  content: string;
};

type DirectionLike = {
  title: string;
  researchQuestion: string;
  expectedContribution: string;
};

export type V2Alpha8ResearchFrame = {
  titleStem: string;
  methodLabel: string | null;
  methodDetail: string | null;
  outcomeSummary: string;
};

const FORBIDDEN_PUBLICATION_TEXT = /現有半成品|既有材料|使用者提供|本機(?:草稿|概念模式)|fixture|Human Gate|sourceBundle|目前可引用|正式分析前將固定|另行確認|。；|；。|。。|；；/iu;

function compact(value: string, maximum: number) {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (normalized.length <= maximum) return normalized;
  return `${normalized.slice(0, Math.max(1, maximum - 1)).trimEnd()}…`;
}

export function normalizeAlpha8PublicationText(value: string) {
  return value
    .normalize("NFC")
    .replace(/基於現有半成品/gu, "依據研究問題與已整理證據")
    .replace(/以現有半成品為基礎/gu, "整合研究目的、方法與現有結果")
    .replace(/現有半成品/gu, "研究內容")
    .replace(/目前可引用的使用者提供描述值為/gu, "描述性結果顯示")
    .replace(/使用者提供(?:的)?材料中的觀察紀錄/gu, "研究紀錄中的描述性觀察")
    .replace(/使用者提供(?:的)?/gu, "研究紀錄中的")
    .replace(/既有材料|現有材料/gu, "研究內容")
    .replace(/本機草稿/gu, "本稿")
    .replace(/本機概念模式/gu, "目前研究階段")
    .replace(/另行確認/gu, "另需評估")
    .replace(/([。！？])；|；[。！？]/gu, "$1")
    .replace(/。。+|；；+/gu, "。")
    .replace(/[ \t]+([，。；：！？])/gu, "$1")
    .replace(/([，。；：！？]) +/gu, "$1")
    .replace(/([\p{Script=Han}]) +(?=[\p{Script=Han}])/gu, "$1")
    .replace(/[ \t]{2,}/gu, " ")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function researchSentence(value: string, maximum: number) {
  return compact(
    normalizeAlpha8PublicationText(value)
      .replace(/^本研究(?:旨在|主要)?(?:探討|聚焦於|分析|檢驗|評估)\s*/u, "")
      .replace(/^研究(?:設計)?(?:採|採用|使用)\s*/u, "")
      .split(/[。；]/u)[0]
      .replace(/[，,]$/u, "")
      .trim(),
    maximum,
  );
}

function firstByKind(materials: readonly MaterialLike[], kinds: readonly string[]) {
  for (const kind of kinds) {
    const material = materials.find((candidate) => candidate.kind === kind);
    if (material) return material;
  }
  return undefined;
}

export function deriveAlpha8ResearchFrame(materials: readonly MaterialLike[]): V2Alpha8ResearchFrame {
  const topicMaterial = firstByKind(materials, ["ABSTRACT", "INTRODUCTION", "NOTE"]) ?? materials[0];
  if (!topicMaterial) throw new Error("alpha8_research_frame_material_missing");
  const methodMaterial = firstByKind(materials, ["METHODS", "EXPERIMENT_DATA", "SURVEY_DATA"]);
  const resultMaterial = firstByKind(materials, ["RESULTS", "EXPERIMENT_DATA", "SURVEY_DATA", "TABLE", "FIGURE"]);
  const topicStatement = researchSentence(topicMaterial.content, 110);
  const titleStem = compact(
    topicStatement
      .replace(/後[，,]/gu, "對")
      .replace(/之間的關係$/u, "的關聯")
      .replace(/之關係$/u, "的關聯"),
    96,
  );
  const methodMatch = methodMaterial?.content.match(/(?:研究(?:設計)?(?:採|採用)|採用)\s*([^，。；]+)/u);
  const methodDetail = methodMaterial ? researchSentence(methodMaterial.content, 150) : null;
  const methodLabel = methodMaterial ? compact((methodMatch?.[1] ?? methodDetail ?? "").replace(/設計$/u, "研究"), 48) : null;
  const outcomeSummary = resultMaterial
    ? compact(
        researchSentence(resultMaterial.content, 120)
          .replace(/^(?:初步)?(?:結果|紀錄|分析)?(?:顯示|指出|發現)\s*/u, "")
          .split(/[，；]?(?:但|惟|然而|仍需|尚需|尚待)/u)[0]
          .trim(),
        72,
      )
    : "核心結果尚待完成分析";
  if (!titleStem) throw new Error("alpha8_research_frame_topic_missing");
  return { titleStem, methodLabel: methodLabel || null, methodDetail: methodDetail || null, outcomeSummary };
}

export function assertAlpha8SemanticGrounding(directions: readonly DirectionLike[], materials: readonly MaterialLike[]) {
  const frame = deriveAlpha8ResearchFrame(materials);
  if (directions.some((direction) => {
    const publicationText = `${direction.title}\n${direction.researchQuestion}\n${direction.expectedContribution}`;
    return !publicationText.includes(frame.titleStem)
      || (frame.methodLabel !== null && !publicationText.includes(frame.methodLabel));
  })) {
    throw new Error("alpha8_direction_semantic_grounding_invalid");
  }
}

export function assertAlpha8PublicationText(value: string) {
  if (FORBIDDEN_PUBLICATION_TEXT.test(value)) throw new Error("alpha8_publication_text_invalid");
}
