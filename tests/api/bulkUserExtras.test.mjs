// Bulk employee upload (POST /admin/bulk-add-saleperson) with the optional
// Additional Details columns. QA company only (".test" e-mails).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { BASE, api } from "./helpers.mjs";
import { qaCompany, RUN } from "./fixtures.mjs";

let qa;
let seq = 0;
const email = (tag) => `qa-bulk-${tag}-${RUN}-${seq++}@salesvera.test`;
const phone = () => `9${String(RUN + seq).slice(-9)}`;

/** Uploads a CSV (array of lines) the way the web app does. */
const upload = async (lines) => {
  const fd = new FormData();
  fd.append("csv", new Blob([lines.join("\n")], { type: "text/csv" }), "bulk_employee_test.csv");
  fd.append("role", "employee");
  fd.append("createdBy", String(qa.adminId));
  const res = await fetch(`${BASE}/admin/bulk-add-saleperson`, {
    method: "POST",
    headers: { Authorization: `Bearer ${qa.admin}` },
    body: fd,
  });
  const body = await res.json();
  return { status: res.status, body };
};

const idOf = (body, mail) => body.data.createdSalePersons.find((c) => c.email === mail)?.id;
const extrasOf = async (userId) => {
  const r = await api("GET", `/admin/employees/${userId}/profile`, qa.owner);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  return r.body.data.extraDetails ?? {};
};

before(async () => {
  qa = await qaCompany();
});

test("BULK-01 Old template (no Additional Details columns) works exactly as before", async () => {
  const e = email("legacy");
  const r = await upload(["firstName,lastName,email,phone,dob,dateOfJoining", `QA,Legacy,${e},${phone()},1995-01-10,2025-06-02`]);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
  for (const k of ["totalCSV", "created", "linkedExisting", "skippedInvalid", "skippedDuplicateInCsv", "skippedDuplicate", "skippedRoleMismatch", "skippedLimitReached", "createdSalePersons", "linkedSalePersons"]) {
    assert.ok(k in r.body.data, `response still has ${k}`);
  }
  assert.equal(r.body.data.created, 1);
  const x = await extrasOf(idOf(r.body, e));
  assert.equal(String(x.dateOfJoining).slice(0, 10), "2025-06-02");
  assert.ok(!x.jobTitle, "no extra details invented");
});

test("BULK-02 Additional Details (key-style headers) are saved and normalised", async () => {
  const e = email("keys");
  const header = "firstName,lastName,email,phone,dob,jobTitle,employeeType,gender,maritalStatus,bloodGroup,personalEmail,officialEmail,countryCode,houseNumber,pfAccountNumber,esiAccountNumber,uan,aadhaarNumber,panNumber,guardianName,emergencyContactName,emergencyContactCountryCode,emergencyContactPhone,emergencyContactRelationship";
  const row = `QA,Keys,${e},${phone()},1994-02-02,Sales Executive,full time,female,unmarried,B+,me@salesvera.test,office@salesvera.test,+91,H-12,PF123,ESI456,100200300400,1234 5678 9012,abcde1234f,Ram,Sita,+91,9811111111,Mother`;
  const r = await upload([header, row]);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
  assert.equal(r.body.data.created, 1);
  assert.equal(r.body.data.withAdditionalDetails, 1);
  const x = await extrasOf(idOf(r.body, e));
  assert.equal(x.jobTitle, "Sales Executive");
  assert.equal(x.employeeType, "Full Time");
  assert.equal(x.gender, "Female");
  assert.equal(x.maritalStatus, "Unmarried");
  assert.equal(x.bloodGroup, "B+");
  assert.equal(x.aadhaarNumber, "123456789012");
  assert.equal(x.panNumber, "ABCDE1234F");
  assert.equal(x.emergencyContactRelationship, "Mother");
  assert.equal(x.uan, "100200300400");
});

test("BULK-03 Label-style headers work too, and quoted addresses keep their commas", async () => {
  const e = email("labels");
  const header = "First Name,Last Name,Email,Phone,DOB,Job Title,Current Address,Permanent Address,Emergency Contact Address";
  const row = `QA,Labels,${e},${phone()},1993-03-03,Team Lead,"Flat 4, Sector 70, Mohali","Village X, Dist Y","House 9, Lane 2"`;
  // Required columns keep their existing (key) names; label-style is for the new ones.
  const r = await upload([header.replace("First Name,Last Name,Email,Phone,DOB", "firstName,lastName,email,phone,dob"), row]);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
  assert.equal(r.body.data.created, 1, JSON.stringify(r.body.data.invalidRowsDetail));
  const x = await extrasOf(idOf(r.body, e));
  assert.equal(x.jobTitle, "Team Lead");
  assert.equal(x.currentAddress, "Flat 4, Sector 70, Mohali");
  assert.equal(x.emergencyContactAddress, "House 9, Lane 2");
});

test("BULK-04 Invalid details skip only that row, with a clear reason", async () => {
  const good = email("good");
  const bad = { pan: email("pan"), aad: email("aad"), gen: email("gen"), mail: email("mail"), blood: email("blood") };
  const header = "firstName,lastName,email,phone,dob,panNumber,aadhaarNumber,gender,personalEmail,bloodGroup";
  const r = await upload([
    header,
    `QA,Good,${good},${phone()},1990-01-01,ABCDE1234F,123412341234,Male,ok@salesvera.test,O-`,
    `QA,BadPan,${bad.pan},${phone()},1990-01-01,12345,,,,`,
    `QA,BadAadhaar,${bad.aad},${phone()},1990-01-01,,1234,,,`,
    `QA,BadGender,${bad.gen},${phone()},1990-01-01,,,Unknown,,`,
    `QA,BadMail,${bad.mail},${phone()},1990-01-01,,,,not-an-email,`,
    `QA,BadBlood,${bad.blood},${phone()},1990-01-01,,,,,C+`,
  ]);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
  assert.equal(r.body.data.created, 1);
  assert.equal(r.body.data.skippedInvalid, 5);
  const reasons = Object.fromEntries(r.body.data.invalidRowsDetail.map((d) => [d.email, d.reason]));
  assert.match(reasons[bad.pan], /PAN/);
  assert.match(reasons[bad.aad], /Aadhaar/);
  assert.match(reasons[bad.gen], /Gender must be one of/);
  assert.match(reasons[bad.mail], /Personal Email is not a valid email/);
  assert.match(reasons[bad.blood], /Blood Group must be one of/);
  assert.deepEqual(r.body.data.invalidRowsDetail.map((d) => d.row), [3, 4, 5, 6, 7]);
});

test("BULK-05 Blank Additional Details cells create the employee with no details", async () => {
  const e = email("blank");
  const r = await upload(["firstName,lastName,email,phone,dob,jobTitle,gender,panNumber", `QA,Blank,${e},${phone()},1991-01-01,,,`]);
  assert.equal(r.body.data.created, 1);
  assert.equal(r.body.data.withAdditionalDetails, 0);
  const x = await extrasOf(idOf(r.body, e));
  assert.ok(!x.jobTitle && !x.gender && !x.panNumber);
});

test("BULK-06 Removed 'Other' fields and unknown columns are ignored, not saved", async () => {
  const e = email("other");
  const r = await upload(["firstName,lastName,email,phone,dob,grade,lockerNumber,favouriteColour,jobTitle", `QA,Other,${e},${phone()},1992-01-01,G7,L-99,Blue,Analyst`]);
  assert.equal(r.body.data.created, 1);
  const x = await extrasOf(idOf(r.body, e));
  assert.equal(x.jobTitle, "Analyst");
  assert.ok(!x.grade && !x.lockerNumber, "Other-group fields not written");
});

test("BULK-07 Required-field and date rules are unchanged (now with reasons)", async () => {
  const noDob = email("nodob");
  const badDoj = email("baddoj");
  const r = await upload(["firstName,lastName,email,phone,dob,dateOfJoining", `QA,NoDob,${noDob},${phone()},,`, `QA,BadDoj,${badDoj},${phone()},1990-01-01,not-a-date`]);
  assert.equal(r.body.data.created, 0);
  assert.equal(r.body.data.skippedInvalid, 2);
  const reasons = Object.fromEntries(r.body.data.invalidRowsDetail.map((d) => [d.email, d.reason]));
  assert.match(reasons[noDob], /required/);
  assert.match(reasons[badDoj], /dateOfJoining/);
});

test("BULK-08 Re-uploading an existing employee doesn't overwrite their details", async () => {
  const e = email("again");
  const first = await upload(["firstName,lastName,email,phone,dob,jobTitle", `QA,Again,${e},${phone()},1990-01-01,Original Title`]);
  const id = idOf(first.body, e);
  const second = await upload(["firstName,lastName,email,phone,dob,jobTitle", `QA,Again,${e},${phone()},1990-01-01,Changed Title`]);
  assert.equal(second.body.data.created, 0);
  assert.equal(second.body.data.skippedDuplicate, 1);
  const x = await extrasOf(id);
  assert.equal(x.jobTitle, "Original Title");
});

test("BULK-09 Duplicate email inside one CSV is still skipped", async () => {
  const e = email("dupcsv");
  const r = await upload(["firstName,lastName,email,phone,dob,jobTitle", `QA,One,${e},${phone()},1990-01-01,A`, `QA,Two,${e},${phone()},1990-01-01,B`]);
  assert.equal(r.body.data.created, 1);
  assert.equal(r.body.data.skippedDuplicateInCsv, 1);
});

test("BULK-10 Employees cannot bulk upload", async () => {
  const emp = await qa.newUser("employee", "bulk-emp");
  const fd = new FormData();
  fd.append("csv", new Blob(["firstName\nX"], { type: "text/csv" }), "x.csv");
  const res = await fetch(`${BASE}/admin/bulk-add-saleperson`, { method: "POST", headers: { Authorization: `Bearer ${emp.token}` }, body: fd });
  assert.equal(res.status, 403);
});
