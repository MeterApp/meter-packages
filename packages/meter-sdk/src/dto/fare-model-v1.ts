import { z } from "zod";

// Canonical Fare Model V1 schema. Keep in sync, in the same change:
// common/rpc/fares/v1/fare_model.proto (protobuf rendering) and
// tools/official_rates/taxi/fare_model_v1_validator.py (Python validator).
// common/fares/fare-model-v1-validation-cases.json pins the verdicts both
// sides must agree on.

export const FARE_MODEL_V1_LIMITS = {
  maxTariffs: 16,
  maxScheduleDays: 7,
  maxPickupLocationTags: 16,
  maxDistanceBands: 24,
  maxPulseBands: 24,
  maxBookingRules: 16,
  maxAdditiveRules: 32,
  maxPassthroughRules: 16,
  maxClientCapabilities: 16,
  maxUnsupportedReasonLength: 512,
  maxIdLength: 80,
  maxDisplayNameLength: 120,
  maxCurrencyMinorAmount: 1_000_000_000,
  maxDistanceMeters: 2_000_000,
  maxDurationSeconds: 86_400,
  maxPercentBasisPoints: 100_000,
} as const;

export const fareModelSourceSemanticsValues = [
  "exact_published_tariff",
  "official_maximum",
  "regulated_range",
  "fixed_route_override",
  "negotiated_optional",
  "source_only",
  "unsupported",
] as const;

export const fareModelSupportLevelValues = [
  "legacy_scalar",
  "source_only",
  "estimate_capable",
  "live_meter_capable",
  "unsupported",
] as const;

export const fareModelClientCapabilityValues = [
  "backend_estimate_v1",
  "backend_receipt_trace_v1",
  "mobile_live_meter_v1",
  "continuous_components_v1",
  "pulse_whichever_first_v1",
  "automatic_waiting_v1",
  "distance_rounding_v1",
  "dual_time_components_v1",
  "fare_fee_semantics_v1",
  "legacy_scalar_combined_rounding_v1",
  "schedule_segmentation_v1",
  "typed_surcharges_v1",
] as const;

/**
 * Who authored/owns the fare. This is deliberately separate from
 * `source_semantics`: provenance is display/audit metadata and never grants
 * or removes pricing capability.
 */
export const fareModelSourceProvenanceValues = [
  "official",
  "user_defined",
  "fleet_defined",
  "platform_defined",
  "unknown",
] as const;

export const fareModelSourceSemanticsSchema = z.enum(
  fareModelSourceSemanticsValues,
);

export const fareModelSupportLevelSchema = z.enum(fareModelSupportLevelValues);

export const fareModelClientCapabilitySchema = z.enum(
  fareModelClientCapabilityValues,
);

export const fareModelSourceProvenanceSchema = z.enum(
  fareModelSourceProvenanceValues,
);

export const fareModelCalculationProfileSchema = z.enum([
  "legacy_scalar_parity_v1",
]);

export const fareModelUnitSystemSchema = z.enum(["metric", "imperial"]);

export const fareModelTaxModeSchema = z.enum(["included", "excluded", "none"]);

export const fareModelRoundingStageSchema = z.enum([
  "none",
  "meter",
  "line_item",
  "tax",
  "total",
]);

export const fareModelRoundingModeSchema = z.enum(["nearest", "up", "down"]);

export const fareModelDayOfWeekSchema = z.enum([
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
]);

export const fareModelHolidayBehaviorSchema = z.enum([
  "include",
  "exclude",
  "only",
]);

export const fareModelServiceClassSchema = z.enum([
  "standard",
  "airport",
  "wheelchair",
  "premium",
  "van",
  "motorcycle",
  "auto_rickshaw",
  "jurisdiction_specific",
]);

export const fareModelPickupLocationTagSchema = z.enum([
  "airport",
  "port",
  "station",
  "city_center",
  "hotel",
  "event",
  "border",
  "jurisdiction_specific",
]);

export const fareModelTimeTriggerSchema = z.enum([
  "none",
  "elapsed",
  "manual_wait",
  "stopped",
  "below_speed_threshold",
]);

export const fareModelGpsQualityPolicySchema = z.enum([
  "charge_when_confident",
  "suppress_when_degraded",
  "fallback_to_elapsed_time",
]);

export const fareModelBookingChannelSchema = z.enum([
  "street_hail",
  "dispatch",
  "phone",
  "app",
  "web",
  "stand",
  "airport_queue",
]);

export const fareModelAdditiveRuleTypeSchema = z.enum([
  "booking",
  "dispatch",
  "passenger",
  "luggage",
  "vehicle_class",
  "airport_pickup",
  "port_pickup",
  "station_pickup",
  "night",
  "peak",
  "holiday",
  "jurisdiction_specific",
]);

export const fareModelSurchargeBaseSchema = z.enum([
  "meter_subtotal",
  "distance_subtotal",
  "time_subtotal",
  "fare_before_tax",
  "fare_after_tax",
]);

export const fareModelPassthroughRuleTypeSchema = z.enum([
  "toll",
  "parking",
  "ferry",
  "airport_fee",
  "manual_extra",
  "jurisdiction_specific",
]);

const idSchema = z
  .string()
  .min(1)
  .max(FARE_MODEL_V1_LIMITS.maxIdLength)
  .regex(/^[A-Za-z0-9_.:-]+$/);

// String limits count UTF-16 code units, as Swift, Kotlin and the Python
// validator do. Zod 4.6 `.max()` counts code points, so a string of astral
// characters (emoji) can pass `.max()` yet exceed the contract. `.max()` stays
// for JSON Schema `maxLength`; this adds the one issue `.max()` misses.
function maxUtf16Length(max: number) {
  return (value: string, ctx: z.RefinementCtx) => {
    if (value.length > max && Array.from(value).length <= max) {
      ctx.addIssue({
        code: "too_big",
        origin: "string",
        maximum: max,
        inclusive: true,
        input: value,
      });
    }
  };
}

const displayNameSchema = z
  .string()
  .min(1)
  .max(FARE_MODEL_V1_LIMITS.maxDisplayNameLength)
  .superRefine(maxUtf16Length(FARE_MODEL_V1_LIMITS.maxDisplayNameLength));

const currencyCodeSchema = z.string().regex(/^[A-Z]{3}$/);

const timezoneSchema = z.string().min(1).max(128);

const localTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const minorAmountSchema = z
  .number()
  .int()
  .min(0)
  .max(FARE_MODEL_V1_LIMITS.maxCurrencyMinorAmount);

// Continuous rates can legitimately be fractions of a currency minor unit.
// They are multiplied first and rounded at the configured pricing stage.
const minorRateSchema = z
  .number()
  .finite()
  .min(0)
  .max(FARE_MODEL_V1_LIMITS.maxCurrencyMinorAmount);

// Exact unit conversion matters at pricing boundaries (one international
// mile is 1609.344m), so continuous distances must not be integer-clamped.
const exactDistanceMetersSchema = z
  .number()
  .finite()
  .gt(0)
  .max(FARE_MODEL_V1_LIMITS.maxDistanceMeters);

const positiveMinorAmountSchema = z
  .number()
  .int()
  .min(1)
  .max(FARE_MODEL_V1_LIMITS.maxCurrencyMinorAmount);

const distanceMetersSchema = z
  .number()
  .int()
  .min(1)
  .max(FARE_MODEL_V1_LIMITS.maxDistanceMeters);

const durationSecondsSchema = z
  .number()
  .int()
  .min(1)
  .max(FARE_MODEL_V1_LIMITS.maxDurationSeconds);

const percentageBasisPointsSchema = z
  .number()
  .int()
  .min(1)
  .max(FARE_MODEL_V1_LIMITS.maxPercentBasisPoints);

export const fareModelRoundingSchema = z
  .object({
    stage: fareModelRoundingStageSchema.describe(
      "Pricing stage at which monetary rounding applies.",
    ),
    increment_minor: z
      .number()
      .int()
      .min(1)
      .max(100_000)
      .optional()
      .describe("Rounding quantum in integer minor currency units."),
    mode: fareModelRoundingModeSchema.describe(
      "Direction of monetary rounding: nearest, up, or down.",
    ),
  })
  .strict();

export const fareModelScheduleSchema = z
  .object({
    days: z
      .array(fareModelDayOfWeekSchema)
      .min(1)
      .max(FARE_MODEL_V1_LIMITS.maxScheduleDays)
      .describe("Weekdays on which the local schedule starts."),
    start_local_time: localTimeSchema.describe(
      "Schedule start in local HH:mm time.",
    ),
    end_local_time: localTimeSchema.describe(
      "Schedule end in local HH:mm time; earlier end crosses midnight, equal start and end means a full day.",
    ),
    holiday_behavior: fareModelHolidayBehaviorSchema
      .default("include")
      .describe("Whether holidays are included, excluded, or required."),
  })
  .strict();

export const fareModelActivationConditionsSchema = z
  .object({
    service_class: fareModelServiceClassSchema
      .default("standard")
      .describe("Service class required for tariff activation."),
    pickup_location_tags: z
      .array(fareModelPickupLocationTagSchema)
      .max(FARE_MODEL_V1_LIMITS.maxPickupLocationTags)
      .default([])
      .describe("Pickup categories applicable to the tariff or rule."),
  })
  .strict();

export const fareModelFlagFallSchema = z
  .object({
    amount_minor: minorAmountSchema.describe(
      "Charge in integer minor currency units.",
    ),
    included_distance_m: distanceMetersSchema
      .optional()
      .describe("Distance included in flag fall, in meters."),
    included_time_s: durationSecondsSchema
      .optional()
      .describe("Time included in flag fall, in seconds."),
  })
  .strict();

export const continuousDistanceBandSchema = z
  .object({
    until_distance_m: exactDistanceMetersSchema
      .optional()
      .describe(
        "Cumulative distance boundary in meters; omission leaves the final band unbounded.",
      ),
    rate_per_distance_minor: minorRateSchema.describe(
      "Minor currency units charged per distance_unit_m; fractional minor-unit rates are preserved.",
    ),
    distance_unit_m: exactDistanceMetersSchema.describe(
      "Distance rate denominator in meters, preserving exact unit conversion.",
    ),
  })
  .strict();

export const continuousTimeComponentSchema = z
  .object({
    trigger: fareModelTimeTriggerSchema.describe(
      "Condition under which this time component accrues.",
    ),
    rate_per_time_minor: minorRateSchema
      .optional()
      .describe(
        "Minor currency units charged per time_unit_s; fractional minor-unit rates are preserved.",
      ),
    time_unit_s: durationSecondsSchema
      .optional()
      .describe("Time rate denominator in seconds."),
    /** Do not bill manual-wait seconds again in this component. */
    exclude_manual_wait: z
      .boolean()
      .optional()
      .describe(
        "Exclude manual-wait seconds from this time component to avoid double charging.",
      ),
    threshold_speed_kph: z
      .number()
      .min(0)
      .max(160)
      .optional()
      .describe("Time-charge speed threshold in kilometers per hour."),
    grace_period_s: z
      .number()
      .int()
      .min(0)
      .max(3_600)
      .optional()
      .describe("Uncharged grace duration in seconds."),
    smoothing_window_s: z
      .number()
      .int()
      .min(0)
      .max(600)
      .optional()
      .describe("Speed smoothing window in seconds."),
    gps_quality_policy: fareModelGpsQualityPolicySchema
      .optional()
      .describe("How charging responds to degraded GPS confidence."),
  })
  .strict();

export const continuousComponentsMeterLogicSchema = z
  .object({
    mode: z
      .literal("continuous_components")
      .describe("Continuous distance and time component calculation."),
    flag_fall: fareModelFlagFallSchema.describe(
      "Initial charge and included distance or time.",
    ),
    distance_bands: z
      .array(continuousDistanceBandSchema)
      .max(FARE_MODEL_V1_LIMITS.maxDistanceBands)
      .default([])
      .describe("Distance tiers in cumulative boundary order."),
    /** Floor chargeable distance to this meter quantum before tiering. */
    distance_rounding_m: exactDistanceMetersSchema
      .optional()
      .describe(
        "Floor chargeable distance to this meter quantum before applying tiers.",
      ),
    time_component: continuousTimeComponentSchema
      .optional()
      .describe("Elapsed or traffic time charging component."),
    /** A simultaneous manual-wait component, distinct from elapsed/traffic. */
    wait_time_component: continuousTimeComponentSchema
      .optional()
      .describe("Separate simultaneous manual-wait charging component."),
  })
  .strict();

export const pulseBandSchema = z
  .object({
    until_distance_m: distanceMetersSchema
      .optional()
      .describe(
        "Cumulative distance boundary in meters; omission leaves the final band unbounded.",
      ),
    pulse_amount_minor: positiveMinorAmountSchema.describe(
      "Charge per pulse in integer minor currency units.",
    ),
    distance_per_pulse_m: distanceMetersSchema.describe(
      "Distance triggering a pulse, in meters.",
    ),
    time_per_pulse_s: durationSecondsSchema.describe(
      "Time triggering a pulse, in seconds.",
    ),
  })
  .strict();

export const pulseWhicheverFirstMeterLogicSchema = z
  .object({
    mode: z
      .literal("pulse_whichever_first")
      .describe(
        "Charge each pulse when its distance or time threshold is reached first.",
      ),
    flag_fall: fareModelFlagFallSchema.describe(
      "Initial charge and included distance or time.",
    ),
    bands: z
      .array(pulseBandSchema)
      .min(1)
      .max(FARE_MODEL_V1_LIMITS.maxPulseBands)
      .describe("Whichever-first pulse bands in cumulative distance order."),
  })
  .strict();

export const fareModelMeterLogicSchema = z.discriminatedUnion("mode", [
  continuousComponentsMeterLogicSchema,
  pulseWhicheverFirstMeterLogicSchema,
]);

export const fareModelBookingRuleSchema = z
  .object({
    rule_id: idSchema.describe(
      "Semantic rule identifier within this pricing model.",
    ),
    channel: fareModelBookingChannelSchema.describe(
      "Booking channel to which the charge applies.",
    ),
    amount_minor: minorAmountSchema.describe(
      "Charge in integer minor currency units.",
    ),
    schedule: fareModelScheduleSchema
      .optional()
      .describe("Local-time conditions for this tariff or rule."),
  })
  .strict();

export const fareModelFixedAmountSchema = z
  .object({
    kind: z
      .literal("fixed")
      .describe("Fixed amount or percentage calculation."),
    amount_minor: minorAmountSchema.describe(
      "Charge in integer minor currency units.",
    ),
  })
  .strict();

export const fareModelPercentAmountSchema = z
  .object({
    kind: z
      .literal("percentage")
      .describe("Fixed amount or percentage calculation."),
    percentage_basis_points: percentageBasisPointsSchema.describe(
      "Percentage in basis points: 100 means one percent.",
    ),
    base: fareModelSurchargeBaseSchema.describe(
      "Subtotal on which the percentage is calculated.",
    ),
  })
  .strict();

export const fareModelAdditiveAmountSchema = z.discriminatedUnion("kind", [
  fareModelFixedAmountSchema,
  fareModelPercentAmountSchema,
]);

export const fareModelAdditiveRuleSchema = z
  .object({
    rule_id: idSchema.describe(
      "Semantic rule identifier within this pricing model.",
    ),
    type: fareModelAdditiveRuleTypeSchema.describe(
      "Category of conditional pricing addition.",
    ),
    amount: fareModelAdditiveAmountSchema.describe(
      "Fixed minor-unit amount or percentage with an explicit calculation base.",
    ),
    schedule: fareModelScheduleSchema
      .optional()
      .describe("Local-time conditions for this tariff or rule."),
    service_classes: z
      .array(fareModelServiceClassSchema)
      .max(16)
      .optional()
      .describe("Service classes to which this rule applies."),
    pickup_location_tags: z
      .array(fareModelPickupLocationTagSchema)
      .max(FARE_MODEL_V1_LIMITS.maxPickupLocationTags)
      .optional()
      .describe("Pickup categories applicable to the tariff or rule."),
  })
  .strict();

export const fareModelPassthroughRuleSchema = z
  .object({
    rule_id: idSchema.describe(
      "Semantic rule identifier within this pricing model.",
    ),
    type: fareModelPassthroughRuleTypeSchema.describe(
      "Category of passthrough cost.",
    ),
    mode: z
      .enum(["actual", "manual", "estimated"])
      .describe(
        "Whether the passthrough cost is actual, manually entered, or estimated.",
      ),
    taxable: z
      .boolean()
      .default(false)
      .describe("Whether this passthrough cost is taxable."),
    display_name: displayNameSchema
      .optional()
      .describe("Human-readable pricing label."),
    default_amount_minor: minorAmountSchema
      .optional()
      .describe("Default cost in integer minor currency units."),
    application: z
      .enum(["required", "optional"])
      .optional()
      .describe("Whether the passthrough charge is required or optional."),
  })
  .strict();

export const fareModelTariffSchema = z
  .object({
    tariff_id: idSchema.describe(
      "Semantic tariff identifier used within the model; not a provider or database identifier.",
    ),
    display_name: displayNameSchema
      .optional()
      .describe("Human-readable pricing label."),
    schedule: fareModelScheduleSchema
      .optional()
      .describe("Local-time conditions for this tariff or rule."),
    activation_conditions: fareModelActivationConditionsSchema
      .optional()
      .describe("Service and pickup conditions that select this tariff."),
    meter_logic: fareModelMeterLogicSchema.describe(
      "Complete typed meter calculation: continuous components or whichever-first pulses.",
    ),
    minimum_fare_minor: minorAmountSchema
      .optional()
      .describe("Minimum charge in integer minor currency units."),
  })
  .strict();

export const fareModelEntitlementRequirementSchema = z.enum([
  "meter_pro_or_fleet",
]);

export const fareModelEntitlementRequirementsSchema = z
  .object({
    advanced_authoring: z
      .array(fareModelEntitlementRequirementSchema)
      .max(2)
      .default([])
      .describe("Entitlements required to author advanced pricing."),
    personal_live_use: z
      .array(fareModelEntitlementRequirementSchema)
      .max(2)
      .default([])
      .describe("Entitlements required for personal live metering."),
  })
  .strict();

export const fareModelCapabilitiesSchema = z
  .object({
    support_level: fareModelSupportLevelSchema.describe(
      "Supported calculation level for the saved pricing model.",
    ),
    required_client_capabilities: z
      .array(fareModelClientCapabilitySchema)
      .max(FARE_MODEL_V1_LIMITS.maxClientCapabilities)
      .default([])
      .describe("Capabilities a client must support before using this model."),
    entitlement_requirements: fareModelEntitlementRequirementsSchema
      .optional()
      .describe("Paid access requirements for authoring or personal live use."),
    unsupported_reason: z
      .string()
      .max(FARE_MODEL_V1_LIMITS.maxUnsupportedReasonLength)
      .superRefine(maxUtf16Length(FARE_MODEL_V1_LIMITS.maxUnsupportedReasonLength))
      .optional()
      .describe("Reason this saved model is not supported, when present."),
  })
  .strict();

const fareModelV1BaseSchema = z
  .object({
    schema_version: z.literal(1).describe("Canonical pricing schema version."),
    fare_kind: z.literal("metered").describe("Metered fare pricing model."),
    source_semantics: fareModelSourceSemanticsSchema.describe(
      "Regulatory meaning of the saved tariff, independent of source ownership or provenance.",
    ),
    source_provenance: fareModelSourceProvenanceSchema.optional(),
    calculation_profile: fareModelCalculationProfileSchema
      .optional()
      .describe("Compatibility calculation rules for this saved model."),
    currency_code: currencyCodeSchema.describe(
      "ISO 4217 currency; canonical money amounts use its minor unit.",
    ),
    unit_system: fareModelUnitSystemSchema.describe(
      "Display distance unit system; explicit meter and second fields retain their stated units.",
    ),
    timezone: timezoneSchema.describe(
      "IANA timezone for local tariff schedules.",
    ),
    tax_mode: fareModelTaxModeSchema.describe(
      "Whether prices include tax, exclude tax, or have no tax.",
    ),
    rounding: fareModelRoundingSchema
      .optional()
      .describe("Explicit monetary rounding policy."),
    tariffs: z
      .array(fareModelTariffSchema)
      .min(1)
      .max(FARE_MODEL_V1_LIMITS.maxTariffs)
      .describe("Complete bounded set of pricing tariffs."),
    booking_rules: z
      .array(fareModelBookingRuleSchema)
      .max(FARE_MODEL_V1_LIMITS.maxBookingRules)
      .default([])
      .describe("Fixed booking-channel charges and their optional schedules."),
    additive_rules: z
      .array(fareModelAdditiveRuleSchema)
      .max(FARE_MODEL_V1_LIMITS.maxAdditiveRules)
      .default([])
      .describe("Conditional fixed or percentage pricing additions."),
    passthrough_rules: z
      .array(fareModelPassthroughRuleSchema)
      .max(FARE_MODEL_V1_LIMITS.maxPassthroughRules)
      .default([])
      .describe(
        "Rules for passing actual, manual, or estimated costs to the rider.",
      ),
    capabilities: fareModelCapabilitiesSchema
      .optional()
      .describe("Saved model support and client/entitlement requirements."),
  })
  .strict();

type FareModelScheduleCandidate = z.infer<typeof fareModelScheduleSchema>;
type FareModelTariffCandidate = z.infer<typeof fareModelTariffSchema>;
type ContinuousTimeComponentCandidate = z.infer<
  typeof continuousTimeComponentSchema
>;
type FareModelV1BaseCandidate = z.infer<typeof fareModelV1BaseSchema>;

const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;
const WEEK_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const WEEK_DAY_INDEX = new Map(WEEK_DAYS.map((day, index) => [day, index]));
function addBusinessRuleIssue(
  ctx: z.RefinementCtx,
  path: Array<string | number>,
  message: string,
) {
  ctx.addIssue({
    code: "custom",
    path,
    message,
  });
}

function hasDuplicateValues(values: readonly string[]) {
  return new Set(values).size !== values.length;
}

function localTimeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours! * 60 + minutes!;
}

function isValidTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

function scheduleToWeekIntervals(schedule: FareModelScheduleCandidate) {
  const start = localTimeToMinutes(schedule.start_local_time);
  const end = localTimeToMinutes(schedule.end_local_time);
  const uniqueDays = [...new Set(schedule.days)];

  return uniqueDays
    .flatMap((day) => {
      const dayIndex = WEEK_DAY_INDEX.get(day) ?? 0;
      const dayStart = dayIndex * MINUTES_PER_DAY;

      if (start === end) {
        return [{ start: dayStart, end: dayStart + MINUTES_PER_DAY }];
      }

      if (start < end) {
        return [{ start: dayStart + start, end: dayStart + end }];
      }

      const nextDayStart = (dayStart + MINUTES_PER_DAY) % MINUTES_PER_WEEK;
      return [
        { start: dayStart + start, end: dayStart + MINUTES_PER_DAY },
        { start: nextDayStart, end: nextDayStart + end },
      ];
    })
    .sort((a, b) => a.start - b.start);
}

function schedulesOverlap(
  left: FareModelScheduleCandidate | undefined,
  right: FareModelScheduleCandidate | undefined,
) {
  if (!left || !right) {
    return true;
  }

  const leftIntervals = scheduleToWeekIntervals(left);
  const rightIntervals = scheduleToWeekIntervals(right);

  return leftIntervals.some((leftInterval) =>
    rightIntervals.some(
      (rightInterval) =>
        leftInterval.start < rightInterval.end &&
        rightInterval.start < leftInterval.end,
    ),
  );
}

function tariffActivationKey(tariff: FareModelTariffCandidate) {
  const activation = tariff.activation_conditions;
  const serviceClass = activation?.service_class ?? "standard";
  const pickupLocationTags = [
    ...new Set(activation?.pickup_location_tags ?? []),
  ].sort();
  return `${serviceClass}|${pickupLocationTags.join(",")}`;
}

function validateScheduleBusinessRules(
  schedule: FareModelScheduleCandidate | undefined,
  ctx: z.RefinementCtx,
  path: Array<string | number>,
) {
  if (!schedule) {
    return;
  }

  if (hasDuplicateValues(schedule.days)) {
    addBusinessRuleIssue(
      ctx,
      [...path, "days"],
      "Schedule days must be unique",
    );
  }
}

function validateDistanceBandThresholds(
  bands: Array<{ until_distance_m?: number }>,
  ctx: z.RefinementCtx,
  path: Array<string | number>,
) {
  let previousThreshold = 0;
  let hasOpenEndedBand = false;

  bands.forEach((band, index) => {
    if (band.until_distance_m === undefined) {
      hasOpenEndedBand = true;
      if (index !== bands.length - 1) {
        addBusinessRuleIssue(
          ctx,
          [...path, index, "until_distance_m"],
          "Open-ended distance bands must be last",
        );
      }
      return;
    }

    if (hasOpenEndedBand) {
      addBusinessRuleIssue(
        ctx,
        [...path, index, "until_distance_m"],
        "Distance bands cannot continue after an open-ended band",
      );
    }

    if (band.until_distance_m <= previousThreshold) {
      addBusinessRuleIssue(
        ctx,
        [...path, index, "until_distance_m"],
        "Distance band thresholds must increase monotonically",
      );
    }

    previousThreshold = band.until_distance_m;
  });
}

function validateTimeComponentBusinessRules(
  timeComponent: ContinuousTimeComponentCandidate | undefined,
  ctx: z.RefinementCtx,
  path: Array<string | number>,
) {
  if (!timeComponent) {
    return;
  }

  const trigger = timeComponent.trigger;
  const hasTimeRate = timeComponent.rate_per_time_minor !== undefined;
  const hasTimeUnit = timeComponent.time_unit_s !== undefined;
  const hasAutomaticWaitingFields =
    timeComponent.gps_quality_policy !== undefined ||
    timeComponent.grace_period_s !== undefined ||
    timeComponent.smoothing_window_s !== undefined;

  if (trigger === "none") {
    if (hasTimeRate || hasTimeUnit || hasAutomaticWaitingFields) {
      addBusinessRuleIssue(
        ctx,
        path,
        "A disabled time component cannot include billing or GPS waiting fields",
      );
    }
    return;
  }

  if (!hasTimeRate || !hasTimeUnit) {
    addBusinessRuleIssue(
      ctx,
      path,
      "A chargeable time component must include both rate_per_time_minor and time_unit_s",
    );
  }

  if (trigger === "below_speed_threshold") {
    if (
      timeComponent.threshold_speed_kph === undefined ||
      timeComponent.threshold_speed_kph <= 0
    ) {
      addBusinessRuleIssue(
        ctx,
        [...path, "threshold_speed_kph"],
        "Below-speed waiting requires a positive threshold_speed_kph",
      );
    }
  } else if (timeComponent.threshold_speed_kph !== undefined) {
    addBusinessRuleIssue(
      ctx,
      [...path, "threshold_speed_kph"],
      "threshold_speed_kph is only valid for below_speed_threshold waiting",
    );
  }

  if (trigger === "stopped" || trigger === "below_speed_threshold") {
    if (!timeComponent.gps_quality_policy) {
      addBusinessRuleIssue(
        ctx,
        [...path, "gps_quality_policy"],
        "Automatic waiting requires an explicit GPS quality policy",
      );
    }
  } else if (hasAutomaticWaitingFields) {
    addBusinessRuleIssue(
      ctx,
      path,
      "GPS waiting fields are only valid for automatic waiting triggers",
    );
  }
}

function validateTariffBusinessRules(
  tariff: FareModelTariffCandidate,
  ctx: z.RefinementCtx,
  path: Array<string | number>,
) {
  validateScheduleBusinessRules(tariff.schedule, ctx, [...path, "schedule"]);

  const activation = tariff.activation_conditions;
  if (
    activation?.pickup_location_tags &&
    hasDuplicateValues(activation.pickup_location_tags)
  ) {
    addBusinessRuleIssue(
      ctx,
      [...path, "activation_conditions", "pickup_location_tags"],
      "Pickup location tags must be unique",
    );
  }

  if (tariff.meter_logic.mode === "continuous_components") {
    validateDistanceBandThresholds(tariff.meter_logic.distance_bands, ctx, [
      ...path,
      "meter_logic",
      "distance_bands",
    ]);
    validateTimeComponentBusinessRules(tariff.meter_logic.time_component, ctx, [
      ...path,
      "meter_logic",
      "time_component",
    ]);
    validateTimeComponentBusinessRules(
      tariff.meter_logic.wait_time_component,
      ctx,
      [...path, "meter_logic", "wait_time_component"],
    );
    if (
      tariff.meter_logic.wait_time_component &&
      tariff.meter_logic.wait_time_component.trigger !== "manual_wait"
    ) {
      addBusinessRuleIssue(
        ctx,
        [...path, "meter_logic", "wait_time_component", "trigger"],
        "wait_time_component must use the manual_wait trigger",
      );
    }
    return;
  }

  validateDistanceBandThresholds(tariff.meter_logic.bands, ctx, [
    ...path,
    "meter_logic",
    "bands",
  ]);
}

function validateTariffScheduleOverlap(
  model: FareModelV1BaseCandidate,
  ctx: z.RefinementCtx,
) {
  model.tariffs.forEach((tariff, tariffIndex) => {
    model.tariffs.slice(0, tariffIndex).forEach((previousTariff) => {
      if (tariffActivationKey(tariff) !== tariffActivationKey(previousTariff)) {
        return;
      }

      if (schedulesOverlap(tariff.schedule, previousTariff.schedule)) {
        addBusinessRuleIssue(
          ctx,
          ["tariffs", tariffIndex, "schedule"],
          `Tariff schedule overlaps tariff ${previousTariff.tariff_id}`,
        );
      }
    });
  });
}

function validateRuleIds(
  model: FareModelV1BaseCandidate,
  ctx: z.RefinementCtx,
) {
  const seenRuleIds = new Map<string, Array<string | number>>();
  const rules = [
    ...model.booking_rules.map((rule, index) => ({
      ruleId: rule.rule_id,
      path: ["booking_rules", index, "rule_id"] as Array<string | number>,
    })),
    ...model.additive_rules.map((rule, index) => ({
      ruleId: rule.rule_id,
      path: ["additive_rules", index, "rule_id"] as Array<string | number>,
    })),
    ...model.passthrough_rules.map((rule, index) => ({
      ruleId: rule.rule_id,
      path: ["passthrough_rules", index, "rule_id"] as Array<string | number>,
    })),
  ];

  rules.forEach((rule) => {
    const previousPath = seenRuleIds.get(rule.ruleId);
    if (previousPath) {
      addBusinessRuleIssue(
        ctx,
        rule.path,
        `Rule id duplicates ${previousPath.join(".")}`,
      );
      return;
    }

    seenRuleIds.set(rule.ruleId, rule.path);
  });
}

function validateAdditiveRules(
  model: FareModelV1BaseCandidate,
  ctx: z.RefinementCtx,
) {
  const hasDistanceSubtotal = model.tariffs.some(
    (tariff) =>
      tariff.meter_logic.mode === "continuous_components" &&
      tariff.meter_logic.distance_bands.length > 0,
  );
  const hasTimeSubtotal = model.tariffs.some(
    (tariff) =>
      tariff.meter_logic.mode === "continuous_components" &&
      ((tariff.meter_logic.time_component?.trigger !== "none" &&
        tariff.meter_logic.time_component?.rate_per_time_minor !== undefined) ||
        (tariff.meter_logic.wait_time_component?.trigger !== "none" &&
          tariff.meter_logic.wait_time_component?.rate_per_time_minor !==
            undefined)),
  );

  model.additive_rules.forEach((rule, index) => {
    validateScheduleBusinessRules(rule.schedule, ctx, [
      "additive_rules",
      index,
      "schedule",
    ]);

    if (rule.service_classes && hasDuplicateValues(rule.service_classes)) {
      addBusinessRuleIssue(
        ctx,
        ["additive_rules", index, "service_classes"],
        "Service classes must be unique",
      );
    }

    if (
      rule.pickup_location_tags &&
      hasDuplicateValues(rule.pickup_location_tags)
    ) {
      addBusinessRuleIssue(
        ctx,
        ["additive_rules", index, "pickup_location_tags"],
        "Pickup location tags must be unique",
      );
    }

    if (rule.amount.kind !== "percentage") {
      return;
    }

    if (rule.amount.base === "distance_subtotal" && !hasDistanceSubtotal) {
      addBusinessRuleIssue(
        ctx,
        ["additive_rules", index, "amount", "base"],
        "distance_subtotal surcharges require a distance-priced tariff",
      );
    }

    if (rule.amount.base === "time_subtotal" && !hasTimeSubtotal) {
      addBusinessRuleIssue(
        ctx,
        ["additive_rules", index, "amount", "base"],
        "time_subtotal surcharges require a time-priced tariff",
      );
    }
  });
}

function validateCapabilities(
  model: FareModelV1BaseCandidate,
  ctx: z.RefinementCtx,
) {
  const capabilities = model.capabilities;
  if (!capabilities) {
    return;
  }

  if (
    capabilities.support_level === "unsupported" &&
    !capabilities.unsupported_reason
  ) {
    addBusinessRuleIssue(
      ctx,
      ["capabilities", "unsupported_reason"],
      "Unsupported fare models require an unsupported_reason",
    );
  }

  const requiredCapabilities = new Set(
    capabilities.required_client_capabilities,
  );
  const requiresPricingCapabilities =
    capabilities.support_level === "estimate_capable" ||
    capabilities.support_level === "live_meter_capable";

  if (
    capabilities.support_level === "live_meter_capable" &&
    !requiredCapabilities.has("mobile_live_meter_v1")
  ) {
    addBusinessRuleIssue(
      ctx,
      ["capabilities", "required_client_capabilities"],
      "Live-meter capable models must require mobile_live_meter_v1",
    );
  }

  if (
    requiresPricingCapabilities &&
    model.tariffs.some(
      (tariff) => tariff.meter_logic.mode === "continuous_components",
    ) &&
    !requiredCapabilities.has("continuous_components_v1")
  ) {
    addBusinessRuleIssue(
      ctx,
      ["capabilities", "required_client_capabilities"],
      "Continuous-component models must require continuous_components_v1",
    );
  }

  if (
    requiresPricingCapabilities &&
    model.tariffs.some(
      (tariff) => tariff.meter_logic.mode === "pulse_whichever_first",
    ) &&
    !requiredCapabilities.has("pulse_whichever_first_v1")
  ) {
    addBusinessRuleIssue(
      ctx,
      ["capabilities", "required_client_capabilities"],
      "Pulse-whichever-first models must require pulse_whichever_first_v1",
    );
  }

  if (
    requiresPricingCapabilities &&
    model.tariffs.some((tariff) => tariff.schedule !== undefined) &&
    !requiredCapabilities.has("schedule_segmentation_v1")
  ) {
    addBusinessRuleIssue(
      ctx,
      ["capabilities", "required_client_capabilities"],
      "Scheduled tariff models must require schedule_segmentation_v1",
    );
  }

  if (
    requiresPricingCapabilities &&
    model.tariffs.some((tariff) => {
      const timeComponent =
        tariff.meter_logic.mode === "continuous_components"
          ? tariff.meter_logic.time_component
          : undefined;
      return (
        timeComponent?.trigger === "stopped" ||
        timeComponent?.trigger === "below_speed_threshold"
      );
    }) &&
    !requiredCapabilities.has("automatic_waiting_v1")
  ) {
    addBusinessRuleIssue(
      ctx,
      ["capabilities", "required_client_capabilities"],
      "Automatic waiting models must require automatic_waiting_v1",
    );
  }

  if (
    requiresPricingCapabilities &&
    model.tariffs.some(
      (tariff) =>
        tariff.meter_logic.mode === "continuous_components" &&
        tariff.meter_logic.distance_rounding_m !== undefined,
    ) &&
    !requiredCapabilities.has("distance_rounding_v1")
  ) {
    addBusinessRuleIssue(
      ctx,
      ["capabilities", "required_client_capabilities"],
      "Distance-rounded models must require distance_rounding_v1",
    );
  }

  if (
    requiresPricingCapabilities &&
    model.tariffs.some(
      (tariff) =>
        tariff.meter_logic.mode === "continuous_components" &&
        (tariff.meter_logic.wait_time_component !== undefined ||
          tariff.meter_logic.time_component?.exclude_manual_wait === true),
    ) &&
    !requiredCapabilities.has("dual_time_components_v1")
  ) {
    addBusinessRuleIssue(
      ctx,
      ["capabilities", "required_client_capabilities"],
      "Models with a wait component must require dual_time_components_v1",
    );
  }

  if (
    requiresPricingCapabilities &&
    model.calculation_profile === "legacy_scalar_parity_v1" &&
    !requiredCapabilities.has("legacy_scalar_combined_rounding_v1")
  ) {
    addBusinessRuleIssue(
      ctx,
      ["capabilities", "required_client_capabilities"],
      "Legacy scalar parity models require legacy_scalar_combined_rounding_v1",
    );
  }

  if (
    requiresPricingCapabilities &&
    model.passthrough_rules.some(
      (rule) =>
        rule.default_amount_minor !== undefined ||
        rule.application !== undefined,
    ) &&
    !requiredCapabilities.has("fare_fee_semantics_v1")
  ) {
    addBusinessRuleIssue(
      ctx,
      ["capabilities", "required_client_capabilities"],
      "Fare-fee metadata requires fare_fee_semantics_v1",
    );
  }
}

function validateFareModelV1BusinessRules(
  model: FareModelV1BaseCandidate,
  ctx: z.RefinementCtx,
) {
  if (!isValidTimezone(model.timezone)) {
    addBusinessRuleIssue(ctx, ["timezone"], "Timezone must be a valid IANA ID");
  }

  model.tariffs.forEach((tariff, index) => {
    validateTariffBusinessRules(tariff, ctx, ["tariffs", index]);
  });

  model.booking_rules.forEach((rule, index) => {
    validateScheduleBusinessRules(rule.schedule, ctx, [
      "booking_rules",
      index,
      "schedule",
    ]);
  });

  validateTariffScheduleOverlap(model, ctx);
  validateRuleIds(model, ctx);
  validateAdditiveRules(model, ctx);
  validateCapabilities(model, ctx);
}

export const fareModelV1Schema = fareModelV1BaseSchema.superRefine(
  validateFareModelV1BusinessRules,
);

/** Public pricing retains semantic rule identifiers, but excludes source provenance. */
export const publicFareModelV1Schema = fareModelV1BaseSchema
  .omit({ source_provenance: true })
  .superRefine(validateFareModelV1BusinessRules);

export const fareModelSchema = z.discriminatedUnion("schema_version", [
  fareModelV1Schema,
]);

export const fareModelApiShapeSchema = z
  .object({
    fare_model_version: z.literal(1),
    fare_model: fareModelV1Schema,
    fare_model_support_level: fareModelSupportLevelSchema,
    fare_model_capabilities: fareModelCapabilitiesSchema,
    engine_version: z.string().min(1).max(80),
    source_semantics: fareModelSourceSemanticsSchema,
    source_revision_id: z.string().uuid().nullable().optional(),
  })
  .strict();

export type FareModelSourceSemantics = z.infer<
  typeof fareModelSourceSemanticsSchema
>;
export type FareModelSupportLevel = z.infer<typeof fareModelSupportLevelSchema>;
export type FareModelClientCapability = z.infer<
  typeof fareModelClientCapabilitySchema
>;
export type FareModelSourceProvenance = z.infer<
  typeof fareModelSourceProvenanceSchema
>;
export type FareModelCalculationProfile = z.infer<
  typeof fareModelCalculationProfileSchema
>;
export type FareModelEntitlementRequirement = z.infer<
  typeof fareModelEntitlementRequirementSchema
>;
export type FareModelEntitlementRequirements = z.infer<
  typeof fareModelEntitlementRequirementsSchema
>;
export type FareModelCapabilities = z.infer<typeof fareModelCapabilitiesSchema>;
export type FareModelV1 = z.infer<typeof fareModelV1Schema>;
export type FareModel = z.infer<typeof fareModelSchema>;
export type FareModelApiShape = z.infer<typeof fareModelApiShapeSchema>;
