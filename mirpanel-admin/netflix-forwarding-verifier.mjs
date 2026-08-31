// Fail-closed forwarding evidence validator. Cryptographic DKIM/ARC validation
// must be performed by a trusted mail gateway; this module accepts only its
// normalized, signed result and never trusts raw From/To/body claims.
export function verifyForwardingEvidence(evidence = {}) {
  if (evidence.dkim !== "pass" || evidence.arc !== "pass" || evidence.forwarded !== true || evidence.sourceRecipientVerified !== true) return false;
  if (!Array.isArray(evidence.signedHeaders) || !evidence.signedHeaders.includes("from") || !evidence.signedHeaders.includes("date") || !evidence.signedHeaders.includes("message-id")) return false;
  if (typeof evidence.messageId !== "string" || !evidence.messageId || !Number.isSafeInteger(evidence.originalSentAt)) return false;
  return true;
}
