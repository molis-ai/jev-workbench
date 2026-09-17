/** Localized HTTP error summaries. Machine codes and field diagnostics remain stable. */
const messages: Record<string, string> = {
  TRASH_REQUIRED: "Move the function to Trash before permanently deleting it.",
  BAD_REQUEST: "The request is invalid. Check the fields and try again.",
  INPUT_TOO_LARGE: "The request exceeds the 256 KiB limit.",
  INTERNAL_ERROR: "Local processing failed. Check the service status.",
  CONFIG_INVALID:
    "The configuration is invalid. Check the field diagnostics before saving.",
  INPUT_SCHEMA_INVALID: "Input does not match this function’s schema.",
  FUNCTION_NOT_FOUND: "This function does not exist.",
  FUNCTION_BUSY:
    "This function is running. Wait for it to finish before deleting.",
  FUNCTION_DISABLED:
    "This function is disabled, archived or in Trash. Restore it before calling.",
  FUNCTION_FORBIDDEN: "This client is not authorized to call the function.",
  FUNCTION_FORBIDDEN_VERSION: "This client cannot use that version.",
  VERSION_FORBIDDEN: "This client is pinned to a different version.",
  VERSION_NOT_FOUND: "The requested published version does not exist.",
  DRAFT_REVISION_CONFLICT:
    "The draft changed in another session. Copy your edits or reload the server draft.",
  KEY_EXISTS: "A function with this key already exists.",
  PREVIEW_REQUIRED:
    "Run the current configuration successfully with a pinned model before publishing.",
  PROVIDER_NOT_CONFIGURED:
    "Configure your TypeSafe API key in Settings before running inference.",
  UPSTREAM_AUTH_FAILED: "TypeSafe rejected the API key. Update it in Settings.",
  UPSTREAM_BUSY: "The provider is busy. Try again later.",
  UPSTREAM_TIMEOUT: "The request timed out or was cancelled. You can retry.",
  UPSTREAM_UNAVAILABLE:
    "The provider could not be reached. Check the connection and retry.",
  UPSTREAM_INPUT_REJECTED: "The provider rejected the input or configuration.",
  UPSTREAM_INVALID_RESPONSE:
    "The provider returned a response that does not match the contract.",
  UPSTREAM_FAILED: "The provider request failed. Try again later.",
  MODEL_VERSION_MISMATCH:
    "The provider returned a different model version. Check the pinned model.",
  LOCAL_BUSY: "The local execution queue is full. Try again later.",
  INVALID_CLIENT_TOKEN: "The client token is missing, invalid or revoked.",
  CLIENT_NOT_FOUND: "The client does not exist.",
  ADMIN_SESSION_REQUIRED:
    "Open a new management session with the service open command.",
  BOOTSTRAP_EXPIRED:
    "This sign-in link expired or was used. Run the service open command again.",
  CSRF_INVALID:
    "The management session could not be verified. Reopen the workbench.",
  HOST_FORBIDDEN: "Only the configured local address is accepted.",
  ORIGIN_FORBIDDEN: "Requests from external pages are not accepted.",
  FORBIDDEN: "This operation is not authorized.",
  ENVIRONMENT_KEY_ACTIVE:
    "The API key is managed by the startup environment. Update the environment variable instead.",
  CONFIG_CHANGED:
    "The runtime configuration changed. Generate a new preview before applying or removing it.",
  PLAN_NOT_FOUND: "This integration preview expired. Generate a new one.",
  INSTALLATION_NOT_FOUND: "This integration does not exist.",
  CONNECTION_FAILED:
    "Connection verification failed. Check the service and credentials.",
  DEMO_MODE: "This action is not available in offline demo mode.",
  TEST_FAILED: "The saved test did not pass.",
  NOT_FOUND: "The requested resource does not exist.",
};
export function englishError(code: string) {
  return (
    messages[code] ??
    "The operation failed. See the error code and diagnostics."
  );
}
