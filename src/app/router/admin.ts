import { Router } from "express";
const router = Router();
import * as AdminController from '../controller/admin'
import { tokenCheck } from "../../config/jwtVerify";
import getUploadMiddleware  from "../../config/fileUploads";
// const uploadPdf = getUploadMiddleware("pdf", 50, 1); // 50 MB max, 1 file

router.post(
    "/register",
    AdminController.Register
);

router.post(
    "/login",
    AdminController.Login
);

router.get(
    "/getProfile",
    tokenCheck,
    AdminController.GetProfile
);

router.patch(
    "/updatepassword",
    tokenCheck,
    AdminController.UpdatePassword
);

router.post(
    "/addcategory",
    tokenCheck,
    AdminController.AddCategory
);

router.get(
    "/getcategory",
    tokenCheck,
    AdminController.getcategory
);

router.get(
    "/getcategoy/:id",
    tokenCheck,
    AdminController.categoryDetails
);

router.patch(
    "/updatecategory/:id",
    tokenCheck,
    AdminController.UpdateCategory
);

router.delete(
    "/deletecategory/:id",
    tokenCheck,
    AdminController.DeleteCategory
);


router.post(
    "/addpropertytype",
    tokenCheck,
    AdminController.AddProperty
);

router.get(
    "/getpropetytype",
    tokenCheck,
    AdminController.getPropertylist
);


router.get(
    "/getpropertydetails/:id",
    tokenCheck,
    AdminController.PropertyDetails
);

router.delete(
    "/deleteproperty/:id",
    tokenCheck,
    AdminController.deleteProperty
);

router.patch(
    "/updateproperty/:id",
    tokenCheck,
    AdminController.UpdateProperty
);

// router.get(
//     "/get",
//     uploadPdf.single("pdf"),
//     AdminController.Pdf
// );

router.post(
    "/addFlat",
    tokenCheck,
    AdminController.addFlat
);

router.get(
    "/flatList",
    tokenCheck,
    AdminController.getFlatList
);
router.get(
    "/flatdetails/:id",
    tokenCheck,
    AdminController.FlatDetails
);
router.patch(
    "/updateflat/:id",
    tokenCheck,
    AdminController.UpdateFlat
);
router.delete(
    "/flatdelete/:id",
    tokenCheck,
    AdminController.flatDelete
);


router.post(
    "/addamenities",
    tokenCheck,
    AdminController.addamenities
);

router.get(
    "/amenitiesList",
    tokenCheck,
    AdminController.amenitiesList
);
router.get(
    "/amenitiesdetails/:id",
    tokenCheck,
    AdminController.amenitiesdetails
);
router.patch(
    "/updateamenities/:id",
    tokenCheck,
    AdminController.updateamenities
);
router.delete(
    "/amenitiesdelete/:id",
    tokenCheck,
    AdminController.amenitiesdelete
);

router.post(
    "/addproperty",
    tokenCheck,
    AdminController.AddPropertys
);

router.post(
    "/addproject",
    tokenCheck,
    AdminController.addProdut
);

export default router;