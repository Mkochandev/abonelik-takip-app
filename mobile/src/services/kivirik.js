import { useEffect, useState } from "react";

import * as api from "../api/client";

// Kıvırık rozetindeki bekleyen soru sayısı. Sunucu soruları her istekte
// anlık hesapladığı için sayı yalnızca uygulama açılınca, ön plana dönünce,
// Ana sayfa odaklanınca (en fazla dakikada bir) ve her cevaptan sonra çekilir.

const MIN_REFRESH_MS = 60 * 1000;

let total = 0;
let lastFetchedAt = 0;
let lastToken = null;
let inFlight = null;
const listeners = new Set();

function setTotal(next) {
  total = next;
  listeners.forEach((listener) => listener(total));
}

// Cevap/erteleme yanıtındaki güncel sayı (ek istek gerekmez).
export function setKivirikTotal(next) {
  lastFetchedAt = Date.now();
  setTotal(next ?? 0);
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
        setKivirikTotal(data.total);
        return data.total;
      })
      .catch(() => total)
      .finally(() => {
        inFlight = null;
      });
  }

  return inFlight;
}

export function useKivirikCount() {
  const [count, setCount] = useState(total);

  useEffect(() => {
    listeners.add(setCount);
    setCount(total);
    return () => listeners.delete(setCount);
  }, []);

  return count;
}
