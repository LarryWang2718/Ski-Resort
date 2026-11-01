const { validationResult } = require('express-validator');

// Ends the request with a 400 listing every failed rule, or passes it on
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  const details = errors.array().map((error) => ({
    field: error.path,
    message: error.msg
  }));

  return res.status(400).json({
    success: false,
    message: details[0].message,
    errors: details
  });
};

module.exports = validate;
