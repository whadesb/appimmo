module.exports = function isAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  // Redirection multilingue dynamique
  const locale = req.params.locale || 'fr';
  return res.redirect(`/${locale}/login`);
};
