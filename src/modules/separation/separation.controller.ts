import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { createSuccess } from "../../app/middlewear/errorMessage";
import { handleServiceError } from "../shared/handleServiceError";
import * as SeparationService from "./separation.service";

// companyId/role come only from req.userData, which tokenCheck resolved
// server-side — never from the request body.
const actorOf = (req: Request): SeparationService.SeparationActor => {
  const userData = req.userData as JwtPayload;
  return {
    userId: Number(userData?.userId),
    role: String(userData?.role || ""),
    companyId: (userData as any)?.companyId ? Number((userData as any).companyId) : null,
  };
};

const handle =
  (message: string | ((result: any) => string), run: (req: Request) => Promise<any>, code = 200) =>
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await run(req);
      createSuccess(res, typeof message === "function" ? message(result) : message, result, code);
    } catch (error) {
      handleServiceError(res, error);
    }
  };

export const getMy = handle("Separation details fetched successfully", (req) => SeparationService.getMySeparation(actorOf(req)));
export const submit = handle("Separation request submitted successfully", (req) => SeparationService.submitSeparation(actorOf(req), req.body), 201);
export const withdrawOwn = handle("Separation request withdrawn", (req) => SeparationService.withdrawOwn(actorOf(req), req.params.id, req.body));

export const getPolicy = handle("Separation policy fetched successfully", (req) => SeparationService.getPolicy(actorOf(req)));
export const updatePolicy = handle("Separation policy saved", (req) => SeparationService.updatePolicy(actorOf(req), req.body));

export const list = handle("Separation requests fetched successfully", (req) => SeparationService.listRequests(actorOf(req), req.query));
export const getOne = handle("Separation request fetched successfully", (req) => SeparationService.getRequest(actorOf(req), req.params.id));
export const managerReview = handle(
  (r) => (r.status === "rejected" ? "Separation request rejected" : "Separation request approved and sent to the admin"),
  (req) => SeparationService.managerReview(actorOf(req), req.params.id, req.body)
);
export const adminReview = handle(
  (r) => (r.status === "rejected" ? "Separation request rejected" : "Separation request approved"),
  (req) => SeparationService.adminReview(actorOf(req), req.params.id, req.body)
);
export const adjustLastWorkingDay = handle("Last working day updated", (req) => SeparationService.adjustLastWorkingDay(actorOf(req), req.params.id, req.body));
export const adminWithdraw = handle("Separation request withdrawn", (req) => SeparationService.adminWithdraw(actorOf(req), req.params.id, req.body));

export const getHandover = handle("Handover details fetched successfully", (req) => SeparationService.getHandover(actorOf(req), req.params.id));
export const reassignTasks = handle((r) => `${r.reassigned} task(s) reassigned to ${r.to?.name}`, (req) => SeparationService.reassignTasks(actorOf(req), req.params.id, req.body));
export const startHandover = handle("Handover started", (req) => SeparationService.startHandover(actorOf(req), req.params.id));
export const updateHandover = handle("Handover updated", (req) => SeparationService.updateHandover(actorOf(req), req.params.id, req.body));
export const updateClearance = handle("Clearance updated", (req) => SeparationService.updateClearance(actorOf(req), req.params.id, req.body));
export const complete = handle("Separation completed and login deactivated", (req) => SeparationService.completeSeparation(actorOf(req), req.params.id, req.body));
