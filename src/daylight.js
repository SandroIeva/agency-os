// Is it light outside, where this person is?
//
// A separate file because it is pure arithmetic and the only way to check it is
// to run it against places and dates whose real sunrise is known. The same
// reason server/figma.js sits apart from the endpoint that uses it.
//
// NOAA's sunrise equation, the form given as the "Sunrise equation" on
// Wikipedia. Accurate to about a minute for our purpose, which is choosing
// between two colour schemes.

const RAD = Math.PI / 180;
// The sun's centre is 0.833 degrees BELOW the horizon at the moment we call
// sunrise: half a degree for the disc's radius plus about a third for
// refraction. Using 0 here puts every answer a few minutes out.
const HORIZON = -0.833;

// Days from the J2000.0 epoch. Date.getTime() is UTC, so this carries no
// timezone of its own, which is what the rest of the maths expects.
const julianDay = (date) => date.getTime() / 86400000 + 2440587.5;

/**
 * Sunrise and sunset for a place and a day, as Date objects (UTC instants).
 * Returns null for the polar cases: above the arctic circle the sun can simply
 * not rise or not set, and there is no time to return.
 */
export function sunTimes(date, lat, lon) {
  const n = Math.round(julianDay(date) - 2451545.0 + 0.0008);
  // Solar noon at 13 degrees EAST happens about 54 minutes before it does at
  // Greenwich, so an east longitude SUBTRACTS. Written the other way round the
  // error is exactly twice the longitude offset, which is how it was caught:
  // 110 minutes out in Berlin, 1212 in Sydney, both 2x lon/360.
  const jStar = n + 0.0009 - lon / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;                       // solar mean anomaly
  const C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD)
          + 0.0003 * Math.sin(3 * M * RAD);                              // equation of the centre
  const lambda = (M + C + 180 + 102.9372) % 360;                         // ecliptic longitude
  const jTransit = 2451545.0 + jStar + 0.0053 * Math.sin(M * RAD)
                 - 0.0069 * Math.sin(2 * lambda * RAD);                  // solar noon
  const sinDec = Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD);
  const cosDec = Math.cos(Math.asin(sinDec));

  const cosOmega = (Math.sin(HORIZON * RAD) - Math.sin(lat * RAD) * sinDec)
                 / (Math.cos(lat * RAD) * cosDec);
  // |cos| > 1 has no solution: midnight sun, or polar night.
  if (cosOmega > 1 || cosOmega < -1) return null;

  const omega = Math.acos(cosOmega) / RAD;
  const fromJulian = (j) => new Date((j - 2440587.5) * 86400000);
  return { sunrise: fromJulian(jTransit - omega / 360), sunset: fromJulian(jTransit + omega / 360) };
}

/**
 * Should the app be in its light scheme right now?
 *
 * With coordinates: between sunrise and sunset. Above the arctic circle, where
 * there is no sunrise to compare against, the sun's declination decides, which
 * is simply "is it the light half of the year up here".
 *
 * Without coordinates: the clock. The browser's hours are already the user's
 * own, so this needs no location lookup, it is just less exact near the
 * solstices. 7 to 19 rather than 6 to 20, because being wrongly DARK in the
 * early evening is the milder mistake: it is the scheme the app defaulted to
 * for its whole life.
 */
export function isDaylight(now = new Date(), lat = null, lon = null) {
  if (typeof lat === "number" && typeof lon === "number") {
    const t = sunTimes(now, lat, lon);
    if (t) return now >= t.sunrise && now < t.sunset;
    // Polar. Northern summer / southern summer, by the date.
    const month = now.getUTCMonth();
    const northernSummer = month >= 3 && month <= 8;
    return lat >= 0 ? northernSummer : !northernSummer;
  }
  const h = now.getHours();
  return h >= 7 && h < 19;
}
