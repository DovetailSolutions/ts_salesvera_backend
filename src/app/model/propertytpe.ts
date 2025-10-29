import { Sequelize, DataTypes,BelongsToManyRemoveAssociationsMixin,BelongsToManyAddAssociationsMixin,BelongsToManyRemoveAssociationMixin, Model,BelongsToManySetAssociationsMixin,BelongsToManyAddAssociationMixin,BelongsToManyGetAssociationsMixin } from "sequelize";
import{Category} from "./category"

export class PropertyType extends Model {
  public id!: number;
  public name!: string;
  public getCategories!: BelongsToManyGetAssociationsMixin<Category>; // property.getCategories()
  public setCategories!: BelongsToManySetAssociationsMixin<Category, number>; // property.setCategories([ids])
  public addCategory!: BelongsToManyAddAssociationMixin<Category, number>; // property.addCategory(id)
  public addCategories!: BelongsToManyAddAssociationsMixin<Category, number>; // property.addCategories([ids])
  public removeCategory!: BelongsToManyRemoveAssociationMixin<Category, number>; // property.removeCategory(id)
  public removeCategories!: BelongsToManyRemoveAssociationsMixin<Category, number>; 
}




export const PropertyTypeModel = (sequelize: Sequelize) => {
  PropertyType.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      }
    },
    {
      tableName: "property_types", // ✅ Fixed table name
      sequelize,                  // ✅ Bind model to Sequelize instance
      timestamps: true,
    }
  );

  return PropertyType;
};
