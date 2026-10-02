// Onboarding adımları (iç stack'teki ekran adları), sırasıyla.
export const ONBOARDING_STEPS = ["Welcome", "SelectServices", "ConfirmPlans", "Summary", "Save"];

// Kök stack'teki "Onboarding" rotasını, taslaktaki adımdan devam edecek
// şekilde kurar. Önceki adımlar da stack'e konur ki geri gitmek çalışsın.
// Seçim yoksa servis seçiminden ileri gidilmez.
export function buildOnboardingRoute(draft) {
  let index = Math.max(0, ONBOARDING_STEPS.indexOf(draft?.step));
  if (!draft?.selectedApps?.length) {
    index = Math.min(index, ONBOARDING_STEPS.indexOf("SelectServices"));
  }

  return {
    name: "Onboarding",
    params: { draft: draft ?? null },
    state: {
      index,
      routes: ONBOARDING_STEPS.slice(0, index + 1).map((name) => ({ name })),
    },
  };
}
