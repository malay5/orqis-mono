import { connectMongoose } from "../db/mongoose.js";
import { UserModel } from "../models/User.js";
import {
  AgentSubmissionModel,
  type AgentSubmissionDoc,
} from "../models/AgentSubmission.js";

export type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  role: "buyer" | "seller" | "admin";
  creditBalance: number;
  createdAt: string;
};

export type AdminAgentSubmissionRow = {
  id: string;
  contactEmail: string;
  contactName: string;
  agentName: string;
  description: string;
  endpointUrl: string;
  pricingIdea: string;
  links: string;
  status: AgentSubmissionDoc["status"];
  createdAt: string;
};

export async function listUsers(limit = 100): Promise<AdminUserRow[]> {
  await connectMongoose();
  const docs = await UserModel.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return docs.map((d) => ({
    id: String(d._id),
    email: d.email,
    name: d.name ?? "",
    role: d.role,
    creditBalance: d.creditBalance ?? 0,
    createdAt:
      d.createdAt instanceof Date
        ? d.createdAt.toISOString()
        : new Date(d.createdAt as unknown as string).toISOString(),
  }));
}

export async function listAgentSubmissions(
  status: AgentSubmissionDoc["status"] | "all" = "new"
): Promise<AdminAgentSubmissionRow[]> {
  await connectMongoose();
  const filter = status === "all" ? {} : { status };
  const docs = await AgentSubmissionModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .lean<AgentSubmissionDoc[]>();
  return docs.map((d) => ({
    id: String(d._id),
    contactEmail: d.contactEmail,
    contactName: d.contactName ?? "",
    agentName: d.agentName,
    description: d.description,
    endpointUrl: d.endpointUrl ?? "",
    pricingIdea: d.pricingIdea ?? "",
    links: d.links ?? "",
    status: d.status,
    createdAt:
      d.createdAt instanceof Date
        ? d.createdAt.toISOString()
        : new Date(d.createdAt as unknown as string).toISOString(),
  }));
}
