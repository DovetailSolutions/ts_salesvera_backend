import { Model,FindOptions,Op,WhereOptions  ,Sequelize ,CreationAttributes,Includeable } from "sequelize";
import jwt from "jsonwebtoken";
import { User, Category, SubCategory } from "../../config/dbConnection";
import { promises } from "dns";
import { Mode } from "fs";
interface FindOneWithIncludeParams {
  baseModel: any; // typeof Model works but is tricky for TS generics
  id: number | string;
  include: Includeable[];
  primaryKeyField?: string;
}
interface FindAllWithIncludeParams {
  baseModel: any;
  include?: Includeable[];
  where?: any;
  limit?: number;
  offset?: number;
  order?: any;
}

// Find by email (Sequelize version)
export const FindByEmail = async (model:any, email: string) => {
  try {
    return await model.findOne({ where: { email } }); // ✅ correct Sequelize syntax
  } catch (error) {
    console.error("Error in FindByEmail:", error);
    throw error;
  }
};


export const findByRole = async(model:any, role: string)=>{
  try{
    return await model.findOne({ where: { role } });
  }catch(error){
    throw error;
  }
}


export const FindByField = async (
  model: any,
  fieldName: string,
  fieldValue: string,
  id:""
  
): Promise<any> => {
  try {
    // Normalize value: lowercase + remove spaces
    const normalizedValue = fieldValue.replace(/\s+/g, "").toLowerCase();

    return await model.findOne({
      // where: Sequelize.where(
      //   Sequelize.fn(
      //     "REPLACE",
      //     Sequelize.fn("LOWER", Sequelize.col(fieldName)),
      //     " ",
      //     ""
      //   ),
      //   normalizedValue
      // ),
       where: {
        // field comparison with normalization
        [Op.and]: [
          Sequelize.where(
            Sequelize.fn(
              "REPLACE",
              Sequelize.fn("LOWER", Sequelize.col(fieldName)),
              " ",
              ""
            ),
            normalizedValue
          ),

          // 🔥 OR condition for adminId or managerId
          {
            [Op.or]: [
              { adminId: id },
              { managerId: id }
            ]
          }
        ]
      }
    });
  } catch (error) {
    console.error(`Error in FindByFieldNormalized (${fieldName}):`, error);
    throw error;
  }
};



export const FindByPhone = async(model:any,phone:any)=>{
  try{
    return await model.findOne({where:{phone}})
  }catch(err){
    return err
  }
}
export const FindByPhone2 = async(model:any,data:any)=>{
  try{
    return await model.findOne({where:{phoneNumber:data}})
  }catch(err){
    return err
  }
}
// Create JWT token
// export const CreateToken = (userId: string,role:string): string => {
//   return jwt.sign({ userId,role }, process.env.JWT_SECRET || "secret", {
//     expiresIn: "1d",
//   });
// };

export const CreateToken = (userId: string, role: string) => {
  const accessToken = jwt.sign(
    { userId, role },
    process.env.JWT_SECRET || "dovetailPharma",
    { expiresIn: "30d" } // short-lived
  );

  const refreshToken = jwt.sign(
    { userId, role },
    process.env.JWT_SECRET || "dovetailPharma",
    { expiresIn: "60d" } // long-lived
  );

  return { accessToken, refreshToken };
};

// crate data 
export const CreateData = async <T extends Model>(
  model: { create(values?: CreationAttributes<T>): Promise<T> },
  data: CreationAttributes<T>
): Promise<T> => {
  try {
    return await model.create(data);
  } catch (error) {
    console.error("Error in CreateData:", error);
    throw new Error("Failed to create data");
  }
};
interface LeadCreationAttributes {
  name: string;
  email: string;
  phone: string;
  company: string;
  company_id?: number[] | null;
  category_id?: number | null;
  sub_category_id?: number | null;
}

export const CreateData2 = async <T extends Model>(
  model: { create(values?: LeadCreationAttributes): Promise<T> },
  data: LeadCreationAttributes
): Promise<T> => {
  try {
    return await model.create(data);
  } catch (error) {
    console.error("Error in CreateData:", error);
    throw new Error("Failed to create data");
  }
};


// get post 

export const GetPost = async(model:any,data:any)=>{
  try{
    const item = await model.findAll()
    return item
  }catch(error){
    return  error
  }
}



export const getAllList = async (model: any, data: any = {}, searchFields: string[] = []) => {
  try {
    const { page = 1, limit = 10, date, search, ...filters } = data;
    const whereConditions: any = { ...filters };
    if (date) {
      whereConditions.date = date; 
    }
    // 🔍 Add search functionality
    if (search && searchFields.length > 0) {
      whereConditions[Op.or] = searchFields.map((field) => ({
        [field]: { [Op.like]: `%${search}%` }, // Or Op.iLike if Postgres
      }));
    }
    const offset = (Number(page) - 1) * Number(limit);
    const { count, rows } = await model.findAndCountAll({
      where: whereConditions,
      limit: Number(limit),
      offset,
    });

   if (rows.length === 0) {
  throw new Error("Company does not exist");
}

    return {
      success: true,
      data: rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        totalRecords: count,
        totalPages: Math.ceil(count / Number(limit)),
      },
    };
  } catch (error) {
    console.error("Database Error:", error);
    throw error;
  }
};




export const getAllList3 = async (
  model: any,
  data: any = {},
  searchFields: string[] = [],
  include: any[] = []
) => {
  try {
    const { page = 1, limit = 10, date, search, ...filters } = data;

    const whereConditions: any = {};

    // Only keep actual filters, not pagination values
    Object.keys(filters).forEach((key) => {
      if (filters[key] !== undefined && filters[key] !== "") {
        whereConditions[key] = filters[key];
      }
    });

    if (date) {
      whereConditions.date = date;
    }

    if (search && searchFields.length > 0) {
      whereConditions[Op.or] = searchFields.map((field) => ({
        [field]: { [Op.iRegexp]: `^${search}` },
      }));
    }

    const offset = (Number(page) - 1) * Number(limit);

    const  rows  = await model.findAll({
      where: whereConditions,
      include,
      limit: Number(limit),
      offset,
      order: [["createdAt", "DESC"]],
    });


    let count  = rows.length

    return {
      success: true,
      data: rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        totalRecords: count,
        totalPages: Math.ceil(count / Number(limit)),
      },
    };
  } catch (error) {
    console.error("Database Error:", error);
    throw error;
  }
};



export const getAllList2 = async (
  model: any,
  data: any = {},
  searchFields: string[] = [],
  extraOptions: any = {}
) => {
  try {
    const { page = 1, limit = 10,search, ...filters } = data;
    const offset = (Number(page) - 1) * Number(limit);

    const whereConditions: any = { ...filters };
    // 🔍 Add search functionality
    if (search && searchFields.length > 0) {
      whereConditions[Op.or] = searchFields.map((field) => ({
        [field]: { [Op.like]: `%${search}%` }, // Or Op.iLike if Postgres
      }));
    }

    const result = await model.findAndCountAll({
      where: whereConditions,
      limit: Number(limit),
      offset,
      include: extraOptions.include || [], // ✅ allow associations
      order: [["createdAt", "DESC"]],
       distinct: true, // ✅ ensures unique lead IDs in count
    });
    let count = result.count

    return {
      data: result.rows,
      pagination: {
        total: result.count,
        page: Number(page),
        limit: Number(limit),
        totalRecords: count,
        totalPages: Math.ceil(count / Number(limit)),
      },
    };
  } catch (error) {
    console.error("Error in getAllList:", error);
    throw error;
  }
};



export const DeleteItembyId = async (model: any, id: number,userId?:number): Promise<number> => {
  try {
    const deletedCount = await model.destroy({
      where: { id }
    });
    return deletedCount;
  } catch (error) {
    throw error;
  }
};

export const getById = async (
  model: any,
  id: number,
  user_id?: number // optional parameter
): Promise<Model | null> => {
  try {
    let result;

    if (user_id) {
      // ✅ When user_id is provided → use `findOne` with both conditions
      result = await model.findOne({
        where: { id, user_id },
      });
    } else {
      // ✅ When only id is provided → use `findByPk`
      result = await model.findByPk(id);
    }

    return result;
  } catch (error) {
    console.error("Get By ID Error:", error);
    throw error;
  }
};


export const Update = async (
  model: any,
  id: number,
  data: object
): Promise<[number, Model[]]> => {
  try {
    return await model.update(data, {
      where: { id }
    });
  } catch (error) {
    throw error;
  }
};



export const Pipeline = async (
  model: any,
  data: any
): Promise<{
  totalCount: number;
  totalPages: number;
  rows: any[];
}> => {
  try {
    const page = +data.page || 1;
    const limit = +data.limit || 10;
    const offset = (page - 1) * limit;

    const where: any = {};

    // Always filter by user_id if present
    if (data.user_id) {
      where.user_id = data.user_id;
    }

    // Optional search filters
    if (data.search) {
      where[Op.or] = [
        { company_name: { [Op.iLike]: `%${data.search}%` } },
        { company_email: { [Op.iLike]: `%${data.search}%` } },
      ];
    }

    // Optional status filter
    if (data.status) {
      where.status = data.status;
    }

    // Optional state filter (future)
    if (data.state) {
      where.state = data.state;
    }

    // Optional city filter (future)
    if (data.city) {
      where.city = data.city;
    }

    const { count, rows } = await model.findAndCountAll({
      where,
      offset,
      limit,
      order: [["createdAt", "DESC"]],
    });

    const totalPages = Math.ceil(count / limit);

    return {
      totalCount: count,
      totalPages,
      rows,
    };
  } catch (err) {
    console.error("Pipeline error:", err);
    return {
      totalCount: 0,
      totalPages: 0,
      rows: [],
    };
  }
};


export const findByOTP = async (model: any, data: any): Promise<any> => {
  try {
    const item = await model.findOne({
      where: { otp: data.otp }  // ✅ Add `where` if using Sequelize
    });

    return item;  // Will return null if not found
  } catch (error) {
    throw error;  // Let caller handle the error properly
  }
};

export const UpdateData = async <T extends Model>(
  model: any,
  id: number | string,
  data: Partial<any>
): Promise<T | null> => {
  try {
    const [affectedRows] = await model.update(data, {
      where: { id },
    });

    if (affectedRows === 0) {
      return null; // No record updated
    }

    return await model.findByPk(id);
  } catch (error) {
    console.error("Error in Update:", error);
    throw new Error("Failed to update data");
  }
};

export const updateByCondition = async (
  model: any,
  condition: WhereOptions,
  data: Record<string, any>
): Promise<[number, Model[]]> => {
  try {
    return await model.update(data, {
      where: condition
    });
  } catch (error) {
    console.error("Update Error:", error);
    throw error;
  }
};

export const findOneWithInclude = async ({
  baseModel,
  id,
  include,
  primaryKeyField = "id",
}: FindOneWithIncludeParams) => {
  return await baseModel.findOne({
    where: { [primaryKeyField]: id },
    include,
  });
};

export const findAllWithInclude = async ({
  baseModel,
  include = [],
  where = {},
  limit,
  offset,
  order,
}: FindAllWithIncludeParams) => {
  return await baseModel.findAll({
    where,
    include,
    limit,
    offset,
    order,
  });
};

export const deleteByCondition = async (baseModel: any, condition: any) => {
  return await baseModel.destroy({
    where: condition,
  });
};


export const findOneByCondition = async (
  model: any,
  condition: WhereOptions
): Promise<Model | null> => {
  try {
    return await model.findOne({ where: condition });
  } catch (error) {
    console.error("Find One Error:", error);
    throw error;
  }
};


export const getCategory = async (
  Model: any,
  data: {
    page?: number;
    limit?: number;
    search?: string;
    category_id?: number;
  },
  id = "",
  login = ""
): Promise<{
  rows: any[];
  totalItems: number;
  currentPage: number;
  totalPages: number;
  limit: number;
}> => {
  try {
    const { page = 1, limit = 10, search = "", category_id } = data;

    // ✅ Pagination calculation
    const pageNum = Number(page);
    const limitNum = Math.min(Number(limit), 50); // safety limit
    const offset = (pageNum - 1) * limitNum;

    // -------------------------
    // MAIN WHERE
    // -------------------------
    const where: any = {};

    // 🔍 Search (case-insensitive)
    if (search) {
      where.name = {
        [Op.iLike]: `%${search}%`,
      };
    }

    // 👤 User filter
    if (id) {
      where.user_id = id;
    }

    // 🔐 Admin / Manager access
    if (login) {
      where[Op.and] = [
        {
          [Op.or]: [
            { adminId: login },
            { managerId: login },
          ],
        },
      ];
    }

    // -------------------------
    // INCLUDE CATEGORY FILTER
    // -------------------------
    const include: any[] = [];

    if (category_id) {
      include.push({
        model: Category,
        as: "categories",
        where: {
          id: Number(category_id),
          [Op.or]: [
            { adminId: login },
            { managerId: login },
          ],
        },
        through: { attributes: [] },
      });
    }

    // -------------------------
    // FETCH DATA + COUNT
    // -------------------------
    const { rows, count } = await Model.findAndCountAll({
      where,
      include: include.length ? include : undefined,
      limit: limitNum,
      offset,
      order: [["createdAt", "DESC"]],
      distinct: true, // important when using include
    });

    // -------------------------
    // RESPONSE
    // -------------------------
    return {
      rows,
      totalItems: count,
      currentPage: pageNum,
      totalPages: Math.ceil(count / limitNum),
      limit: limitNum,
    };

  } catch (error) {
    throw error;
  }
};


export const withuserlogin = async (
  model: any,
  id: any,
  data: any = {},
  searchFields: string[] = [],
  include: any[] = []
) => {
  try {
    const { page = 1, limit = 10, month, year, search, ...filters } = data;

    const whereConditions: any = {};

    if (id) {
      whereConditions.employee_id = id;
    }

    // Normal filters
    Object.keys(filters).forEach((key) => {
      if (filters[key] !== undefined && filters[key] !== "") {
        whereConditions[key] = filters[key];
      }
    });

    // Month filter
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      whereConditions.date = {
        [Op.between]: [startDate, endDate],
      };
    }

    // Search
    if (search && searchFields.length > 0) {
      whereConditions[Op.or] = searchFields.map((field) => ({
        [field]: { [Op.iRegexp]: `^${search}` },
      }));
    }

    const offset = (Number(page) - 1) * Number(limit);

    const rows = await model.findAll({
      where: whereConditions,
      include,
      limit: Number(limit),
      offset,
      order: [["createdAt", "DESC"]],
    });

    const count = rows.length;

    return {
      success: true,
      data: rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        totalRecords: count,
        totalPages: Math.ceil(count / Number(limit)),
      },
    };
  } catch (error) {
    console.error("Database Error:", error);
    throw error;
  }
};

export const getAllListCategory = async (model: any, data: any = {}, searchFields: string[] = []) => {
  try {
    const { page = 1, limit = 100, date, search, ...filters } = data;
    const whereConditions: any = { ...filters };
    if (date) {
      whereConditions.date = date; 
    }
    // 🔍 Add search functionality
    if (search && searchFields.length > 0) {
      whereConditions[Op.or] = searchFields.map((field) => ({
        [field]: { [Op.like]: `%${search}%` }, // Or Op.iLike if Postgres
      }));
    }
    const offset = (Number(page) - 1) * Number(limit);
    const { count, rows } = await model.findAndCountAll({
      where: whereConditions,
       include: [
    {
      model: SubCategory,
      as: "subCategories",
      required: false
    }
  ],
      limit: Number(limit),
      offset,
    });

   if (rows.length === 0) {
  throw new Error("Company does not exist");
}

    return {
      success: true,
      data: rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        totalRecords: count,
        totalPages: Math.ceil(count / Number(limit)),
      },
    };
  } catch (error) {
    console.error("Database Error:", error);
    throw error;
  }
};
export const getAllSubordinateIds = async (userId: number): Promise<number[]> => {
  let rootId = userId;
  let currentId = userId;

  // 1. Climb UP to find the 'admin' or 'manager' (Company Root)
  // This ensures that even a sale_person sees their entire team/company data.
  while (true) {
    const userWithCreators = await User.findByPk(currentId, {
      include: [
        {
          model: User,
          as: "creators",
          attributes: ["id", "role"],
          through: { attributes: [] },
        },
      ],
    }) as any;

    if (!userWithCreators) break;
    const creator = userWithCreators.creators?.[0];
    if (!creator) break;

    // Stop if we find an admin or manager (treating them as root of their team/company)
    if (["admin", "manager"].includes(creator.role)) {
      rootId = creator.id;
      break;
    }

    // Stop if we hit a super_admin (we don't want to include platform-wide data)
    if (creator.role === "super_admin") {
      break;
    }

    currentId = creator.id;
  }

  // 2. Fetch all subordinates DOWN from the rootId (Full hierarchy)
  let teamUserIds: number[] = [];
  
  // Check if root itself is not super_admin
  const rootUser = await User.findByPk(rootId);
  if (rootUser && rootUser.role !== "super_admin") {
    teamUserIds.push(rootId);
  }

  let queue: number[] = [rootId];
  let processedIds = new Set<number>([rootId]);

  while (queue.length > 0) {
    const pid = queue.shift()!;
    const userWithCreated = await User.findByPk(pid, {
      include: [
        {
          model: User,
          as: "createdUsers",
          attributes: ["id", "role"],
          through: { attributes: [] },
        },
      ],
    }) as any;

    if (userWithCreated?.createdUsers) {
      for (const child of userWithCreated.createdUsers) {
        if (!processedIds.has(child.id)) {
          processedIds.add(child.id);
          // Only include manager, sale_person, admin etc. but NOT super_admin
          if (child.role !== "super_admin") {
            teamUserIds.push(child.id);
            queue.push(child.id);
          } else {
            // Even if we don't include super_admin in results, we might want to crawl their children?
            // Usually super_admin is the top, so we won't hit them going DOWN anyway.
          }
        }
      }
    }
  }

  return teamUserIds;
};
