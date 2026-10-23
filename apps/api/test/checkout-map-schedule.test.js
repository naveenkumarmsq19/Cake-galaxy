import test from "node:test";
import assert from "node:assert/strict";
import { indiaNow, addCalendarDays, firstAvailableDate, isBookableDate, availableDeliverySlots, deliverySlots } from "../../web/src/components/deliverySchedule.js";
import { deliveryLocation, HttpError, validateDeliverySlot } from "../src/validation.js";

test("Delivery date picker uses IST, never shows past calendar dates", () => {
  // At 00:15 IST, UTC is still the preceding day.
  const now = new Date("2026-10-22T18:45:00Z");
  assert.deepEqual(indiaNow(now), { date: "2026-10-23", minutes: 15 });
  assert.equal(isBookableDate("2026-10-22", now), false);
  assert.equal(isBookableDate("2026-10-23", now), true);
  assert.equal(isBookableDate("2026-11-23", now), true);
  assert.equal(isBookableDate("2026-11-24", now), false);
  assert.equal(isBookableDate("2026-10-32", now), false);
  assert.equal(addCalendarDays("2026-10-23",31), "2026-11-23");
  assert.equal(firstAvailableDate(now), "2026-10-23");
});

test("Elapsed time slots are hidden and all-times-past date automatically moves to tomorrow", () => {
  const now = new Date("2026-10-23T11:30:00Z"); // 5pm IST
  assert.deepEqual(availableDeliverySlots("2026-10-23",now), ["7 PM – 10 PM"]);
  assert.deepEqual(availableDeliverySlots("2026-10-22",now), []);
  assert.deepEqual(availableDeliverySlots("2026-10-24",now), deliverySlots);
  assert.throws(() => validateDeliverySlot("2026-10-23","4 PM – 7 PM",now), HttpError);
  assert.equal(validateDeliverySlot("2026-10-23","7 PM – 10 PM",now), "7 PM – 10 PM");
  const afterLastStart = new Date("2026-10-23T13:31:00Z"); // 7:01pm IST
  assert.equal(firstAvailableDate(afterLastStart), "2026-10-24");
  assert.deepEqual(availableDeliverySlots("2026-10-23",afterLastStart), []);
});

test("Map pins are normalized, India-bounded, and cannot overwrite the human delivery address", () => {
  assert.deepEqual(deliveryLocation({lat:13.009876543,lng:77.512345678}),{lat:13.009877,lng:77.512346});
  assert.equal(deliveryLocation(undefined),null);
  for (const bad of [
    {lat:91,lng:77},{lat:13,lng:180},{lat:"13",lng:77},{lat:NaN,lng:77},
    {lat:13,lng:Infinity},[13,77],{},null
  ]) {
    if (bad===null) assert.equal(deliveryLocation(bad),null);
    else assert.throws(() => deliveryLocation(bad),HttpError);
  }
});
