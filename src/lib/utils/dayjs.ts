/**
 * Centralized dayjs instance.
 *
 * Import `dayjs` from this module rather than from "dayjs" directly so that
 * every caller gets the same plugins registered (utc, timezone, isoWeek)
 * and the PKT default timezone applied. Plugin registration is global, but
 * keeping it in one file means we only do it once and have a single place
 * to change tz behavior if business rules ever shift.
 */

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import isoWeek from "dayjs/plugin/isoWeek";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);

export const PKT_TZ = "Asia/Karachi";

dayjs.tz.setDefault(PKT_TZ);

/** Get a dayjs instance pinned to PKT for any input. */
export const pkt = (input?: dayjs.ConfigType) => dayjs(input).tz(PKT_TZ);

export default dayjs;
