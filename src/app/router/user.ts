import { Router } from "express";
const router = Router();
import * as Controller from '../controller/user'
import { tokenCheck } from "../../config/jwtVerify2";
import getUploadMiddleware  from "../../config/fileUploads";
// const uploadPdf = getUploadMiddleware("pdf", 50, 1); // 50 MB max, 1 file

router.post(
    "/register",
    Controller.Register
);
router.post(
    "/login",
    Controller.Login
);
router.get(
    "/getprofile",
    tokenCheck,
    Controller.GetProfile
);
router.patch(
    "/updateprofile",
    tokenCheck,
    Controller.UpdateProfile
);

router.get(
    "/mysaleperson",
    tokenCheck,
    Controller.MySalePerson
);














































router.post(
    "/addproperty",
    tokenCheck,
    Controller.AddPropertys
);

router.post(
    "/addproject",
    tokenCheck,
    Controller.addProdut
);
router.get(
    "/projectlist",
    tokenCheck,
    Controller.getProjectList
);

router.get(
    "/getprojectdetails/:id",
    tokenCheck,
    Controller.getProjectDetails
);
  
router.patch(
    "/updateProejct/:id",
    tokenCheck,
    Controller.updateProduct
);

router.delete(
    "/deleteproduct/:id",
    tokenCheck,
    Controller.deleteProduct
);

export default router;