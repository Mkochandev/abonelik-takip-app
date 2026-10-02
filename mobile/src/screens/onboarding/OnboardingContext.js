import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import * as api from "../../api/client";
import { finishOnboarding, saveOnboardingDraft } from "../../storage/onboarding";
import { getCheapestPlan, toCatalogEntry } from "../../utils/catalog";
import { ONBOARDING_STEPS } from "./steps";

const OnboardingContext = createContext(null);

// Onboarding ekranlarının paylaştığı durum: katalog, seçilen servisler ve
// her servis için seçilen plan. Her değişiklik onboarding_draft olarak
// saklanır; uygulama yarıda kapanırsa kaldığı adımdan devam edilir.
export function OnboardingProvider({ initialDraft, children }) {
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(null);
  const [step, setStep] = useState(initialDraft?.step ?? ONBOARDING_STEPS[0]);
  // Seçim sırası korunur; misafir limitinde "ilk 5" bu sıraya göre alınır.
  const [selectedApps, setSelectedApps] = useState(initialDraft?.selectedApps ?? []);
  // app_name -> catalog_id (seçilmemişse en ucuz plan varsayılır)
  const [planChoices, setPlanChoices] = useState(initialDraft?.planChoices ?? {});
  const finishedRef = useRef(false);

  async function loadCatalog() {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const data = await api.getCatalog();
      // Katalog zaten app_name'e göre gruplu gelir; yine de her servis bir
      // kez görünsün ve plansız grup kalmasın.
      const unique = new Map();
      for (const group of data.catalog) {
        if (group.plans.length > 0 && !unique.has(group.app_name)) {
          unique.set(group.app_name, group);
        }
      }
      setCatalog(Array.from(unique.values()));
    } catch (err) {
      setCatalogError(err.message);
    } finally {
      setCatalogLoading(false);
    }
  }

  useEffect(() => {
    loadCatalog();
  }, []);

  useEffect(() => {
    if (finishedRef.current) {
      return;
    }
    saveOnboardingDraft({ step, selectedApps, planChoices }).catch(() => {});
  }, [step, selectedApps, planChoices]);

  const value = useMemo(() => {
    const groupsByName = new Map(catalog.map((group) => [group.app_name, group]));
    const selectedGroups = selectedApps.map((name) => groupsByName.get(name)).filter(Boolean);

    // Seçilen her servis için onaylanan plan, abonelik satırı biçiminde.
    const chosenPlans = selectedGroups.map((group) => {
      const plan =
        group.plans.find((candidate) => candidate.id === planChoices[group.app_name]) ??
        getCheapestPlan(group);
      return toCatalogEntry(group, plan);
    });

    return {
      catalog,
      catalogLoading,
      catalogError,
      reloadCatalog: loadCatalog,
      selectedApps,
      selectedGroups,
      chosenPlans,
      setStep,
      isSelected: (appName) => selectedApps.includes(appName),
      toggleApp(appName) {
        setSelectedApps((current) =>
          current.includes(appName)
            ? current.filter((name) => name !== appName)
            : [...current, appName]
        );
      },
      choosePlan(appName, catalogId) {
        setPlanChoices((current) => ({ ...current, [appName]: catalogId }));
      },
      // Onboarding'i bitirir (onboarding_done = true, taslak silinir) ve kök
      // stack'i Ana sayfaya sıfırlar. extraRoutes, örn. ["Paywall"], Ana
      // sayfanın üstüne açılır.
      async finish(navigation, extraRoutes = []) {
        finishedRef.current = true;
        await finishOnboarding().catch(() => {});
        const routes = [{ name: "MainTabs" }, ...extraRoutes.map((name) => ({ name }))];
        navigation.getParent()?.reset({ index: routes.length - 1, routes });
      },
    };
  }, [catalog, catalogLoading, catalogError, selectedApps, planChoices]);

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboarding, OnboardingProvider içinde kullanılmalı");
  }
  return ctx;
}
