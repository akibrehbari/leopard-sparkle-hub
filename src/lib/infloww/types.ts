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
 * Spec enums use TitleCase ("Subscription", "Recurring Subscription", ...).
 * We model exactly what the spec returns and treat anything else as "Unknown".
 */
export type InflowwTransactionType =
  | "Subscription"
  | "Recurring Subscription"
  | "Tips"
  | "Messages"
  | "Referrals"
  | "Streams"
  | "Posts"
  | "Unknown";

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
   * Number, decimal dollars per the example (29.99). Treat as a number value;
   * if a future deployment returns cents instead, the derive helpers handle
   * both via heuristics.
   */
  paymentAmount: number;
  transactionType: InflowwRefundTransactionType;
  currency: string;
}

/* -------------------------------------------------------------------------- */
/*  Links — GET /v1/links?linkType=CAMPAIGN|TRIAL|TRACKING                    */
/* -------------------------------------------------------------------------- */

export type InflowwLinkType = "CAMPAIGN" | "TRIAL" | "TRACKING";

interface InflowwLinkBase {
  id: string;
  finishedFlag: boolean;
  earningsGross: number;
  earningsNet: number;
  payingFansCount: number;
  currency: string;
  /** Unix milliseconds as a string. */
  createdTime: string;
  /** Unix milliseconds as a string. */
  expiredTime: string;
  /** Unix milliseconds as a string. */
  updatedTime: string;
}

export interface InflowwCampaignLink extends InflowwLinkBase {
  linkKind: "CAMPAIGN";
  /** Description shown to fans. */
  message: string;
  /** Targeting: new fans, expired (re-sub), or both. */
  type: "new" | "expired" | "both";
  subCount: number;
  /** 0 means no limit. */
  subLimit: number;
  /** Days. */
  subDuration: number;
  /** Percent (e.g. 30 = 30%). */
  discount: number;
}

export interface InflowwTrialLink extends InflowwLinkBase {
  linkKind: "TRIAL";
  name: string;
  /** Path-suffix used to construct the public URL. */
  code: string;
  subDuration: number;
  subLimit: number;
  subCount: number;
  source: string;
  autoDefaultList: boolean;
  defaultListName: string;
  relTagNames: string[];
  /** Percentage (string) of trial fans who later spent. */
  spendClaim: string;
  /** Average earnings per subscriber (smallest unit). */
  aepsGross: number;
  aepsNet: number;
}

export interface InflowwTrackingLink extends InflowwLinkBase {
  linkKind: "TRACKING";
  name: string;
  code: string;
  clickCount: number;
  subCount: number;
  source: string;
  autoDefaultList: boolean;
  defaultListName: string;
  relTagNames: string[];
  /** Percentages as strings. */
  subscriptionCVR: string;
  spendingCVR: string;
  /** Smallest unit. */
  epcGross: number;
  epcNet: number;
  aepsGross: number;
  aepsNet: number;
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
