/**
 * timeBucket.ts — Groepeer tallies in tijd-buckets met Nederlandse labels.
 *
 * "Drink-day" begint om 06:00 lokale tijd. Tallies van 00:00-06:00 horen
 * bij de vorige dag zijn avond-bucket.
 *
 * Slots binnen een drink-day:
 *   ochtend  06:00 – 13:00
 *   middag   13:00 – 18:00
 *   avond    18:00 – 06:00 (volgende dag)
 *
 * Labels:
 *   Vandaag, ochtend  / Vandaag, middag  / Vandaag, avond
 *   Gisteren, ochtend / Gisteren, middag / Gisteren, avond
 *   Vrijdagavond (avond-bucket als 2-6 dagen geleden, dagnaam aan één stuk)
 *   Zaterdag, middag  (ochtend/middag als 2-6 dagen geleden)
 *   Zondag, ochtend/middag   (combo — zie groupTalliesByBucket)
 *   dd-mm             (7+ dagen terug, datum-formaat)
 *
 * Combo-labels (alleen in groupTalliesByBucket):
 *   Als in dezelfde drink-day zowel ochtend+middag als middag+avond voorkomen
 *   worden die buckets samengevoegd: "middag/avond" of "ochtend/middag".
 *   Ochtend+avond zonder middag: GEEN combo — blijven los.
 */

export type BucketKey = string; // bijv. "2026-04-18-evening"

export type SlotKey = 'ochtend' | 'middag' | 'avond';

export type BucketInfo = {
  key: BucketKey;
  label: string;       // "Vandaag, middag" / "Vrijdagavond" / "Zondag, ochtend/middag"
  bucketStart: Date;   // voor sorteren desc
};

// ─── Interne helpers ──────────────────────────────────────────────────────────

const NL_WEEKDAYS: Record<number, string> = {
  0: 'Zondag',
  1: 'Maandag',
  2: 'Dinsdag',
  3: 'Woensdag',
  4: 'Donderdag',
  5: 'Vrijdag',
  6: 'Zaterdag',
};

/** Geeft de "drink-day" terug als Date op middernacht (00:00) van die dag,
 *  waarbij de dag begint om 06:00. Tallies van 00:00-06:00 vallen terug naar
 *  de vorige dag. */
function getDrinkDay(d: Date): Date {
  const h = d.getHours();
  const base = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  if (h < 6) {
    base.setDate(base.getDate() - 1);
  }
  return base;
}

/** Vergelijk twee drink-days op gelijkheid (op dagniveau). */
function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Verschil in volledige drink-days (a - b), altijd >= 0. */
function drinkDayDiff(aDrinkDay: Date, bDrinkDay: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = (aDrinkDay.getTime() - bDrinkDay.getTime()) / msPerDay;
  return Math.round(diff);
}

/** Bepaal het slot (ochtend/middag/avond) op basis van het uur. */
function getSlot(d: Date): SlotKey {
  const h = d.getHours();
  if (h < 6)   return 'avond';   // na middernacht, nog "gisteren"s avond
  if (h < 13)  return 'ochtend';
  if (h < 18)  return 'middag';
  return 'avond';
}

/** Bouw een dag-prefix-label ("Vandaag", "Gisteren", weekdagnaam of "dd-mm"). */
function buildDayPrefix(tallyDrinkDay: Date, nowDrinkDay: Date): string {
  const diff = drinkDayDiff(nowDrinkDay, tallyDrinkDay);

  if (diff === 0) return 'Vandaag';
  if (diff === 1) return 'Gisteren';
  if (diff >= 2 && diff <= 6) {
    const dow = tallyDrinkDay.getDay();
    return NL_WEEKDAYS[dow];
  }
  // 7+ dagen: dd-mm datum
  const day   = String(tallyDrinkDay.getDate()).padStart(2, '0');
  const month = String(tallyDrinkDay.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}`;
}

/** Bouw het definitieve label voor één bucket.
 *  avond-bucket: "Vrijdagavond" / "Vandaag, avond" / "Gisteren, avond"
 *  ochtend/middag: "{dag}, {slot}"
 *  combo:         "{dag}, {slot1}/{slot2}"
 */
function buildLabel(dayPrefix: string, slot: string): string {
  if (slot === 'avond') {
    // Als het een weekdagnaam is (geen "Vandaag"/"Gisteren"/datum) → samengesteld woord
    const isRelative = dayPrefix === 'Vandaag' || dayPrefix === 'Gisteren';
    const isDate = /^\d{2}-\d{2}$/.test(dayPrefix);
    if (isRelative || isDate) {
      return `${dayPrefix}, avond`;
    }
    // Weekdagnaam → "Vrijdagavond"
    return `${dayPrefix}avond`;
  }
  return `${dayPrefix}, ${slot}`;
}

// ─── Publieke API ─────────────────────────────────────────────────────────────

/**
 * Geef de BucketInfo voor één tally-datum ten opzichte van "now".
 */
export function classifyTally(tallyDate: Date, now: Date): BucketInfo {
  const tallyDrinkDay = getDrinkDay(tallyDate);
  const nowDrinkDay   = getDrinkDay(now);
  const slot          = getSlot(tallyDate);
  const dayPrefix     = buildDayPrefix(tallyDrinkDay, nowDrinkDay);
  const label         = buildLabel(dayPrefix, slot);

  // bucketStart = het begin van het slot in de drink-day
  const bucketStart = new Date(tallyDrinkDay);
  if (slot === 'ochtend') bucketStart.setHours(6,  0, 0, 0);
  if (slot === 'middag')  bucketStart.setHours(13, 0, 0, 0);
  if (slot === 'avond')   bucketStart.setHours(18, 0, 0, 0);

  // Key: ISO-datum van drink-day + slot
  const keyDate = `${tallyDrinkDay.getFullYear()}-` +
    String(tallyDrinkDay.getMonth() + 1).padStart(2, '0') + '-' +
    String(tallyDrinkDay.getDate()).padStart(2, '0');
  const key: BucketKey = `${keyDate}-${slot}`;

  return { key, label, bucketStart };
}

/**
 * Groepeer een lijst tallies in buckets gesorteerd op bucketStart descending.
 *
 * Combo-logica:
 *   - Zelfde drink-day heeft ochtend + middag → samenvoegen als "{dag}, ochtend/middag"
 *   - Zelfde drink-day heeft middag + avond   → samenvoegen als "{dag}, middag/avond"
 *     (avond-variant: "{dag}middag/avond", bijv. "Vrijdagmiddag/avond" — maar voor
 *      leesbaarheid houden we de comma-vorm voor combo's aan, ook bij weekdagnamen)
 *   - Ochtend + avond zonder middag: GEEN combo.
 *   - Alle drie: eerste ochtend+middag samenvoegen, avond los.
 */
export function groupTalliesByBucket<T extends { created_at: string | Date }>(
  tallies: T[],
  now: Date = new Date(),
): Array<{ bucket: BucketInfo; items: T[] }> {

  // Stap 1: classificeer elke tally
  type Classified = { item: T; bucket: BucketInfo };
  const classified: Classified[] = tallies.map((item) => {
    const d = typeof item.created_at === 'string'
      ? new Date(item.created_at)
      : item.created_at;
    return { item, bucket: classifyTally(d, now) };
  });

  // Stap 2: groepeer op bucket-key
  const bucketMap = new Map<string, { bucket: BucketInfo; items: T[] }>();
  for (const { item, bucket } of classified) {
    if (!bucketMap.has(bucket.key)) {
      bucketMap.set(bucket.key, { bucket, items: [] });
    }
    bucketMap.get(bucket.key)!.items.push(item);
  }

  // Stap 3: groepeer bucket-keys per drink-day
  type DrinkDayKey = string; // YYYY-MM-DD
  const byDrinkDay = new Map<DrinkDayKey, string[]>(); // drinkDay → bucket-keys
  for (const key of bucketMap.keys()) {
    // Key formaat: "YYYY-MM-DD-{slot}"
    const lastDash = key.lastIndexOf('-');
    const dayKey = key.substring(0, lastDash);
    if (!byDrinkDay.has(dayKey)) byDrinkDay.set(dayKey, []);
    byDrinkDay.get(dayKey)!.push(key);
  }

  // Stap 4: pas combo-merge toe per drink-day
  const finalBuckets: Array<{ bucket: BucketInfo; items: T[] }> = [];

  for (const [, keys] of byDrinkDay) {
    const hasOchtend = keys.includes(keys.find(k => k.endsWith('-ochtend') ) ?? '___');
    const hasMiddag  = keys.includes(keys.find(k => k.endsWith('-middag')  ) ?? '___');
    const hasAvond   = keys.includes(keys.find(k => k.endsWith('-avond')   ) ?? '___');

    const ochtendKey = keys.find(k => k.endsWith('-ochtend'));
    const middagKey  = keys.find(k => k.endsWith('-middag'));
    const avondKey   = keys.find(k => k.endsWith('-avond'));

    const canMergeOM = !!ochtendKey && !!middagKey;   // ochtend+middag
    const canMergeMA = !!middagKey  && !!avondKey;     // middag+avond

    if (canMergeOM && !hasAvond) {
      // Alleen ochtend+middag → merge
      const b1 = bucketMap.get(ochtendKey!)!;
      const b2 = bucketMap.get(middagKey!)!;
      const mergedItems = [...b1.items, ...b2.items];
      const newLabel = b1.bucket.label.replace(/, ochtend$/, ', ochtend/middag');
      finalBuckets.push({
        bucket: { ...b1.bucket, label: newLabel, key: `${ochtendKey}-merged` },
        items: mergedItems,
      });
    } else if (canMergeMA && !hasOchtend) {
      // Alleen middag+avond → merge
      const b1 = bucketMap.get(middagKey!)!;
      const b2 = bucketMap.get(avondKey!)!;
      const mergedItems = [...b1.items, ...b2.items];
      const newLabel = b1.bucket.label.replace(/, middag$/, ', middag/avond');
      finalBuckets.push({
        bucket: { ...b1.bucket, label: newLabel, key: `${middagKey}-merged` },
        items: mergedItems,
      });
    } else if (canMergeOM && hasAvond) {
      // Alle drie: merge ochtend+middag, avond los
      const b1 = bucketMap.get(ochtendKey!)!;
      const b2 = bucketMap.get(middagKey!)!;
      const b3 = bucketMap.get(avondKey!)!;
      const mergedItems = [...b1.items, ...b2.items];
      const newLabel = b1.bucket.label.replace(/, ochtend$/, ', ochtend/middag');
      finalBuckets.push({
        bucket: { ...b1.bucket, label: newLabel, key: `${ochtendKey}-merged` },
        items: mergedItems,
      });
      finalBuckets.push(b3);
    } else {
      // Geen merge van toepassing — voeg alle buckets apart toe
      for (const key of keys) {
        const entry = bucketMap.get(key);
        if (entry) finalBuckets.push(entry);
      }
    }
  }

  // Stap 5: sorteer descending op bucketStart
  finalBuckets.sort((a, b) => b.bucket.bucketStart.getTime() - a.bucket.bucketStart.getTime());

  return finalBuckets;
}

// ─── TEST: Verwachte outputs (niet als Jest-test, maar als documentatie) ──────
//
// TEST 1: Vandaag, avond-bucket
//   now      = new Date('2026-04-21T20:00:00')  // dinsdag, 20:00
//   tally    = new Date('2026-04-21T19:30:00')  // zelfde dag, 19:30
//   expected = { key: '2026-04-21-avond', label: 'Vandaag, avond', ... }
//
// TEST 2: Na middernacht → vorige dag avond
//   now      = new Date('2026-04-21T02:00:00')  // dinsdagnacht 02:00
//   tally    = new Date('2026-04-21T01:45:00')  // dinsdagnacht 01:45
//   drinkDay = 2026-04-20 (maandag) → slot = avond
//   expected = { key: '2026-04-20-avond', label: 'Gisteren, avond', ... }
//   (want nowDrinkDay is ook 2026-04-20, dus diff=0 → Vandaag? Nee:
//    nowDrinkDay = getDrinkDay(02:00) = 2026-04-20,
//    tallyDrinkDay = getDrinkDay(01:45) = 2026-04-20
//    diff = 0 → "Vandaag, avond")
//   Correctie: als now=02:00 dan nowDrinkDay=2026-04-20 (maandag).
//   label = "Vandaag, avond"
//
// TEST 3: 6 dagen terug, avond
//   now      = new Date('2026-04-21T15:00:00')  // dinsdag middag
//   tally    = new Date('2026-04-15T21:00:00')  // woensdag 21:00, 6 dagen terug
//   drinkDay(tally) = 2026-04-15, drinkDay(now) = 2026-04-21, diff = 6
//   dow(2026-04-15) = 3 (woensdag)
//   expected = { key: '2026-04-15-avond', label: 'Woensdagavond', ... }
//
// TEST 4: 7 dagen terug → datum-formaat
//   now      = new Date('2026-04-21T10:00:00')
//   tally    = new Date('2026-04-14T14:00:00')  // dinsdag 14:00, 7 dagen terug
//   diff = 7 → datum-formaat
//   expected = { key: '2026-04-14-middag', label: '14-04, middag', ... }
//
// TEST 5: DST cross — zomertijd-wissel (laatste zondag maart in NL)
//   Stel now = new Date('2026-03-30T10:00:00')  // dag NA de wissel
//   tally    = new Date('2026-03-29T04:30:00')  // vóór wissel, 04:30 → < 6u
//   drinkDay(tally) = 2026-03-28 (zaterdag), slot = avond
//   drinkDay(now)   = 2026-03-30 (maandag),  diff = 2
//   dow(2026-03-28) = 6 (zaterdag)
//   expected = { key: '2026-03-28-avond', label: 'Zaterdagavond', ... }
//   (JS Date werkt in lokale tijd, DST-wissel zit al verwerkt in getHours())
//
// TEST 6: groupTalliesByBucket combo middag+avond
//   tallies op zelfde dag: een om 14:30 (middag) en een om 20:00 (avond)
//   → 1 bucket, label: "Vandaag, middag/avond"
