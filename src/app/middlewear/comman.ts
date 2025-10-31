import { Model,FindOptions,Op,WhereOptions  ,Sequelize ,CreationAttributes,Includeable } from "sequelize";
import jwt from "jsonwebtoken";
import { User, Category,PropertyType } from "../../config/dbConnection";

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
  fieldValue: string
): Promise<any> => {
  try {
    // Normalize value: lowercase + remove spaces
    const normalizedValue = fieldValue.replace(/\s+/g, "").toLowerCase();

    return await model.findOne({
      where: Sequelize.where(
        Sequelize.fn(
          "REPLACE",
          Sequelize.fn("LOWER", Sequelize.col(fieldName)),
          " ",
          ""
        ),
        normalizedValue
      ),
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
    { expiresIn: "1d" } // short-lived
  );

  const refreshToken = jwt.sign(
    { userId, role },
    process.env.JWT_SECRET || "dovetailPharma",
    { expiresIn: "7d" } // long-lived
  );

  return { accessToken, refreshToken };
};

// crate data 
export const CreateData = async <T extends Model>(
  model: { create(values?: CreationAttributes<T>): Promise<T> },
  data: CreationAttributes<T>
): Promise<T> => {
  try {
    console.log("Creating data with:", JSON.stringify(data, null, 2));
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

    console.log(rows.length)
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
    // console.log(">>>>>>>>>>>>>>>>>>count",count)
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
  data: { page?: number; limit?: number; search?: string; category_id?: number },
  id=""
): Promise<{
  rows: any[];
  pagination: {
    totalItems: number;
    currentPage: number;
    totalPages: number;
    limit: number;
  };
}> => {
  try {
    const { page = 1, limit = 10, search = "", category_id } = data;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    const where: any = {};
    if (search) {
      where.name = { [Op.iLike]: `%${search}%` };
    }

    if(id){
      where.user_id = id
    }

    // ✅ If filtering by category_id, use include instead of where
    const include: any[] = [];
    if (category_id) {
      include.push({
        model: Category,
        as: "categories",
        where: { id: Number(category_id) },
        through: { attributes: [] }, // hides junction table fields
      });
    }

    // ✅ Total count with include
    const totalItems = await Model.count({
      where,
      include: include.length ? include : undefined,
      distinct: true,
    });

    // ✅ Fetch rows with pagination & include
    const rows = await Model.findAll({
      where,
      include: include.length ? include : undefined,
      limit: limitNum,
      offset,
      order: [["createdAt", "DESC"]],
    });

    return {
      rows,
      pagination: {
        totalItems,
        currentPage: pageNum,
        totalPages: Math.ceil(totalItems / limitNum),
        limit: limitNum,
      },
    };
  } catch (error) {
    throw error;
  }
};


export const withuserlogin = async (
  model: any,
  id:any,
  data: any = {},
  searchFields: string[] = [],
  include: any[] = []
) => {
  try {
    const { page = 1, limit = 10, date, search, ...filters } = data;

    const whereConditions: any = {};
    if(id){
      whereConditions.employee_id = id
    }

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

    console.log(rows.length)
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

