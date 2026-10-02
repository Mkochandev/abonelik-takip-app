import * as api from "../api/client";
import { clearGuestSubscriptions, getGuestSubscriptions } from "../storage/guestSubscriptions";

let inFlight = null;

// Misafir listesini giriş yapan hesaba aktarır (bulk uç). Yerel liste
// yalnızca başarılı yanıttan sonra silinir; ağ/sunucu hatasında korunur ve
// bir sonraki açılışta ya da girişte tekrar denenir.
//
// Dönen değer: liste boşsa null, başarıda bulk yanıtı
// ({ added, skipped, limit_reached }), hatada { error }.
export function syncGuestSubscriptions(token) {
  if (!token) {
    return Promise.resolve(null);
  }

  // Açılıştaki deneme ile giriş sonrası deneme çakışırsa aynı isteği paylaş.
  if (!inFlight) {
    inFlight = (async () => {
      const items = await getGuestSubscriptions();
      if (items.length === 0) {
        return null;
      }

      try {
        const result = await api.bulkAddUserSubscriptions(
          token,
          items.map((item) => item.catalog_id)
        );
        await clearGuestSubscriptions();
        return result;
      } catch (error) {
        return { error };
      }
    })().finally(() => {
      inFlight = null;
    });
  }

  return inFlight;
}
