import { MeetingUser, Meeting, MeetingCompany, User } from "../config/dbConnection";
(async () => {
  const u = await User.findOne({ where: { role: "manager", status: "active" } });
  if (!u) { console.log("no manager"); process.exit(1); }
  const uid = u.get("id") as number;
  console.log("manager id", uid, "companyId?", u.get("lastLoginCompanyId"));

  const mu = await MeetingUser.create({
    name: "Test Client A",
    companyName: "Acme Corp",
    mobile: "9999999999",
    userId: uid,
    customerType: "Business",
    status: "draft",
  } as any);

  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);

  await Meeting.create({
    userId: uid,
    companyId: 0,
    meetingUserId: mu.get("id"),
    meetingPurpose: "demo",
    status: "completed",
    scheduledTime: now,
    meetingTimeIn: now,
    meetingTimeOut: now,
  } as any);

  await Meeting.create({
    userId: uid,
    companyId: 0,
    meetingUserId: mu.get("id"),
    meetingPurpose: "support",
    status: "completed",
    scheduledTime: yesterday,
    meetingTimeIn: yesterday,
    meetingTimeOut: yesterday,
  } as any);

  console.log("seeded meetingUserId", mu.get("id"), "for userId", uid);
  process.exit(0);
})();
