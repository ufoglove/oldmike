export const V2_BETA1_PAGE_AUTHORITY = Object.freeze({
  mode: "LOCAL_DEVELOPMENT_FIXTURE_ONLY",
  requiredEnvironment: {
    NODE_ENV: "development",
    TEST_FIXTURE: "1",
    OLD_MIKE_V2_BETA1_LOCAL_PROTOTYPE: "1",
  },
  productionStatus: 404,
});

export function v2Beta1PrototypeEnabled(environment: Record<string, string | undefined> = process.env) {
  return environment.NODE_ENV === "development"
    && environment.TEST_FIXTURE === "1"
    && environment.OLD_MIKE_V2_BETA1_LOCAL_PROTOTYPE === "1";
}
