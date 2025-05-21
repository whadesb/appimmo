module.exports = function isAuthenticated(req, res, next) {
  if (req.user) {
    return next();
  }

  const locale = req.params?.locale || 'fr';
  return res.redirect(`/${locale}/login`);
};
