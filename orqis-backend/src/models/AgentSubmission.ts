import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const agentSubmissionSchema = new Schema(
  {
    contactEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    contactName: { type: String, default: "" },
    agentName: { type: String, required: true },
    description: { type: String, required: true },
    endpointUrl: { type: String, default: "" },
    pricingIdea: { type: String, default: "" },
    links: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    status: {
      type: String,
      enum: ["new", "reviewing", "approved", "rejected"],
      default: "new",
      index: true,
    },
  },
  { timestamps: true }
);

export type AgentSubmissionDoc = InferSchemaType<typeof agentSubmissionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AgentSubmissionModel: Model<AgentSubmissionDoc> =
  (mongoose.models.AgentSubmission as Model<AgentSubmissionDoc>) ??
  mongoose.model<AgentSubmissionDoc>("AgentSubmission", agentSubmissionSchema);
