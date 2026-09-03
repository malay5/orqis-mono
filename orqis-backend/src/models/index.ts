/**
 * Sprint 19 — the platform data layer moved here.
 *
 * These schemas were previously owned by orqis-frontend (`src/lib/models/`),
 * where Next.js route handlers talked to MongoDB directly. The frontend is now
 * a pure client of this API and holds no database connection at all, so these
 * are the single definition — not a mirror.
 *
 * Mongoose model registration is process-global (`mongoose.models.X ?? …`), so
 * importing a model twice is safe, but changing a schema requires a server
 * restart: a hot reload re-evaluates the module while the old compiled model
 * stays cached, and new paths get silently stripped on write.
 */
export { AgentModel, type AgentDoc } from "./Agent.js";
export { AgentSubmissionModel, type AgentSubmissionDoc } from "./AgentSubmission.js";
export { ApiKeyModel, type ApiKeyDoc } from "./ApiKey.js";
export { CreditRequestModel, type CreditRequestDoc } from "./CreditRequest.js";
export { CreditTransactionModel, type CreditTransactionDoc } from "./CreditTransaction.js";
export { InvocationModel, type InvocationDoc } from "./Invocation.js";
export { ReviewModel, type ReviewDoc } from "./Review.js";
export { UserModel, type UserDoc } from "./User.js";
