export const authorize = (...roles) => {
  return (req, res, next) => {
    // Flatten roles array in case it's nested
    const flattenedRoles = roles.flat();

    console.log(`[AUTHORIZE] Required roles: ${flattenedRoles}`);
    console.log(`[AUTHORIZE] User role: ${req.user?.role}`);
    console.log(
      "[AUTHORIZE] roles array:",
      flattenedRoles,
      "type:",
      typeof flattenedRoles[0]
    );
    console.log(
      "[AUTHORIZE] roles[0]:",
      flattenedRoles[0],
      "is array:",
      Array.isArray(flattenedRoles[0])
    );
    console.log(
      "[AUTHORIZE] req.user.role:",
      req.user.role,
      "type:",
      typeof req.user.role
    );

    if (!flattenedRoles.includes(req.user.role)) {
      console.log(
        `[AUTHORIZE] Access denied for role: ${req.user.role}. Allowed: ${flattenedRoles}`
      );
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`,
      });
    }

    console.log(
      `[AUTHORIZE] Access granted to user with role: ${req.user.role}`
    );
    next();
  };
};

export const checkPharmacyVerification = async (req, res, next) => {
  console.log(`[CHECK PHARMACY VERIFICATION] Role: ${req.user?.role}`);
  if (req.user.role === "pharmacy") {
    console.log(req.user);
    console.log(
      `[CHECK PHARMACY VERIFICATION] isVerified: ${req.user?.isEmailVerified}`
    );
    // console.log(
    //   `[CHECK PHARMACY VERIFICATION] isVerified: ${req.user?.isVerified}`
    // );

    if (!req.user.isEmailVerified) {
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
