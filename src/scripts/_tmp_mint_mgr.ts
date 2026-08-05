import * as Middleware from "../app/middlewear/comman";
const t = Middleware.CreateToken("13", "manager", 2);
console.log(t.accessToken);
