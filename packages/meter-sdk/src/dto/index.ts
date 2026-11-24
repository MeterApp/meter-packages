import {
  reconciliationPoliciesSchema,
  reconciliationStatementsSchema,
  reconciliationWriteSchema,
} from "./reconciliation.ts";
export * from "./reconciliation.ts";
import {
  tripInvoicePageSchema,
  tripInvoiceDetailSchema,
  tripInvoiceCreatedSchema,
  tripInvoiceCreatedWriteSchema,
  tripInvoiceVoidedSchema,
  tripInvoiceVoidedWriteSchema,
} from "./trip-invoice.ts";
import {
  bookingCancellationSchema,
  bookingCancellationWriteSchema,
  bookingPaymentReminderSchema,
  bookingPaymentReminderWriteSchema,
} from "./booking-action.ts";
export * from "./booking-action.ts";
import {
  placeSearchSchema,
  rideEstimateSchema,
  rideRequestSchema,
  quoteRequestWriteSchema,
  rideRequestWriteSchema,
  rideStatusSchema,
  riderFleetPageSchema,
} from "./rider-ride.ts";
export * from "./rider-ride.ts";
import {
  quoteResponseWriteSchema,
  ratingPromptSchema,
  rideChangeWriteSchema,
  rideDetailsWriteSchema,
  rideIssueReportWriteSchema,
  rideRatingWriteSchema,
} from "./rider-booking.ts";
export * from "./rider-booking.ts";
import { bookingQuoteEstimateSchema } from "./booking-estimate.ts";
import { bookingCalendarSchema } from "./booking-calendar.ts";
import {
  bookingChangeSchema,
  bookingChangeWriteSchema,
} from "./booking-change.ts";
export * from "./booking-change.ts";
import {
  bookingLifecycleSchema,
  bookingLifecycleWriteSchema,
  dispatchOfferSchema,
  dispatchOffersSchema,
  dispatchOfferWriteSchema,
} from "./booking-lifecycle.ts";
export * from "./booking-lifecycle.ts";
import {
  customerSchema,
  customerPageSchema,
  customerDetailSchema,
} from "./customer.ts";
export * from "./customer.ts";
import {
  customerImportSchema,
  customerImportWriteSchema,
  customerWriteSchema,
} from "./customer-writes.ts";
export * from "./customer-writes.ts";
import {
  operatorBookingSchema,
  operatorBookingWriteSchema,
  quoteBookingConversionSchema,
  quoteBookingConversionWriteSchema,
} from "./operator-booking.ts";
export * from "./operator-booking.ts";
import {
  tripVoidRequestSchema,
  tripVoidRequestWriteSchema,
  tripNoteSchema,
  tripNoteWriteSchema,
} from "./trip-void.ts";
export * from "./trip-void.ts";
export * from "./fleet-finances.ts";
import {
  fleetFeeSettingsSchema,
  fleetFinanceSettingsSchema,
  fleetFeeSettingsWriteSchema,
  fleetFinanceSettingsWriteSchema,
} from "./fleet-finances.ts";
import { tripAdjustmentWriteSchema } from "./trip-adjustments.ts";
export * from "./trip-adjustments.ts";
export * from "./fleet-pricing.ts";
export * from "./ride-option-classes.ts";
export * from "./service-zones.ts";
export * from "./pricing-management.ts";
import {
  dynamicPricingSchema,
  dynamicPricingWriteSchema,
  knownLocationListSchema,
  knownLocationSchema,
  knownLocationWriteSchema,
  officialRateImportWriteSchema,
  officialRateListSchema,
  promoCodeEmailWriteSchema,
  promoCodeListSchema,
  promoCodeSchema,
  promoCodeWriteSchema,
  serviceZoneListSchema,
  zoneFaresWriteSchema,
} from "./pricing-management.ts";
export * from "./fleet-setup.ts";
export * from "./fleet-members.ts";
import {
  fleetJoinLinkSchema,
  fleetJoinLinkWriteSchema,
  fleetMemberNameWriteSchema,
  fleetMemberRemovalSchema,
  fleetMemberRemovalWriteSchema,
  memberDocumentsPageSchema,
  memberDocumentsSchema,
  memberDocumentsWriteSchema,
  memberOnlineRequestSchema,
  memberOnlineRequestWriteSchema,
  membershipEventPageSchema,
  membershipEventSchema,
  vehicleRemovalWriteSchema,
  vehicleUpdateWriteSchema,
} from "./fleet-members.ts";
import {
  fleetIconCandidatesSchema,
  fleetMemberSettingsSchema,
  fleetMemberSettingsWriteSchema,
  fleetMemberWriteSchema,
  vehicleWriteSchema,
} from "./fleet-setup.ts";
import {
  rideOptionStateSchema,
  rideOptionStateWriteSchema,
  zoneFareReferenceSchema,
  zoneFarePageSchema,
  zoneFareWriteSchema,
} from "./fleet-pricing.ts";
import {
  serviceZoneSchema,
  serviceZoneWriteSchema,
  zoneBoundarySchema,
} from "./service-zones.ts";
import { fareWriteSchema } from "./fare-write.ts";
export * from "./fare-write.ts";
import {
  fareReadSchema,
  fareReadPageSchema,
  fareAuditPageSchema,
} from "./fare-read.ts";
export * from "./fare-read.ts";
import {
  FeedbackCategoriesSchema,
  FeedbackVoteSchema,
  FeedbackFollowSchema,
  FeedbackSubmissionWriteSchema,
  FeedbackVoteWriteSchema,
  FeedbackFollowWriteSchema,
  FeedbackCommentWriteSchema,
  FeedbackItemPageSchema,
  FeedbackSimilarIdeasSchema,
  FeedbackDetailSchema,
  FeedbackChangelogEntrySchema,
  FeedbackChangelogPageSchema,
} from "./feedback.ts";
export * from "./feedback.ts";
import {
  FeedbackItemSchema,
  FeedbackCommentSchema,
  FeedbackStatusEventSchema,
  FeedbackAvailabilitySchema,
  FeedbackAttachmentSchema,
} from "./feedback.ts";
export * from "./booking-blocks.ts";
import {
  bookingBlockSchema,
  bookingBlockListSchema,
  bookingBlockWriteSchema,
} from "./booking-blocks.ts";
export * from "./personal-settings.ts";
import {
  driverSiteReadSchema,
  driverSiteSettingsSchema,
  driverSiteSettingsWriteSchema,
  personalBookingSettingsSchema,
  personalBookingSettingsWriteSchema,
  notificationPreferenceSchema,
  notificationPreferencesSchema,
  notificationPreferenceWriteSchema,
} from "./personal-settings.ts";
export * from "./storefront.ts";
import {
  fleetSiteDomainSchema,
  fleetSiteDomainWriteSchema,
  googleMapsLinkSchema,
  googleMapsLinkWriteSchema,
  googlePlaceSearchSchema,
  storefrontSettingsSchema,
  storefrontSettingsWriteSchema,
} from "./storefront.ts";
export * from "./insights.ts";
import {
  driverPerformanceSchema,
  marketingOverviewSchema,
  seoOverviewSchema,
} from "./insights.ts";
export * from "./fleet-features.ts";
import {
  notificationWebhookSchema,
  notificationWebhookWriteSchema,
  notificationWebhooksSchema,
  privacySettingsSchema,
  privacySettingsWriteSchema,
  voiceAgentSettingsSchema,
  voiceAgentSettingsWriteSchema,
} from "./fleet-features.ts";
export * from "./website-pages.ts";
import {
  websitePageSchema,
  websitePageSummarySchema,
  websitePagesSchema,
  websitePageWriteSchema,
} from "./website-pages.ts";
export * from "./quote.ts";
import {
  quoteActionResultSchema,
  quoteActionWriteSchema,
  quotePageSchema,
  quoteDetailSchema,
  quoteSummarySchema,
  quoteWriteSchema,
} from "./quote.ts";
export * from "./meter-pay.ts";
import { meterPayStatusSchema } from "./meter-pay.ts";
export * from "./billing.ts";
import { planCatalogSchema, subscriptionOverviewSchema } from "./billing.ts";
export * from "./handoff.ts";
import { actionLinkSchema } from "./handoff.ts";
export * from "./changes.ts";
import { changeRequestSchema, changeRequestPageSchema } from "./changes.ts";
export * from "./metrics.ts";
export * from "./reviews.ts";
import { metricRegistrySchema, metricQueryResultSchema } from "./metrics.ts";
import { reviewsPageSchema } from "./reviews.ts";
export * from "./common.ts";
export * from "./profile.ts";
export * from "./fleet.ts";
export * from "./member.ts";
export * from "./vehicle.ts";
export * from "./trip.ts";
export * from "./booking.ts";
export * from "./earnings.ts";
export * from "./accounting.ts";
export * from "./settings.ts";

import { accountingSummarySchema } from "./accounting.ts";
export * from "./accounting-records.ts";
import {
  ledgerEntryPageSchema,
  driverBalancePageSchema,
  settlementPageSchema,
  accountingExceptionPageSchema,
  driverAccountingSchema,
  dataExportSchema,
} from "./accounting-records.ts";
import {
  bookingAuditLogSchema,
  bookingPageSchema,
  bookingSchema,
} from "./booking.ts";
import { earningsSummarySchema } from "./earnings.ts";
import { fleetDetailSchema, fleetSummarySchema } from "./fleet.ts";
import { fleetMemberSchema } from "./member.ts";
import {
  bookingSettingsSchema,
  bookingSettingsWriteSchema,
  driverAvailabilitySchema,
  driverAvailabilityWriteSchema,
  fleetSettingsSchema,
  fleetSettingsWriteSchema,
  myProfileSchema,
  myProfileWriteSchema,
  onboardingChecklistSchema,
  rideOptionDetailSchema,
  rideOptionWriteSchema,
  vehicleAssignmentWriteSchema,
} from "./settings.ts";
import { whoamiSchema } from "./profile.ts";
import { tripPageSchema, tripSchema } from "./trip.ts";
import { vehicleSchema } from "./vehicle.ts";

/**
 * Every public DTO by name. `describe_api` / `explain_data` and the
 * leak tests iterate this map, so a new DTO must be registered here.
 */
export const DTO_SCHEMAS = {
  ReconciliationPolicies: reconciliationPoliciesSchema,
  ReconciliationStatements: reconciliationStatementsSchema,
  ReconciliationWrite: reconciliationWriteSchema,
  MetricRegistry: metricRegistrySchema,
  MetricQueryResult: metricQueryResultSchema,
  ReviewsPage: reviewsPageSchema,
  TripInvoicePage: tripInvoicePageSchema,
  TripInvoiceDetail: tripInvoiceDetailSchema,
  TripInvoiceCreated: tripInvoiceCreatedSchema,
  TripInvoiceCreatedWrite: tripInvoiceCreatedWriteSchema,
  TripInvoiceVoided: tripInvoiceVoidedSchema,
  TripInvoiceVoidedWrite: tripInvoiceVoidedWriteSchema,
  BookingQuoteEstimate: bookingQuoteEstimateSchema,
  BookingCalendar: bookingCalendarSchema,
  FleetFeeSettings: fleetFeeSettingsSchema,
  FleetFinanceSettings: fleetFinanceSettingsSchema,
  FleetFeeSettingsWrite: fleetFeeSettingsWriteSchema,
  FleetFinanceSettingsWrite: fleetFinanceSettingsWriteSchema,
  RideOptionState: rideOptionStateSchema,
  RideOptionStateWrite: rideOptionStateWriteSchema,
  ZoneFareReference: zoneFareReferenceSchema,
  ZoneFarePage: zoneFarePageSchema,
  ZoneFareWrite: zoneFareWriteSchema,
  ZoneBoundary: zoneBoundarySchema,
  ServiceZone: serviceZoneSchema,
  ServiceZoneWrite: serviceZoneWriteSchema,
  ServiceZoneList: serviceZoneListSchema,
  ZoneFaresWrite: zoneFaresWriteSchema,
  PromoCode: promoCodeSchema,
  PromoCodeList: promoCodeListSchema,
  PromoCodeWrite: promoCodeWriteSchema,
  PromoCodeEmailWrite: promoCodeEmailWriteSchema,
  DynamicPricing: dynamicPricingSchema,
  DynamicPricingWrite: dynamicPricingWriteSchema,
  OfficialRateList: officialRateListSchema,
  OfficialRateImportWrite: officialRateImportWriteSchema,
  KnownLocation: knownLocationSchema,
  KnownLocationList: knownLocationListSchema,
  KnownLocationWrite: knownLocationWriteSchema,
  FleetIconCandidates: fleetIconCandidatesSchema,
  VehicleWrite: vehicleWriteSchema,
  FleetMemberSettings: fleetMemberSettingsSchema,
  FleetMemberSettingsWrite: fleetMemberSettingsWriteSchema,
  FleetMemberWrite: fleetMemberWriteSchema,
  FleetJoinLink: fleetJoinLinkSchema,
  FleetJoinLinkWrite: fleetJoinLinkWriteSchema,
  MembershipEvent: membershipEventSchema,
  MembershipEventPage: membershipEventPageSchema,
  MemberDocuments: memberDocumentsSchema,
  MemberDocumentsPage: memberDocumentsPageSchema,
  MemberDocumentsWrite: memberDocumentsWriteSchema,
  FleetMemberRemoval: fleetMemberRemovalSchema,
  FleetMemberRemovalWrite: fleetMemberRemovalWriteSchema,
  FleetMemberNameWrite: fleetMemberNameWriteSchema,
  MemberOnlineRequest: memberOnlineRequestSchema,
  MemberOnlineRequestWrite: memberOnlineRequestWriteSchema,
  VehicleUpdateWrite: vehicleUpdateWriteSchema,
  VehicleRemovalWrite: vehicleRemovalWriteSchema,
  FareRead: fareReadSchema,
  TripAdjustmentWrite: tripAdjustmentWriteSchema,
  FareWrite: fareWriteSchema,
  FareReadPage: fareReadPageSchema,
  FareAuditPage: fareAuditPageSchema,
  FeedbackVote: FeedbackVoteSchema,
  FeedbackFollow: FeedbackFollowSchema,
  FeedbackSubmissionWrite: FeedbackSubmissionWriteSchema,
  FeedbackVoteWrite: FeedbackVoteWriteSchema,
  FeedbackFollowWrite: FeedbackFollowWriteSchema,
  FeedbackCommentWrite: FeedbackCommentWriteSchema,
  FeedbackCategories: FeedbackCategoriesSchema,
  FeedbackItemPage: FeedbackItemPageSchema,
  FeedbackSimilarIdeas: FeedbackSimilarIdeasSchema,
  FeedbackDetail: FeedbackDetailSchema,
  FeedbackChangelogEntry: FeedbackChangelogEntrySchema,
  FeedbackChangelogPage: FeedbackChangelogPageSchema,

  FeedbackItem: FeedbackItemSchema,
  FeedbackComment: FeedbackCommentSchema,
  FeedbackStatusEvent: FeedbackStatusEventSchema,
  FeedbackAvailability: FeedbackAvailabilitySchema,
  FeedbackAttachment: FeedbackAttachmentSchema,

  BookingBlock: bookingBlockSchema,
  BookingBlockList: bookingBlockListSchema,
  BookingBlockWrite: bookingBlockWriteSchema,
  DriverSite: driverSiteReadSchema,
  DriverSiteSettings: driverSiteSettingsSchema,
  DriverSiteSettingsWrite: driverSiteSettingsWriteSchema,
  PersonalBookingSettings: personalBookingSettingsSchema,
  PersonalBookingSettingsWrite: personalBookingSettingsWriteSchema,
  NotificationPreference: notificationPreferenceSchema,
  NotificationPreferences: notificationPreferencesSchema,
  NotificationPreferenceWrite: notificationPreferenceWriteSchema,
  FleetSiteDomain: fleetSiteDomainSchema,
  FleetSiteDomainWrite: fleetSiteDomainWriteSchema,
  StorefrontSettings: storefrontSettingsSchema,
  StorefrontSettingsWrite: storefrontSettingsWriteSchema,
  GoogleMapsLink: googleMapsLinkSchema,
  GoogleMapsLinkWrite: googleMapsLinkWriteSchema,
  GooglePlaceSearch: googlePlaceSearchSchema,
  SeoOverview: seoOverviewSchema,
  MarketingOverview: marketingOverviewSchema,
  DriverPerformance: driverPerformanceSchema,
  PrivacySettings: privacySettingsSchema,
  PrivacySettingsWrite: privacySettingsWriteSchema,
  VoiceAgentSettings: voiceAgentSettingsSchema,
  VoiceAgentSettingsWrite: voiceAgentSettingsWriteSchema,
  NotificationWebhook: notificationWebhookSchema,
  NotificationWebhookWrite: notificationWebhookWriteSchema,
  NotificationWebhooks: notificationWebhooksSchema,
  WebsitePage: websitePageSchema,
  WebsitePageSummary: websitePageSummarySchema,
  WebsitePages: websitePagesSchema,
  WebsitePageWrite: websitePageWriteSchema,
  QuoteActionResult: quoteActionResultSchema,
  QuoteActionWrite: quoteActionWriteSchema,
  QuoteSummary: quoteSummarySchema,
  QuoteDetail: quoteDetailSchema,
  QuotePage: quotePageSchema,
  QuoteWrite: quoteWriteSchema,
  MeterPayStatus: meterPayStatusSchema,
  SubscriptionOverview: subscriptionOverviewSchema,
  PlanCatalog: planCatalogSchema,
  ActionLink: actionLinkSchema,
  ChangeRequest: changeRequestSchema,
  ChangeRequestPage: changeRequestPageSchema,
  Whoami: whoamiSchema,
  FleetSummary: fleetSummarySchema,
  FleetDetail: fleetDetailSchema,
  FleetMember: fleetMemberSchema,
  Vehicle: vehicleSchema,
  Trip: tripSchema,
  TripPage: tripPageSchema,
  RiderFleetPage: riderFleetPageSchema,
  PlaceSearch: placeSearchSchema,
  RideEstimate: rideEstimateSchema,
  RideRequest: rideRequestSchema,
  QuoteRequestWrite: quoteRequestWriteSchema,
  RideRequestWrite: rideRequestWriteSchema,
  RideStatus: rideStatusSchema,
  RideChangeWrite: rideChangeWriteSchema,
  RideDetailsWrite: rideDetailsWriteSchema,
  QuoteResponseWrite: quoteResponseWriteSchema,
  RideRatingWrite: rideRatingWriteSchema,
  RideIssueReportWrite: rideIssueReportWriteSchema,
  RatingPrompt: ratingPromptSchema,
  BookingCancellation: bookingCancellationSchema,
  BookingCancellationWrite: bookingCancellationWriteSchema,
  BookingPaymentReminder: bookingPaymentReminderSchema,
  BookingPaymentReminderWrite: bookingPaymentReminderWriteSchema,
  BookingChange: bookingChangeSchema,
  BookingChangeWrite: bookingChangeWriteSchema,
  BookingLifecycle: bookingLifecycleSchema,
  BookingLifecycleWrite: bookingLifecycleWriteSchema,
  DispatchOffer: dispatchOfferSchema,
  DispatchOffers: dispatchOffersSchema,
  DispatchOfferWrite: dispatchOfferWriteSchema,
  Customer: customerSchema,
  CustomerPage: customerPageSchema,
  CustomerDetail: customerDetailSchema,
  CustomerWrite: customerWriteSchema,
  CustomerImport: customerImportSchema,
  CustomerImportWrite: customerImportWriteSchema,
  OperatorBooking: operatorBookingSchema,
  OperatorBookingWrite: operatorBookingWriteSchema,
  QuoteBookingConversion: quoteBookingConversionSchema,
  QuoteBookingConversionWrite: quoteBookingConversionWriteSchema,
  TripVoidRequest: tripVoidRequestSchema,
  TripVoidRequestWrite: tripVoidRequestWriteSchema,
  TripNote: tripNoteSchema,
  TripNoteWrite: tripNoteWriteSchema,
  Booking: bookingSchema,
  BookingPage: bookingPageSchema,
  BookingAuditLog: bookingAuditLogSchema,
  EarningsSummary: earningsSummarySchema,
  TaxSummary: taxSummarySchema,
  MileageReport: mileageReportSchema,
  AccountingSummary: accountingSummarySchema,
  LedgerEntryPage: ledgerEntryPageSchema,
  DriverBalancePage: driverBalancePageSchema,
  SettlementPage: settlementPageSchema,
  AccountingExceptionPage: accountingExceptionPageSchema,
  DriverAccounting: driverAccountingSchema,
  DataExport: dataExportSchema,
  FleetSettings: fleetSettingsSchema,
  FleetSettingsWrite: fleetSettingsWriteSchema,
  BookingSettings: bookingSettingsSchema,
  BookingSettingsWrite: bookingSettingsWriteSchema,
  RideOptionDetail: rideOptionDetailSchema,
  RideOptionWrite: rideOptionWriteSchema,
  VehicleAssignmentWrite: vehicleAssignmentWriteSchema,
  MyProfile: myProfileSchema,
  MyProfileWrite: myProfileWriteSchema,
  DriverAvailability: driverAvailabilitySchema,
  DriverAvailabilityWrite: driverAvailabilityWriteSchema,
  OnboardingChecklist: onboardingChecklistSchema,
} as const;

export type DtoName = keyof typeof DTO_SCHEMAS;

export * from "./booking-estimate.ts";

export * from "./booking-calendar.ts";
import { taxSummarySchema, mileageReportSchema } from "./tax-mileage.ts";
export * from "./tax-mileage.ts";

export * from "./trip-invoice.ts";
