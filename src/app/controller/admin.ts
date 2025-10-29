import {
  Model,
  FindOptions,
  Op,
  WhereOptions,
  Sequelize,
  CreationAttributes,
  Includeable,
  fn,
  col,
  literal,
} from "sequelize";
import fs from "fs";
import pdfParse from "pdf-parse";
import bcrypt from "bcrypt";
import jwt, { JwtPayload } from "jsonwebtoken";
// import cron from "node-cron";
// import { S3 } from "aws-sdk";
import { Request, Response } from "express-serve-static-core";
// import csv from "csv-parser";
// import fs from "fs";
import {
  createSuccess,
  getSuccess,
  badRequest,
} from "../middlewear/errorMessage";
import {
  User,
  Category,
  PropertyType,
  Flat,
  Amenities,
  Property,
  Project,
} from "../../config/dbConnection";
import * as Middleware from "../middlewear/comman";

const UNIQUE_ROLES = ["admin", "super_admin"];

export const Register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName, phone, dob, role,createdBy } = req.body;

    /** ✅ Required field validation */
    const requiredFields: Record<string, any> = {
      email,
      password,
      firstName,
      lastName,
      phone,
      dob,
      role,
    };

    for (const key in requiredFields) {
      if (!requiredFields[key]) {
         badRequest(res, `${key} is required`);
         return
      }
    }

    /** ✅ Check if user with same email exists */
    const isExist = await Middleware.FindByEmail(User, email);
    if (isExist) {
       badRequest(res, "Email already exists");
       return
    }

    /** ✅ Check role — admin/super_admin only once in DB */
    if (UNIQUE_ROLES.includes(role)) {
      const existing = await Middleware.findByRole(User, role);
      if (existing) {
         badRequest(
          res,
          `${role} already exists. Only one ${role} can be created.`
        );
        return
      }
    }

    const obj:any = {
      email,
      password,
      firstName,
      lastName,
      phone,
      dob,
      role,
    }
    const item = await User.create(obj);

     if (role === "sale_person") {
      const ids = Array.isArray(createdBy)
        ? createdBy.map(Number)
        : [Number(createdBy)];

      // ✅ Connect relations
      await (item as any).setCreators(ids);
    }

    /** ✅ JWT Tokens */
    const { accessToken, refreshToken } = Middleware.CreateToken(
      String(item.getDataValue("id")),
      String(item.getDataValue("role"))
    );
    await item.update({ refreshToken });
    createSuccess(res, `${role} registered successfully`, {
      // item,
      accessToken,
      // refreshToken,
    });
  } catch (error) {
     badRequest(
      res,
      error instanceof Error ? error.message : "Something went wrong",
      error
    );
    return
  }
};


export const Login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body || {};

    // ✅ Validate input
    if (!email || !password) {
      badRequest(res, "Email and password are required");
      return;
    }

    // ✅ Check if user exists
    const user = await Middleware.FindByEmail(User, email);
    if (!user) {
      badRequest(res, "Invalid email or password");
    }

    // ✅ Validate password
    const hashedPassword = user.getDataValue("password");
    const isPasswordValid = await bcrypt.compare(password, hashedPassword);

    if (!isPasswordValid) {
      badRequest(res, "Invalid email or password");
    }

    // ✅ Create tokens
    const { accessToken, refreshToken } = Middleware.CreateToken(
      String(user.getDataValue("id")),
      String(user.getDataValue("role"))
    );

    // ✅ Update refresh token in DB
    await user.update({ refreshToken });

    // ✅ Respond
    createSuccess(res, "Login successful", {
      accessToken,
      refreshToken,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const GetProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const user = await Middleware.getById(User, Number(userData.userId));
    createSuccess(res, "User profile fetched successfully", user);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const UpdatePassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) {
      badRequest(res, "Please provide old password and new password");
      return;
    }

    if (oldPassword === newPassword) {
      badRequest(res, "New password must be different from the old password");
      return;
    }

    // ✅ Fetch user
    const user = await Middleware.getById(User, Number(userData.userId));
    if (!user) {
      badRequest(res, "User not found");
      return;
    }

    // ✅ Now TypeScript knows `user` is not null
    const isPasswordValid = await bcrypt.compare(
      oldPassword,
      user.get("password") as string
    );

    if (!isPasswordValid) {
      badRequest(res, "Old password is incorrect");
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const newHashedPassword = await bcrypt.hash(newPassword, salt);

    await Middleware.Update(User, Number(userData.userId), {
      password: newHashedPassword,
    });

    createSuccess(res, "Password updated successfully");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const AddCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { category_name } = req.body || {};
    if (!category_name) {
      badRequest(res, "category name is missing");
      return;
    }
    const isCategoryExist = await Middleware.FindByField(
      Category,
      "category_name",
      category_name
    );
    if (isCategoryExist) {
      badRequest(res, "Category already exists");
      return;
    }
    const item = await Category.create({ category_name });
    createSuccess(res, "category create successfully");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const getcategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const data = req.query;
    const item = await Middleware.getCategory(Category, data);
    createSuccess(res, "category list", item);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const categoryDetails = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      badRequest(res, "Category ID is missing");
      return;
    }

    const category = await Middleware.getById(Category, Number(id));

    if (!category) {
      badRequest(res, "Category not found");
      return;
    }

    createSuccess(res, "Category details fetched successfully", category);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const UpdateCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { category_name } = req.body || {};
    if (!id) {
      badRequest(res, "Category ID is missing");
      return;
    }

    if (!category_name) {
      badRequest(res, "Category name is missing");
      return;
    }

    // ✅ Check if category with same name already exists
    const isCategoryExist = await Middleware.FindByField(
      Category,
      "category_name",
      category_name
    );

    if (isCategoryExist) {
      badRequest(res, "Category already exists");
      return;
    }

    // ✅ Update category
    const updatedCategory = await Middleware.UpdateData(
      Category,
      id,
      { category_name } // Pass as object
    );
    if (!updatedCategory) {
      badRequest(res, "Category not found");
      return;
    }
    createSuccess(res, "Category updated successfully", updatedCategory);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const DeleteCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      badRequest(res, "Category ID is missing");
      return;
    }
    const item = await Middleware.DeleteItembyId(Category, Number(id));
    if (!item) {
      badRequest(res, "Category not found");
      return;
    }
    createSuccess(res, "category delete successfully");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const AddProperty = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { category_id, name } = req.body || {};
    if (!category_id || !name) {
      badRequest(res, "property / category missing ");
    }
    const isCategoryExist = await Middleware.FindByField(
      PropertyType,
      "name",
      name
    );
    if (isCategoryExist) {
      badRequest(res, "property type already exists");
      return;
    }
    const item = await PropertyType.create({ name });
    await (item as any).addCategories(category_id);
    createSuccess(res, "property add successfully");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const getPropertylist = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const data = req.query;
    const item = await Middleware.getCategory(PropertyType, data);
    createSuccess(res, "Property list", item);
    if (!item) {
      badRequest(res, "Property not found");
      return;
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const PropertyDetails = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      badRequest(res, "property id is required");
      return;
    }
    const item = await Middleware.getById(PropertyType, Number(id));
    if (!item) {
      badRequest(res, "Property not found");
      return;
    }
    createSuccess(res, "property details", item);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const deleteProperty = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params || {};
    if (!id) {
      badRequest(res, "property id is required");
      return;
    }
    const item = await Middleware.getById(PropertyType, Number(id));
    if (!item) {
      badRequest(res, "Property not found");
      return;
    }
    await (item as any).setCategories([]);

    if (item !== null) {
      await item.destroy();
    }
    createSuccess(res, "property delete successfully ");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const UpdateProperty = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, category_id } = req.body;

    if (!id) {
      badRequest(res, "Property ID is required");
      return;
    }

    // ✅ Prepare update object
    const updateData: any = {};
    if (name) updateData.name = name;
    if (category_id) updateData.category_id = category_id;

    // ✅ Check if property name already exists (avoid duplicates)
    if (name) {
      const isExist = await Middleware.FindByField(PropertyType, "name", name);
      if (isExist && isExist.id !== Number(id)) {
        badRequest(res, "Property type already exists");
        return;
      }
    }

    // ✅ Update property
    const item = await Middleware.UpdateData(
      PropertyType,
      Number(id),
      updateData
    );

    if (!item) {
      badRequest(res, "Property not found");
      return;
    }
    createSuccess(res, "Property updated successfully", item);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

interface JournalEntry {
  date?: string;
  debit?: number;
  credit?: number;
  particulars?: string;
  billNo?: string;
}

interface JournalPeriod {
  date: string;
  broughtForward: { debit: number; credit: number };
  entries: JournalEntry[];
  carryForward: { debit: number; credit: number };
  total: { debit: number; credit: number };
}

interface JournalEntry {
  serialNo: string;
  transactions: Transaction[];
}

interface Transaction {
  particulars: string;
  debit: number;
  credit: number;
}

// export const Pdf = async (req: Request, res: Response) => {
//   try {
//     const file = req.file;
//     if (!file || !file.buffer) {
//       badRequest(res, "PDF file is required");
//       return;
//     }

//     const pdfData = await pdfParse(file.buffer);

//     const lines = pdfData.text
//       .split("\n")
//       .map((l) => l.trim())
//       .filter((l) => l.length > 0);

//     const entries: any[] = [];
//     let currentEntry: any = null;
//     let narration = "";

//     for (let i = 0; i < lines.length; i++) {
//       const line = lines[i];

//       // 🔹 Skip headers
//       if (
//         line.includes("S.No.") ||
//         line.includes("Dr. Amount") ||
//         line.includes("Particulars") ||
//         line.includes("Journal Book")
//       )
//         continue;

//       // 🔹 Detect new entry (serial no + first ledger)
//       const entryStart = line.match(/^(\d+)\s+([\d,.]+)(.+)$/);
//       if (entryStart) {
//         // Push previous entry if exists
//         if (currentEntry) {
//           currentEntry.Narration = narration.trim();
//           entries.push({ Jrnlentry: currentEntry });
//         }

//         // Reset for next entry
//         narration = "";

//         currentEntry = {
//           ledname1: entryStart[3].trim(),
//           Dbtamt1: entryStart[2].trim(),
//           ledname2: "",
//           Dbtamt2: "",
//           ledname3: "",
//           Dbtamt3: "",
//           Narration: "",
//         };
//         continue;
//       }

//       // 🔹 Detect second/third ledger lines (like "47821.00WHEAT STRAW SALE")
//       const ledgerLine = line.match(/^([\d,.]+)(.+)$/);
//       if (ledgerLine && currentEntry) {
//         if (!currentEntry.ledname2) {
//           currentEntry.Dbtamt2 = ledgerLine[1].trim();
//           currentEntry.ledname2 = ledgerLine[2].trim();
//         } else if (!currentEntry.ledname3) {
//           currentEntry.Dbtamt3 = ledgerLine[1].trim();
//           currentEntry.ledname3 = ledgerLine[2].trim();
//         }
//         continue;
//       }

//       // 🔹 Narration or Bill details
//       if (
//         !line.match(/^[\d,.]+/) &&
//         !line.includes("Total :") &&
//         !line.includes("C/F") &&
//         !line.includes("B/F")
//       ) {
//         narration += (narration ? " " : "") + line;
//         continue;
//       }
//     }

//     // Push last entry
//     if (currentEntry) {
//       currentEntry.Narration = narration.trim();
//       entries.push({ Jrnlentry: currentEntry });
//     }

//     res.status(200).json({
//       success: true,
//       count: entries.length,
//       data: entries,
//     });
//   } catch (error) {
//     const errorMessage =
//       error instanceof Error ? error.message : "Something went wrong";
//     badRequest(res, errorMessage, error);
//   }
// };

// // export const Pdf = async (req: Request, res: Response) => {
// //   try {
// //     const file = req.file;
// //     if (!file || !file.buffer) {
// //       badRequest(res, "PDF file is required");
// //       return;
// //     }

// //     const pdfData = await pdfParse(file.buffer);

// //     const lines = pdfData.text
// //       .split("\n")
// //       .map((l) => l.trim())
// //       .filter((l) => l.length > 0);

// //     const entries: any[] = [];
// //     let currentEntry: any = null;
// //     let narration = "";

// //     for (let i = 0; i < lines.length; i++) {
// //       const line = lines[i];

// //       // 🔹 Skip header and meta lines completely
// //       if (
// //         line.startsWith("ZAMINDARA FARMSOLUTIONS") ||
// //         line.startsWith("FEROZEPUR ROAD") ||
// //         line.startsWith("FAZILKA") ||
// //         line.includes("Journal Book") ||
// //         line.includes("Dr. Amount") ||
// //         line.includes("Particulars") ||
// //         line.includes("S.No.") ||
// //         line.startsWith("Page")
// //       ) {
// //         continue;
// //       }

// //       // 🔹 New Journal Entry (Serial + first ledger)
// //       const entryStart = line.match(/^(\d+)\s+([\d,.]+)(.+)$/);
// //       if (entryStart) {
// //         // Push previous entry if exists
// //         if (currentEntry) {
// //           currentEntry.Narration = narration.trim();
// //           entries.push({ Jrnlentry: currentEntry });
// //         }

// //         // Reset for next entry
// //         narration = "";

// //         currentEntry = {
// //           ledname1: entryStart[3].trim(),
// //           Dbtamt1: entryStart[2].trim(),
// //           ledname2: "",
// //           Dbtamt2: "",
// //           ledname3: "",
// //           Dbtamt3: "",
// //           Narration: "",
// //         };
// //         continue;
// //       }

// //       // 🔹 Second/third ledger lines (like "47821.00WHEAT STRAW SALE")
// //       const ledgerLine = line.match(/^([\d,.]+)(.+)$/);
// //       if (ledgerLine && currentEntry) {
// //         if (!currentEntry.ledname2) {
// //           currentEntry.Dbtamt2 = ledgerLine[1].trim();
// //           currentEntry.ledname2 = ledgerLine[2].trim();
// //         } else if (!currentEntry.ledname3) {
// //           currentEntry.Dbtamt3 = ledgerLine[1].trim();
// //           currentEntry.ledname3 = ledgerLine[2].trim();
// //         }
// //         continue;
// //       }

// //       // 🔹 Narration lines (e.g. Bill details)
// //       if (
// //         !line.match(/^[\d,.]+/) &&
// //         !line.includes("Total :") &&
// //         !line.includes("C/F") &&
// //         !line.includes("B/F")
// //       ) {
// //         narration += (narration ? " " : "") + line;
// //         continue;
// //       }
// //     }

// //     // 🔹 Push last entry
// //     if (currentEntry) {
// //       currentEntry.Narration = narration.trim();
// //       entries.push({ Jrnlentry: currentEntry });
// //     }

// //     res.status(200).json({
// //       success: true,
// //       count: entries.length,
// //       data: entries,
// //     });
// //   } catch (error) {
// //     const errorMessage =
// //       error instanceof Error ? error.message : "Something went wrong";
// //     badRequest(res, errorMessage, error);
// //   }
// // };

// // export const Pdf = async (req: Request, res: Response) => {
// //   try {
// //     const file = req.file;
// //     if (!file || !file.buffer) {
// //       badRequest(res, "PDF file is required");
// //       return;
// //     }

// //     const pdfData = await pdfParse(file.buffer);

// //     const lines = pdfData.text
// //       .split("\n")
// //       .map((l) => l.trim())
// //       .filter((l) => l.length > 0);

// //     const entries: any[] = [];
// //     let currentEntry: any = null;
// //     let narration = "";
// //     let ledgerList: { name: string; amount: string }[] = [];
// //     let currentDate = "";
// //     let entryCounter = 0; // ✅ continuous count for entries

// //     for (let i = 0; i < lines.length; i++) {
// //       const line = lines[i];

// //       // 🔹 Skip headers
// //       if (
// //         line.startsWith("ZAMINDARA FARMSOLUTIONS") ||
// //         line.startsWith("FEROZEPUR ROAD") ||
// //         line.startsWith("FAZILKA") ||
// //         line.includes("Journal Book") ||
// //         line.includes("Dr. Amount") ||
// //         line.includes("Particulars") ||
// //         line.includes("S.No.") ||
// //         line.startsWith("Page")
// //       )
// //         continue;

// //       // 🔹 Detect Date (e.g., "01/04/2025 B/F  0.00  0.00")
// //       const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{4})\s+B\/F/);
// //       if (dateMatch) {
// //         currentDate = dateMatch[1];
// //         continue;
// //       }

// //       // 🔹 Detect new entry start (e.g., "1  47821.00SILAGE FACTORY")
// //       const entryStart = line.match(/^(\d+)\s+([\d,.]+)(.+)$/);
// //       if (entryStart) {
// //         // Save previous entry
// //         if (currentEntry) {
// //           ledgerList.forEach((l, index) => {
// //             currentEntry[`ledname${index + 1}`] = l.name;
// //             currentEntry[`Dbtamt${index + 1}`] = l.amount;
// //           });
// //           currentEntry.Narration = narration.trim();
// //           entries.push({ Jrnlentry: currentEntry });
// //         }

// //         // Reset for new entry
// //         narration = "";
// //         ledgerList = [];
// //         entryCounter += 1; // ✅ increment running number

// //         // Create new entry
// //         ledgerList.push({
// //           amount: entryStart[2].trim(),
// //           name: entryStart[3].trim(),
// //         });

// //         currentEntry = {
// //           number: entryCounter, // ✅ continuous number
// //           date: currentDate || "",
// //         };
// //         continue;
// //       }

// //       // 🔹 Detect additional ledgers (e.g. "47821.00WHEAT STRAW SALE")
// //       const ledgerLine = line.match(/^([\d,.]+)(.+)$/);
// //       if (ledgerLine) {
// //         ledgerList.push({
// //           amount: ledgerLine[1].trim(),
// //           name: ledgerLine[2].trim(),
// //         });
// //         continue;
// //       }

// //       // 🔹 Narration lines (e.g. Bill info)
// //       if (
// //         !line.match(/^[\d,.]+/) &&
// //         !line.includes("Total :") &&
// //         !line.includes("C/F") &&
// //         !line.includes("B/F")
// //       ) {
// //         narration += (narration ? " " : "") + line;
// //         continue;
// //       }
// //     }

// //     // 🔹 Push last entry after loop
// //     if (currentEntry) {
// //       ledgerList.forEach((l, index) => {
// //         currentEntry[`ledname${index + 1}`] = l.name;
// //         currentEntry[`Dbtamt${index + 1}`] = l.amount;
// //       });
// //       currentEntry.Narration = narration.trim();
// //       entries.push({ Jrnlentry: currentEntry });
// //     }

// //     res.status(200).json({
// //       success: true,
// //       totalEntries: entries.length,
// //       data: entries,
// //     });
// //   } catch (error) {
// //     const errorMessage =
// //       error instanceof Error ? error.message : "Something went wrong";
// //     badRequest(res, errorMessage, error);
// //   }
// // };

// export const Pdf = async (req: Request, res: Response) => {
//   try {
//     const file = req.file;
//     if (!file || !file.buffer) {
//       badRequest(res, "PDF file is required");
//       return;
//     }

//     const pdfData = await pdfParse(file.buffer);

//     const lines = pdfData.text
//       .split("\n")
//       .map((l) => l.trim())
//       .filter((l) => l.length > 0);

//     const entries: any[] = [];
//     let currentEntry: any = null;
//     let narration = "";
//     let ledgerList: { name: string; amount: string }[] = [];
//     let currentDate = "";
//     let entryCounter = 0; // resets each date section

//     for (let i = 0; i < lines.length; i++) {
//       const line = lines[i];

//       // 🔹 Skip header & irrelevant lines
//       if (
//         line.startsWith("ZAMINDARA FARMSOLUTIONS") ||
//         line.startsWith("FEROZEPUR ROAD") ||
//         line.startsWith("FAZILKA") ||
//         line.includes("Journal Book") ||
//         line.includes("Dr. Amount") ||
//         line.includes("Particulars") ||
//         line.includes("S.No.") ||
//         line.startsWith("Page")
//       )
//         continue;

//       // 🔹 Detect date line → "01/04/2025 B/F  0.00  0.00"
//       const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{4})\s+B\/F/);
//       if (dateMatch) {
//         const newDate = dateMatch[1];
//         // ✅ Reset numbering when new date section starts
//         if (newDate !== currentDate) {
//           currentDate = newDate;
//           entryCounter = 0;
//         }
//         continue;
//       }

//       // 🔹 Detect new journal entry → "1  47821.00SILAGE FACTORY"
//       const entryStart = line.match(/^(\d+)\s+([\d,.]+)(.+)$/);
//       if (entryStart) {
//         // Save previous entry if exists
//         if (currentEntry) {
//           ledgerList.forEach((l, index) => {
//             currentEntry[`ledname${index + 1}`] = l.name;
//             currentEntry[`Dbtamt${index + 1}`] = l.amount;
//           });
//           currentEntry.Narration = narration.trim();
//           entries.push({ Jrnlentry: currentEntry });
//         }

//         // Reset for new entry
//         narration = "";
//         ledgerList = [];
//         entryCounter += 1; // ✅ increment within current date

//         // Create new entry
//         ledgerList.push({
//           amount: entryStart[2].trim(),
//           name: entryStart[3].trim(),
//         });

//         currentEntry = {
//           number: entryCounter,
//           date: currentDate || "",
//         };
//         continue;
//       }

//       // 🔹 Detect additional ledgers → "47821.00WHEAT STRAW SALE"
//       const ledgerLine = line.match(/^([\d,.]+)(.+)$/);
//       if (ledgerLine) {
//         ledgerList.push({
//           amount: ledgerLine[1].trim(),
//           name: ledgerLine[2].trim(),
//         });
//         continue;
//       }

//       // 🔹 Narration lines (Bill details etc.)
//       if (
//         !line.match(/^[\d,.]+/) &&
//         !line.includes("Total :") &&
//         !line.includes("C/F") &&
//         !line.includes("B/F")
//       ) {
//         narration += (narration ? " " : "") + line;
//         continue;
//       }
//     }

//     // 🔹 Push the last entry
//     if (currentEntry) {
//       ledgerList.forEach((l, index) => {
//         currentEntry[`ledname${index + 1}`] = l.name;
//         currentEntry[`Dbtamt${index + 1}`] = l.amount;
//       });
//       currentEntry.Narration = narration.trim();
//       entries.push({ Jrnlentry: currentEntry });
//     }

//     res.status(200).json({
//       success: true,
//       totalEntries: entries.length,
//       data: entries,
//     });
//   } catch (error) {
//     const errorMessage =
//       error instanceof Error ? error.message : "Something went wrong";
//     badRequest(res, errorMessage, error);
//   }
// };

// Type definitions
interface JournalPeriod {
  date: string;
  broughtForward: { debit: number; credit: number };
  entries: JournalEntry[];
  carryForward: { debit: number; credit: number };
  total: { debit: number; credit: number };
}

interface JournalEntry {
  serialNo: string;
  transactions: Transaction[];
}

interface Transaction {
  particulars: string;
  debit: number;
  credit: number;
}

export const addFlat = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type } = req.body || {};
    if (!type) {
      badRequest(res, "flat type is missing ");
      return;
    }
    const isCategoryExist = await Middleware.FindByField(Flat, "type", type);
    if (isCategoryExist) {
      badRequest(res, "Flat type already exists");
      return;
    }
    const item = await Flat.create({ type });
    createSuccess(res, "flat type add successfully ");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const getFlatList = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const data = req.query;
    const item = await Middleware.getCategory(Flat, data);
    if (!item) {
      badRequest(res, "flat not found");
      return;
    }
    createSuccess(res, "flat list", item);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const FlatDetails = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params || {};
    if (!id) {
      badRequest(res, "flat id missing");
    }
    const item = await Middleware.getById(Flat, Number(id));
    if (!item) {
      badRequest(res, "falt not found");
    }
    createSuccess(res, "falt details", item);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const UpdateFlat = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params || {};
    const { type } = req.body;

    console.log(">>>>>>>>>>>>>>>>type", type);
    const isCategoryExist = await Middleware.FindByField(Flat, "type", type);
    if (isCategoryExist) {
      badRequest(res, "Flat type already exists");
      return;
    }
    const item = await Middleware.Update(Flat, Number(id), { type });
    console.log(">>>>>>>>>>>>>>>>>>item", item);

    createSuccess(res, "flat data update successfully");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const flatDelete = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      badRequest(res, "flat is missing");
    }
    const item = await Middleware.DeleteItembyId(Flat, Number(id));
    createSuccess(res, "flat delete successfully ");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const addamenities = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { type } = req.body || {};
    if (!type) {
      badRequest(res, "Amenities type is missing ");
      return;
    }
    const isCategoryExist = await Middleware.FindByField(
      Amenities,
      "type",
      type
    );
    if (isCategoryExist) {
      badRequest(res, "Amenities type already exists");
      return;
    }
    const item = await Amenities.create({ type });
    createSuccess(res, "Amenities type add successfully ");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const amenitiesList = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const data = req.query;
    const item = await Middleware.getCategory(Amenities, data);
    if (!item) {
      badRequest(res, "Amenities not found");
      return;
    }
    createSuccess(res, "Amenities list", item);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const amenitiesdetails = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params || {};
    if (!id) {
      badRequest(res, "Amenities id missing");
    }
    const item = await Middleware.getById(Amenities, Number(id));
    if (!item) {
      badRequest(res, "Amenities not found");
    }
    createSuccess(res, "Amenities details", item);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const updateamenities = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params || {};
    const { type } = req.body;

    console.log(">>>>>>>>>>>>>>>>type", type);
    const isCategoryExist = await Middleware.FindByField(
      Amenities,
      "type",
      type
    );
    if (isCategoryExist) {
      badRequest(res, "Amenities type already exists");
      return;
    }
    const item = await Middleware.Update(Amenities, Number(id), { type });
    console.log(">>>>>>>>>>>>>>>>>>item", item);

    createSuccess(res, "Amenities data update successfully");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const amenitiesdelete = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      badRequest(res, "Amenities is missing");
    }
    const item = await Middleware.DeleteItembyId(Amenities, Number(id));
    createSuccess(res, "Amenities delete successfully ");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const AddPropertys = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      name,
      listing_type,
      property_for,
      owner_ship,
      builder_id,
      project_id,
      category_id,
      property_type,
      amenities_id,
      title,
      unique_selling_point,
      state,
      city,
      country,
      locality,
      address,
      facing,
      bedroom,
      bathroom,
      balconies,
      floor_no,
      total_floor,
      furnished_status,
      price,
      price_negotiable,
      price_include,
      other_charge,
      maintenance_charge,
      maintenance_mode,
      corner_plot,
      length,
      breadth,
      is_active,
      possession_status,
      image,
    } = req.body || {};

    const allowedFields = [
      "name",
      "listing_type",
      "property_for",
      "owner_ship",
      "builder_id",
      "project_id",
      "category_id",
      "property_type",
      "amenities_id",
      "title",
      "price",
      "unique_selling_point",
      "state",
      "city",
      "country",
      "locality",
      "address",
      "facing",
      "bedroom",
      "bathroom",
      "balconies",
      "floor_no",
      "total_floor",
      "furnished_status",
      "price_negotiable",
      "price_include",
      "other_charge",
      "maintenance_charge",
      "maintenance_mode",
      "corner_plot",
      "length",
      "breadth",
      "is_active",
      "possession_status",
      "image",
    ];

    const object: any = {};

    // ✅ Add only non-empty fields
    for (const key of allowedFields) {
      if (
        req.body[key] !== undefined &&
        req.body[key] !== null &&
        req.body[key] !== ""
      ) {
        object[key] = req.body[key];
      }
    }

    // ✅ Auto calculations
    if (length && breadth) {
      object.area = Number(length) * Number(breadth);
    }

    if (price) {
      // If area exists, calculate price per sqft
      if (object.area) {
        object.price_per_sqft = Number(price) / Number(object.area);
      }

      // 25% of price as booking amount
      object.booking_amount = Number(price) * 0.25;
    }

    console.log("✅ Final Property Object:", object);

    // ✅ Save to DB
    const item = await Property.create(object);

    createSuccess(res, "Property added successfully", item);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const addProdut = async (req: Request, res: Response): Promise<void> => {
  try {
    // ✅ Get user ID from JWT
    const userData = req.userData as JwtPayload;
    const user_id = userData?.userId;
    const {
      project_name,
      status,
      project_details,
      project_features,
      price_range_from,
      price_range_to,
      price_per_sqft,
      units_size_sqft,
      total_units,
      location,
      city,
      state,
      country,
      possession_date,
      builder_name,
      project_images,
      is_active,
    } = req.body || {};

    const allowedFields = [
      "project_name",
      "status",
      "project_details",
      "project_features",
      "price_range_from",
      "price_range_to",
      "price_per_sqft",
      "units_size_sqft",
      "total_units",
      "location",
      "city",
      "state",
      "country",
      "possession_date",
      "builder_name",
      "project_images",
      "is_active",
    ];

    // ✅ Build object with non-empty values
    const object: any = { user_id }; // include user_id
    for (const key of allowedFields) {
      const value = req.body[key];
      if (value !== undefined && value !== null && value !== "") {
        object[key] = value;
      }
    }

    // ✅ Auto-calculate price_per_sqft if missing
    if (
      price_range_from &&
      price_range_to &&
      !price_per_sqft &&
      units_size_sqft
    ) {
      const avgPrice = (Number(price_range_from) + Number(price_range_to)) / 2;
      object.price_per_sqft = avgPrice / Number(units_size_sqft);
    }

    // ✅ Save to DB
    const item = await Project.create(object);

    createSuccess(res, "Project added successfully", item);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

// export const Pdf = async (req: Request, res: Response) => {
//   try {
//     const file = req.file;

//     if (!file || !file.buffer) {
//       badRequest(res, "PDF file is required");
//       return;
//     }

//     const pdfData = await pdfParse(file.buffer);
//     const lines = pdfData.text
//       .split("\n")
//       .map((l) => l.trim())
//       .filter((l) => l.length > 0);

//     const journalData: any = { periods: [] };
//     let currentPeriod: any = null;
//     let currentEntry: any = null;

//     // Extract company info
//     journalData.companyInfo = {
//       companyName: lines[0] || "",
//       address: lines[1] || "",
//       journalType: lines[2] || "",
//       financialYear: "2025-2026",
//     };

//     for (let i = 0; i < lines.length; i++) {
//       const line = lines[i];

//       // Skip header lines
//       if (
//         line.includes("S.No.") ||
//         line.includes("Dr. Amount") ||
//         line.includes("Cr. Amount") ||
//         line.includes("Particulars")
//       )
//         continue;

//       // Period start line
//       const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{4})\s+B\/F\s+([\d,.]+)\s+([\d,.]+)/);
//       if (dateMatch) {
//         if (currentPeriod && currentPeriod.entries.length > 0)
//           journalData.periods.push(currentPeriod);

//         currentPeriod = {
//           date: dateMatch[1],
//           entries: [],
//         };
//         continue;
//       }

//       // Debit entry (starts with serial no)
//       const serialMatch = line.match(/^(\d+)\s+(.+?)\s+([\d,.]+)$/);
//       if (serialMatch && currentPeriod) {
//         if (currentEntry) currentPeriod.entries.push(currentEntry);

//         currentEntry = {
//           serialNo: serialMatch[1],
//           transactions: [
//             {
//               particulars: serialMatch[2].trim(),
//               debit: parseFloat(serialMatch[3].replace(/,/g, "")),
//               credit: 0,
//             },
//           ],
//         };
//         continue;
//       }

//       // Credit or additional transactions
//       const creditMatch = line.match(/^(.+?)\s+([\d,.]+)$/);
//       if (creditMatch && currentEntry && !line.match(/Total|C\/F|B\/F/)) {
//         currentEntry.transactions.push({
//           particulars: creditMatch[1].trim(),
//           debit: 0,
//           credit: parseFloat(creditMatch[2].replace(/,/g, "")),
//         });
//         continue;
//       }

//       // Narration line
//       if (
//         currentEntry &&
//         currentEntry.transactions.length > 0 &&
//         !line.match(/^\d/) &&
//         !line.match(/^Total|C\/F|B\/F/)
//       ) {
//         const last = currentEntry.transactions[currentEntry.transactions.length - 1];
//         last.narration = last.narration ? `${last.narration} ${line}` : line;
//         continue;
//       }
//     }

//     if (currentEntry && currentPeriod) currentPeriod.entries.push(currentEntry);
//     if (currentPeriod && currentPeriod.entries.length > 0) journalData.periods.push(currentPeriod);

//     const transformedData = transformToDesiredFormat(journalData);

//     res.status(200).json({
//       success: true,
//       data: transformedData,
//     });
//   } catch (error) {
//     const errorMessage = error instanceof Error ? error.message : "Something went wrong";
//     badRequest(res, errorMessage, error);
//   }
// };

// function transformToDesiredFormat(journalData: any) {
//   const entries: any[] = [];

//   for (const period of journalData.periods) {
//     for (const entry of period.entries) {
//       const txs = entry.transactions;

//       if (txs.length >= 2) {
//         const jrnlEntry: any = {
//           ledname1: txs[0]?.particulars || "",
//           Dbtamt1: formatAmount(txs[0]?.debit),
//           Ledname2: txs[1]?.particulars || "",
//           Dbtamt2: formatAmount(txs[1]?.credit),
//           Ledname3: "",
//           Dbtamt3: "",
//           Narration: "",
//         };

//         // Handle ROUND OFF or third transaction
//         if (txs.length >= 3) {
//           jrnlEntry.Ledname3 = txs[2]?.particulars || "";
//           jrnlEntry.Dbtamt3 = formatAmount(txs[2]?.credit || txs[2]?.debit);
//         }

//         // Pick first narration found
//         for (const tx of txs) {
//           if (tx.narration) {
//             jrnlEntry.Narration = tx.narration.trim();
//             break;
//           }
//         }

//         entries.push({ Jrnlentry: jrnlEntry });
//       }
//     }
//   }

//   return entries;
// }

// function formatAmount(val: number): string {
//   return val ? val.toFixed(2) : "";
// }

// // Type definitions
// interface JournalPeriod {
//   date: string;
//   broughtForward: { debit: number; credit: number };
//   entries: JournalEntry[];
//   carryForward: { debit: number; credit: number };
//   total: { debit: number; credit: number };
// }

// interface JournalEntry {
//   serialNo: string;
//   transactions: Transaction[];
// }

// interface Transaction {
//   particulars: string;
//   debit: number;
//   credit: number;
//   narration?: string;
// }
