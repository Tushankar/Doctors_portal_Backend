export const authorize = (...roles) => {
  return (req, res, next) => {
    // console.log(`[AUTHORIZE] Required roles: ${roles}`);
    // console.log(`[AUTHORIZE] User role: ${req.user?.role}`);

    if (!roles.includes(req.user.role)) {
      // console.log(
      //   `[AUTHORIZE] Access denied for role: ${req.user.role}. Allowed: ${roles}`
      // );
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`,
      });
    }

    // console.log(
    //   `[AUTHORIZE] Access granted to user with role: ${req.user.role}`
    // );
    next();
  };
};

export const checkPharmacyVerification = async (req, res, next) => {
  console.log(`[CHECK PHARMACY VERIFICATION] Role: ${req.user?.role}`);
  if (req.user.role === "pharmacy") {
    // console.log(
    //   `[CHECK PHARMACY VERIFICATION] isVerified: ${req.user?.isVerified}`
    // );

    if (!req.user.isVerified) {
      // console.log(`[CHECK PHARMACY VERIFICATION] Pharmacy not verified`, user);
      return res.status(403).json({
        success: false,
        message: "Your pharmacy registration is pending verification",
      });
    }
  }

  console.log(
    `[CHECK PHARMACY VERIFICATION] Pharmacy verified or not applicable`
  );
  next();
};
