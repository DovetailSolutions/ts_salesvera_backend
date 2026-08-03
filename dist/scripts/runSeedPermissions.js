"use strict";
/**
 * One-off runner: seed the permissions table without booting the full server.
 *
 * Run with:
 *   npx ts-node src/scripts/runSeedPermissions.ts
 *
 * Safe to re-run — seedPermissions() uses findOrCreate per module+action.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const dbConnection_1 = require("../config/dbConnection");
const seedPermissions_1 = require("../config/seedPermissions");
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        yield dbConnection_1.sequelize.authenticate();
        console.log("Connected to database.\n");
        yield (0, seedPermissions_1.seedPermissions)();
        yield dbConnection_1.sequelize.close();
        console.log("\nDone.");
    });
}
run().catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
});
