import { customError } from '../middlewares/errorMiddleware.js';

/**
 * Catalogue of stable error identifiers sent to the client alongside the
 * English message. The client maps them to translated text; the backend never
 * translates anything itself.
 *
 * Every code here must have a matching key in
 * `Frontend/src/i18n/locales/en/errors.json` — `__tests__/errors/errorCodes.test.ts`
 * enforces that, since the two trees have no shared package.
 *
 * Keys are grouped by domain, and named after the *condition*, not the current
 * wording, so rephrasing the English message never renames a code.
 */
export const ERROR_CODES = [
  // Cross-cutting
  'common.resourceNotFound',
  'common.validationError',
  'common.routeNotFound',
  'common.internal',

  // Authentication and session
  'auth.tokenExpired',
  'auth.invalidToken',
  'auth.tokenNotActive',
  'auth.notAuthenticated',
  'auth.invalidCredentials',
  'auth.userExists',
  'auth.passwordMismatch',
  'auth.invalidUserData',
  'auth.banned',
  'auth.forbidden',
  'auth.emailNotVerified',
  'auth.invalidVerificationToken',
  'auth.invalidResetToken',
  'auth.emailRequired',
  'auth.resendCooldown',
  'auth.noToken',
  'auth.failed',
  'auth.credentialsRequired',
  'auth.tokenRequired',
  'auth.emailAlreadyVerified',
  'auth.noEmailSet',
  'auth.passwordConfirmationRequired',

  // API keys
  'apiKey.invalid',
  'apiKey.expired',

  // User account and profile
  'user.notFound',
  'user.usernameTaken',
  'user.usernameInvalid',
  'user.emailTaken',
  'user.incorrectPassword',
  'user.passwordRequired',
  'user.passwordMismatch',
  'user.passwordTooShort',
  'user.invalidTimezone',
  'user.invalidLanguage',
  'user.aboutTooLong',
  'user.invalidDiscordId',
  'user.invalidAvatar',
  'user.invalidBanner',

  'user.usernameLength',
  'user.oldPasswordRequired',
  'user.newPasswordRequired',
  'user.passwordConfirmRequired',
  'user.discordIdLinked',
  'user.emailInvalid',
  'user.usernameConfirmMismatch',

  // Avatar / banner uploads
  'upload.cropWithoutFile',
  'upload.avatarCropWithoutFile',
  'upload.bannerCropWithoutFile',
  'upload.gifAvatarTierRequired',
  'upload.avatarCropGifOnly',
  'upload.gifBannerTierRequired',
  'upload.bannerCropGifOnly',
  'upload.invalidFieldName',

  // Media and immersion list
  'media.notFound',
  'immersionList.mediaNotFound',
  'immersionList.mediaIdAndTypeRequired',
  'immersionList.mediaIdRequired',
  'immersionList.invalidMediaType',
  'immersionList.invalidStatus',
  'immersionList.invalidSource',
  'immersionList.noteMustBeString',

  // Favorites
  'favorites.mustBeArray',
  'favorites.itemMustBeObject',
  'favorites.mediaIdRequired',
  'favorites.invalidMediaType',
  'favorites.invalidAction',
  'favorites.tooMany',
  'favorites.noteTooLong',

  // Saved stats / profile layouts
  'layout.mustBeArrayOfGroups',
  'layout.mustBeArrayOfWidgets',
  'layout.groupMustBeObject',
  'layout.groupNeedsCards',
  'layout.groupNeedsVisible',
  'layout.invalidGroupId',
  'layout.cardMustBeObject',
  'layout.cardNeedsVisible',
  'layout.invalidCardId',
  'layout.widgetMustBeObject',
  'layout.widgetNeedsVisible',
  'layout.invalidWidgetId',
  'layout.duplicateWidgetId',

  // Logs, goals and text sessions
  'log.descriptionRequired',
  'log.idsRequired',
  'log.atLeastOneId',
  'log.createFailed',
  'log.saveFailed',
  'log.notFound',
  'log.notFoundPlural',
  'log.notFoundOrForbidden',
  'log.typeRequired',
  'log.noneFound',
  'log.noneFoundOrForbidden',
  'log.manabeNotConfigured',
  'log.rangeMinAboveMax',
  'user.usernameRequired',
  'user.updateFailed',
  'goal.notFound',
  'goal.invalidType',
  'goal.invalidTimeframe',
  'goal.targetPositive',
  'goal.totalTargetPositive',
  'goal.typeAndTargetRequired',
  'goal.longTermFieldsRequired',
  'goal.startBeforeTarget',
  'goal.targetInFuture',
  'goal.alreadyActive',
  'textSession.notFound',
  'textSession.nameRequired',
  'textSession.nameTooLong',
  'textSession.invalidIsShared',
  'textSession.invalidLineIds',
  'textSession.invalidLines',
  'textSession.invalidHistoryMetrics',
  'textSession.invalidTimerSeconds',

  // Achievement
  'achievement.notFound',
  'achievement.invalidId',
  'achievement.keyExists',
  'achievement.fieldsRequired',
  'achievement.showcaseMax',
  'achievement.showcaseNotArray',
  'achievement.showcaseInvalidIds',
  'achievement.showcaseDuplicates',
  'achievement.unlockFieldsRequired',

  // Admin
  'admin.invalidMediaId',
  'admin.mediaNotFound',
  'admin.nativeTitleRequired',
  'admin.passwordTooShort',
  'admin.fieldMustBeNumber',

  // Tag
  'tag.notFound',
  'tag.invalidId',
  'tag.nameExists',
  'tag.fieldsRequired',

  // Patreon
  'patreon.badgeTextTooLong',
  'patreon.oauthNotConfigured',
  'patreon.notConfigured',

  // MediaRequest
  'mediaRequest.notFound',
  'mediaRequest.invalidId',
  'mediaRequest.nativeTitleRequired',
  'mediaRequest.invalidType',
  'mediaRequest.invalidAction',

  // Changelog
  'changelog.notFound',

  // E4 follow-ups
  'achievement.notEarned',
  'admin.moderationFieldRequired',
  'tag.limitReached',
  'tag.limitReachedTier',
  'patreon.useOauthFlow',
  'patreon.badgeTextTierRequired',
  'patreon.badgeTextNotAllowed',
  'patreon.badgeColorTierRequired',
  'patreon.invalidBadgeColor',
  'patreon.invalidBadgeTextColor',
  'mediaRequest.tooManyPending',
  'mediaRequest.alreadyReviewed',
  'changelog.fieldsRequired',
  'changelog.invalidChangeType',
  'changelog.versionExists',

  // E5: uploads, imports, integrations, api keys
  'upload.noFile',
  'upload.storageFailed',
  'upload.gifCropFailed',
  'upload.fieldNotJsonString',
  'upload.fieldInvalidJson',
  'upload.fieldNotFinite',
  'upload.fieldNegative',
  'import.noFile',
  'import.fileTooLarge',
  'import.invalidType',
  'import.emptyCsv',
  'import.emptyTsv',
  'import.emptyJsonl',
  'import.unsupportedCsvType',
  'integration.apiUrlNotSet',
  'integration.discordIdNotSet',
  'integration.meiliHostNotSet',
  'integration.privateKeyNotSet',
  'apiKey.nameRequired',
  'apiKey.nameTooLong',
  'apiKey.notFound',
  'log.notFoundSingle',
  'log.typeNotFound',
  'user.noStats',
  'media.invalidContentType',
  'upload.fieldDimensionsPositive',
  'upload.invalidImageType',
  'upload.fileTooLarge',
  'import.rowMissingFields',
  'import.rowMissingColumns',
  'apiKey.limitReached',
  'integration.meiliKeyNotSet',
  'upload.failed',
  'upload.sourceDimensionPositive',
  'upload.gifOnlyMetadata',
  'upload.gifDimensionsUnknown',
  'upload.cropOutOfBounds',
  'search.failed',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const ERROR_CODE_SET: ReadonlySet<string> = new Set(ERROR_CODES);

export function isErrorCode(value: string): value is ErrorCode {
  return ERROR_CODE_SET.has(value);
}

/**
 * Preferred way to raise a client-facing error.
 *
 * `message` stays in English in the source: it documents the condition, shows
 * up readable in logs, and is what the client falls back to when it does not
 * know the code.
 */
export function apiError(
  code: ErrorCode,
  statusCode: number,
  message: string,
  params?: Record<string, string | number>
): customError {
  return new customError(message, statusCode, undefined, { code, params });
}
