/**
 * Type definitions for the Infloww OpenAPI v1.
 *
 * Reference: infloww-openapi.yaml (in repo root) and
 * https://infloww-openapi.stoplight.io/.
 *
 * Notes on data shapes:
 * - Timestamps are returned as strings — usually unix milliseconds (e.g.
 *   "1750019015000") but the spec also accepts ISO 8601. Use parseInflowwTime
 *   from ./util.ts to normalize.
 * - Money fields differ by endpoint:
 *     - transactions: string in the smallest unit (cents). "7400" = $74.00.
 *     - links:        integer in the smallest unit (cents). 150000 = $1500.
 *     - refunds:      number; spec says smallest unit but the example uses
 *                     decimal dollars (29.99). We treat the value as decimal
 *                     dollars (matches the example) but expose a helper to
 *                     coerce both shapes.
 *     - linkfans:     integer in the smallest unit (cents).
 */

/** All Infloww endpoints share this envelope. */
export interface InflowwEnvelope<T> {
  data: {
    list: T[];
    platformCode?: string;
    linkType?: InflowwLinkType;
  };
  cursor?: string | null;
  hasMore: boolean;
  errorMessage?: string | null;
}

/** Standard error body for non-2xx responses. */
export interface InflowwErrorBody {
  errorMessage?: string;
  message?: string;
  body?: string;
}

export type InflowwPlatformCode = "OnlyFans" | "Fansly" | (string & {});

/* -------------------------------------------------------------------------- */
/*  Creators — GET /v1/creators                                               */
/* -------------------------------------------------------------------------- */

export interface InflowwCreator {
  id: string;
  name: string;
  nickName: string;
  userName: string;
  tagName: string;
  /** Unix milliseconds as a string, or ISO 8601. */
  createdTime: string;
}

/* -------------------------------------------------------------------------- */
/*  Transactions — GET /v1/transactions                                       */
/* -------------------------------------------------------------------------- */

/**
 * Transaction types observed in the live API. NOTE: the OpenAPI spec lists
 * `"Recurring Subscription"` (with a space), but the live API actually
 * returns `"RecurringSubscription"` (no space) — verified against real data.
 * We accept both spellings just in case Infloww switches back. Anything else
 * is widened to `string` so unknown types parse instead of throwing.
 */
export type InflowwTransactionType =
  | "Subscription"
  | "RecurringSubscription"
  | "Recurring Subscription"
  | "Tips"
  | "Messages"
  | "Referrals"
  | "Streams"
  | "Posts"
  | "Unknown"
  | (string & {});

export type InflowwTipSource =
  | "Profile"
  | "PostAll"
  | "Chat"
  | "Stream"
  | "Story"
  | "Unknown";

export type InflowwTransactionStatus =
  | "loading"
  | "done"
  | "undo"
  | "pending_return";

export interface InflowwTransaction {
  id: string;
  /** OnlyFans (or other-platform) transaction id. */
  transactionId: string;
  fanId: string;
  fanName: string;
  /** Unix milliseconds as a string, or ISO 8601. */
  createdTime: string;
  type: InflowwTransactionType;
  /** Only present when type === "Tips". */
  tipSource?: InflowwTipSource;
  status: InflowwTransactionStatus;
  /** String, smallest unit of currency. e.g. "7400" = $74.00 USD. */
  amount: string;
  fee: string;
  net: string;
  currency: string;
}

/* -------------------------------------------------------------------------- */
/*  Refunds — GET /v1/refunds                                                 */
/* -------------------------------------------------------------------------- */

export type InflowwRefundStatus = "undo" | "loading" | "done";

export type InflowwRefundTransactionType =
  | "tips"
  | "post"
  | "chat_messages"
  | "stream"
  | "subscribes";

export interface InflowwRefund {
  id: string;
  transactionId: string;
  fanId: string;
  /** Unix milliseconds as a string, or ISO 8601. */
  paymentTime: string;
  /** May be null if the refund hasn't actually completed. */
  refundTime: string | null;
  paymentStatus: InflowwRefundStatus;
  /**
   * String of the smallest currency unit (cents). e.g. "2999" = $29.99 USD.
   * The OpenAPI spec example showed "29.99" decimal but live data is cents
   * matching the transactions endpoint. Use inflowwAmount(value, "cents").
   */
  paymentAmount: string;
  transactionType: InflowwRefundTransactionType;
  currency: string;
}

/* -------------------------------------------------------------------------- */
/*  Links — GET /v1/links?linkType=CAMPAIGN|TRIAL|TRACKING                    */
/* -------------------------------------------------------------------------- */

export type InflowwLinkType = "CAMPAIGN" | "TRIAL" | "TRACKING";

/**
 * Spec says all numeric link fields are integers, but the live API returns
 * them as JSON strings (e.g. "0", "1", "150000"). We type as `string | number`
 * and use inflowwAmount() / Number() at the read site to coerce safely.
 */
interface InflowwLinkBase {
  id: string;
  finishedFlag: boolean;
  earningsGross: string | number;
  earningsNet: string | number;
  payingFansCount: string | number;
  currency: string;
  /** Unix milliseconds as a string. */
  createdTime: string;
  /** Unix milliseconds as a string, may be null. */
  expiredTime: string | null;
  /** Unix milliseconds as a string. */
  updatedTime: string;
}

export interface InflowwCampaignLink extends InflowwLinkBase {
  linkKind: "CAMPAIGN";
  /** Description shown to fans. */
  message: string;
  /** Targeting: new fans, expired (re-sub), or both. */
  type: "new" | "expired" | "both";
  subCount: string | number;
  /** "0" means no limit. */
  subLimit: string | number;
  /** Days. */
  subDuration: string | number;
  /** Percent (e.g. 30 = 30%). */
  discount: string | number;
}

export interface InflowwTrialLink extends InflowwLinkBase {
  linkKind: "TRIAL";
  name: string;
  /** Path-suffix used to construct the public URL. */
  code: string;
  subDuration: string | number;
  subLimit: string | number;
  subCount: string | number;
  source: string | null;
  autoDefaultList: boolean;
  defaultListName: string | null;
  relTagNames: string[];
  /** Percentage (string) of trial fans who later spent. */
  spendClaim: string;
  /** Average earnings per subscriber (smallest unit). */
  aepsGross: string | number;
  aepsNet: string | number;
}

export interface InflowwTrackingLink extends InflowwLinkBase {
  linkKind: "TRACKING";
  name: string;
  code: string;
  clickCount: string | number;
  subCount: string | number;
  source: string | null;
  autoDefaultList: boolean;
  defaultListName: string | null;
  relTagNames: string[];
  /** Percentages as strings. */
  subscriptionCVR: string;
  spendingCVR: string;
  /** Smallest unit. */
  epcGross: string | number;
  epcNet: string | number;
  aepsGross: string | number;
  aepsNet: string | number;
}

export type InflowwLink =
  | InflowwCampaignLink
  | InflowwTrialLink
  | InflowwTrackingLink;

/* -------------------------------------------------------------------------- */
/*  Link Fans — GET /v1/linkfans                                              */
/* -------------------------------------------------------------------------- */

export interface InflowwLinkFan {
  /** Link ID. */
  id: string;
  fanId: string;
  fanName: string;
  /** All earning fields are integers in the smallest unit (cents). */
  subscriptionEarningGross: number;
  subscriptionEarningNet: number;
  postsEarningGross: number;
  postsEarningNet: number;
  messagesEarningGross: number;
  messagesEarningNet: number;
  streamsEarningGross: number;
  streamsEarningNet: number;
  tipsEarningGross: number;
  tipsEarningNet: number;
  currency: string;
  /** Unix milliseconds as a string, or ISO 8601. */
  subscribedTime: string;
}

/* -------------------------------------------------------------------------- */
/*  Query parameter shapes                                                    */
/* -------------------------------------------------------------------------- */

export interface InflowwListQuery {
  cursor?: string | number;
  limit?: number;
  platformCode?: InflowwPlatformCode;
}

export interface InflowwTimeRangeQuery {
  /** Unix ms or ISO 8601. */
  startTime?: string | number;
  endTime?: string | number;
}

export interface InflowwTransactionsQuery
  extends InflowwListQuery,
    InflowwTimeRangeQuery {
  creatorId: string | number;
}

export interface InflowwRefundsQuery
  extends InflowwListQuery,
    InflowwTimeRangeQuery {
  creatorId: string | number;
}

export interface InflowwLinksQuery
  extends InflowwListQuery,
    InflowwTimeRangeQuery {
  creatorId: string | number;
  linkType?: InflowwLinkType;
}

export interface InflowwLinkFansQuery extends InflowwListQuery {
  creatorId: string | number;
  linkType: InflowwLinkType;
  linkId: string | number;
}
