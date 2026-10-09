import { newItemId, type BillData } from "./bill";
import { personaDeviceKey } from "./demo";
import { localStore, newBillId } from "./localApi";
import { loadOwnProfile, rememberBill } from "./storage";

/**
 * Demo only: a filled example bill, so the payer view and the friends' view can be
 * explored right away. Anna has already ticked her items and tapped pay, Ben is
 * still choosing, the payer's own items are left open.
 */
export function createSampleBill(): string {
  const profile = loadOwnProfile();
  const ids = { pizza: newItemId(), bier: newItemId(), tira: newItemId(), pasta: newItemId(), wasser: newItemId() };
  const data: BillData = {
    title: "Trattoria Da Mario (Beispiel)",
    date: new Date().toISOString().slice(0, 10),
    currency: "EUR",
    tipPercent: 10,
    payment: { paypalMe: profile.paypalMe || undefined, paypalEmail: profile.paypalEmail || undefined },
    items: [
      { id: ids.pizza, name: "Pizza Margherita", qty: 1, total: 950 },
      { id: ids.bier, name: "Bier 0,5l", qty: 3, total: 1350 },
      { id: ids.tira, name: "Tiramisu", qty: 2, total: 1000 },
      { id: ids.pasta, name: "Spaghetti Carbonara", qty: 1, total: 1290 },
      { id: ids.wasser, name: "Wasser 0,25l", qty: 2, total: 560 },
    ],
  };
  const store = localStore();
  const owner = personaDeviceKey("me");
  const anna = personaDeviceKey("anna");
  const ben = personaDeviceKey("ben");
  const id = store.create(newBillId(), data, owner, profile.name || "Du");
  store.join(id, anna, "Anna");
  store.join(id, ben, "Ben");
  store.setClaims(id, anna, { [ids.pizza]: 1, [ids.bier]: 2 });
  store.setClaims(id, ben, { [ids.bier]: 1, [ids.tira]: 1 });
  store.recordPayClick(id, anna);
  rememberBill({ id, title: data.title, role: "owner", createdAt: new Date().toISOString() });
  return id;
}
