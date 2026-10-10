import { useEffect, useState } from "react";

import * as api from "../api/client";

// Kıvırık rozetindeki bekleyen soru sayısı. Sunucu soruları her istekte
// anlık hesapladığı için sayı yalnızca uygulama açılınca, ön plana dönünce,
// Ana sayfa odaklanınca (en fazla dakikada bir) ve her cevaptan sonra çekilir.
// trigger: en öndeki bekleyen soru tetiklemeliyse (iptal kontrolü gibi) o
// soru; ana sayfa balonu bunu doğrudan söyler.

const MIN_REFRESH_MS = 60 * 1000;

let total = 0;
let trigger = null;
let lastFetchedAt = 0;
let lastToken = null;
let inFlight = null;
const listeners = new Set();

function setTotal(next, nextTrigger = null) {
  total = next;
  trigger = nextTrigger;
  listeners.forEach((listener) => listener({ total, trigger }));
}

// Cevap/erteleme yanıtındaki güncel sayı (ek istek gerekmez).
export function setKivirikTotal(next, nextTrigger = null) {
  lastFetchedAt = Date.now();
  setTotal(next ?? 0, nextTrigger ?? null);
}

export function refreshKivirikCount(token, { force = false } = {}) {
  if (!token) {
    lastToken = null;
    setTotal(0);
    return Promise.resolve(0);
  }

  const fresh = token === lastToken && Date.now() - lastFetchedAt < MIN_REFRESH_MS;
  if (!force && fresh) {
    return Promise.resolve(total);
  }

  if (!inFlight) {
    lastToken = token;
    inFlight = api
      .getKivirikQuestions(token)
      .then((data) => {
        setKivirikTotal(data.total, data.trigger);
        return data.total;
      })
      .catch(() => total)
      .finally(() => {
        inFlight = null;
      });
  }

  return inFlight;
}

function useKivirikState() {
  const [state, setState] = useState({ total, trigger });

  useEffect(() => {
    listeners.add(setState);
    setState({ total, trigger });
    return () => listeners.delete(setState);
  }, []);

  return state;
}

export function useKivirikCount() {
  return useKivirikState().total;
}

// En öndeki tetiklemeli soru ya da null.
export function useKivirikTrigger() {
  return useKivirikState().trigger;
}
